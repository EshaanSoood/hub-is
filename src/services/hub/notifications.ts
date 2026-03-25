import { hubRequest } from './transport.ts';

import type { HubNotification } from './types.ts';

export const listNotifications = async (
  accessToken: string,
  unreadOnly = false,
): Promise<HubNotification[]> => {
  const data = await hubRequest<{
    notifications: HubNotification[];
  }>(accessToken, `/api/hub/notifications?unread=${unreadOnly ? '1' : '0'}`, {
    method: 'GET',
  });
  return data.notifications;
};

export const markNotificationRead = async (accessToken: string, notificationId: string): Promise<void> => {
  await hubRequest<{ notification: { notification_id: string } }>(
    accessToken,
    `/api/hub/notifications/${encodeURIComponent(notificationId)}/read`,
    {
      method: 'POST',
      body: JSON.stringify({}),
    },
  );
};
