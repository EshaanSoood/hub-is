import { useMemo, useState } from 'react';
import { useAuthz } from '../context/AuthzContext';
import { dashboardCardRegistry } from '../lib/dashboardCards';
import { buildEventDestinationHref, buildTaskDestinationHref } from '../lib/hubRoutes';
import type { ProjectRecord } from '../types/domain';
import type { getHubHome } from '../services/hub/records';
import { Chip, FilterChip, Select, Tabs, TabButton, TabsContent, TabsList } from '../components/primitives';

type HubHomeData = Awaited<ReturnType<typeof getHubHome>>;
type HubTask = HubHomeData['tasks'][number];
type HubEvent = HubHomeData['events'][number];
type HubDashboardView = 'daily-brief' | 'project-lens' | 'stream';
type StreamSort = 'due' | 'updated';
type StreamTypeFilter = 'all' | 'tasks' | 'events';
type DailyBucket = 'today' | 'next-7-days' | 'later';

type HubDashboardItem =
  | {
      id: string;
      kind: 'task';
      recordId: string;
      title: string;
      projectId: string | null;
      projectName: string | null;
      dueAt: string | null;
      updatedAt: string;
      unread: boolean;
      badgeLabel: 'Task';
      subtitle?: string;
      explicitHref: string;
    }
  | {
      id: string;
      kind: 'event';
      recordId: string;
      title: string;
      projectId: string | null;
      projectName: string | null;
      dueAt: string | null;
      updatedAt: string;
      unread: boolean;
      badgeLabel: 'Event';
      subtitle?: string;
      explicitHref: string;
    };

const VIEW_ORDER: HubDashboardView[] = ['daily-brief', 'project-lens', 'stream'];
const STREAM_FILTERS: StreamTypeFilter[] = ['all', 'tasks', 'events'];

const viewLabels: Record<HubDashboardView, string> = {
  'daily-brief': 'Daily Brief',
  'project-lens': 'Project Lens',
  stream: 'Stream',
};

const streamFilterLabels: Record<StreamTypeFilter, string> = {
  all: 'All',
  tasks: 'Tasks',
  events: 'Events',
};

const bucketLabels: Record<DailyBucket, string> = {
  today: 'Today',
  'next-7-days': 'Next 7 Days',
  later: 'Later',
};

const startOfDay = (date: Date): Date => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const endOfDay = (date: Date): Date => {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
};

const parseIso = (value: string | null | undefined): Date | null => {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
};

const formatRelativeDateTime = (value: string | null): string => {
  const parsed = parseIso(value);
  if (!parsed) {
    return 'No date';
  }
  const now = new Date();
  const dayDelta = Math.round((startOfDay(parsed).getTime() - startOfDay(now).getTime()) / 86_400_000);
  if (dayDelta === 0) {
    return `Today ${parsed.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  }
  if (dayDelta === 1) {
    return `Tomorrow ${parsed.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  }
  if (dayDelta > 1 && dayDelta < 7) {
    return parsed.toLocaleDateString([], { weekday: 'long', hour: 'numeric', minute: '2-digit' });
  }
  if (dayDelta < 0) {
    return `Overdue ${parsed.toLocaleDateString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`;
  }
  return parsed.toLocaleDateString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

const sortByDueThenUpdated = (items: HubDashboardItem[]): HubDashboardItem[] =>
  [...items].sort((left, right) => {
    const leftDue = parseIso(left.dueAt)?.getTime() ?? Number.POSITIVE_INFINITY;
    const rightDue = parseIso(right.dueAt)?.getTime() ?? Number.POSITIVE_INFINITY;
    if (leftDue !== rightDue) {
      return leftDue - rightDue;
    }
    const leftUpdated = parseIso(left.updatedAt)?.getTime() ?? 0;
    const rightUpdated = parseIso(right.updatedAt)?.getTime() ?? 0;
    return rightUpdated - leftUpdated;
  });

const sortByUpdated = (items: HubDashboardItem[]): HubDashboardItem[] =>
  [...items].sort((left, right) => {
    const leftUpdated = parseIso(left.updatedAt)?.getTime() ?? 0;
    const rightUpdated = parseIso(right.updatedAt)?.getTime() ?? 0;
    return rightUpdated - leftUpdated;
  });

const buildTaskItems = (tasks: HubTask[]): HubDashboardItem[] =>
  tasks.map((task) => ({
    id: `task:${task.record_id}`,
    kind: 'task',
    recordId: task.record_id,
    title: task.title,
    projectId: task.project_id,
    projectName: task.project_name,
    dueAt: task.task_state.due_at ?? null,
    updatedAt: task.updated_at,
    unread: false,
    badgeLabel: 'Task',
    subtitle: task.task_state.priority ? `${task.task_state.status} · ${task.task_state.priority}` : task.task_state.status,
    explicitHref: buildTaskDestinationHref(task),
  }));

const buildEventItems = (events: HubEvent[]): HubDashboardItem[] =>
  events.map((event) => ({
    id: `event:${event.record_id}`,
    kind: 'event',
    recordId: event.record_id,
    title: event.title,
    projectId: event.project_id,
    projectName: event.project_name,
    dueAt: event.event_state.start_dt,
    updatedAt: event.updated_at,
    unread: false,
    badgeLabel: 'Event',
    explicitHref: buildEventDestinationHref(event),
  }));

const toDailyBucket = (item: HubDashboardItem): DailyBucket | null => {
  const due = parseIso(item.dueAt);
  if (!due) {
    return null;
  }
  const now = new Date();
  if (due <= endOfDay(now)) {
    return 'today';
  }
  const nextWeek = startOfDay(now);
  nextWeek.setDate(nextWeek.getDate() + 7);
  if (due <= endOfDay(nextWeek)) {
    return 'next-7-days';
  }
  return 'later';
};

const projectDotClassNames = [
  'bg-[color:var(--color-primary)]',
  'bg-[color:var(--color-info)]',
  'bg-[color:var(--color-success)]',
  'bg-[color:var(--color-warning)]',
  'bg-[color:var(--color-danger)]',
];

const projectDotClassName = (projectId: string | null): string => {
  if (!projectId) {
    return 'bg-[color:var(--color-muted)]';
  }
  let hash = 0;
  for (let index = 0; index < projectId.length; index += 1) {
    hash = (hash << 5) - hash + projectId.charCodeAt(index);
    hash |= 0;
  }
  return projectDotClassNames[Math.abs(hash) % projectDotClassNames.length] || projectDotClassNames[0];
};

const ItemRow = ({
  item,
  onOpen,
}: {
  item: HubDashboardItem;
  onOpen: (recordId: string) => void;
}) => {
  const canOpen = Boolean(item.recordId);
  const content = (
    <>
      <div className="flex min-w-0 items-start gap-3">
        <Chip variant="neutral" className="shrink-0">
          {item.badgeLabel}
        </Chip>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-semibold text-text">{item.title}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${projectDotClassName(item.projectId)}`} aria-hidden="true" />
            <span>{item.projectName || 'Inbox & Unassigned'}</span>
            {item.subtitle ? <span>{item.subtitle}</span> : null}
          </div>
        </div>
        {item.dueAt ? <span className="shrink-0 text-xs text-muted">{formatRelativeDateTime(item.dueAt)}</span> : null}
      </div>
      <div className="mt-3 text-[11px] text-muted">Open in Record Inspector</div>
    </>
  );

  if (!canOpen || !item.recordId) {
    return (
      <div className="flex flex-wrap items-start gap-2">
        <article className={`min-w-0 flex-1 rounded-panel border p-3 ${item.unread ? 'border-primary/40' : 'border-border-muted'} bg-surface`}>
          {content}
        </article>
        <a
          href={item.explicitHref}
          className="rounded-control border border-border-muted px-2 py-1 text-xs font-medium text-primary"
        >
          Go to project
        </a>
      </div>
    );
  }

  const recordId = item.recordId;
  return (
    <div className="flex flex-wrap items-start gap-2">
      <button
        type="button"
        onClick={() => onOpen(recordId)}
        className={`min-w-0 flex-1 rounded-panel border p-3 text-left ${item.unread ? 'border-primary/40' : 'border-border-muted'} bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring`}
      >
        {content}
      </button>
      <a
        href={item.explicitHref}
        className="rounded-control border border-border-muted px-2 py-1 text-xs font-medium text-primary"
      >
        Go to project
      </a>
    </div>
  );
};

const DailyBriefView = ({
  items,
  onOpenRecord,
}: {
  items: HubDashboardItem[];
  onOpenRecord: (recordId: string) => void;
}) => {
  const grouped = useMemo(() => {
    const buckets: Record<DailyBucket, HubDashboardItem[]> = {
      today: [],
      'next-7-days': [],
      later: [],
    };
    for (const item of items) {
      const bucket = toDailyBucket(item);
      if (!bucket) {
        continue;
      }
      buckets[bucket].push(item);
    }
    return {
      today: sortByDueThenUpdated(buckets.today),
      'next-7-days': sortByDueThenUpdated(buckets['next-7-days']),
      later: sortByDueThenUpdated(buckets.later),
    };
  }, [items]);

  return (
    <div className="space-y-6">
      {(['today', 'next-7-days', 'later'] as DailyBucket[]).map((bucket) => {
        if (bucket === 'later' && grouped.later.length === 0) {
          return null;
        }
        const bucketItems = grouped[bucket];
        return (
          <section key={bucket} className="space-y-3">
            <div className="sticky top-0 z-10 rounded-panel border border-border-muted bg-surface-elevated px-3 py-2">
              <h3 className="text-sm font-semibold text-primary">{bucketLabels[bucket]}</h3>
            </div>
            {bucketItems.length === 0 ? (
              <p className="rounded-panel border border-border-muted bg-surface px-3 py-4 text-sm text-muted">
                {bucket === 'today' ? 'Nothing due today.' : 'Clear week ahead.'}
              </p>
            ) : (
              <div className="space-y-3">
                {(['task', 'event'] as HubDashboardItem['kind'][]).map((kind) => {
                  const kindItems = bucketItems.filter((item) => item.kind === kind);
                  if (kindItems.length === 0) {
                    return null;
                  }
                  return (
                    <div key={kind} className="space-y-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted">
                        {kind === 'task' ? 'Tasks' : 'Events'}
                      </p>
                      <div className="space-y-2">
                        {kindItems.map((item) => (
                          <ItemRow key={item.id} item={item} onOpen={onOpenRecord} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
};

const ProjectLensView = ({
  items,
  projects,
  onOpenRecord,
}: {
  items: HubDashboardItem[];
  projects: ProjectRecord[];
  onOpenRecord: (recordId: string) => void;
}) => {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const groupedItems = useMemo(() => {
    const map = new Map<string, HubDashboardItem[]>();
    map.set('__inbox__', items.filter((item) => !item.projectId));
    for (const project of projects) {
      map.set(project.id, items.filter((item) => item.projectId === project.id));
    }
    return map;
  }, [items, projects]);

  const sections = [
    { id: '__inbox__', name: 'Inbox & Unassigned', items: groupedItems.get('__inbox__') || [] },
    ...projects.map((project) => ({
      id: project.id,
      name: project.name,
      items: groupedItems.get(project.id) || [],
    })),
  ];

  return (
    <div className="space-y-4">
      {sections.map((section) => {
        const isCollapsed = collapsed[section.id] === true;
        return (
          <section key={section.id} className="rounded-panel border border-border-muted bg-surface">
            <button
              type="button"
              onClick={() => setCollapsed((current) => ({ ...current, [section.id]: !current[section.id] }))}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className={`inline-block h-2.5 w-2.5 rounded-full ${projectDotClassName(section.id === '__inbox__' ? null : section.id)}`} />
                <span className="truncate text-sm font-semibold text-text">{section.name}</span>
              </div>
              <span className="text-xs text-muted">{section.items.length} item{section.items.length === 1 ? '' : 's'}</span>
            </button>
            {!isCollapsed ? (
              <div className="border-t border-border-muted px-4 py-3">
                {section.items.length === 0 ? (
                  <p className="text-sm text-muted">
                    {section.id === '__inbox__' ? 'A Penny For Your Thoughts?' : 'Nothing assigned to you here.'}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {sortByDueThenUpdated(section.items).map((item) => (
                      <ItemRow key={item.id} item={item} onOpen={onOpenRecord} />
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </section>
        );
      })}
      {projects.length === 0 ? <p className="rounded-panel border border-border-muted bg-surface px-4 py-8 text-center text-sm text-muted">No projects yet.</p> : null}
    </div>
  );
};

const StreamView = ({
  items,
  projects,
  onOpenRecord,
}: {
  items: HubDashboardItem[];
  projects: ProjectRecord[];
  onOpenRecord: (recordId: string) => void;
}) => {
  const [sortMode, setSortMode] = useState<StreamSort>('due');
  const [typeFilter, setTypeFilter] = useState<StreamTypeFilter>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');

  const filteredItems = useMemo(() => {
    let next = items;
    if (typeFilter !== 'all') {
      next = next.filter((item) => (typeFilter === 'tasks' ? item.kind === 'task' : typeFilter === 'events' ? item.kind === 'event' : false));
    }
    if (projectFilter !== 'all') {
      next = next.filter((item) => item.projectId === projectFilter);
    }
    return sortMode === 'updated' ? sortByUpdated(next) : sortByDueThenUpdated(next);
  }, [items, projectFilter, sortMode, typeFilter]);

  const projectOptions = [
    { value: 'all', label: 'All projects' },
    ...projects.map((project) => ({ value: project.id, label: project.name })),
  ];

  return (
    <div className="space-y-4">
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

      {filteredItems.length === 0 ? (
        <p className="rounded-panel border border-border-muted bg-surface px-4 py-10 text-center text-sm text-muted">Nothing here.</p>
      ) : (
        <div className="space-y-2">
          {filteredItems.map((item) => (
            <ItemRow key={item.id} item={item} onOpen={onOpenRecord} />
          ))}
        </div>
      )}
    </div>
  );
};

export const PersonalizedDashboardPanel = ({
  homeData,
  homeLoading,
  homeError,
  projects,
  onOpenRecord,
}: {
  homeData: HubHomeData;
  homeLoading: boolean;
  homeError: string | null;
  projects: ProjectRecord[];
  onOpenRecord: (recordId: string) => void;
}) => {
  const { canGlobal, sessionSummary } = useAuthz();
  const [activeView, setActiveView] = useState<HubDashboardView>('daily-brief');
  const visibleDashboardCards = useMemo(
    () =>
      dashboardCardRegistry.filter((card) => {
        const hasGlobalCaps = card.requiredGlobalCapabilities.every((capability) =>
          sessionSummary.globalCapabilities.includes(capability),
        );
        if (!hasGlobalCaps) {
          return false;
        }
        if (!card.requiredProjectCapability) {
          return true;
        }
        const requiredProjectCapability = card.requiredProjectCapability;
        return projects.some((project) =>
          (sessionSummary.projectCapabilities[project.id] ?? []).includes(requiredProjectCapability),
        );
      }),
    [projects, sessionSummary.globalCapabilities, sessionSummary.projectCapabilities],
  );

  const items = useMemo(
    () => [
      ...buildTaskItems(homeData.tasks),
      ...buildEventItems(homeData.events),
    ],
    [homeData.events, homeData.tasks],
  );

  const hasHubView = canGlobal('hub.view') || visibleDashboardCards.some((card) => card.requiredGlobalCapabilities.includes('hub.view'));
  const availableViewIds = useMemo(
    () => (hasHubView ? VIEW_ORDER : (['daily-brief'] as HubDashboardView[])),
    [hasHubView],
  );

  const selectedView = availableViewIds.includes(activeView) ? activeView : availableViewIds[0];

  return (
    <section className="rounded-panel border border-subtle bg-elevated p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="heading-3 text-primary">Hub</h2>
          <p className="mt-1 text-sm text-muted">Your personal rollup across projects, with everything opening in the Record Inspector.</p>
        </div>
        {homeLoading ? <span className="text-xs text-muted">Refreshing…</span> : null}
      </div>

      {homeError ? (
        <p className="mt-3 text-sm text-danger" role="alert">
          {homeError}
        </p>
      ) : null}

      <Tabs value={selectedView} onValueChange={(value) => setActiveView(value as HubDashboardView)} className="mt-4">
        <TabsList variant="compact" className="inline-flex rounded-panel border border-border-muted bg-surface p-1">
          {availableViewIds.map((viewId) => (
            <TabButton key={viewId} value={viewId} variant="compact">
              {viewLabels[viewId]}
            </TabButton>
          ))}
        </TabsList>

        <TabsContent value="daily-brief" className="mt-4">
          <DailyBriefView items={items} onOpenRecord={onOpenRecord} />
        </TabsContent>
        <TabsContent value="project-lens" className="mt-4">
          <ProjectLensView items={items} projects={projects} onOpenRecord={onOpenRecord} />
        </TabsContent>
        <TabsContent value="stream" className="mt-4">
          <StreamView items={items} projects={projects} onOpenRecord={onOpenRecord} />
        </TabsContent>
      </Tabs>
    </section>
  );
};
