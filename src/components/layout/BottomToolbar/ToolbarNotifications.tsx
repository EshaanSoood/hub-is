import { Icon } from '../../primitives';
import { NotificationsPanelDialog } from './ToolbarDialogs/NotificationsPanelDialog';
import type { BottomToolbarProps } from './types';

type ToolbarNotificationsProps = Pick<
  BottomToolbarProps,
  | 'notificationsRef'
  | 'notificationsTriggerRef'
  | 'setNotificationsOpen'
  | 'setProfileOpen'
  | 'closeSearch'
  | 'closeQuickNav'
  | 'closeQuickNavPanel'
  | 'setContextMenuOpen'
  | 'closeCapturePanel'
  | 'unreadNotifications'
  | 'notificationsOpen'
  | 'notifications'
  | 'notifFilter'
  | 'setNotifFilter'
  | 'notifProjectFilter'
  | 'setNotifProjectFilter'
  | 'projects'
  | 'onNavigateNotification'
  | 'notificationsPanelRef'
>;

export const ToolbarNotifications = ({
  notificationsRef,
  notificationsTriggerRef,
  setNotificationsOpen,
  setProfileOpen,
  closeSearch,
  closeQuickNav,
  closeQuickNavPanel,
  setContextMenuOpen,
  closeCapturePanel,
  unreadNotifications,
  notificationsOpen,
  notifications,
  notifFilter,
  setNotifFilter,
  notifProjectFilter,
  setNotifProjectFilter,
  projects,
  onNavigateNotification,
  notificationsPanelRef,
}: ToolbarNotificationsProps) => (
  <div className="relative" ref={notificationsRef}>
    <button
      ref={notificationsTriggerRef}
      type="button"
      onClick={() => {
        setNotificationsOpen((current) => !current);
        setProfileOpen(false);
        closeSearch();
        closeQuickNav();
        closeQuickNavPanel();
        setContextMenuOpen(false);
        closeCapturePanel({ restoreFocus: false });
      }}
      aria-label={unreadNotifications > 0 ? `${unreadNotifications} unread notifications` : 'Notifications'}
      className="relative flex h-9 w-9 items-center justify-center rounded-control text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
    >
      <Icon
        name={unreadNotifications > 0 ? 'bell-unread' : 'bell-read'}
        className="text-[18px]"
      />
      {unreadNotifications > 0 ? (
        <span
          aria-hidden="true"
          className="absolute right-1 top-1 h-2 w-2 rounded-full bg-primary"
          style={{ boxShadow: '0 0 0 1.5px var(--color-surface), 0 0 0 3px var(--color-primary)' }}
        />
      ) : null}
    </button>

    {notificationsOpen ? (
      <NotificationsPanelDialog
        notifications={notifications}
        notifFilter={notifFilter}
        setNotifFilter={setNotifFilter}
        notifProjectFilter={notifProjectFilter}
        setNotifProjectFilter={setNotifProjectFilter}
        projects={projects}
        onNavigateNotification={onNavigateNotification}
        notificationsPanelRef={notificationsPanelRef}
      />
    ) : null}
  </div>
);
