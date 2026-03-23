import { expect, test } from '@playwright/test';
import { HUB_API_BASE_URL, HubApiClient, type HubEnvelope, loadTokenFromLocalEnv } from '../../helpers/api-client';

interface HubTaskSummary {
  record_id: string;
  title: string;
  project_id: string | null;
  project_name: string | null;
  task_state: {
    status: string;
    priority: string | null;
    due_at: string | null;
  };
  assignments?: Array<{ user_id: string; assigned_at: string }>;
}

interface HubHomePayload {
  home: {
    personal_project_id: string | null;
    tasks: HubTaskSummary[];
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

const extractRecordIdFromCreateResponse = (data: unknown): string => {
  if (!data || typeof data !== 'object') {
    throw new Error('Task create response data is missing.');
  }

  const maybeData = data as {
    record_id?: unknown;
    record?: { record_id?: unknown };
    task?: { record_id?: unknown };
  };

  if (typeof maybeData.record_id === 'string') {
    return maybeData.record_id;
  }
  if (typeof maybeData.record?.record_id === 'string') {
    return maybeData.record.record_id;
  }
  if (typeof maybeData.task?.record_id === 'string') {
    return maybeData.task.record_id;
  }
  throw new Error('Could not locate record_id in task create response.');
};

test.describe('Task API contract tests', () => {
  let client: HubApiClient;
  let personalProjectId = '';
  let creatorUserId = '';
  const createdRecordIds = new Set<string>();

  const getHome = async (): Promise<HubHomePayload['home']> => {
    const response = await client.get('/api/hub/home?tasks_limit=50&events_limit=20&captures_limit=20');
    expect(response.status).toBe(200);
    const envelope = await parseEnvelope<HubHomePayload>(response);
    expect(envelope?.ok).toBe(true);
    expect(envelope?.data).toBeTruthy();
    return (envelope as HubEnvelope<HubHomePayload>).data!.home;
  };

  const waitForTaskInHome = async (recordId: string): Promise<HubTaskSummary | null> => {
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

    const meResponse = await client.get('/api/hub/me');
    expect(meResponse.status).toBe(200);
    const meEnvelope = await parseEnvelope<{ sessionSummary?: { userId?: string }; user?: { user_id?: string } }>(meResponse);
    expect(meEnvelope?.ok).toBe(true);
    creatorUserId =
      meEnvelope?.data?.sessionSummary?.userId
      || meEnvelope?.data?.user?.user_id
      || '';
    expect(creatorUserId).toBeTruthy();

    const home = await getHome();
    personalProjectId = String(home.personal_project_id || '');
    expect(personalProjectId).toBeTruthy();
  });

  test.afterEach(async () => {
    for (const recordId of createdRecordIds) {
      await client.patch(`/api/hub/records/${encodeURIComponent(recordId)}`, { archived: true });
    }
    createdRecordIds.clear();
  });

  test('POST /api/hub/tasks creates a task with all fields', async () => {
    const payload = {
      project_id: personalProjectId,
      title: uniqueTitle('api-task-all-fields'),
      status: 'todo',
      priority: 'high',
      due_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      category: 'contract',
    };

    const createResponse = await client.post('/api/hub/tasks', payload);
    expect(createResponse.status).toBe(201);

    const envelope = await parseEnvelope<{ record?: { record_id: string; title: string } }>(createResponse);
    expect(envelope?.ok).toBe(true);
    expect(envelope?.data?.record).toBeTruthy();
    expect(envelope?.data?.record?.title).toBe(payload.title);
    expect(envelope?.data?.record?.record_id).toMatch(/^rec_/);

    const recordId = extractRecordIdFromCreateResponse(envelope?.data);
    createdRecordIds.add(recordId);
  });

  test('POST /api/hub/tasks auto-creates collection if none exists', async () => {
    const projectResponse = await client.post('/api/hub/projects', {
      name: uniqueTitle('api-project-auto-collection'),
    });
    expect(projectResponse.status).toBe(201);

    const projectEnvelope = await parseEnvelope<{ project?: { project_id: string }; project_id?: string }>(projectResponse);
    expect(projectEnvelope?.ok).toBe(true);
    const projectId =
      projectEnvelope?.data?.project?.project_id
      || projectEnvelope?.data?.project_id
      || '';
    expect(projectId).toBeTruthy();

    const createResponse = await client.post('/api/hub/tasks', {
      project_id: projectId,
      title: uniqueTitle('api-task-auto-collection'),
      status: 'todo',
      priority: 'medium',
      due_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      category: 'ops',
    });
    expect(createResponse.status).toBe(201);

    const createEnvelope = await parseEnvelope<unknown>(createResponse);
    expect(createEnvelope?.ok).toBe(true);
    const recordId = extractRecordIdFromCreateResponse(createEnvelope?.data);
    createdRecordIds.add(recordId);
  });

  test('POST /api/hub/tasks auto-assigns to creator when no assignees provided', async () => {
    const createResponse = await client.post('/api/hub/tasks', {
      project_id: personalProjectId,
      title: uniqueTitle('api-task-auto-assignee'),
      status: 'todo',
      priority: 'low',
      assignee_user_ids: [],
      assignment_user_ids: [],
    });
    expect(createResponse.status).toBe(201);

    const createEnvelope = await parseEnvelope<unknown>(createResponse);
    expect(createEnvelope?.ok).toBe(true);
    const recordId = extractRecordIdFromCreateResponse(createEnvelope?.data);
    createdRecordIds.add(recordId);

    const recordResponse = await client.get(`/api/hub/records/${encodeURIComponent(recordId)}`);
    expect(recordResponse.status).toBe(200);
    const recordEnvelope = await parseEnvelope<{
      record: {
        capabilities?: {
          assignments?: Array<{ user_id: string; assigned_at: string }>;
        };
      };
    }>(recordResponse);
    expect(recordEnvelope?.ok).toBe(true);

    const assignments = recordEnvelope?.data?.record?.capabilities?.assignments || [];
    expect(assignments.some((assignment) => assignment.user_id === creatorUserId)).toBe(true);
  });

  test('POST /api/hub/tasks rejects missing title', async () => {
    const createResponse = await client.post('/api/hub/tasks', {
      project_id: personalProjectId,
      status: 'todo',
      priority: 'medium',
    });
    expect(createResponse.status).toBe(400);

    const envelope = await parseEnvelope<unknown>(createResponse);
    expect(envelope?.ok).toBe(false);
    expect(String(envelope?.error?.message || '').toLowerCase()).toContain('title');
  });

  test('POST /api/hub/tasks rejects invalid due_at', async () => {
    const createResponse = await client.post('/api/hub/tasks', {
      project_id: personalProjectId,
      title: uniqueTitle('api-task-invalid-due-at'),
      status: 'todo',
      priority: 'high',
      due_at: 'not a date',
      category: 'contract',
    });
    expect(createResponse.status).toBe(400);
  });

  test('POST /api/hub/tasks preserves due_at with correct timezone', async () => {
    const dueAt = '2026-03-22T18:00:00.000Z';
    const createResponse = await client.post('/api/hub/tasks', {
      project_id: personalProjectId,
      title: uniqueTitle('api-task-due-at-timezone'),
      status: 'todo',
      priority: 'medium',
      due_at: dueAt,
      category: 'timezone',
    });
    expect(createResponse.status).toBe(201);

    const createEnvelope = await parseEnvelope<unknown>(createResponse);
    expect(createEnvelope?.ok).toBe(true);
    const recordId = extractRecordIdFromCreateResponse(createEnvelope?.data);
    createdRecordIds.add(recordId);

    const task = await waitForTaskInHome(recordId);
    expect(task).toBeTruthy();
    expect(task?.task_state?.due_at).toBe(dueAt);
  });

  test('GET /api/hub/home returns tasks created by user', async () => {
    const createResponse = await client.post('/api/hub/tasks', {
      project_id: personalProjectId,
      title: uniqueTitle('api-home-task-contract'),
      status: 'todo',
      priority: 'urgent',
      due_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      category: 'contract',
    });
    expect(createResponse.status).toBe(201);

    const createEnvelope = await parseEnvelope<unknown>(createResponse);
    expect(createEnvelope?.ok).toBe(true);
    const recordId = extractRecordIdFromCreateResponse(createEnvelope?.data);
    createdRecordIds.add(recordId);

    const task = await waitForTaskInHome(recordId);
    expect(task).toBeTruthy();
    expect(typeof task?.record_id).toBe('string');
    expect(typeof task?.title).toBe('string');
    expect('project_id' in (task || {})).toBe(true);
    expect('project_name' in (task || {})).toBe(true);
    expect(task?.task_state).toBeTruthy();
    expect(typeof task?.task_state?.status).toBe('string');
    expect('priority' in (task?.task_state || {})).toBe(true);
    expect('due_at' in (task?.task_state || {})).toBe(true);
  });
});
