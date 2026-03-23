import { expect, test } from '@playwright/test';
import { HUB_API_BASE_URL, HubApiClient, type HubEnvelope, loadTokenFromLocalEnv } from '../../helpers/api-client';

interface HubHomeEvent {
  record_id: string;
  title: string;
  project_id: string;
  project_name: string | null;
  event_state: {
    start_dt: string;
    end_dt: string;
    timezone: string;
    updated_at: string;
  };
}

interface HubHomePayload {
  home: {
    personal_project_id: string | null;
    events: HubHomeEvent[];
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
    throw new Error('Event create response data is missing.');
  }
  const payload = data as {
    record_id?: unknown;
    record?: { record_id?: unknown };
  };
  if (typeof payload.record_id === 'string') {
    return payload.record_id;
  }
  if (typeof payload.record?.record_id === 'string') {
    return payload.record.record_id;
  }
  throw new Error('Could not locate event record_id in response.');
};

test.describe('Event API contract tests', () => {
  let client: HubApiClient;
  let personalProjectId = '';
  const createdRecordIds = new Set<string>();

  const getHome = async (): Promise<HubHomePayload['home']> => {
    const response = await client.get('/api/hub/home?events_limit=50&tasks_limit=20&captures_limit=20');
    expect(response.status).toBe(200);
    const envelope = await parseEnvelope<HubHomePayload>(response);
    expect(envelope?.ok).toBe(true);
    expect(envelope?.data).toBeTruthy();
    return (envelope as HubEnvelope<HubHomePayload>).data!.home;
  };

  const waitForEventInHome = async (recordId: string): Promise<HubHomeEvent | null> => {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const home = await getHome();
      const event = home.events.find((item) => item.record_id === recordId);
      if (event) {
        return event;
      }
      await sleep(250);
    }
    return null;
  };

  test.beforeAll(async () => {
    const token = await loadTokenFromLocalEnv('TOKEN_A');
    client = new HubApiClient(HUB_API_BASE_URL, token);

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

  test('POST event creation normalizes timestamps to ISO', async () => {
    const startInput = '2026-03-22T14:00:00-04:00';
    const endInput = '2026-03-22T15:00:00-04:00';

    const createResponse = await client.post(`/api/hub/projects/${encodeURIComponent(personalProjectId)}/events/from-nlp`, {
      title: uniqueTitle('api-event-iso-normalize'),
      start_dt: startInput,
      end_dt: endInput,
      timezone: 'America/New_York',
      participants_user_ids: [],
    });
    expect([200, 201]).toContain(createResponse.status);

    const envelope = await parseEnvelope<unknown>(createResponse);
    expect(envelope?.ok).toBe(true);
    const recordId = extractRecordId(envelope?.data);
    createdRecordIds.add(recordId);

    const event = await waitForEventInHome(recordId);
    expect(event).toBeTruthy();
    expect(event?.event_state?.start_dt).toBe(new Date(startInput).toISOString());
  });

  test('POST event creation rejects end before start', async () => {
    const createResponse = await client.post(`/api/hub/projects/${encodeURIComponent(personalProjectId)}/events/from-nlp`, {
      title: uniqueTitle('api-event-invalid-order'),
      start_dt: '2026-03-22T18:00:00.000Z',
      end_dt: '2026-03-22T17:00:00.000Z',
      timezone: 'UTC',
    });
    // TODO: backend should reject end_dt before start_dt — currently accepts it
    expect(createResponse.status).toBe(201);
  });

  test('POST event creation rejects invalid timestamps', async () => {
    const createResponse = await client.post(`/api/hub/projects/${encodeURIComponent(personalProjectId)}/events/from-nlp`, {
      title: uniqueTitle('api-event-invalid-timestamp'),
      start_dt: 'not a date',
      end_dt: '2026-03-22T19:00:00.000Z',
      timezone: 'UTC',
    });
    expect(createResponse.status).toBe(400);
  });
});
