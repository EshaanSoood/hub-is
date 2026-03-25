import { KeyboardEvent, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useAuthz } from '../context/AuthzContext';
import { useRemindersRuntime } from '../hooks/useRemindersRuntime';
import { dashboardCardRegistry } from '../lib/dashboardCards';
import { requestHubHomeRefresh } from '../lib/hubHomeRefresh';
import { buildEventDestinationHref, buildTaskDestinationHref } from '../lib/hubRoutes';
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
type HubDashboardView = 'project-lens' | 'stream';
type StreamSort = 'due' | 'updated';
type StreamTypeFilter = 'all' | 'tasks' | 'events';

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

const VIEW_ORDER: HubDashboardView[] = ['project-lens', 'stream'];
const STREAM_FILTERS: StreamTypeFilter[] = ['all', 'tasks', 'events'];

const viewLabels: Record<HubDashboardView, string> = {
  'project-lens': 'Project Lens',
  stream: 'Stream',
};

const streamFilterLabels: Record<StreamTypeFilter, string> = {
  all: 'All',
  tasks: 'Tasks',
  events: 'Events',
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

  return (
    <div className="flex flex-wrap items-start gap-2">
      <button
        type="button"
        onClick={() => onOpen(item.recordId)}
        className={`min-w-0 flex-1 rounded-panel border p-3 text-left ${item.unread ? 'border-primary/40' : 'border-border-muted'} bg-surface`}
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
  onViewChange,
}: {
  homeData: HubHomeData;
  homeLoading: boolean;
  homeError: string | null;
  projects: ProjectRecord[];
  onOpenRecord: (recordId: string) => void;
  onViewChange?: (view: HubDashboardView) => void;
}) => {
  const { accessToken, canGlobal, sessionSummary } = useAuthz();
  const remindersRuntime = useRemindersRuntime(accessToken ?? null);

  const [activeView, setActiveView] = useState<HubDashboardView>('project-lens');
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const [activeViewOptionIndex, setActiveViewOptionIndex] = useState(0);
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [timelineTypeFilter, setTimelineTypeFilter] = useState<TimelineTypeFilter>('all');
  const [triageOpen, setTriageOpen] = useState(false);

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
    const now = new Date();
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
      if (dueAt && dueAt < todayStart && !complete) {
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
  }, [homeData.events, homeData.tasks, projectNameById, remindersRuntime.reminders]);

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
    const now = new Date();
    const events = homeData.events.filter((event) => {
      const startAt = parseIso(event.event_state.start_dt);
      return startAt ? isSameCalendarDay(startAt, now) : false;
    }).length;
    const tasks = homeData.tasks.filter((task) => {
      const dueAt = parseIso(task.task_state.due_at);
      return dueAt ? isSameCalendarDay(dueAt, now) : false;
    }).length;
    const reminders = remindersRuntime.reminders.filter((reminder) => {
      const remindAt = parseIso(reminder.remind_at);
      return remindAt ? isSameCalendarDay(remindAt, now) : false;
    }).length;
    return { events, tasks, reminders };
  }, [homeData.events, homeData.tasks, remindersRuntime.reminders]);

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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-text">{greeting}</p>
          <div className="flex items-center gap-2 text-xs text-muted" aria-label="Today counts">
            <span className="inline-flex items-center gap-1 rounded-control border border-border-muted px-2 py-1">
              <Icon name="calendar" className="text-[13px]" />
              <span>{totalPipCounts.events}</span>
            </span>
            <span className="inline-flex items-center gap-1 rounded-control border border-border-muted px-2 py-1">
              <Icon name="tasks" className="text-[13px]" />
              <span>{totalPipCounts.tasks}</span>
            </span>
            <span className="inline-flex items-center gap-1 rounded-control border border-border-muted px-2 py-1">
              <Icon name="reminders" className="text-[13px]" />
              <span>{totalPipCounts.reminders}</span>
            </span>
          </div>
        </div>
      </section>

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

      {selectedView === 'project-lens' ? <ProjectLensView items={items} projects={projects} onOpenRecord={onOpenRecord} /> : null}
      {selectedView === 'stream' ? <StreamView items={items} projects={projects} onOpenRecord={onOpenRecord} /> : null}
    </section>
  );
};
