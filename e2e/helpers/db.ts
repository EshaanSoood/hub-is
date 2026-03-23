const rawApiBaseUrl = process.env.HUB_API_BASE_URL ?? process.env.PLAYWRIGHT_BASE_URL;
if (!rawApiBaseUrl) {
  throw new Error(
    'Missing HUB_API_BASE_URL or PLAYWRIGHT_BASE_URL for E2E API helpers. Refusing to run against an implicit host.',
  );
}

const API_BASE_URL = rawApiBaseUrl.replace(/\/$/, '');
const timeoutFromEnv = Number.parseInt(process.env.HUB_API_REQUEST_TIMEOUT_MS || '15000', 10);
const API_REQUEST_TIMEOUT_MS = Number.isFinite(timeoutFromEnv) && timeoutFromEnv > 0 ? timeoutFromEnv : 15_000;

interface HubEnvelope<T> {
  ok: boolean;
  data: T | null;
  error?: {
    code?: string;
    message?: string;
  } | null;
}

export interface HubTaskSummary {
  record_id: string;
  title: string;
  project_id: string | null;
  task_state: {
    status: string;
    priority: string | null;
    due_at: string | null;
  };
}

export interface HubReminderSummary {
  reminder_id: string;
  record_id: string;
  record_title: string;
  project_id: string;
  remind_at: string;
  overdue: boolean;
}

interface HubCollection {
  collection_id: string;
  name: string;
}

interface HubHomeResponse {
  home: {
    personal_project_id: string | null;
    tasks: HubTaskSummary[];
    tasks_next_cursor: string | null;
    captures: Array<Record<string, unknown>>;
    events: Array<Record<string, unknown>>;
    notifications: Array<Record<string, unknown>>;
  };
}

const toUrl = (path: string): string => `${API_BASE_URL}${path}`;

const toError = async (response: Response): Promise<Error> => {
  const text = await response.text();
  const compactBody = text.slice(0, 400).replace(/\s+/g, ' ').trim();
  return new Error(`API request failed (${response.status} ${response.statusText}): ${compactBody || '<empty response>'}`);
};

const apiRequest = async <T>(
  token: string,
  path: string,
  init?: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    body?: string;
  },
): Promise<T> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, API_REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(toUrl(path), {
      method: init?.method || 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(init?.body ? { body: init.body } : {}),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`API request timed out after ${API_REQUEST_TIMEOUT_MS}ms for ${path}`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw await toError(response);
  }

  if (response.status === 204) {
    return {} as T;
  }

  const payload = (await response.json()) as HubEnvelope<T> | T;
  if (
    payload
    && typeof payload === 'object'
    && 'ok' in payload
    && 'data' in payload
  ) {
    const envelope = payload as HubEnvelope<T>;
    if (!envelope.ok) {
      throw new Error(envelope.error?.message || envelope.error?.code || 'Hub API returned ok=false');
    }
    if (envelope.data === null || envelope.data === undefined) {
      throw new Error('Hub API envelope did not include data');
    }
    return envelope.data;
  }

  return payload as T;
};

const pickTaskCollection = (collections: HubCollection[]): HubCollection | null => {
  const ranked = collections.find((collection) => /task|todo/i.test(`${collection.name} ${collection.collection_id}`));
  return ranked || collections[0] || null;
};

export const getHubHome = async (
  token: string,
  options?: {
    tasks_limit?: number;
    events_limit?: number;
    captures_limit?: number;
    notifications_limit?: number;
  },
): Promise<HubHomeResponse['home']> => {
  const params = new URLSearchParams();
  params.set('tasks_limit', String(options?.tasks_limit ?? 20));
  params.set('events_limit', String(options?.events_limit ?? 20));
  params.set('captures_limit', String(options?.captures_limit ?? 20));
  params.set('notifications_limit', String(options?.notifications_limit ?? 20));

  const data = await apiRequest<HubHomeResponse>(token, `/api/hub/home?${params.toString()}`);
  return data.home;
};

export const getLatestTasks = async (token: string, limit = 10): Promise<HubTaskSummary[]> => {
  const home = await getHubHome(token, { tasks_limit: limit });
  return home.tasks.slice(0, limit);
};

export const getLatestReminders = async (token: string, limit = 10): Promise<HubReminderSummary[]> => {
  const data = await apiRequest<{ reminders: HubReminderSummary[] }>(token, '/api/hub/reminders');
  return data.reminders.slice(0, limit);
};

export const createReminderViaApi = async (
  token: string,
  payload: { title: string; remind_at: string },
): Promise<HubReminderSummary> => {
  const data = await apiRequest<{ reminder?: HubReminderSummary } & Partial<HubReminderSummary>>(token, '/api/hub/reminders', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (data.reminder) {
    return data.reminder;
  }
  if (data.reminder_id && data.record_id && data.remind_at) {
    return {
      reminder_id: data.reminder_id,
      record_id: data.record_id,
      record_title: data.record_title || payload.title,
      project_id: data.project_id || '',
      remind_at: data.remind_at,
      overdue: Boolean(data.overdue),
    };
  }
  throw new Error('Reminder create response missing reminder payload');
};

export const dismissReminderViaApi = async (token: string, reminderId: string): Promise<void> => {
  const result = await apiRequest<{ dismissed: boolean; reminder_id: string }>(
    token,
    `/api/hub/reminders/${encodeURIComponent(reminderId)}/dismiss`,
    {
    method: 'POST',
    body: JSON.stringify({}),
    },
  );
  if (!result.dismissed) {
    throw new Error(`Reminder ${reminderId} was not dismissed.`);
  }
  if (result.reminder_id !== reminderId) {
    throw new Error(`Dismissed reminder id mismatch: expected ${reminderId}, got ${result.reminder_id}`);
  }
};

const listProjectCollections = async (token: string, projectId: string): Promise<HubCollection[]> => {
  const data = await apiRequest<{ collections: HubCollection[] }>(
    token,
    `/api/hub/projects/${encodeURIComponent(projectId)}/collections`,
  );
  return data.collections;
};

export const createTaskInPersonalProject = async (
  token: string,
  payload: { title: string; due_at: string; priority?: string | null; status?: string },
): Promise<{ record_id: string; project_id: string }> => {
  const home = await getHubHome(token, { tasks_limit: 1, events_limit: 1, captures_limit: 1, notifications_limit: 1 });
  const projectId = home.personal_project_id;
  if (!projectId) {
    throw new Error('Expected personal_project_id from /api/hub/home');
  }

  const collections = await listProjectCollections(token, projectId);
  const taskCollection = pickTaskCollection(collections);
  if (!taskCollection) {
    throw new Error(`No collections found in project ${projectId}`);
  }

  const created = await apiRequest<{ record_id: string }>(
    token,
    `/api/hub/projects/${encodeURIComponent(projectId)}/records`,
    {
      method: 'POST',
      body: JSON.stringify({
        collection_id: taskCollection.collection_id,
        title: payload.title,
        capability_types: ['task'],
        task_state: {
          status: payload.status || 'todo',
          priority: payload.priority ?? 'medium',
          due_at: payload.due_at,
        },
      }),
    },
  );

  return { record_id: created.record_id, project_id: projectId };
};

export const archiveRecordViaApi = async (token: string, recordId: string): Promise<void> => {
  await apiRequest<{ record: Record<string, unknown> }>(token, `/api/hub/records/${encodeURIComponent(recordId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ archived: true }),
  });
};

export const archiveMostRecentTaskByTitle = async (token: string, title: string): Promise<void> => {
  const tasks = await getLatestTasks(token, 50);
  const found = tasks.find((task) => task.title.trim() === title.trim());
  if (found?.record_id) {
    await archiveRecordViaApi(token, found.record_id);
  }
};

export const archiveMostRecentTaskByTitleIncludes = async (token: string, needle: string): Promise<void> => {
  const lowerNeedle = needle.toLowerCase();
  const tasks = await getLatestTasks(token, 50);
  const found = tasks.find((task) => task.title.toLowerCase().includes(lowerNeedle));
  if (found?.record_id) {
    await archiveRecordViaApi(token, found.record_id);
  }
};
