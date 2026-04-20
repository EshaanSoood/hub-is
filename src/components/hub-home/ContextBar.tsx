import { Icon, type IconName, Select } from '../primitives';

const adjectiveForCount = (count: number): string => {
  if (count <= 3) {
    return 'Chill';
  }
  if (count <= 5) {
    return 'Busy';
  }
  return 'Packed';
};

const nounForCount = (count: number, singular: string, plural: string): string =>
  count === 1 ? singular : plural;

const CountPill = ({
  count,
  iconName,
  label,
}: {
  count: number;
  iconName: IconName;
  label: string;
}) => (
  <span
    className="ghost-button inline-flex items-center gap-2 bg-surface-highest px-3 py-1 text-xs font-semibold text-text"
    role="img"
    aria-label={`${count} ${label}`}
  >
    <Icon name={iconName} size={14} weight="bold" className="shrink-0" />
    <span aria-hidden="true">{count}</span>
  </span>
);

export const ContextBar = ({
  className,
  projectFilter,
  projectOptions,
  onProjectFilterChange,
  eventCount,
  taskCount,
  reminderCount,
  backlogCount,
}: {
  className?: string;
  projectFilter: string;
  projectOptions: Array<{ value: string; label: string }>;
  onProjectFilterChange: (value: string) => void;
  eventCount: number;
  taskCount: number;
  reminderCount: number;
  backlogCount: number;
}) => {
  const totalCount = eventCount + taskCount + reminderCount;
  const adjective = adjectiveForCount(totalCount);
  const backlogNoun = nounForCount(backlogCount, 'item', 'items');

  return (
    <div className={`rounded-panel bg-surface-low px-3 py-3 shadow-soft ${className ?? ''}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <Select
            value={projectFilter}
            onValueChange={onProjectFilterChange}
            options={projectOptions}
            ariaLabel="Filter timeline by project"
            triggerClassName="min-w-44 bg-surface-highest font-medium shadow-soft-subtle"
          />
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Daily brief totals">
            <CountPill count={eventCount} iconName="calendar" label={nounForCount(eventCount, 'event', 'events')} />
            <CountPill count={taskCount} iconName="tasks" label={nounForCount(taskCount, 'task', 'tasks')} />
            <CountPill count={reminderCount} iconName="reminders" label={nounForCount(reminderCount, 'reminder', 'reminders')} />
          </div>
        </div>
      </div>
      <p className="mt-3 min-w-0 text-sm text-text">
        <span>{adjective} day ahead.</span>
        {backlogCount > 0 ? (
          <>
            <span> You also have </span>
            <span className="font-medium text-text">
              {backlogCount} overdue or unassigned {backlogNoun}
            </span>
            <span> that need your attention.</span>
          </>
        ) : null}
      </p>
    </div>
  );
};
