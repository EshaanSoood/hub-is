import { useMemo } from 'react';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../primitives/Menu';
import { Icon } from '../primitives/Icon';
import { cn } from '../../lib/cn';
import { PRIORITY_DOT_CLASS } from '../../lib/priorityStyles';

export type TimelineEventType = 'task' | 'event' | 'milestone' | 'file' | 'workspace';
export type TimelineFilterValue = 'all' | TimelineEventType;

export interface TimelineItem {
  id: string;
  type: TimelineEventType;
  label: string;
  timestamp: string;
  timestampIso?: string;
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
  onFilterToggle: (type: TimelineFilterValue) => void;
  onLoadMore: () => void;
  onItemClick: (recordId: string, recordType: string) => void;
  bottomAnchor?: boolean;
  className?: string;
  previewMode?: boolean;
  showFilters?: boolean;
}

export const TIMELINE_FILTER_TYPES: TimelineEventType[] = ['task', 'event', 'milestone', 'file', 'workspace'];

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

const DAY_MS = 24 * 60 * 60 * 1000;

const parseTimelineDate = (value: string): Date | null => {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
};

const startOfLocalDay = (date: Date): number =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

const formatAbsoluteDate = (date: Date, includeYear: boolean): string =>
  new Intl.DateTimeFormat([], {
    month: 'short',
    day: 'numeric',
    ...(includeYear ? { year: 'numeric' } : {}),
  }).format(date);

const formatTimelineDateLabel = (cluster: TimelineCluster): string => {
  const firstItem = cluster.items[0];
  const date = parseTimelineDate(firstItem?.timestampIso ?? '') ?? parseTimelineDate(firstItem?.timestamp ?? '') ?? parseTimelineDate(cluster.date);
  if (!date) {
    return cluster.date;
  }

  const now = new Date();
  const dayDelta = Math.floor((startOfLocalDay(now) - startOfLocalDay(date)) / DAY_MS);
  if (dayDelta <= 0) {
    return 'Today';
  }
  if (dayDelta === 1) {
    return 'Yesterday';
  }
  if (dayDelta < 7) {
    return `${dayDelta} days ago`;
  }
  return formatAbsoluteDate(date, date.getFullYear() !== now.getFullYear());
};

const timelineFilterSummary = (activeFilters: TimelineEventType[]): string => {
  const allFiltersSelected = TIMELINE_FILTER_TYPES.every((type) => activeFilters.includes(type));
  if (allFiltersSelected) {
    return 'All';
  }
  if (activeFilters.length === 0) {
    return 'None';
  }
  return activeFilters.map((type) => FILTER_LABELS[type]).join(', ');
};

export const TimelineFilterMenu = ({
  activeFilters,
  onFilterToggle,
}: {
  activeFilters: TimelineEventType[];
  onFilterToggle: (type: TimelineFilterValue) => void;
}) => {
  const allFiltersSelected = TIMELINE_FILTER_TYPES.every((type) => activeFilters.includes(type));
  const filterSummary = timelineFilterSummary(activeFilters);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Timeline filters: ${filterSummary}`}
          className="inline-flex max-w-full items-center gap-xs rounded-control border border-subtle bg-surface px-sm py-xs text-xs text-text shadow-soft-subtle transition-colors hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          <Icon name="filter" className="h-3.5 w-3.5 shrink-0" />
          <span className="shrink-0">Filters:</span>
          <span className="max-w-48 truncate text-muted">{filterSummary}</span>
          <Icon name="chevron-down" className="h-3.5 w-3.5 shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-52">
        <DropdownMenuLabel>Timeline filters</DropdownMenuLabel>
        <DropdownMenuCheckboxItem
          checked={allFiltersSelected}
          onSelect={(event) => event.preventDefault()}
          onCheckedChange={() => onFilterToggle('all')}
        >
          All
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        {TIMELINE_FILTER_TYPES.map((type) => (
          <DropdownMenuCheckboxItem
            key={type}
            checked={activeFilters.includes(type)}
            onSelect={(event) => event.preventDefault()}
            onCheckedChange={() => onFilterToggle(type)}
          >
            {FILTER_LABELS[type]}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export const TimelineFeed = ({
  clusters,
  activeFilters,
  isLoading,
  hasMore,
  onFilterToggle,
  onLoadMore,
  onItemClick,
  bottomAnchor = false,
  className,
  previewMode = false,
  showFilters = true,
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
    <div className={cn('flex h-full min-h-0 flex-col gap-sm', className)}>
      {!previewMode && showFilters ? (
        <div className="self-start">
          <TimelineFilterMenu activeFilters={activeFilters} onFilterToggle={onFilterToggle} />
        </div>
      ) : null}

      <div role="feed" aria-busy={isLoading} className="timeline-feed-scroll min-h-0 flex-1 overflow-y-auto">
        <div className={cn('timeline-mast pb-6', bottomAnchor && 'flex min-h-full flex-col justify-end')}>
          {visibleClusters.length === 0 && !isLoading ? <p className="text-sm text-muted">No timeline events match filters.</p> : null}

          {visibleClusters.map((cluster) => (
            <section key={cluster.date}>
              <h3 className="timeline-date-label py-xs text-sm font-semibold text-muted">{formatTimelineDateLabel(cluster)}</h3>
              <div className="space-y-0">
                {cluster.items.map((item) => {
                  const clickable = Boolean(item.linkedRecordId && item.linkedRecordType);
                  const itemLabel = `${item.type}: ${item.label}. ${item.timestamp}`;
                  return (
                    <div
                      key={item.id}
                      role="article"
                      aria-label={itemLabel}
                      title={item.timestamp}
                      className="timeline-entry-row pb-sm"
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          'timeline-entry-dot h-[var(--timeline-node-size)] w-[var(--timeline-node-size)] rounded-full ring-2 ring-surface',
                          TIMELINE_DOT_CLASS[item.type],
                        )}
                      />

                      <div className="flex min-w-0 flex-wrap items-center gap-xs">
                        <span className="text-xs text-muted">{item.type}</span>
                        {clickable && !previewMode ? (
                          <button
                            type="button"
                            onClick={() => onItemClick(item.linkedRecordId!, item.linkedRecordType!)}
                            aria-label={itemLabel}
                            title={item.timestamp}
                            className="truncate text-left text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                          >
                            {item.label}
                          </button>
                        ) : (
                          <span aria-label={itemLabel} title={item.timestamp} className="truncate text-sm text-text">
                            {item.label}
                          </span>
                        )}
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
    </div>
  );
};
