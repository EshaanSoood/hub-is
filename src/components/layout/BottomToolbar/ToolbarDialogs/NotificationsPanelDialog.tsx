import { NotificationsPanel } from '../../NotificationsPanel';
import type { BottomToolbarProps } from '../types';

type NotificationsPanelDialogProps = Pick<
  BottomToolbarProps,
  | 'notifications'
  | 'notifFilter'
  | 'setNotifFilter'
  | 'notifProjectFilter'
  | 'setNotifProjectFilter'
  | 'projects'
  | 'onNavigateNotification'
  | 'notificationsPanelRef'
>;

export const NotificationsPanelDialog = ({
  notifications,
  notifFilter,
  setNotifFilter,
  notifProjectFilter,
  setNotifProjectFilter,
  projects,
  onNavigateNotification,
  notificationsPanelRef,
}: NotificationsPanelDialogProps) => (
  <NotificationsPanel
    notifications={notifications}
    filter={notifFilter}
    onFilterChange={setNotifFilter}
    projectFilter={notifProjectFilter}
    onProjectFilterChange={setNotifProjectFilter}
    projects={projects}
    onNavigate={onNavigateNotification}
    panelRef={notificationsPanelRef}
  />
);
