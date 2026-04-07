import { KeyboardEvent, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthz } from '../context/AuthzContext';
import {
  DATE_BUCKET_LABELS,
  DATE_BUCKET_ORDER,
  type DateBucketId,
  useDateBuckets,
} from '../hooks/useDateBuckets';
import { useRemindersRuntime } from '../hooks/useRemindersRuntime';
import { dashboardCardRegistry } from '../lib/dashboardCards';
import { requestHubHomeRefresh } from '../lib/hubHomeRefresh';
import { buildEventDestinationHref, buildTaskDestinationHref } from '../lib/hubRoutes';
import { requestQuickAddProject } from '../lib/quickAddProjectRequest';
import type { ProjectRecord } from '../types/domain';
import { updateRecord } from '../services/hub/records';
import { dismissReminder, updateReminder } from '../services/hub/reminders';
import type { EventSummary, HubHomeResponse, TaskSummary } from '../shared/api-types';
import {
  Chip,
  FilterChip,
  HubOsWordmark,
  Icon,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
} from '../components/primitives';
import { ContextBar } from '../components/hub-home/ContextBar';
import { DayStrip } from '../components/hub-home/DayStrip';
import { TriagePanel } from '../components/hub-home/TriagePanel';
import type {
  DayStripEventItem,
  DayStripReminderItem,
  DayStripTaskItem,
  TimelineTypeFilter,
  TriageDragPayload,
  TriageReminderItem,
  TriageTaskItem,
} from '../components/hub-home/types';

type HubHomeData = HubHomeResponse;
type HubTask = TaskSummary;
type HubEvent = EventSummary;
export type HubDashboardView = 'project-lens' | 'stream';
type StreamSort = 'due' | 'updated';
type StreamTypeFilter = 'all' | 'tasks' | 'events';
type StreamBucketId = DateBucketId;

export type HubDashboardItem =
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

const VIEW_ORDER: HubDashboardView[] = ['project-lens', 'stream'];
const STREAM_FILTERS: StreamTypeFilter[] = ['all', 'tasks', 'events'];
const STREAM_BUCKET_ORDER = DATE_BUCKET_ORDER;

const viewLabels: Record<HubDashboardView, string> = {
  'project-lens': 'Project Lens',
  stream: 'Stream',
};

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

const startOfDay = (date: Date): Date => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const parseIso = (value: string | null | undefined): Date | null => {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
};

const isSameCalendarDay = (left: Date, right: Date): boolean =>
  startOfDay(left).getTime() === startOfDay(right).getTime();

const isMidnightLocal = (date: Date): boolean =>
  date.getHours() === 0 && date.getMinutes() === 0 && date.getSeconds() === 0 && date.getMilliseconds() === 0;

const tomorrowAtNineIso = (): string => {
  const next = new Date();
  next.setDate(next.getDate() + 1);
  next.setHours(9, 0, 0, 0);
  return next.toISOString();
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

const formatCountLabel = (count: number, singular: string): string =>
  `${count} ${count === 1 ? singular : `${singular}s`}`;

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

export const buildTaskItems = (tasks: HubTask[]): HubDashboardItem[] =>
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

export const ItemRow = ({
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
      className={`block rounded-panel border p-3 ${item.unread ? 'border-primary/40' : 'border-border-muted'} bg-surface`}
    >
      {content}
    </a>
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
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [hiddenSections, setHiddenSections] = useState<Record<string, boolean>>({});
  const [filterOpen, setFilterOpen] = useState(false);
  const filterListId = useId();
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
  const visibleSections = sections.filter((section) => !hiddenSections[section.id]);
  const filterLabel = visibleSections.length === sections.length
    ? 'All sections'
    : `${visibleSections.length} of ${sections.length} sections`;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
        <h2 className="font-serif text-base font-semibold text-text">
          Project Lens
        </h2>
        <Popover open={filterOpen} onOpenChange={setFilterOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={filterOpen}
              className="inline-flex items-center justify-center gap-2 rounded-control border border-border-muted bg-surface px-3 py-1.5 text-xs font-medium text-text"
            >
              <Icon name="menu" className="text-[12px]" />
              <span>{filterLabel}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent align="center" className="w-64 border border-border-muted bg-surface p-2">
            <div id={filterListId} role="group" aria-label="Project Lens filters" className="space-y-1">
              {sections.map((section) => {
                const checked = !hiddenSections[section.id];
                return (
                  <label key={section.id} className="flex cursor-pointer items-center gap-2 rounded-control px-2 py-1.5 text-sm text-text hover:bg-surface-elevated">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        setHiddenSections((current) => {
                          const next = { ...current };
                          if (checked) {
                            next[section.id] = true;
                          } else {
                            delete next[section.id];
                          }
                          return next;
                        });
                      }}
                    />
                    <span className="truncate">{section.name}</span>
                  </label>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
        <div className="sm:justify-self-end">
          <button
            type="button"
            onClick={() => {
              requestQuickAddProject();
            }}
            className="inline-flex items-center gap-2 rounded-control border border-border-muted bg-surface px-3 py-1.5 text-xs font-medium text-text"
          >
            <Icon name="plus" className="text-[12px]" />
            <span>New Project</span>
          </button>
        </div>
      </div>

      {visibleSections.map((section) => {
        const isExpanded = expandedSections[section.id] ?? section.items.length > 0;
        const sectionPanelId = `project-lens-section-panel-${section.id}`;
        return (
          <section key={section.id} className="rounded-panel border border-border-muted bg-surface">
            <div className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
              <div className="flex min-w-0 items-baseline gap-2">
                <span className={`inline-block h-2.5 w-2.5 rounded-full ${projectDotClassName(section.id === '__inbox__' ? null : section.id)}`} />
                <h3 className="truncate text-sm font-semibold text-text">{section.name}</h3>
                {section.id !== '__inbox__' ? (
                  <Link
                    to={`/projects/${encodeURIComponent(section.id)}/overview`}
                    aria-label={`Go To Project ${section.name}`}
                    className="inline-flex items-baseline gap-1 rounded-control border border-border-muted px-2 py-1 text-xs font-medium text-primary"
                  >
                    <span>Go To Project</span>
                    <Icon name="back" className="rotate-180 text-[10px]" />
                  </Link>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setExpandedSections((current) => ({ ...current, [section.id]: !isExpanded }))}
                aria-expanded={isExpanded}
                aria-controls={isExpanded ? sectionPanelId : undefined}
                className="text-xs text-muted"
              >
                {section.items.length} item{section.items.length === 1 ? '' : 's'}
              </button>
            </div>
            {isExpanded ? (
              <div id={sectionPanelId} className="border-t border-border-muted px-4 py-3">
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
      {visibleSections.length === 0 ? (
        <p className="rounded-panel border border-border-muted bg-surface px-4 py-8 text-center text-sm text-muted">
          No sections selected.
        </p>
      ) : null}
      {projects.length === 0 ? <p className="rounded-panel border border-border-muted bg-surface px-4 py-8 text-center text-sm text-muted">No projects yet.</p> : null}
    </div>
  );
};

const StreamView = ({
  items,
  projects,
  onOpenRecord,
  now,
}: {
  items: HubDashboardItem[];
  projects: ProjectRecord[];
  onOpenRecord: (recordId: string) => void;
  now: Date;
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
    <div className="space-y-4">
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

const greetingForHour = (hour: number): string => {
  if (hour < 12) {
    return 'Good morning';
  }
  if (hour < 18) {
    return 'Good afternoon';
  }
  return 'Good evening';
};

const isTaskComplete = (status: HubTask['task_state']['status']): boolean => status === 'done' || status === 'cancelled';

export const PersonalizedDashboardPanel = ({
  homeData,
  homeLoading,
  homeError,
  projects,
  onOpenRecord,
  initialView,
  onViewChange,
}: {
  homeData: HubHomeData;
  homeLoading: boolean;
  homeError: string | null;
  projects: ProjectRecord[];
  onOpenRecord: (recordId: string) => void;
  initialView?: HubDashboardView;
  onViewChange?: (view: HubDashboardView) => void;
}) => {
  const { accessToken, canGlobal, sessionSummary } = useAuthz();
  const remindersRuntime = useRemindersRuntime(accessToken ?? null);

  const [activeView, setActiveView] = useState<HubDashboardView>(initialView ?? 'project-lens');
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const [activeViewOptionIndex, setActiveViewOptionIndex] = useState(0);
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [timelineTypeFilter, setTimelineTypeFilter] = useState<TimelineTypeFilter>('all');
  const [triageOpen, setTriageOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());

  const viewListboxId = useId();
  const viewTriggerRef = useRef<HTMLButtonElement | null>(null);
  const viewListboxRef = useRef<HTMLDivElement | null>(null);

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
    () => (hasHubView ? VIEW_ORDER : (['project-lens'] as HubDashboardView[])),
    [hasHubView],
  );

  const selectedView = availableViewIds.includes(activeView) ? activeView : availableViewIds[0];

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      setActiveView(initialView ?? 'project-lens');
    }, 0);
    return () => {
      window.clearTimeout(timerId);
    };
  }, [initialView]);

  useEffect(() => {
    onViewChange?.(selectedView);
  }, [onViewChange, selectedView]);

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

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(new Date());
    }, 60_000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

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

  const projectNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const project of projects) {
      map.set(project.id, project.name);
    }
    return map;
  }, [projects]);

  const projectOptions = useMemo(
    () => [
      { value: 'all', label: 'All projects' },
      ...projects.map((project) => ({ value: project.id, label: project.name })),
    ],
    [projects],
  );
  const activeProjectFilter = projectFilter === 'all' || projects.some((project) => project.id === projectFilter)
    ? projectFilter
    : 'all';

  const dailyData = useMemo(() => {
    const todayStart = startOfDay(now);

    const dayEvents: DayStripEventItem[] = homeData.events.flatMap((event) => {
      const startAt = parseIso(event.event_state.start_dt);
      const endAt = parseIso(event.event_state.end_dt);
      if (!startAt || !endAt || !isSameCalendarDay(startAt, now)) {
        return [];
      }
      return [{
        id: `event:${event.record_id}`,
        recordId: event.record_id,
        projectId: event.project_id,
        projectName: event.project_name,
        title: event.title,
        startAtIso: startAt.toISOString(),
        endAtIso: endAt.toISOString(),
      }];
    });

    const timedTasks: DayStripTaskItem[] = [];
    const overdueTasks: TriageTaskItem[] = [];
    const untimedTasks: TriageTaskItem[] = [];

    for (const task of homeData.tasks) {
      const dueAt = parseIso(task.task_state.due_at);
      const complete = isTaskComplete(task.task_state.status);
      if (complete) {
        continue;
      }
      if (dueAt && dueAt < todayStart) {
        overdueTasks.push({
          id: `triage-overdue:${task.record_id}`,
          recordId: task.record_id,
          projectId: task.project_id,
          projectName: task.project_name,
          title: task.title,
          dueAtIso: dueAt.toISOString(),
          priority: task.task_state.priority,
        });
      }

      if (!dueAt || !isSameCalendarDay(dueAt, now)) {
        continue;
      }

      if (isMidnightLocal(dueAt)) {
        untimedTasks.push({
          id: `triage-untimed:${task.record_id}`,
          recordId: task.record_id,
          projectId: task.project_id,
          projectName: task.project_name,
          title: task.title,
          dueAtIso: dueAt.toISOString(),
          priority: task.task_state.priority,
        });
      } else {
        timedTasks.push({
          id: `task:${task.record_id}`,
          recordId: task.record_id,
          projectId: task.project_id,
          projectName: task.project_name,
          title: task.title,
          dueAtIso: dueAt.toISOString(),
          status: task.task_state.status,
        });
      }
    }

    const timedReminders: DayStripReminderItem[] = [];
    const missedReminders: TriageReminderItem[] = [];

    for (const reminder of remindersRuntime.reminders) {
      const remindAt = parseIso(reminder.remind_at);
      if (!remindAt) {
        continue;
      }
      const projectName = projectNameById.get(reminder.project_id) || null;
      if (isSameCalendarDay(remindAt, now)) {
        timedReminders.push({
          id: `reminder:${reminder.reminder_id}`,
          reminderId: reminder.reminder_id,
          recordId: reminder.record_id,
          projectId: reminder.project_id,
          projectName,
          title: reminder.record_title || 'Untitled reminder',
          remindAtIso: remindAt.toISOString(),
          dismissed: false,
        });
      }
      if (remindAt < now) {
        missedReminders.push({
          id: `triage-reminder:${reminder.reminder_id}`,
          reminderId: reminder.reminder_id,
          recordId: reminder.record_id,
          projectId: reminder.project_id,
          projectName,
          title: reminder.record_title || 'Untitled reminder',
          remindAtIso: remindAt.toISOString(),
        });
      }
    }

    return {
      dayEvents,
      timedTasks,
      untimedTasks,
      overdueTasks,
      timedReminders,
      missedReminders,
    };
  }, [homeData.events, homeData.tasks, now, projectNameById, remindersRuntime.reminders]);

  const filteredDailyData = useMemo(() => {
    const matchesProject = (projectId: string | null): boolean => activeProjectFilter === 'all' || projectId === activeProjectFilter;

    return {
      dayEvents: dailyData.dayEvents.filter((event) => matchesProject(event.projectId)),
      timedTasks: dailyData.timedTasks.filter((task) => matchesProject(task.projectId)),
      untimedTasks: dailyData.untimedTasks.filter((task) => matchesProject(task.projectId)),
      overdueTasks: dailyData.overdueTasks.filter((task) => matchesProject(task.projectId)),
      timedReminders: dailyData.timedReminders.filter((reminder) => matchesProject(reminder.projectId)),
      missedReminders: dailyData.missedReminders.filter((reminder) => matchesProject(reminder.projectId)),
    };
  }, [activeProjectFilter, dailyData]);

  const dayCounts = useMemo(() => {
    const events = filteredDailyData.dayEvents.length;
    const tasks = filteredDailyData.timedTasks.length + filteredDailyData.untimedTasks.length;
    const reminders = filteredDailyData.timedReminders.length;
    const triage = filteredDailyData.overdueTasks.length + filteredDailyData.untimedTasks.length + filteredDailyData.missedReminders.length;
    return { events, tasks, reminders, triage };
  }, [filteredDailyData]);

  const totalPipCounts = useMemo(() => {
    const events = homeData.events.filter((event) => {
      const startAt = parseIso(event.event_state.start_dt);
      return startAt ? isSameCalendarDay(startAt, now) : false;
    }).length;
    const tasks = homeData.tasks.filter((task) => {
      if (isTaskComplete(task.task_state.status)) {
        return false;
      }
      const dueAt = parseIso(task.task_state.due_at);
      return dueAt ? isSameCalendarDay(dueAt, now) : false;
    }).length;
    const reminders = remindersRuntime.reminders.filter((reminder) => {
      const remindAt = parseIso(reminder.remind_at);
      return remindAt ? isSameCalendarDay(remindAt, now) : false;
    }).length;
    return { events, tasks, reminders };
  }, [homeData.events, homeData.tasks, now, remindersRuntime.reminders]);

  const refreshAfterMutation = useCallback(async () => {
    requestHubHomeRefresh();
    await remindersRuntime.refresh();
  }, [remindersRuntime]);

  const onCompleteTask = useCallback(async (recordId: string) => {
    if (!accessToken) {
      return;
    }
    await updateRecord(accessToken, recordId, { task_state: { status: 'done' } });
    await refreshAfterMutation();
  }, [accessToken, refreshAfterMutation]);

  const onRescheduleTask = useCallback(async (recordId: string, dueAtIso: string) => {
    if (!accessToken) {
      return;
    }
    await updateRecord(accessToken, recordId, { task_state: { due_at: dueAtIso } });
    await refreshAfterMutation();
  }, [accessToken, refreshAfterMutation]);

  const onSnoozeTask = useCallback(async (recordId: string) => {
    if (!accessToken) {
      return;
    }
    await updateRecord(accessToken, recordId, { task_state: { due_at: tomorrowAtNineIso() } });
    await refreshAfterMutation();
  }, [accessToken, refreshAfterMutation]);

  const onDismissReminder = useCallback(async (reminderId: string) => {
    if (!accessToken) {
      return;
    }
    await dismissReminder(accessToken, reminderId);
    await refreshAfterMutation();
  }, [accessToken, refreshAfterMutation]);

  const onSnoozeReminder = useCallback(async (reminderId: string, remindAtIso: string) => {
    if (!accessToken) {
      return;
    }
    await updateReminder(accessToken, reminderId, { remind_at: remindAtIso });
    await refreshAfterMutation();
  }, [accessToken, refreshAfterMutation]);

  const onDropFromTriage = useCallback(async (payload: TriageDragPayload, assignedAt: Date) => {
    if (!accessToken) {
      return;
    }
    const assignedAtIso = assignedAt.toISOString();
    if (payload.kind === 'task') {
      await updateRecord(accessToken, payload.recordId, { task_state: { due_at: assignedAtIso } });
    } else {
      await updateReminder(accessToken, payload.reminderId, { remind_at: assignedAtIso });
    }
    await refreshAfterMutation();
  }, [accessToken, refreshAfterMutation]);

  const greeting = greetingForHour(new Date().getHours());

  return (
    <section className="rounded-panel border border-subtle bg-elevated p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="heading" aria-level={1} aria-label="Hub OS" className="hub-home-wordmark">
          <HubOsWordmark aria-label="Hub OS" className="block h-auto w-[116px]" width={116} />
        </div>
        {homeLoading ? <span className="text-xs text-muted">Refreshing…</span> : null}
      </div>

      {homeError ? (
        <p className="mt-3 text-sm text-danger" role="alert">
          {homeError}
        </p>
      ) : null}

      <section className={`${homeError ? 'mt-3' : 'mt-4'} rounded-panel border border-border-muted bg-surface px-3 py-2`}>
        <h2 className="sr-only">Today&apos;s overview</h2>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-text">{greeting}</p>
          <div className="flex items-center gap-2 text-xs text-muted">
            <span
              className="inline-flex items-center gap-1 rounded-control border border-border-muted px-2 py-1"
              aria-label={formatCountLabel(totalPipCounts.events, 'event')}
            >
              <Icon name="calendar" className="text-[13px]" aria-hidden="true" />
              <span aria-hidden="true">{totalPipCounts.events}</span>
            </span>
            <span
              className="inline-flex items-center gap-1 rounded-control border border-border-muted px-2 py-1"
              aria-label={formatCountLabel(totalPipCounts.tasks, 'task')}
            >
              <Icon name="tasks" className="text-[13px]" aria-hidden="true" />
              <span aria-hidden="true">{totalPipCounts.tasks}</span>
            </span>
            <span
              className="inline-flex items-center gap-1 rounded-control border border-border-muted px-2 py-1"
              aria-label={formatCountLabel(totalPipCounts.reminders, 'reminder')}
            >
              <Icon name="reminders" className="text-[13px]" aria-hidden="true" />
              <span aria-hidden="true">{totalPipCounts.reminders}</span>
            </span>
          </div>
        </div>
      </section>

      <h2 className="sr-only">Timeline</h2>
      <DayStrip
        className="mt-3"
        events={filteredDailyData.dayEvents}
        tasks={filteredDailyData.timedTasks}
        reminders={filteredDailyData.timedReminders}
        typeFilter={timelineTypeFilter}
        onOpenRecord={onOpenRecord}
        onDropFromTriage={onDropFromTriage}
      />

      <ContextBar
        className="mt-3"
        projectFilter={activeProjectFilter}
        projectOptions={projectOptions}
        onProjectFilterChange={setProjectFilter}
        eventCount={dayCounts.events}
        taskCount={dayCounts.tasks}
        reminderCount={dayCounts.reminders}
        triageCount={dayCounts.triage}
        timelineTypeFilter={timelineTypeFilter}
        onToggleTimelineType={(type) => {
          setTimelineTypeFilter((current) => (current === type ? 'all' : type));
        }}
        onToggleTriagePanel={() => setTriageOpen((current) => !current)}
        triageOpen={triageOpen}
      />

      {triageOpen ? <h2 className="sr-only">Triage</h2> : null}
      <TriagePanel
        className="mt-3"
        open={triageOpen}
        overdueTasks={filteredDailyData.overdueTasks}
        untimedTasks={filteredDailyData.untimedTasks}
        missedReminders={filteredDailyData.missedReminders}
        onCompleteTask={onCompleteTask}
        onRescheduleTask={onRescheduleTask}
        onSnoozeTask={onSnoozeTask}
        onAssignTaskTime={onRescheduleTask}
        onDismissReminder={onDismissReminder}
        onSnoozeReminder={onSnoozeReminder}
      />

      <h2 className="sr-only">Views</h2>
      <Popover open={viewMenuOpen} onOpenChange={handleViewMenuOpenChange}>
        <PopoverTrigger asChild>
          <button
            ref={viewTriggerRef}
            type="button"
            className="mt-3 inline-flex items-center gap-2 rounded-panel border border-border-muted bg-surface px-3 py-2 text-sm font-semibold text-text"
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

      <div className="mt-3">
        {selectedView === 'project-lens' ? <ProjectLensView items={items} projects={projects} onOpenRecord={onOpenRecord} /> : null}
        {selectedView === 'stream' ? <StreamView items={items} projects={projects} onOpenRecord={onOpenRecord} now={now} /> : null}
      </div>
    </section>
  );
};
