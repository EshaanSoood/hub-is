import { useMemo } from 'react';
import { cn } from '../../lib/cn';
import { PRIORITY_DOT_CLASS } from '../../lib/priorityStyles';

export type TimelineEventType = 'task' | 'event' | 'milestone' | 'file' | 'workspace';

export interface TimelineItem {
  id: string;
  type: TimelineEventType;
  label: string;
  timestamp: string;
  timestampRelative: string;
  dotColor: string;
  linkedRecordId?: string;
  linkedRecordType?: string;
}

export interface TimelineCluster {
  date: string;
  items: TimelineItem[];
}

interface TimelineFeedProps {
  clusters: TimelineCluster[];
  activeFilters: TimelineEventType[];
  isLoading: boolean;
  hasMore: boolean;
  onFilterToggle: (type: TimelineEventType) => void;
  onLoadMore: () => void;
  onItemClick: (recordId: string, recordType: string) => void;
  previewMode?: boolean;
}

const FILTER_LABELS: Record<TimelineEventType, string> = {
  task: 'Tasks',
  event: 'Events',
  milestone: 'Milestones',
  file: 'Files',
  workspace: 'Workspace',
};

const TIMELINE_DOT_CLASS: Record<TimelineEventType, string> = {
  task: PRIORITY_DOT_CLASS.high,
  event: 'bg-primary',
  milestone: PRIORITY_DOT_CLASS.medium,
  file: PRIORITY_DOT_CLASS.low,
  workspace: 'bg-capture-rail',
};

export const TimelineFeed = ({
  clusters,
  activeFilters,
  isLoading,
  hasMore,
  onFilterToggle,
  onLoadMore,
  onItemClick,
  previewMode = false,
}: TimelineFeedProps) => {
  const visibleClusters = useMemo(
    () =>
      clusters
        .map((cluster) => ({
          ...cluster,
          items: cluster.items.filter((item) => activeFilters.includes(item.type)),
        }))
        .filter((cluster) => cluster.items.length > 0),
    [activeFilters, clusters],
  );

  return (
    <div className="flex flex-col gap-sm">
      {!previewMode ? <div role="group" aria-label="Filter timeline" className="flex flex-wrap gap-xs">
        {(Object.keys(FILTER_LABELS) as TimelineEventType[]).map((type) => {
          const active = activeFilters.includes(type);
          return (
            <button
              key={type}
              type="button"
              aria-pressed={active}
              onClick={() => onFilterToggle(type)}
              className="rounded-control border px-sm py-[3px] text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              style={{
                background: active ? 'color-mix(in srgb, var(--color-primary) 15%, transparent)' : 'transparent',
                borderColor: active ? 'var(--color-primary)' : 'var(--color-border-muted)',
                color: active ? 'var(--color-primary)' : 'var(--color-muted)',
              }}
            >
              {FILTER_LABELS[type]}
            </button>
          );
        })}
      </div> : null}

      <div role="feed" aria-busy={isLoading}>
        {visibleClusters.length === 0 && !isLoading ? <p className="text-sm text-muted">No timeline events match filters.</p> : null}

        {visibleClusters.map((cluster) => (
          <section key={cluster.date}>
            <h3 className="sticky top-0 z-[1] bg-surface py-xs text-xs font-medium uppercase tracking-wide text-muted">{cluster.date}</h3>
            <div className="space-y-0">
              {cluster.items.map((item, index) => {
                const isLast = index === cluster.items.length - 1;
                const clickable = Boolean(item.linkedRecordId && item.linkedRecordType);
                return (
                  <div key={item.id} className="flex gap-sm">
                    <div className="flex w-3 shrink-0 flex-col items-center">
                      <span className={cn('mt-1 h-2.5 w-2.5 rounded-full', TIMELINE_DOT_CLASS[item.type])} />
                      {!isLast ? <span className="mt-1 w-px flex-1 bg-border-muted" /> : null}
                    </div>

                    <div className="flex flex-1 items-start justify-between gap-sm pb-sm">
                      <div className="flex min-w-0 flex-wrap items-center gap-xs">
                        <span className="text-xs text-muted">{item.type}</span>
                        {clickable && !previewMode ? (
                          <button
                            type="button"
                            onClick={() => onItemClick(item.linkedRecordId!, item.linkedRecordType!)}
                            className="truncate text-left text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                          >
                            {item.label}
                          </button>
                        ) : (
                          <span className="truncate text-sm text-text">{item.label}</span>
                        )}
                      </div>
                      <span className="shrink-0 text-xs text-muted" title={item.timestamp}>
                        {item.timestampRelative}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        {isLoading ? <div className="my-sm h-5 rounded-control bg-muted/20" /> : null}

        {hasMore && !isLoading && !previewMode ? (
          <button
            type="button"
            onClick={onLoadMore}
            className="py-sm text-xs text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            Load earlier
          </button>
        ) : null}
      </div>
    </div>
  );
};
