import { expect, test } from '@playwright/test';
import { HUB_API_BASE_URL, HubApiClient, type HubEnvelope, loadTokenFromLocalEnv } from '../../helpers/api-client';

interface HubReminderSummary {
  reminder_id: string;
  record_id: string;
  record_title: string;
  space_id: string;
  remind_at: string;
  channels: string[];
  recurrence_json?: {
    frequency?: 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval?: number;
    next_remind_at?: string;
    subsequent_remind_at?: string;
  } | null;
  created_at: string;
  fired_at: string | null;
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

const extractReminder = (data: unknown): HubReminderSummary => {
  if (!data || typeof data !== 'object') {
    throw new Error('Reminder response payload is missing.');
  }
  const payload = data as {
    reminder?: HubReminderSummary;
    reminder_id?: string;
    record_id?: string;
    title?: string;
    space_id?: string;
    remind_at?: string;
    channels?: string[];
    created_at?: string;
    fired_at?: string | null;
  };

  if (payload.reminder) {
    return payload.reminder;
  }

  if (payload.reminder_id && payload.record_id && payload.remind_at) {
    return {
      reminder_id: payload.reminder_id,
      record_id: payload.record_id,
      record_title: String(payload.title || ''),
      space_id: String(payload.space_id || ''),
      remind_at: payload.remind_at,
      channels: Array.isArray(payload.channels) ? payload.channels : ['in_app'],
      created_at: String(payload.created_at || ''),
      fired_at: payload.fired_at ?? null,
    };
  }

  throw new Error('Could not locate reminder payload in response.');
};

test.describe('Reminder API contract tests', () => {
  let client: HubApiClient;
  const createdRecordIds = new Set<string>();
  const createdReminderIds = new Set<string>();

  const listReminders = async (): Promise<HubReminderSummary[]> => {
    const response = await client.get('/api/hub/reminders');
    expect(response.status).toBe(200);
    const envelope = await parseEnvelope<{ reminders: HubReminderSummary[] }>(response);
    expect(envelope?.ok).toBe(true);
    return envelope?.data?.reminders || [];
  };

  const waitForReminder = async (reminderId: string): Promise<HubReminderSummary | null> => {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const reminders = await listReminders();
      const match = reminders.find((reminder) => reminder.reminder_id === reminderId);
      if (match) {
        return match;
      }
      await sleep(250);
    }
    return null;
  };

  test.beforeAll(async () => {
    const token = await loadTokenFromLocalEnv('TOKEN_A');
    client = new HubApiClient(HUB_API_BASE_URL, token);
  });

  test.afterEach(async () => {
    for (const reminderId of createdReminderIds) {
      await client.post(`/api/hub/reminders/${encodeURIComponent(reminderId)}/dismiss`, {});
    }
    for (const recordId of createdRecordIds) {
      await client.patch(`/api/hub/records/${encodeURIComponent(recordId)}`, { archived: true });
    }
    createdReminderIds.clear();
    createdRecordIds.clear();
  });

  test('POST /api/hub/reminders creates a reminder', async () => {
    const remindAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const createResponse = await client.post('/api/hub/reminders', {
      title: uniqueTitle('api-reminder-create'),
      remind_at: remindAt,
    });
    expect(createResponse.status).toBe(201);

    const envelope = await parseEnvelope<unknown>(createResponse);
    expect(envelope?.ok).toBe(true);
    const reminder = extractReminder(envelope?.data);

    expect(reminder.reminder_id).toBeTruthy();
    expect(reminder.reminder_id).toMatch(/^rem_/);
    expect(reminder.record_id).toMatch(/^rec_/);

    createdReminderIds.add(reminder.reminder_id);
    createdRecordIds.add(reminder.record_id);
  });

  test('POST /api/hub/reminders rejects missing remind_at', async () => {
    const createResponse = await client.post('/api/hub/reminders', {
      title: uniqueTitle('api-reminder-missing-remind-at'),
    });
    expect(createResponse.status).toBe(400);
  });

  test('POST /api/hub/reminders rejects invalid remind_at', async () => {
    const createResponse = await client.post('/api/hub/reminders', {
      title: uniqueTitle('api-reminder-invalid-remind-at'),
      remind_at: 'garbage',
    });
    expect(createResponse.status).toBe(400);
  });

  test('GET /api/hub/reminders returns created reminders', async () => {
    const remindAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    const createResponse = await client.post('/api/hub/reminders', {
      title: uniqueTitle('api-reminder-list-contract'),
      remind_at: remindAt,
    });
    expect(createResponse.status).toBe(201);

    const envelope = await parseEnvelope<unknown>(createResponse);
    expect(envelope?.ok).toBe(true);
    const reminder = extractReminder(envelope?.data);
    createdReminderIds.add(reminder.reminder_id);
    createdRecordIds.add(reminder.record_id);

    const listed = await waitForReminder(reminder.reminder_id);
    expect(listed).toBeTruthy();
    expect(listed?.remind_at).toBe(remindAt);
  });

  test('POST /api/hub/reminders/:id/dismiss dismisses a reminder', async () => {
    const remindAt = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
    const createResponse = await client.post('/api/hub/reminders', {
      title: uniqueTitle('api-reminder-dismiss-contract'),
      remind_at: remindAt,
    });
    expect(createResponse.status).toBe(201);

    const envelope = await parseEnvelope<unknown>(createResponse);
    expect(envelope?.ok).toBe(true);
    const reminder = extractReminder(envelope?.data);
    createdReminderIds.add(reminder.reminder_id);
    createdRecordIds.add(reminder.record_id);

    const dismissResponse = await client.post(`/api/hub/reminders/${encodeURIComponent(reminder.reminder_id)}/dismiss`, {});
    expect(dismissResponse.status).toBe(200);
    createdReminderIds.delete(reminder.reminder_id);

    const reminders = await listReminders();
    expect(reminders.some((item) => item.reminder_id === reminder.reminder_id)).toBe(false);
  });

  test('PATCH /api/hub/reminders/:id updates reminder schedule', async () => {
    const initialRemindAt = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
    const updatedRemindAt = new Date(Date.now() + 28 * 60 * 60 * 1000).toISOString();
    const createResponse = await client.post('/api/hub/reminders', {
      title: uniqueTitle('api-reminder-update-contract'),
      remind_at: initialRemindAt,
    });
    expect(createResponse.status).toBe(201);

    const createEnvelope = await parseEnvelope<unknown>(createResponse);
    expect(createEnvelope?.ok).toBe(true);
    const reminder = extractReminder(createEnvelope?.data);
    createdReminderIds.add(reminder.reminder_id);
    createdRecordIds.add(reminder.record_id);

    const updateResponse = await client.patch(`/api/hub/reminders/${encodeURIComponent(reminder.reminder_id)}`, {
      remind_at: updatedRemindAt,
      recurrence_json: {
        frequency: 'weekly',
        interval: 2,
      },
    });
    expect(updateResponse.status).toBe(200);

    const updateEnvelope = await parseEnvelope<{ reminder: HubReminderSummary }>(updateResponse);
    expect(updateEnvelope?.ok).toBe(true);
    expect(updateEnvelope?.data?.reminder.reminder_id).toBe(reminder.reminder_id);
    expect(updateEnvelope?.data?.reminder.remind_at).toBe(updatedRemindAt);
    expect(updateEnvelope?.data?.reminder.recurrence_json).toEqual({
      frequency: 'weekly',
      interval: 2,
    });

    const listed = await waitForReminder(reminder.reminder_id);
    expect(listed?.remind_at).toBe(updatedRemindAt);
    expect(listed?.recurrence_json).toEqual({
      frequency: 'weekly',
      interval: 2,
    });
  });
});
