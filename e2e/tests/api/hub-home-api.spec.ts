import { expect, test } from '@playwright/test';
import { HUB_API_BASE_URL, HubApiClient, type HubEnvelope, loadTokenFromLocalEnv } from '../../helpers/api-client';

interface HubHomeTask {
  record_id: string;
  title: string;
  space_id: string | null;
  space_name: string | null;
  task_state: {
    status: string;
    priority: string | null;
    due_at: string | null;
  };
  updated_at: string;
}

interface HubHomeEvent {
  record_id: string;
  title: string;
  space_id: string;
  space_name: string | null;
  event_state: {
    start_dt: string;
    end_dt: string;
    timezone: string;
  };
  updated_at: string;
}

interface HubHomeCapture {
  record_id: string;
  title: string;
  space_id: string;
  collection_id: string;
  created_at: string;
}

interface HubHomePayload {
  home: {
    personal_space_id: string | null;
    tasks: HubHomeTask[];
    events: HubHomeEvent[];
    captures: HubHomeCapture[];
  };
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const uniqueTitle = (prefix: string): string =>
  `${prefix} ${new Date().toISOString()} ${Math.random().toString(36).slice(2, 10)}`;

const parseEnvelope = async <T>(response: Response): Promise<HubEnvelope<T> | null> => {
  const raw = await response.text();
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as HubEnvelope<T>;
  } catch {
    return null;
  }
};

const extractRecordId = (data: unknown): string => {
  if (!data || typeof data !== 'object') {
    throw new Error('Task create response data is missing.');
  }
  const payload = data as {
    record_id?: unknown;
    record?: { record_id?: unknown };
    task?: { record_id?: unknown };
  };
  if (typeof payload.record_id === 'string') {
    return payload.record_id;
  }
  if (typeof payload.record?.record_id === 'string') {
    return payload.record.record_id;
  }
  if (typeof payload.task?.record_id === 'string') {
    return payload.task.record_id;
  }
  throw new Error('Could not locate task record_id in response.');
};

test.describe('myHub data contract tests', () => {
  let client: HubApiClient;
  let personalSpaceId = '';
  const createdRecordIds = new Set<string>();

  const getHome = async (): Promise<HubHomePayload['home']> => {
    const response = await client.get('/api/hub/home?tasks_limit=50&events_limit=50&captures_limit=50');
    expect(response.status).toBe(200);
    const envelope = await parseEnvelope<HubHomePayload>(response);
    expect(envelope?.ok).toBe(true);
    expect(envelope?.data).toBeTruthy();
    return (envelope as HubEnvelope<HubHomePayload>).data!.home;
  };

  const waitForTaskInHome = async (recordId: string): Promise<HubHomeTask | null> => {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const home = await getHome();
      const task = home.tasks.find((item) => item.record_id === recordId);
      if (task) {
        return task;
      }
      await sleep(250);
    }
    return null;
  };

  test.beforeAll(async () => {
    const token = await loadTokenFromLocalEnv('TOKEN_A');
    client = new HubApiClient(HUB_API_BASE_URL, token);

    const home = await getHome();
    personalSpaceId = String(home.personal_space_id || '');
    expect(personalSpaceId).toBeTruthy();
  });

  test.afterEach(async () => {
    for (const recordId of createdRecordIds) {
      await client.patch(`/api/hub/records/${encodeURIComponent(recordId)}`, { archived: true });
    }
    createdRecordIds.clear();
  });

  test('GET /api/hub/home returns expected shape', async () => {
    const home = await getHome();

    expect(Array.isArray(home.tasks)).toBe(true);
    expect(Array.isArray(home.events)).toBe(true);
    expect(Array.isArray(home.captures)).toBe(true);
    expect(typeof home.personal_space_id).toBe('string');

    for (const task of home.tasks) {
      expect(typeof task.record_id).toBe('string');
      expect(typeof task.title).toBe('string');
      expect('space_id' in task).toBe(true);
      expect('space_name' in task).toBe(true);
      expect(typeof task.updated_at).toBe('string');
      expect(task.task_state).toBeTruthy();
      expect(typeof task.task_state.status).toBe('string');
      expect('priority' in task.task_state).toBe(true);
      expect('due_at' in task.task_state).toBe(true);
    }

    for (const event of home.events) {
      expect(typeof event.record_id).toBe('string');
      expect(typeof event.title).toBe('string');
      expect(typeof event.space_id).toBe('string');
      expect('space_name' in event).toBe(true);
      expect(typeof event.updated_at).toBe('string');
      expect(event.event_state).toBeTruthy();
      expect(typeof event.event_state.start_dt).toBe('string');
      expect(typeof event.event_state.end_dt).toBe('string');
      expect(typeof event.event_state.timezone).toBe('string');
    }
  });

  test('GET /api/hub/home includes tasks from personal project', async () => {
    const createResponse = await client.post('/api/hub/tasks', {
      space_id: personalSpaceId,
      title: uniqueTitle('api-home-personal-task'),
      status: 'todo',
      priority: 'medium',
      due_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
      category: 'personal',
    });
    expect(createResponse.status).toBe(201);

    const createEnvelope = await parseEnvelope<unknown>(createResponse);
    expect(createEnvelope?.ok).toBe(true);
    const recordId = extractRecordId(createEnvelope?.data);
    createdRecordIds.add(recordId);

    const task = await waitForTaskInHome(recordId);
    expect(task).toBeTruthy();
    expect(task?.space_id).toBe(personalSpaceId);
  });

  test('GET /api/hub/home includes both assigned and created tasks', async () => {
    const createResponse = await client.post('/api/hub/tasks', {
      space_id: personalSpaceId,
      title: uniqueTitle('api-home-assigned-created-task'),
      status: 'todo',
      priority: 'high',
      assignee_user_ids: [],
      assignment_user_ids: [],
    });
    expect(createResponse.status).toBe(201);

    const createEnvelope = await parseEnvelope<unknown>(createResponse);
    expect(createEnvelope?.ok).toBe(true);
    const recordId = extractRecordId(createEnvelope?.data);
    createdRecordIds.add(recordId);

    const task = await waitForTaskInHome(recordId);
    expect(task).toBeTruthy();
    expect(task?.record_id).toBe(recordId);
  });
});
