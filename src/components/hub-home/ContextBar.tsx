import { Select } from '../primitives';

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
    <div className={`rounded-panel border border-border-muted bg-surface px-3 py-3 ${className ?? ''}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="shrink-0">
          <Select
            value={projectFilter}
            onValueChange={onProjectFilterChange}
            options={projectOptions}
            ariaLabel="Filter timeline by project"
            triggerClassName="min-w-44"
          />
        </div>

        <p className="min-w-0 flex-1 text-sm text-text">
          <span>{adjective} day ahead. You have </span>
          <span className="font-medium text-text">
            {eventCount} {nounForCount(eventCount, 'event', 'events')}
          </span>
          <span>, </span>
          <span className="font-medium text-text">
            {taskCount} {nounForCount(taskCount, 'task', 'tasks')}
          </span>
          <span> and </span>
          <span className="font-medium text-text">
            {reminderCount} {nounForCount(reminderCount, 'reminder', 'reminders')}
          </span>
          <span> due today.</span>
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
    </div>
  );
};
