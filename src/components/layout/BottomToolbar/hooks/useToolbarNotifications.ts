import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import { listNotifications, markNotificationRead } from '../../../../services/hub/notifications';
import {
  focusElementSoon,
  focusFirstDescendantSoon,
  toToolbarNotification,
  type NotificationFilter,
  type QuickAddDialog,
  type ToolbarDialog,
  type ToolbarNotification,
} from '../../appShellUtils';
import { useNotificationsEffects } from './useNotificationsEffects';
import type {
  CloseContextMenuOptions,
  CloseNotificationsOptions,
  CloseProfileOptions,
  CloseQuickNavOptions,
} from '../types';

interface UseToolbarNotificationsArgs {
  accessToken: string | null | undefined;
  navigate: (to: string) => void;
  closeSearch: () => void;
  closeQuickNav: (options?: CloseQuickNavOptions) => void;
  closeQuickNavPanel: () => void;
  closeProfile: (options?: CloseProfileOptions) => void;
  closeContextMenu: (options?: CloseContextMenuOptions) => void;
  closeCapturePanel: (options?: { restoreFocus?: boolean }) => void;
  quickNavOpen: boolean;
  profileOpen: boolean;
  contextMenuOpen: boolean;
  captureOpen: boolean;
  toolbarDialog: ToolbarDialog;
  quickAddDialog: QuickAddDialog;
  searchOpen: boolean;
}

interface UseToolbarNotificationsResult {
  notificationsRef: MutableRefObject<HTMLDivElement | null>;
  notificationsTriggerRef: MutableRefObject<HTMLButtonElement | null>;
  notificationsPanelRef: MutableRefObject<HTMLDivElement | null>;
  notificationsOpen: boolean;
  notifications: ToolbarNotification[];
  unreadNotifications: number;
  notifFilter: NotificationFilter;
  setNotifFilter: Dispatch<SetStateAction<NotificationFilter>>;
  notifProjectFilter: string | null;
  setNotifProjectFilter: Dispatch<SetStateAction<string | null>>;
  toggleNotifications: () => void;
  closeNotifications: (options?: CloseNotificationsOptions) => void;
  onNavigateNotification: (notification: ToolbarNotification) => Promise<void>;
}

export const useToolbarNotifications = ({
  accessToken,
  navigate,
  closeSearch,
  closeQuickNav,
  closeQuickNavPanel,
  closeProfile,
  closeContextMenu,
  closeCapturePanel,
  quickNavOpen,
  profileOpen,
  contextMenuOpen,
  captureOpen,
  toolbarDialog,
  quickAddDialog,
  searchOpen,
}: UseToolbarNotificationsArgs): UseToolbarNotificationsResult => {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<ToolbarNotification[]>([]);
  const [notifFilter, setNotifFilter] = useState<NotificationFilter>('unread');
  const [notifProjectFilter, setNotifProjectFilter] = useState<string | null>(null);

  const notificationsRef = useRef<HTMLDivElement | null>(null);
  const notificationsTriggerRef = useRef<HTMLButtonElement | null>(null);
  const notificationsPanelRef = useRef<HTMLDivElement | null>(null);
  const notificationsWereOpenRef = useRef(false);
  const skipNotificationsFocusRestoreRef = useRef(false);

  const refreshNotifications = useCallback(async () => {
    if (!accessToken) {
      return [] as ToolbarNotification[];
    }

    try {
      const next = await listNotifications(accessToken);
      return next.map(toToolbarNotification);
    } catch {
      return null;
    }
  }, [accessToken]);

  const onMarkNotificationRead = useCallback(async (notificationId: string) => {
    if (!accessToken) {
      return;
    }

    try {
      await markNotificationRead(accessToken, notificationId);
      setNotifications((current) =>
        current.map((notification) => (notification.id === notificationId ? { ...notification, read: true } : notification)),
      );
    } catch {
      const restored = await refreshNotifications();
      if (restored) {
        setNotifications(restored);
      }
    }
  }, [accessToken, refreshNotifications]);

  const closeNotifications = useCallback((options?: CloseNotificationsOptions) => {
    skipNotificationsFocusRestoreRef.current = options?.restoreFocus === false;
    setNotificationsOpen(false);
  }, []);

  const toggleNotifications = useCallback(() => {
    setNotificationsOpen((current) => !current);
    closeProfile({ restoreFocus: false });
    closeSearch();
    closeQuickNav({ restoreFocus: false });
    closeQuickNavPanel();
    closeContextMenu({ restoreFocus: false });
    closeCapturePanel({ restoreFocus: false });
  }, [closeCapturePanel, closeContextMenu, closeProfile, closeQuickNav, closeQuickNavPanel, closeSearch]);

  const onNavigateNotification = useCallback(async (notification: ToolbarNotification) => {
    navigate(notification.href);
    closeNotifications({ restoreFocus: false });
    if (!notification.read) {
      await onMarkNotificationRead(notification.id);
    }
  }, [closeNotifications, navigate, onMarkNotificationRead]);

  const unreadNotifications = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications],
  );

  useNotificationsEffects({
    accessToken,
    refreshNotifications,
    setNotifications,
  });

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (notificationsOpen && notificationsRef.current && !notificationsRef.current.contains(target)) {
        closeNotifications();
      }
    };

    document.addEventListener('mousedown', onMouseDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
    };
  }, [closeNotifications, notificationsOpen]);

  useEffect(() => {
    if (notificationsOpen) {
      focusFirstDescendantSoon(
        notificationsPanelRef.current,
        'button:not([disabled]), select:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
    } else if (
      notificationsWereOpenRef.current
      && !skipNotificationsFocusRestoreRef.current
      && !searchOpen
      && !quickNavOpen
      && !profileOpen
      && !contextMenuOpen
      && !captureOpen
      && !toolbarDialog
      && !quickAddDialog
    ) {
      focusElementSoon(notificationsTriggerRef.current);
    }

    if (!notificationsOpen) {
      skipNotificationsFocusRestoreRef.current = false;
    }
    notificationsWereOpenRef.current = notificationsOpen;
  }, [captureOpen, contextMenuOpen, notificationsOpen, profileOpen, quickAddDialog, quickNavOpen, searchOpen, toolbarDialog]);

  return {
    notificationsRef,
    notificationsTriggerRef,
    notificationsPanelRef,
    notificationsOpen,
    notifications,
    unreadNotifications,
    notifFilter,
    setNotifFilter,
    notifProjectFilter,
    setNotifProjectFilter,
    toggleNotifications,
    closeNotifications,
    onNavigateNotification,
  };
};
