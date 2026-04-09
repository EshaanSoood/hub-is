import { hubRequest } from './transport.ts';
import type {
  CreateReminderRequest,
  CreateReminderResponse,
  ListRemindersResponse,
  ReminderScope,
  ReminderSummary,
} from '../../shared/api-types';

export type HubReminderSummary = ReminderSummary;
export type CreateReminderPayload = CreateReminderRequest;
export interface ListRemindersOptions {
  scope?: ReminderScope;
  projectId?: string;
  paneId?: string | null;
}
export type UpdateReminderPayload = {
  remind_at?: string;
  recurrence_json?: CreateReminderRequest['recurrence_json'] | null;
};

export const listReminders = async (accessToken: string, options?: ListRemindersOptions): Promise<HubReminderSummary[]> => {
  const params = new URLSearchParams();
  if (options?.scope === 'project') {
    params.set('scope', 'project');
    if (options.projectId) {
      params.set('project_id', options.projectId);
    }
    if (options.paneId) {
      params.set('pane_id', options.paneId);
    }
  }
  const query = params.toString();
  const data = await hubRequest<ListRemindersResponse>(accessToken, `/api/hub/reminders${query ? `?${query}` : ''}`, {
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

export const updateReminder = async (
  accessToken: string,
  reminderId: string,
  payload: UpdateReminderPayload,
): Promise<HubReminderSummary> => {
  const data = await hubRequest<{ reminder: HubReminderSummary }>(
    accessToken,
    `/api/hub/reminders/${encodeURIComponent(reminderId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
  );
  return data.reminder;
};
