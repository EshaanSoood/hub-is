import { Select } from '../primitives';
import type { TimelineTypeFilter } from './types';

const adjectiveForCount = (count: number): string => {
  if (count <= 3) {
    return 'Chill';
  }
  if (count <= 5) {
    return 'Busy';
  }
  return 'Packed';
};

export const ContextBar = ({
  projectFilter,
  projectOptions,
  onProjectFilterChange,
  eventCount,
  taskCount,
  reminderCount,
  triageCount,
  timelineTypeFilter,
  onToggleTimelineType,
  onToggleTriagePanel,
  triageOpen,
}: {
  projectFilter: string;
  projectOptions: Array<{ value: string; label: string }>;
  onProjectFilterChange: (value: string) => void;
  eventCount: number;
  taskCount: number;
  reminderCount: number;
  triageCount: number;
  timelineTypeFilter: TimelineTypeFilter;
  onToggleTimelineType: (type: Exclude<TimelineTypeFilter, 'all'>) => void;
  onToggleTriagePanel: () => void;
  triageOpen: boolean;
}) => {
  const totalCount = eventCount + taskCount + reminderCount;
  const adjective = adjectiveForCount(totalCount);
  const triageButtonClassName = triageCount > 0
    ? 'border-warning/50 bg-warning/10 text-text'
    : 'border-border-muted bg-surface text-muted';

  return (
    <section className="rounded-panel border border-border-muted bg-surface px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="shrink-0">
          <Select
            value={projectFilter}
            onValueChange={onProjectFilterChange}
            options={projectOptions}
            ariaLabel="Filter daily brief by project"
            triggerClassName="min-w-44 focus-visible:ring-1 focus-visible:ring-[color:var(--color-border-secondary)]"
          />
        </div>

        <p className="min-w-0 flex-1 text-sm text-text">
          <span>{adjective} day ahead. You have </span>
          <button
            type="button"
            className={`underline decoration-dotted underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${timelineTypeFilter === 'events' ? 'text-primary font-semibold' : 'text-primary'}`}
            onClick={() => onToggleTimelineType('events')}
            aria-pressed={timelineTypeFilter === 'events'}
          >
            {eventCount} events
          </button>
          <span>, </span>
          <button
            type="button"
            className={`underline decoration-dotted underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${timelineTypeFilter === 'tasks' ? 'text-primary font-semibold' : 'text-primary'}`}
            onClick={() => onToggleTimelineType('tasks')}
            aria-pressed={timelineTypeFilter === 'tasks'}
          >
            {taskCount} tasks
          </button>
          <span> and </span>
          <button
            type="button"
            className={`underline decoration-dotted underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${timelineTypeFilter === 'reminders' ? 'text-primary font-semibold' : 'text-primary'}`}
            onClick={() => onToggleTimelineType('reminders')}
            aria-pressed={timelineTypeFilter === 'reminders'}
          >
            {reminderCount} reminders
          </button>
          <span> due today.</span>
          {triageCount > 0 ? (
            <>
              <span> You also have </span>
              <button
                type="button"
                className="text-primary underline decoration-dotted underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                onClick={onToggleTriagePanel}
              >
                {triageCount} overdue or unassigned items
              </button>
              <span> that need your attention.</span>
            </>
          ) : null}
        </p>

        <button
          type="button"
          className={`shrink-0 rounded-control border px-2.5 py-1 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${triageButtonClassName}`}
          onClick={onToggleTriagePanel}
          aria-label={`${triageCount} items need attention`}
          aria-expanded={triageOpen}
        >
          {triageCount}
        </button>
      </div>
    </section>
  );
};
