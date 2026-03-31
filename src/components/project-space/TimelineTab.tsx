import type { PriorityLevel } from './designTokens';
import { cn } from '../../lib/cn';
import { getPriorityClasses } from '../../lib/priorityStyles';

export interface TimelineClusterItem {
  id: string;
  label: string;
  type: 'event' | 'task' | 'milestone';
  priority: PriorityLevel;
}

export interface TimelineCluster {
  id: string;
  dateLabel: string;
  items: TimelineClusterItem[];
}

interface TimelineTabProps {
  clusters: TimelineCluster[];
}

const TYPE_LABELS: Record<TimelineClusterItem['type'], string> = {
  event: 'Event',
  task: 'Task',
  milestone: 'Milestone',
};

export const TimelineTab = ({ clusters }: TimelineTabProps) => (
  <div className="flex max-h-[32rem] flex-col gap-5 overflow-y-auto pr-1">
    {clusters.map((cluster) => (
      <section key={cluster.id} className="space-y-2">
        <h4 className="sticky top-0 z-10 bg-elevated pb-1 text-xs font-bold uppercase tracking-wide text-muted">
          {cluster.dateLabel}
        </h4>

        <ul className="space-y-3 pl-1">
          {cluster.items.map((item, index) => (
            <li key={item.id} className="flex gap-3">
              <div className="flex w-4 flex-col items-center" aria-hidden="true">
                <span className={cn('mt-1 h-2.5 w-2.5 rounded-full', getPriorityClasses(item.priority).dot)} />
                {index === cluster.items.length - 1 ? null : <span className="mt-1 w-px flex-1 bg-border-subtle" />}
              </div>

              <div className="flex flex-1 items-start gap-2">
                <span className="flex-1 text-sm text-text">{item.label}</span>
                <span className="rounded-control border border-subtle bg-surface px-1.5 py-0.5 text-[11px] text-muted">
                  {TYPE_LABELS[item.type]}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </section>
    ))}
  </div>
);
