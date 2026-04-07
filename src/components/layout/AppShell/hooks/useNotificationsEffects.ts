import { useEffect, type Dispatch, type SetStateAction } from 'react';
import { subscribeHubLive } from '../../../../services/hubLive';
import { toToolbarNotification, type ToolbarNotification } from '../../appShellUtils';

interface UseNotificationsEffectsArgs {
  accessToken: string | null | undefined;
  refreshNotifications: () => Promise<ToolbarNotification[] | null>;
  setNotifications: Dispatch<SetStateAction<ToolbarNotification[]>>;
}

export const useNotificationsEffects = ({
  accessToken,
  refreshNotifications,
  setNotifications,
}: UseNotificationsEffectsArgs) => {
  useEffect(() => {
    let cancelled = false;
    const refreshAndStore = async () => {
      const next = await refreshNotifications();
      if (cancelled || !next) {
        return;
      }
      setNotifications(next);
    };
    const kickoff = window.setTimeout(() => {
      void refreshAndStore();
    }, 0);
    const timer = window.setInterval(() => {
      void refreshAndStore();
    }, 45_000);
    return () => {
      cancelled = true;
      window.clearTimeout(kickoff);
      window.clearInterval(timer);
    };
  }, [refreshNotifications]);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      void Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (!accessToken) {
      return;
    }
    return subscribeHubLive(accessToken, (message) => {
      if (message.type !== 'notification.new') {
        return;
      }
      const nextNotification = toToolbarNotification(message.notification);
      setNotifications((current) => {
        const existingIndex = current.findIndex((notification) => notification.id === nextNotification.id);
        if (existingIndex >= 0) {
          return current.map((notification, index) => (index === existingIndex ? nextNotification : notification));
        }
        return [nextNotification, ...current];
      });

      if ('Notification' in window && Notification.permission === 'granted') {
        const payload = message.notification?.payload ?? {};
        const title = typeof payload.message === 'string' && payload.message.trim() ? payload.message : 'New notification';
        const browserNotification = new Notification(title, {
          body: payload.source_project_id ? 'In project' : 'Hub OS',
          tag: message.notification?.notification_id || undefined,
          icon: '/favicon.ico',
        });
        browserNotification.onclick = () => {
          window.focus();
          browserNotification.close();
        };
      }
    });
  }, [accessToken]);
};
