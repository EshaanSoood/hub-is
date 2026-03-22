import { KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useAuthz } from '../context/AuthzContext';
import { useRemindersRuntime } from '../hooks/useRemindersRuntime';
import { dashboardCardRegistry } from '../lib/dashboardCards';
import { buildEventDestinationHref, buildTaskDestinationHref } from '../lib/hubRoutes';
import type { ProjectRecord } from '../types/domain';
import type { getHubHome } from '../services/hub/records';
import type { HubReminderSummary } from '../services/hub/reminders';
import { Chip, FilterChip, Icon, Popover, PopoverContent, PopoverTrigger, Select, Tabs, TabsContent } from '../components/primitives';

type HubHomeData = Awaited<ReturnType<typeof getHubHome>>;
type HubTask = HubHomeData['tasks'][number];
type HubEvent = HubHomeData['events'][number];
type HubDashboardView = 'project-lens' | 'stream';
type StreamSort = 'due' | 'updated';
type StreamTypeFilter = 'all' | 'tasks' | 'events';
type BriefFilter = 'timeline' | 'calendar' | 'tasks' | 'reminders';
const ALL_DAILY_BRIEF_PROJECTS_FILTER = '__all_projects__';

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

const isSameLocalDay = (left: Date, right: Date): boolean =>
  left.getFullYear() === right.getFullYear()
  && left.getMonth() === right.getMonth()
  && left.getDate() === right.getDate();

const formatTimeOnly = (value: string | null | undefined): string => {
  const parsed = parseIso(value);
  if (!parsed) {
    return 'No time';
  }
  return parsed.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
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
  userDisplayName,
  tasks,
  events,
  reminders,
  remindersLoading,
  remindersError,
  onOpenRecord,
}: {
  userDisplayName: string;
  tasks: HubTask[];
  events: HubEvent[];
  reminders: HubReminderSummary[];
  remindersLoading: boolean;
  remindersError: string | null;
  onOpenRecord: (recordId: string) => void;
}) => {
  const [briefFilter, setBriefFilter] = useState<BriefFilter>('timeline');
  const [briefProjectFilter, setBriefProjectFilter] = useState<string>(ALL_DAILY_BRIEF_PROJECTS_FILTER);
  const [dayKey, setDayKey] = useState(() => new Date().toDateString());

  useEffect(() => {
    let timer: number | null = null;

    const scheduleMidnightTick = () => {
      const now = new Date();
      const nextMidnight = new Date(now);
      nextMidnight.setHours(24, 0, 0, 0);
      const delay = Math.max(1000, nextMidnight.getTime() - now.getTime() + 50);
      timer = window.setTimeout(() => {
        setDayKey(new Date().toDateString());
        scheduleMidnightTick();
      }, delay);
    };

    scheduleMidnightTick();
    return () => {
      if (timer !== null) {
        window.clearTimeout(timer);
      }
    };
  }, []);

  const todayEventsBase = useMemo(
    () => {
      const today = new Date(dayKey);
      return (
      events
        .filter((event) => {
          const startAt = parseIso(event.event_state.start_dt);
          if (!startAt) {
            return false;
          }
          return isSameLocalDay(startAt, today);
        })
        .sort((left, right) => {
          const leftStart = parseIso(left.event_state.start_dt)?.getTime() ?? Number.POSITIVE_INFINITY;
          const rightStart = parseIso(right.event_state.start_dt)?.getTime() ?? Number.POSITIVE_INFINITY;
          return leftStart - rightStart;
        })
      );
    },
    [events, dayKey],
  );

  const todayTasksBase = useMemo(
    () => {
      const now = new Date();
      const nowMs = now.getTime();
      const today = new Date(dayKey);
      return tasks
        .filter((task) => {
          const dueAt = parseIso(task.task_state.due_at);
          if (!dueAt) {
            return false;
          }
          return isSameLocalDay(dueAt, today) || dueAt.getTime() < nowMs;
        })
        .sort((left, right) => {
          const leftDue = parseIso(left.task_state.due_at)?.getTime() ?? Number.POSITIVE_INFINITY;
          const rightDue = parseIso(right.task_state.due_at)?.getTime() ?? Number.POSITIVE_INFINITY;
          if (leftDue !== rightDue) {
            return leftDue - rightDue;
          }
          const leftUpdated = parseIso(left.updated_at)?.getTime() ?? 0;
          const rightUpdated = parseIso(right.updated_at)?.getTime() ?? 0;
          return rightUpdated - leftUpdated;
        });
    },
    [tasks, dayKey],
  );

  const todayRemindersBase = useMemo(
    () => {
      const now = new Date();
      const nowMs = now.getTime();
      const today = new Date(dayKey);
      return reminders
        .filter((reminder) => {
          const remindAt = parseIso(reminder.remind_at);
          if (!remindAt) {
            return false;
          }
          return isSameLocalDay(remindAt, today) || remindAt.getTime() < nowMs;
        })
        .sort((left, right) => {
          const leftTime = parseIso(left.remind_at)?.getTime() ?? Number.POSITIVE_INFINITY;
          const rightTime = parseIso(right.remind_at)?.getTime() ?? Number.POSITIVE_INFINITY;
          return leftTime - rightTime;
        });
    },
    [reminders, dayKey],
  );

  const projectFilterOptions = useMemo(() => {
    const projectMap = new Map<string, string>();

    for (const event of todayEventsBase) {
      if (!event.project_id) {
        continue;
      }
      const existingLabel = projectMap.get(event.project_id);
      if (!existingLabel) {
        projectMap.set(event.project_id, event.project_name || 'Unnamed project');
      }
    }

    for (const task of todayTasksBase) {
      if (!task.project_id) {
        continue;
      }
      const existingLabel = projectMap.get(task.project_id);
      if (!existingLabel) {
        projectMap.set(task.project_id, task.project_name || 'Unnamed project');
      }
    }

    for (const reminder of todayRemindersBase) {
      const projectId = typeof reminder.project_id === 'string' ? reminder.project_id : '';
      if (!projectId || projectMap.has(projectId)) {
        continue;
      }
      projectMap.set(projectId, 'Unnamed project');
    }

    return [
      { value: ALL_DAILY_BRIEF_PROJECTS_FILTER, label: 'All Projects' },
      ...Array.from(projectMap.entries())
        .sort((left, right) => left[1].localeCompare(right[1]))
        .map(([value, label]) => ({ value, label })),
    ];
  }, [todayEventsBase, todayRemindersBase, todayTasksBase]);

  const todayEvents = useMemo(
    () => (briefProjectFilter === ALL_DAILY_BRIEF_PROJECTS_FILTER
      ? todayEventsBase
      : todayEventsBase.filter((event) => event.project_id === briefProjectFilter)),
    [briefProjectFilter, todayEventsBase],
  );

  const todayTasks = useMemo(
    () => (briefProjectFilter === ALL_DAILY_BRIEF_PROJECTS_FILTER
      ? todayTasksBase
      : todayTasksBase.filter((task) => task.project_id === briefProjectFilter)),
    [briefProjectFilter, todayTasksBase],
  );

  const todayReminders = useMemo(() => {
    if (briefProjectFilter === ALL_DAILY_BRIEF_PROJECTS_FILTER) {
      return todayRemindersBase;
    }
    return todayRemindersBase.filter((reminder) => {
      const projectId = typeof reminder.project_id === 'string' ? reminder.project_id : '';
      if (!projectId) {
        return false;
      }
      return projectId === briefProjectFilter;
    });
  }, [briefProjectFilter, todayRemindersBase]);

  const normalizedDisplayName = userDisplayName.trim();
  const greetingText = normalizedDisplayName ? `Hey ${normalizedDisplayName}` : 'Hey';
  const showCalendarSection = briefFilter === 'timeline' || briefFilter === 'calendar';
  const showTasksSection = briefFilter === 'timeline' || briefFilter === 'tasks';
  const showRemindersSection = briefFilter === 'timeline' || briefFilter === 'reminders';

  return (
    <div className="rounded-panel border border-border-muted bg-surface">
      <div className="space-y-3 px-4 py-4">
        <section className="space-y-2">
          <h3 className="text-xl font-semibold text-primary">{greetingText}</h3>
          <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <span className="inline-flex items-center gap-1">
              <Icon name="calendar" className="text-[12px] text-primary" />
              <span>{todayEvents.length} event{todayEvents.length === 1 ? '' : 's'}</span>
            </span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1">
              <Icon name="tasks" className="text-[12px] text-primary" />
              <span>{todayTasks.length} task{todayTasks.length === 1 ? '' : 's'}</span>
            </span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1">
              <Icon name="reminders" className="text-[12px] text-primary" />
              <span>{todayReminders.length} reminder{todayReminders.length === 1 ? '' : 's'}</span>
            </span>
          </p>
        </section>

        <div role="tablist" aria-label="Daily brief filter" className="flex flex-wrap gap-1">
          {(['timeline', 'calendar', 'tasks', 'reminders'] as const).map((filter) => (
            <button
              key={filter}
              type="button"
              role="tab"
              aria-selected={briefFilter === filter}
              onClick={() => setBriefFilter(filter)}
              className={`rounded-control px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
                briefFilter === filter
                  ? 'bg-accent text-on-primary'
                  : 'text-muted hover:bg-surface-elevated'
              }`}
            >
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="relative">
        <div className="max-h-[50vh] space-y-6 overflow-y-auto px-4 pb-10 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {showCalendarSection ? (
            <section className="space-y-2" aria-labelledby="daily-brief-calendar-heading">
              <h3 id="daily-brief-calendar-heading" className="text-sm font-semibold text-text">
                Calendar
              </h3>
              {todayEvents.length === 0 ? (
                <p className="rounded-panel border border-border-muted bg-surface-elevated px-3 py-4 text-sm text-muted">
                  No calendar events today.
                </p>
              ) : (
                <ul className="space-y-2">
                  {todayEvents.map((event) => (
                    <li key={event.record_id}>
                      <button
                        type="button"
                        onClick={() => onOpenRecord(event.record_id)}
                        className="flex w-full items-start justify-between gap-3 rounded-panel border border-border-muted bg-surface-elevated px-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-text">{event.title || 'Untitled event'}</span>
                          <span className="mt-1 block text-xs text-muted">{event.project_name || 'Unnamed project'}</span>
                        </span>
                        <span className="shrink-0 text-xs text-muted">{formatTimeOnly(event.event_state.start_dt)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}

          {showTasksSection ? (
            <section className="space-y-2" aria-labelledby="daily-brief-tasks-heading">
              <h3 id="daily-brief-tasks-heading" className="text-sm font-semibold text-text">
                Tasks
              </h3>
              {todayTasks.length === 0 ? (
                <p className="rounded-panel border border-border-muted bg-surface-elevated px-3 py-4 text-sm text-muted">
                  No tasks for today or overdue.
                </p>
              ) : (
                <ul className="space-y-2">
                  {todayTasks.map((task) => (
                    <li key={task.record_id}>
                      <button
                        type="button"
                        onClick={() => onOpenRecord(task.record_id)}
                        className="flex w-full items-start justify-between gap-3 rounded-panel border border-border-muted bg-surface-elevated px-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-text">{task.title}</span>
                          <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                            <span className={`inline-block h-2.5 w-2.5 rounded-full ${projectDotClassName(task.project_id)}`} aria-hidden="true" />
                            <span>{task.project_name || 'Inbox & Unassigned'}</span>
                            {task.task_state.priority ? <Chip variant="neutral">{task.task_state.priority}</Chip> : null}
                          </span>
                        </span>
                        <span className="shrink-0 text-xs text-muted">{formatTimeOnly(task.task_state.due_at)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}

          {showRemindersSection ? (
            <section className="space-y-2" aria-labelledby="daily-brief-reminders-heading">
              <h3 id="daily-brief-reminders-heading" className="text-sm font-semibold text-text">
                Reminders
              </h3>
              {remindersError ? (
                <p className="rounded-panel border border-danger bg-danger-subtle px-3 py-4 text-sm text-danger">
                  {remindersError}
                </p>
              ) : null}
              {!remindersError && remindersLoading && reminders.length === 0 ? (
                <p className="rounded-panel border border-border-muted bg-surface-elevated px-3 py-4 text-sm text-muted">
                  Loading reminders…
                </p>
              ) : null}
              {!remindersError && !remindersLoading && todayReminders.length === 0 ? (
                <p className="rounded-panel border border-border-muted bg-surface-elevated px-3 py-4 text-sm text-muted">
                  No reminders for today or overdue.
                </p>
              ) : null}
              {todayReminders.length > 0 ? (
                <ul className="space-y-2">
                  {todayReminders.map((reminder) => (
                    <li key={reminder.reminder_id}>
                      <button
                        type="button"
                        onClick={() => onOpenRecord(reminder.record_id)}
                        className={`relative flex w-full min-h-16 items-stretch overflow-hidden border-l-2 text-left ${
                          reminder.overdue ? 'bg-danger-subtle border-danger' : 'bg-surface-elevated border-border-muted'
                        } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring`}
                        style={{
                          clipPath: 'polygon(0 0, calc(100% - 16px) 0, 100% 50%, calc(100% - 16px) 100%, 0 100%)',
                          borderLeftColor: reminder.overdue ? 'var(--color-danger)' : 'var(--color-capture-rail)',
                        }}
                      >
                        <span className="flex min-w-0 flex-1 items-center justify-between gap-3 px-3 py-3">
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium text-text">{reminder.record_title || 'Untitled reminder'}</span>
                            <span className={`mt-1 block text-xs ${reminder.overdue ? 'text-danger underline' : 'text-text-secondary'}`}>
                              {formatTimeOnly(reminder.remind_at)}
                            </span>
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ) : null}
        </div>

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[color:var(--color-surface)] to-transparent"
        />
      </div>

      <section className="space-y-1 border-t border-border-muted px-4 py-3">
        <span className="text-xs font-medium text-muted">Project</span>
        <Select
          value={briefProjectFilter}
          onValueChange={setBriefProjectFilter}
          options={projectFilterOptions}
          ariaLabel="Filter Daily Brief by project"
          triggerClassName="min-w-44"
        />
      </section>
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
  const projectLensProjects = useMemo(
    () => projects.filter((project) => !project.isPersonal),
    [projects],
  );

  const groupedItems = useMemo(() => {
    const map = new Map<string, HubDashboardItem[]>();
    map.set('__inbox__', items.filter((item) => !item.projectId));
    for (const project of projectLensProjects) {
      map.set(project.id, items.filter((item) => item.projectId === project.id));
    }
    return map;
  }, [items, projectLensProjects]);

  const sections = [
    { id: '__inbox__', name: 'Inbox & Unassigned', items: groupedItems.get('__inbox__') || [] },
    ...projectLensProjects.map((project) => ({
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
      {projectLensProjects.length === 0 ? <p className="rounded-panel border border-border-muted bg-surface px-4 py-8 text-center text-sm text-muted">No projects yet.</p> : null}
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
  const [activeView, setActiveView] = useState<HubDashboardView>('project-lens');
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const [activeViewOptionIndex, setActiveViewOptionIndex] = useState(0);
  const viewListboxId = useId();
  const viewTriggerRef = useRef<HTMLButtonElement | null>(null);
  const viewListboxRef = useRef<HTMLDivElement | null>(null);
  const remindersRuntime = useRemindersRuntime(accessToken ?? null);

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

  return (
    <section className="rounded-panel border border-subtle bg-elevated p-4">
      {homeLoading ? <p className="text-xs text-muted">Refreshing…</p> : null}

      {homeError ? (
        <p className="mt-3 text-sm text-danger" role="alert">
          {homeError}
        </p>
      ) : null}

      <div className="mt-4">
        <DailyBriefView
          userDisplayName={sessionSummary.name || ''}
          tasks={homeData.tasks}
          events={homeData.events}
          reminders={remindersRuntime.reminders}
          remindersLoading={remindersRuntime.loading}
          remindersError={remindersRuntime.error}
          onOpenRecord={onOpenRecord}
        />
      </div>

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
