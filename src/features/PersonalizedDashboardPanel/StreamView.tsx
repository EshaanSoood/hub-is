import { useMemo, useState } from 'react';
import {
  DATE_BUCKET_LABELS,
  DATE_BUCKET_ORDER,
  type DateBucketId,
  useDateBuckets,
} from '../../hooks/useDateBuckets';
import { FilterChip, Select } from '../../components/primitives';
import type { ProjectRecord } from '../../types/domain';
import { ItemRow } from './ItemRow';
import type { HubDashboardItem, StreamSort, StreamTypeFilter } from './types';
import { sortByDueThenUpdated, sortByUpdated } from './utils';

type StreamBucketId = DateBucketId;

const STREAM_FILTERS: StreamTypeFilter[] = ['all', 'tasks', 'events'];
const STREAM_BUCKET_ORDER = DATE_BUCKET_ORDER;

const streamFilterLabels: Record<StreamTypeFilter, string> = {
  all: 'All',
  tasks: 'Tasks',
  events: 'Events',
};

const streamBucketOverlayOpacity: Record<StreamBucketId, number> = {
  overdue: 0.14,
  today: 0.12,
  tomorrow: 0.09,
  'rest-of-week': 0.07,
  'later-this-month': 0.04,
  'later-this-year': 0.02,
  beyond: 0,
  'no-date': 0,
};

interface StreamViewProps {
  items: HubDashboardItem[];
  projects: ProjectRecord[];
  onOpenRecord: (recordId: string) => void;
  now: Date;
}

export const StreamView = ({ items, projects, onOpenRecord, now }: StreamViewProps) => {
  const [sortMode, setSortMode] = useState<StreamSort>('due');
  const [typeFilter, setTypeFilter] = useState<StreamTypeFilter>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');

  const filteredItems = useMemo(() => {
    let next = items;
    if (typeFilter !== 'all') {
      next = next.filter((item) => (typeFilter === 'tasks' ? item.kind === 'task' : item.kind === 'event'));
    }
    if (projectFilter !== 'all') {
      next = next.filter((item) => item.projectId === projectFilter);
    }
    return sortMode === 'updated' ? sortByUpdated(next) : sortByDueThenUpdated(next);
  }, [items, projectFilter, sortMode, typeFilter]);

  const bucketedSections = useDateBuckets({
    items: filteredItems,
    getDate: (item) => item.dueAt,
    now,
    order: STREAM_BUCKET_ORDER,
    labels: DATE_BUCKET_LABELS,
  });

  const projectOptions = [
    { value: 'all', label: 'All projects' },
    ...projects.map((project) => ({ value: project.id, label: project.name })),
  ];

  return (
    <div className="relative space-y-4">
      <h2 className="sr-only">Stream</h2>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {STREAM_FILTERS.map((filter) => (
            <FilterChip
              key={filter}
              selected={typeFilter === filter}
              onClick={() => setTypeFilter(filter)}
            >
              {streamFilterLabels[filter]}
            </FilterChip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-control border border-border-muted bg-surface p-1">
            <button
              type="button"
              onClick={() => setSortMode('due')}
              className={`rounded-control px-2 py-1 text-xs font-medium ${sortMode === 'due' ? 'bg-accent text-on-primary' : 'text-muted'}`}
            >
              By due date
            </button>
            <button
              type="button"
              onClick={() => setSortMode('updated')}
              className={`rounded-control px-2 py-1 text-xs font-medium ${sortMode === 'updated' ? 'bg-accent text-on-primary' : 'text-muted'}`}
            >
              By last updated
            </button>
          </div>
          <Select
            value={projectFilter}
            onValueChange={setProjectFilter}
            options={projectOptions}
            ariaLabel="Filter stream by project"
            triggerClassName="min-w-44"
          />
        </div>
      </div>

      {bucketedSections.length === 0 ? (
        <p className="rounded-panel border border-border-muted bg-surface px-4 py-10 text-center text-sm text-muted">Nothing here.</p>
      ) : (
        <div className="space-y-2">
          {bucketedSections.map((section) => {
            const overlayOpacity = streamBucketOverlayOpacity[section.id];
            const background = overlayOpacity > 0
              ? `linear-gradient(rgba(180, 194, 210, ${overlayOpacity}), rgba(180, 194, 210, ${overlayOpacity})), var(--color-surface-elevated)`
              : 'var(--color-surface-elevated)';
            return (
              <section
                key={section.id}
                aria-labelledby={`stream-section-${section.id}`}
                className="rounded-panel border border-border-muted p-3"
                style={{ background }}
              >
                <h3
                  id={`stream-section-${section.id}`}
                  className="mb-2 font-serif text-right text-xs font-medium text-text-secondary"
                >
                  {section.label}
                </h3>
                <div className="space-y-2">
                  {section.items.map((item) => (
                    <ItemRow key={item.id} item={item} onOpen={onOpenRecord} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};
