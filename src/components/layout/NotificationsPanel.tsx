import { type FC, type RefObject, useMemo } from 'react';
import { relativeTimeLabel, type NotificationFilter, type ToolbarNotification } from './appShellUtils';
import { cn } from '../../lib/cn';

interface NotificationsPanelProps {
  notifications: ToolbarNotification[];
  filter: NotificationFilter;
  onFilterChange: (filter: NotificationFilter) => void;
  projectFilter: string | null;
  onProjectFilterChange: (projectId: string | null) => void;
  projects: Array<{ id: string; name: string }>;
  onNavigate: (notification: ToolbarNotification) => void;
  panelRef: RefObject<HTMLDivElement | null>;
}

export const NotificationsPanel: FC<NotificationsPanelProps> = ({
  notifications,
  filter,
  onFilterChange,
  projectFilter,
  onProjectFilterChange,
  projects,
  onNavigate,
  panelRef,
}) => {
  const visibleNotifications = useMemo(() => {
    return notifications.filter((notification) => {
      if (filter === 'unread' && notification.read) {
        return false;
      }
      if (projectFilter && notification.projectId !== projectFilter) {
        return false;
      }
      return true;
    });
  }, [filter, notifications, projectFilter]);

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Notifications"
      className="absolute bottom-[calc(100%+8px)] right-0 z-[100] w-[360px] rounded-panel border border-border-muted bg-surface-elevated shadow-soft"
    >
      <div className="flex items-center gap-sm border-b border-border-muted px-md py-sm">
        {(['unread', 'all'] as NotificationFilter[]).map((nextFilter) => (
          <button
            key={nextFilter}
            type="button"
            onClick={() => onFilterChange(nextFilter)}
            className={cn('text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring', filter === nextFilter ? 'font-medium' : 'font-normal')}
            style={{
              color: filter === nextFilter ? 'var(--color-text)' : 'var(--color-muted)',
              borderBottom: filter === nextFilter ? '2px solid var(--color-primary)' : '2px solid transparent',
            }}
          >
            {nextFilter.charAt(0).toUpperCase() + nextFilter.slice(1)}
          </button>
        ))}

        <select
          value={projectFilter ?? ''}
          onChange={(event) => onProjectFilterChange(event.target.value || null)}
          aria-label="Filter by project"
          className="ml-auto rounded-control border border-border-muted bg-surface-elevated px-xs py-[2px] text-xs text-text outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          <option value="">All projects</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </div>

      <ul className="max-h-[420px] list-none overflow-y-auto p-0">
        {visibleNotifications.length === 0 ? (
          <li className="px-xl py-xl text-center text-sm text-muted">
            {filter === 'unread' ? "You're all caught up." : 'No notifications yet.'}
          </li>
        ) : (
          visibleNotifications.map((notification) => (
            <li
              key={notification.id}
              className="group flex items-start gap-sm border-b border-border-muted px-md py-sm last:border-b-0"
              style={{
                background: notification.read
                  ? 'transparent'
                  : 'color-mix(in srgb, var(--color-primary) 8%, transparent)',
              }}
            >
              <button
                type="button"
                onClick={() => onNavigate(notification)}
                className="min-w-0 flex flex-1 items-start gap-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                <div
                  aria-hidden="true"
                  className="mt-[2px] flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-on-primary"
                  style={{ background: notification.avatarColor }}
                >
                  {notification.authorInitial}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-text">{notification.summary}</p>
                  <p className="mt-[2px] line-clamp-2 text-[13px] text-muted">{notification.body}</p>
                </div>
              </button>

              <div className="flex shrink-0 flex-col items-end gap-xs">
                <span className="text-xs text-muted" title={new Date(notification.createdAt).toLocaleString()}>
                  {relativeTimeLabel(notification.createdAt)}
                </span>

                <div className="flex">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      event.preventDefault();
                    }}
                    aria-disabled="true"
                    aria-label="Add to reminders. Coming soon."
                    title="Coming soon."
                    className="cursor-not-allowed rounded-control border border-border-muted px-2 py-1 text-xs text-muted opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                  >
                    Add to reminders
                  </button>
                </div>
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
};
