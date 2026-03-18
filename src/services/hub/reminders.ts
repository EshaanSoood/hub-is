import { hubRequest } from './transport';

export interface HubReminderSummary {
  reminder_id: string;
  record_id: string;
  record_title: string;
  project_id: string;
  remind_at: string;
  channels: string[];
  recurrence_json: { next_remind_at?: string; frequency?: string } | null;
  created_at: string;
  fired_at: string | null;
  overdue: boolean;
}

export interface CreateReminderPayload {
  title: string;
  remind_at: string;
  recurrence_json?: { next_remind_at?: string; frequency?: string } | null;
}

export const listReminders = async (accessToken: string): Promise<HubReminderSummary[]> => {
  const data = await hubRequest<{ reminders: HubReminderSummary[] }>(accessToken, '/api/hub/reminders', {
    method: 'GET',
  });
  return data.reminders;
};

export const dismissReminder = async (accessToken: string, reminderId: string): Promise<void> => {
  await hubRequest<{ dismissed: boolean; reminder_id: string }>(
    accessToken,
    `/api/hub/reminders/${encodeURIComponent(reminderId)}/dismiss`,
    {
      method: 'POST',
      body: JSON.stringify({}),
    },
  );
};

export const createReminder = async (accessToken: string, payload: CreateReminderPayload): Promise<HubReminderSummary> => {
  const data = await hubRequest<{ reminder: HubReminderSummary }>(accessToken, '/api/hub/reminders', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return data.reminder;
};
