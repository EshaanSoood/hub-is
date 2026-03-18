import { KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useAuthz } from '../context/AuthzContext';
import { CalendarModuleSkin } from '../components/project-space/CalendarModuleSkin';
import { RemindersModuleSkin } from '../components/project-space/RemindersModuleSkin';
import { usePersonalCalendarRuntime } from '../hooks/usePersonalCalendarRuntime';
import { useRemindersRuntime } from '../hooks/useRemindersRuntime';
import { dashboardCardRegistry } from '../lib/dashboardCards';
import { buildEventDestinationHref, buildTaskDestinationHref } from '../lib/hubRoutes';
import type { ProjectRecord } from '../types/domain';
import { createEventFromNlp } from '../services/hub/records';
import type { getHubHome } from '../services/hub/records';
import { Chip, FilterChip, Popover, PopoverContent, PopoverTrigger, Select, Tabs, TabsContent } from '../components/primitives';

type HubHomeData = Awaited<ReturnType<typeof getHubHome>>;
type HubCapture = HubHomeData['captures'][number];
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

const formatCreatedAt = (value: string | null): string => {
  const parsed = parseIso(value);
  if (!parsed) {
    return 'Unknown date';
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

const toDailyBucket = (item: HubDashboardItem): DailyBucket => {
  const due = parseIso(item.dueAt);
  if (!due) {
    return 'today';
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
  captures,
  items,
  onOpenRecord,
}: {
  captures: HubCapture[];
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
      <section className="space-y-3">
        <div className="sticky top-0 z-10 rounded-panel border border-border-muted bg-surface-elevated px-3 py-2">
          <h3 className="text-sm font-semibold text-primary">Inbox</h3>
        </div>
        {captures.length === 0 ? (
          <p className="rounded-panel border border-border-muted bg-surface px-3 py-4 text-sm text-muted">
            Nothing uncategorized.
          </p>
        ) : (
          <div className="space-y-2">
            {captures.map((capture) => (
              <button
                key={capture.record_id}
                type="button"
                onClick={() => onOpenRecord(capture.record_id)}
                className="flex w-full items-center justify-between gap-3 rounded-panel border border-border-muted bg-surface px-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                <span className="min-w-0 truncate text-sm font-semibold text-text">{capture.title || 'Untitled record'}</span>
                <span className="shrink-0 text-xs text-muted">{formatCreatedAt(capture.created_at)}</span>
              </button>
            ))}
          </div>
        )}
      </section>

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
  const { accessToken, canGlobal, sessionSummary } = useAuthz();
  const [activeView, setActiveView] = useState<HubDashboardView>('daily-brief');
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const [activeViewOptionIndex, setActiveViewOptionIndex] = useState(0);
  const viewListboxId = useId();
  const viewTriggerRef = useRef<HTMLButtonElement | null>(null);
  const viewListboxRef = useRef<HTMLDivElement | null>(null);
  const remindersRuntime = useRemindersRuntime(accessToken ?? null);
  const {
    calendarEvents,
    calendarError,
    calendarLoading,
    calendarMode,
    refreshCalendar,
    setCalendarMode,
  } = usePersonalCalendarRuntime(accessToken ?? null);
  const [calendarCreateProjectId, setCalendarCreateProjectId] = useState(() => projects[0]?.id || '');

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
  const calendarProjectOptions = useMemo(
    () => projects.map((project) => ({ value: project.id, label: project.name })),
    [projects],
  );
  const selectedCalendarCreateProjectId = useMemo(() => {
    if (projects.length === 0) {
      return '';
    }
    if (projects.some((project) => project.id === calendarCreateProjectId)) {
      return calendarCreateProjectId;
    }
    return projects[0]?.id || '';
  }, [calendarCreateProjectId, projects]);

  const selectedView = availableViewIds.includes(activeView) ? activeView : availableViewIds[0];

  useEffect(() => {
    if (!viewMenuOpen) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      viewListboxRef.current?.focus();
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [viewMenuOpen]);

  const closeViewMenu = () => {
    setViewMenuOpen(false);
  };

  const selectView = (viewId: HubDashboardView) => {
    setActiveView(viewId);
    closeViewMenu();
  };

  const handleViewMenuOpenChange = (nextOpen: boolean) => {
    setViewMenuOpen(nextOpen);
    if (nextOpen) {
      const selectedIndex = availableViewIds.indexOf(selectedView);
      setActiveViewOptionIndex(selectedIndex >= 0 ? selectedIndex : 0);
    }
  };

  const handleViewListboxKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (availableViewIds.length === 0) {
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      closeViewMenu();
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveViewOptionIndex((current) => (current + 1) % availableViewIds.length);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveViewOptionIndex((current) => (current - 1 + availableViewIds.length) % availableViewIds.length);
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      setActiveViewOptionIndex(0);
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      setActiveViewOptionIndex(availableViewIds.length - 1);
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const nextView = availableViewIds[activeViewOptionIndex];
      if (nextView) {
        selectView(nextView);
      }
    }
  };

  return (
    <section className="rounded-panel border border-subtle bg-elevated p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="heading-3 text-primary">Hub</h2>
        {homeLoading ? <span className="text-xs text-muted">Refreshing…</span> : null}
      </div>

      {homeError ? (
        <p className="mt-3 text-sm text-danger" role="alert">
          {homeError}
        </p>
      ) : null}

      <Tabs value={selectedView} onValueChange={(value) => setActiveView(value as HubDashboardView)} className="mt-4">
        <Popover open={viewMenuOpen} onOpenChange={handleViewMenuOpenChange}>
          <PopoverTrigger asChild>
            <button
              ref={viewTriggerRef}
              type="button"
              className="inline-flex items-center gap-2 rounded-panel border border-border-muted bg-surface px-3 py-2 text-sm font-semibold text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              aria-haspopup="listbox"
              aria-expanded={viewMenuOpen}
              aria-controls={viewMenuOpen ? viewListboxId : undefined}
            >
              <span>{viewLabels[selectedView]}</span>
              <span aria-hidden="true" className="text-xs text-muted">
                ▾
              </span>
            </button>
          </PopoverTrigger>
        <PopoverContent
            align="start"
            className="w-56 border border-border-muted bg-surface p-1.5"
            onOpenAutoFocus={(event) => {
              event.preventDefault();
            }}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              viewTriggerRef.current?.focus();
            }}
          >
            <div
              id={viewListboxId}
              ref={viewListboxRef}
              role="listbox"
              tabIndex={-1}
              aria-label="Hub view mode"
              aria-activedescendant={`${viewListboxId}-option-${availableViewIds[activeViewOptionIndex]}`}
              className="space-y-1 outline-none"
              onKeyDown={handleViewListboxKeyDown}
            >
              {availableViewIds.map((viewId, index) => {
                const selected = selectedView === viewId;
                const active = activeViewOptionIndex === index;
                return (
                  <button
                    key={viewId}
                    id={`${viewListboxId}-option-${viewId}`}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    tabIndex={-1}
                    className={`flex w-full items-center justify-between rounded-control px-3 py-2 text-left text-sm transition-colors ${
                      active
                        ? 'bg-accent text-on-primary'
                        : selected
                          ? 'bg-surface-elevated text-primary ring-1 ring-border-muted'
                          : 'text-text hover:bg-surface-elevated'
                    }`}
                    onMouseEnter={() => setActiveViewOptionIndex(index)}
                    onClick={() => selectView(viewId)}
                  >
                    <span>{viewLabels[viewId]}</span>
                    {selected ? (
                      <span className={`text-[11px] font-medium ${active ? 'text-on-primary/80' : 'text-muted'}`}>Current</span>
                    ) : null}
                    {selected ? (
                      <span aria-hidden="true" className="text-xs">
                        ✓
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>

        <TabsContent value="daily-brief" className="mt-4">
          <DailyBriefView captures={homeData.captures} items={items} onOpenRecord={onOpenRecord} />
        </TabsContent>
        <TabsContent value="project-lens" className="mt-4">
          <ProjectLensView items={items} projects={projects} onOpenRecord={onOpenRecord} />
        </TabsContent>
        <TabsContent value="stream" className="mt-4">
          <StreamView items={items} projects={projects} onOpenRecord={onOpenRecord} />
        </TabsContent>
      </Tabs>

      <div className="mt-4">
        <RemindersModuleSkin
          reminders={remindersRuntime.reminders}
          loading={remindersRuntime.loading}
          error={remindersRuntime.error}
          onDismiss={remindersRuntime.dismiss}
          onCreate={remindersRuntime.create}
          sizeTier="M"
        />
      </div>

      <section className="mt-4 space-y-3" aria-labelledby="personal-dashboard-calendar-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 id="personal-dashboard-calendar-heading" className="text-sm font-semibold text-text">
            Calendar
          </h3>
          {calendarProjectOptions.length > 0 ? (
            <Select
              value={selectedCalendarCreateProjectId}
              onValueChange={setCalendarCreateProjectId}
              options={calendarProjectOptions}
              ariaLabel="Select project for new personal calendar events"
              triggerClassName="min-w-44"
            />
          ) : null}
        </div>
        {calendarError ? (
          <div className="rounded-panel border border-danger/30 bg-danger/5 p-4" role="alert">
            <p className="text-sm text-danger">{calendarError}</p>
            <button
              type="button"
              onClick={() => {
                void refreshCalendar();
              }}
              className="mt-3 rounded-control border border-border-muted px-3 py-1.5 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              Retry
            </button>
          </div>
        ) : (
          <CalendarModuleSkin
            events={calendarEvents}
            loading={calendarLoading}
            scope={calendarMode}
            onScopeChange={setCalendarMode}
            onOpenRecord={onOpenRecord}
            onCreateEvent={
              accessToken && selectedCalendarCreateProjectId
                ? async (payload) => {
                    await createEventFromNlp(accessToken, selectedCalendarCreateProjectId, payload);
                    await refreshCalendar();
                  }
                : undefined
            }
          />
        )}
      </section>
    </section>
  );
};
