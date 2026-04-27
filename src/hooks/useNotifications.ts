import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { listNotifications, markNotificationRead } from '../services/hub/notifications';
import type { HubNotification } from '../services/hub/types';
import { subscribeHubLive } from '../services/hubLive';

interface NotificationsState {
  error: unknown;
  loading: boolean;
  notifications: HubNotification[];
}

interface UseNotificationsResult extends NotificationsState {
  markAsRead: (notificationId: string) => Promise<void>;
  refetch: () => void;
  unreadCount: number;
}

const upsertNotification = (
  notifications: HubNotification[],
  nextNotification: HubNotification,
): HubNotification[] => {
  const withoutExisting = notifications.filter(
    (notification) => notification.notification_id !== nextNotification.notification_id,
  );
  return [nextNotification, ...withoutExisting];
};

export const useNotifications = (
  accessToken: string | null | undefined,
): UseNotificationsResult => {
  const [state, setState] = useState<NotificationsState>({
    error: null,
    loading: false,
    notifications: [],
  });
  const [requestVersion, setRequestVersion] = useState(0);
  const requestIdRef = useRef(0);

  const refetch = useCallback(() => {
    if (!accessToken) {
      return;
    }

    setState((current) => ({
      ...current,
      error: null,
      loading: true,
    }));
    setRequestVersion((current) => current + 1);
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    let cancelled = false;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    void listNotifications(accessToken)
      .then((notifications) => {
        if (cancelled || requestIdRef.current !== requestId) {
          return;
        }
        setState({
          error: null,
          loading: false,
          notifications,
        });
      })
      .catch((error) => {
        if (cancelled || requestIdRef.current !== requestId) {
          return;
        }
        setState((current) => ({
          ...current,
          error,
          loading: false,
        }));
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken, requestVersion]);

  useEffect(() => {
    if (!accessToken) {
      return undefined;
    }

    return subscribeHubLive(accessToken, (message) => {
      if (message.type !== 'notification.new') {
        return;
      }
      setState((current) => ({
        ...current,
        notifications: upsertNotification(current.notifications, message.notification),
      }));
    });
  }, [accessToken]);

  const markAsRead = useCallback(
    async (notificationId: string) => {
      if (!accessToken) {
        return;
      }

      const readAt = new Date().toISOString();
      setState((current) => ({
        ...current,
        notifications: current.notifications.map((notification) => (
          notification.notification_id === notificationId
            ? { ...notification, read_at: notification.read_at ?? readAt }
            : notification
        )),
      }));

      await markNotificationRead(accessToken, notificationId);
    },
    [accessToken],
  );

  const unreadCount = useMemo(
    () => state.notifications.filter((notification) => !notification.read_at).length,
    [state.notifications],
  );

  return {
    error: accessToken ? state.error : null,
    loading: accessToken ? state.loading : false,
    markAsRead,
    notifications: accessToken ? state.notifications : [],
    refetch,
    unreadCount: accessToken ? unreadCount : 0,
  };
};
