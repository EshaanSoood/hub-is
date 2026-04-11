const rawApiBaseUrl = process.env.HUB_API_BASE_URL ?? process.env.PLAYWRIGHT_BASE_URL;
if (!rawApiBaseUrl) {
  throw new Error(
    'Missing HUB_API_BASE_URL or PLAYWRIGHT_BASE_URL for Hub Home Daily Brief E2E helpers. Refusing to run against an implicit host.',
  );
}

const API_BASE_URL = rawApiBaseUrl.replace(/\/$/, '');

interface HubEnvelope<T> {
  ok: boolean;
  data: T | null;
  error?: {
    code?: string;
    message?: string;
  } | null;
}

interface HubCollection {
  collection_id: string;
  name: string;
}

const toUrl = (path: string): string => `${API_BASE_URL}${path}`;

const pickTaskCollection = (collections: HubCollection[]): HubCollection => {
  const ranked = collections.find((collection) => /task|todo/i.test(`${collection.name} ${collection.collection_id}`));
  if (ranked) {
    return ranked;
  }
  throw new Error(
    `No task/todo collection found in project collections: ${
      collections.map((collection) => `${collection.name}:${collection.collection_id}`).join(', ') || '<none>'
    }`,
  );
};

const toError = async (response: Response): Promise<Error> => {
  const text = await response.text();
  const compactBody = text.slice(0, 400).replace(/\s+/g, ' ').trim();
  return new Error(`API request failed (${response.status} ${response.statusText}): ${compactBody || '<empty response>'}`);
};

const apiRequest = async <T>(
  token: string,
  path: string,
  init?: {
    method?: 'GET' | 'POST' | 'PATCH';
    body?: string;
  },
): Promise<T> => {
  const response = await fetch(toUrl(path), {
    method: init?.method || 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(init?.body ? { body: init.body } : {}),
  });

  if (!response.ok) {
    throw await toError(response);
  }

  const payload = (await response.json()) as HubEnvelope<T> | T;
  if (
    payload
    && typeof payload === 'object'
    && 'ok' in payload
    && 'data' in payload
  ) {
    const envelope = payload as HubEnvelope<T>;
    if (!envelope.ok || !envelope.data) {
      throw new Error(envelope.error?.message || envelope.error?.code || 'Hub API returned ok=false');
    }
    return envelope.data;
  }

  return payload as T;
};

const listProjectCollections = async (token: string, projectId: string): Promise<HubCollection[]> => {
  const data = await apiRequest<{ collections: HubCollection[] }>(
    token,
    `/api/hub/projects/${encodeURIComponent(projectId)}/collections`,
  );
  return data.collections;
};

export const createTaskInProject = async (
  token: string,
  projectId: string,
  payload: { title: string; due_at: string; priority?: string | null; status?: string },
): Promise<{ record_id: string; project_id: string }> => {
  const collections = await listProjectCollections(token, projectId);
  const taskCollection = pickTaskCollection(collections);

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
