import { hubRequest } from './transport.ts';
import type {
  CreateReminderRequest,
  CreateReminderResponse,
  ListRemindersResponse,
  ReminderScope,
  ReminderSummary,
  UpdateReminderRequest,
  UpdateReminderResponse,
} from '../../shared/api-types';

export type HubReminderSummary = ReminderSummary;
export type CreateReminderPayload = CreateReminderRequest;
export type ListRemindersOptions =
  | {
      scope?: Exclude<ReminderScope, 'project'>;
    }
  | {
      scope: 'project';
      spaceId: string;
      projectId?: string | null;
    };
export type UpdateReminderPayload = UpdateReminderRequest;

export const listReminders = async (accessToken: string, options?: ListRemindersOptions): Promise<HubReminderSummary[]> => {
  const params = new URLSearchParams();
  if (options?.scope === 'project') {
    params.set('scope', 'project');
    params.set('space_id', options.spaceId);
    if (options.projectId) {
      params.set('project_id', options.projectId);
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
  const data = await hubRequest<UpdateReminderResponse>(
    accessToken,
    `/api/hub/reminders/${encodeURIComponent(reminderId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
  );
  return data.reminder;
};
