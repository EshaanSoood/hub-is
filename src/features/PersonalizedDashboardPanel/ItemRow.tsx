import { Chip, Icon, type IconName } from '../../components/primitives';
import { EventCard } from '../../components/cards/EventCard';
import { TaskCard } from '../../components/cards/TaskCard';
import type { HubDashboardItem } from './types';
import { formatRelativeDateTime } from './utils';

interface ItemRowProps {
  item: HubDashboardItem;
  onOpen: (recordId: string) => void;
}

export const ItemRow = ({ item, onOpen }: ItemRowProps) => {
  const canOpen = Boolean(item.recordId);
  const badgeIconName: IconName = item.kind === 'task' ? 'tasks' : 'calendar';
  const content = (
    <div className="flex min-w-0 items-start gap-3">
      <Chip variant="neutral" className="shrink-0 gap-1.5 px-2.5">
        <Icon name={badgeIconName} className="text-[12px]" />
        <span className="sr-only">{item.badgeLabel}</span>
      </Chip>
      {item.kind === 'task' ? (
        <TaskCard
          title={item.title}
          status={item.taskStatus}
          projectId={item.projectId}
          projectName={item.projectName || 'Inbox & Unassigned'}
          subtitle={item.subtitle}
          dueLabel={item.dueAt ? formatRelativeDateTime(item.dueAt) : null}
          className="min-w-0 flex-1"
        />
      ) : (
        <EventCard
          title={item.title}
          timeLabel={item.dueAt ? formatRelativeDateTime(item.dueAt) : null}
          projectId={item.projectId}
          projectName={item.projectName || 'Inbox & Unassigned'}
          className="min-w-0 flex-1"
        />
      )}
    </div>
  );

  return (
    <a
      href={item.explicitHref}
      onClick={
        canOpen && item.recordId
          ? (event) => {
              if (
                event.defaultPrevented
                || event.button !== 0
                || event.metaKey
                || event.ctrlKey
                || event.shiftKey
                || event.altKey
              ) {
                return;
              }
              event.preventDefault();
              onOpen(item.recordId);
            }
          : undefined
      }
      className={`interactive interactive-fold block rounded-panel border bg-surface p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${item.unread ? 'border-primary/40' : 'border-border-muted'}`}
    >
      {content}
    </a>
  );
};
