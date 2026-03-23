import { hubRequest } from './transport';
import type {
  CreateReminderRequest,
  CreateReminderResponse,
  ListRemindersResponse,
  ReminderSummary,
} from '../../shared/api-types';

export type HubReminderSummary = ReminderSummary;
export type CreateReminderPayload = CreateReminderRequest;

export const listReminders = async (accessToken: string): Promise<HubReminderSummary[]> => {
  const data = await hubRequest<ListRemindersResponse>(accessToken, '/api/hub/reminders', {
    method: 'GET',
  });
  return data.reminders;
};

export const dismissReminder = async (accessToken: string, reminderId: string): Promise<void> => {
  await hubRequest<{ dismissed: boolean }>(
    accessToken,
    `/api/hub/reminders/${encodeURIComponent(reminderId)}/dismiss`,
    {
      method: 'POST',
      body: JSON.stringify({}),
    },
  );
};

export const createReminder = async (accessToken: string, payload: CreateReminderPayload): Promise<HubReminderSummary> => {
  const data = await hubRequest<CreateReminderResponse>(accessToken, '/api/hub/reminders', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return data.reminder;
};
