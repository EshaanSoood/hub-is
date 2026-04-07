import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { NotificationsPanel } from '../../NotificationsPanel';
import type { NotificationFilter, ToolbarNotification } from '../../appShellUtils';
import type { BottomToolbarProps } from '../types';

interface NotificationsPanelDialogProps {
  notifications: ToolbarNotification[];
  notifFilter: NotificationFilter;
  setNotifFilter: Dispatch<SetStateAction<NotificationFilter>>;
  notifProjectFilter: string | null;
  setNotifProjectFilter: Dispatch<SetStateAction<string | null>>;
  projects: BottomToolbarProps['projects'];
  onNavigateNotification: (notification: ToolbarNotification) => Promise<void>;
  notificationsPanelRef: MutableRefObject<HTMLDivElement | null>;
}

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
