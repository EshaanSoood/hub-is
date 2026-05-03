import { useMemo } from 'react';
import type { ProjectRecord } from '../../../types/domain';
import type { HubReminderSummary } from '../../../services/hub/reminders';
import { buildEventDestinationHref, buildTaskDestinationHref } from '../../../lib/hubRoutes';
import type { DashboardPipCounts, HubDashboardItem, HubHomeData, HubTask, DashboardDailyData } from '../types';
import { isMidnightLocal, isSameCalendarDay, isTaskComplete, parseIso } from '../utils';

export type DashboardRollupSurface = 'dailyBrief' | 'homeGround' | 'timeline';
export type DashboardRollupSourceModule = 'tasks' | 'events' | 'reminders' | 'quickThoughts';
export type DashboardRollupItemType = 'task' | 'event' | 'reminder' | 'quickThought';

export type SpaceRollupItemType = 'task' | 'event' | 'reminder';
export type SpaceRollupOrigin = 'space' | 'project';
export type SpaceRollupBucket = 'space.tasks' | 'space.events' | 'space.reminders' | 'space.orphans';

export interface SpaceRollupProjectRef {
  projectId: string;
  spaceId: string;
  name: string;
}

export interface SpaceRollupItemSummary {
  id: string;
  type: SpaceRollupItemType;
  sourceModule: 'tasks' | 'events' | 'reminders';
  spaceId: string | null;
  sourceProjectId: string | null;
  sourceProjectName: string | null;
  origin: SpaceRollupOrigin | null;
  rollupBucket: SpaceRollupBucket;
  homeRelevant: boolean;
  homeReason: 'createdByUser' | 'assignedToUser' | 'eventParticipant' | 'notRelevant' | 'invalid';
  sortKey: string | null;
}

export interface SpaceRollupPipeline {
  spaceId: string;
  totalItemsIn: number;
  buckets: Record<SpaceRollupBucket, SpaceRollupItemSummary[]>;
  home: SpaceRollupItemSummary[];
  orphans: SpaceRollupItemSummary[];
  invariantViolations: string[];
}

export interface DashboardQuickThoughtInput {
  id: string;
  title: string;
  createdAt: string;
  targetSurface?: DashboardRollupSurface | null;
}

export interface DashboardRollupItemSummary {
  id: string;
  type: DashboardRollupItemType;
  sourceModule: DashboardRollupSourceModule;
  targetSurface: DashboardRollupSurface | null;
  rollupBucket: string;
  sortKey: string | null;
}

export interface DashboardRollupSurfaceSummary {
  received: DashboardRollupItemSummary[];
  ghosts: string[];
}

export interface DashboardRollupPipeline {
  totalItemsIn: number;
  buckets: Record<string, DashboardRollupItemSummary[]>;
  surfaces: Record<DashboardRollupSurface, DashboardRollupSurfaceSummary>;
  unrouted: DashboardRollupItemSummary[];
  invariantViolations: string[];
}

export const buildTaskItems = (tasks: HubTask[]): HubDashboardItem[] =>
  tasks.map((task) => ({
    id: `task:${task.record_id}`,
    kind: 'task',
    recordId: task.record_id,
    title: task.title,
    projectId: task.space_id,
    projectName: task.space_name,
    dueAt: task.task_state.due_at ?? null,
    updatedAt: task.updated_at,
    unread: false,
    badgeLabel: 'Task',
    taskStatus: task.task_state.status,
    subtitle: task.task_state.priority ? `${task.task_state.status} · ${task.task_state.priority}` : task.task_state.status,
    explicitHref: buildTaskDestinationHref(task),
  }));

const buildEventItems = (events: HubHomeData['events']): HubDashboardItem[] =>
  events.map((event) => ({
    id: `event:${event.record_id}`,
    kind: 'event',
    recordId: event.record_id,
    title: event.title,
    projectId: event.space_id,
    projectName: event.space_name,
    dueAt: event.event_state.start_dt,
    updatedAt: event.updated_at,
    unread: false,
    badgeLabel: 'Event',
    explicitHref: buildEventDestinationHref(event),
  }));

interface UseDashboardAggregationParams {
  homeData: HubHomeData;
  reminders: HubReminderSummary[];
  projects: ProjectRecord[];
  now: Date;
  quickThoughts?: DashboardQuickThoughtInput[];
}

interface UseDashboardAggregationResult {
  items: HubDashboardItem[];
  dailyData: DashboardDailyData;
  totalPipCounts: DashboardPipCounts;
  rollup: DashboardRollupPipeline;
}

const emptyDailyData = (): DashboardDailyData => ({
  dayEvents: [],
  timedTasks: [],
  untimedTasks: [],
  overdueTasks: [],
  timedReminders: [],
  missedReminders: [],
});

const compareNullableIsoAscending = (left: string | null, right: string | null): number => {
  const leftTime = parseIso(left)?.getTime() ?? Number.POSITIVE_INFINITY;
  const rightTime = parseIso(right)?.getTime() ?? Number.POSITIVE_INFINITY;
  if (leftTime !== rightTime) {
    return leftTime - rightTime;
  }
  return String(left ?? '').localeCompare(String(right ?? ''));
};

const compareRollupItems = (left: DashboardRollupItemSummary, right: DashboardRollupItemSummary): number => {
  const bySortKey = compareNullableIsoAscending(left.sortKey, right.sortKey);
  if (bySortKey !== 0) {
    return bySortKey;
  }
  return left.id.localeCompare(right.id);
};

const compareSpaceRollupItems = (left: SpaceRollupItemSummary, right: SpaceRollupItemSummary): number => {
  const bySortKey = compareNullableIsoAscending(left.sortKey, right.sortKey);
  if (bySortKey !== 0) {
    return bySortKey;
  }
  return left.id.localeCompare(right.id);
};

const emptySpaceRollupPipeline = (spaceId: string): SpaceRollupPipeline => ({
  spaceId,
  totalItemsIn: 0,
  buckets: {
    'space.tasks': [],
    'space.events': [],
    'space.reminders': [],
    'space.orphans': [],
  },
  home: [],
  orphans: [],
  invariantViolations: [],
});

const userOwnsOrIsAssignedToTask = (task: HubTask, userId: string) => {
  if (task.created_by === userId) {
    return { relevant: true, reason: 'createdByUser' as const };
  }
  if (task.assignments.some((assignment) => assignment.user_id === userId)) {
    return { relevant: true, reason: 'assignedToUser' as const };
  }
  return { relevant: false, reason: 'notRelevant' as const };
};

const userOwnsOrParticipatesInEvent = (event: HubHomeData['events'][number], userId: string) => {
  if (event.created_by === userId) {
    return { relevant: true, reason: 'createdByUser' as const };
  }
  if (event.participants.some((participant) => participant.user_id === userId)) {
    return { relevant: true, reason: 'eventParticipant' as const };
  }
  return { relevant: false, reason: 'notRelevant' as const };
};

const userOwnsOrIsLinkedToReminder = (reminder: HubReminderSummary, userId: string) => {
  if (reminder.created_by === userId) {
    return { relevant: true, reason: 'createdByUser' as const };
  }
  if (reminder.record_assignments?.some((assignment) => assignment.user_id === userId)) {
    return { relevant: true, reason: 'assignedToUser' as const };
  }
  if (reminder.record_participants?.some((participant) => participant.user_id === userId)) {
    return { relevant: true, reason: 'eventParticipant' as const };
  }
  return { relevant: false, reason: 'notRelevant' as const };
};

const resolveSpaceRollupOrigin = (
  spaceId: string,
  sourceProject: { project_id: string | null; project_name: string | null } | null | undefined,
  projectSpaceById: Map<string, string>,
): Pick<SpaceRollupItemSummary, 'origin' | 'sourceProjectId' | 'sourceProjectName' | 'rollupBucket' | 'homeReason'> => {
  const sourceProjectId = sourceProject?.project_id ?? null;
  if (!sourceProjectId) {
    return {
      origin: 'space',
      sourceProjectId: null,
      sourceProjectName: null,
      rollupBucket: 'space.tasks',
      homeReason: 'notRelevant',
    };
  }
  if (projectSpaceById.get(sourceProjectId) !== spaceId) {
    return {
      origin: null,
      sourceProjectId,
      sourceProjectName: sourceProject?.project_name ?? null,
      rollupBucket: 'space.orphans',
      homeReason: 'invalid',
    };
  }
  return {
    origin: 'project',
    sourceProjectId,
    sourceProjectName: sourceProject?.project_name ?? null,
    rollupBucket: 'space.tasks',
    homeReason: 'notRelevant',
  };
};

export const buildSpaceRollup = ({
  spaceId,
  workProjects,
  tasks,
  events,
  reminders,
  userId,
}: {
  spaceId: string;
  workProjects: SpaceRollupProjectRef[];
  tasks: HubTask[];
  events: HubHomeData['events'];
  reminders: HubReminderSummary[];
  userId: string;
}): SpaceRollupPipeline => {
  const rollup = emptySpaceRollupPipeline(spaceId);
  rollup.totalItemsIn = tasks.length + events.length + reminders.length;
  const projectSpaceById = new Map(workProjects.map((project) => [project.projectId, project.spaceId]));

  const pushItem = (item: SpaceRollupItemSummary) => {
    rollup.buckets[item.rollupBucket].push(item);
    if (item.rollupBucket === 'space.orphans') {
      rollup.orphans.push(item);
    }
    if (item.homeRelevant) {
      rollup.home.push(item);
    }
  };

  for (const task of tasks) {
    const relevance = userOwnsOrIsAssignedToTask(task, userId);
    const origin = resolveSpaceRollupOrigin(spaceId, task.source_project, projectSpaceById);
    const validSpace = task.space_id === spaceId;
    pushItem({
      id: `task:${task.record_id}`,
      type: 'task',
      sourceModule: 'tasks',
      spaceId: task.space_id,
      sourceProjectId: origin.sourceProjectId,
      sourceProjectName: origin.sourceProjectName,
      origin: validSpace ? origin.origin : null,
      rollupBucket: validSpace && origin.rollupBucket !== 'space.orphans' ? 'space.tasks' : 'space.orphans',
      homeRelevant: validSpace && origin.origin !== null && relevance.relevant,
      homeReason: validSpace && origin.origin !== null ? relevance.reason : 'invalid',
      sortKey: task.task_state.due_at ?? task.updated_at,
    });
  }

  for (const event of events) {
    const relevance = userOwnsOrParticipatesInEvent(event, userId);
    const origin = resolveSpaceRollupOrigin(spaceId, event.source_project, projectSpaceById);
    const validSpace = event.space_id === spaceId;
    const validDate = Boolean(parseIso(event.event_state.start_dt));
    pushItem({
      id: `event:${event.record_id}`,
      type: 'event',
      sourceModule: 'events',
      spaceId: event.space_id,
      sourceProjectId: origin.sourceProjectId,
      sourceProjectName: origin.sourceProjectName,
      origin: validSpace && validDate ? origin.origin : null,
      rollupBucket: validSpace && validDate && origin.rollupBucket !== 'space.orphans' ? 'space.events' : 'space.orphans',
      homeRelevant: validSpace && validDate && origin.origin !== null && relevance.relevant,
      homeReason: validSpace && validDate && origin.origin !== null ? relevance.reason : 'invalid',
      sortKey: event.event_state.start_dt || event.updated_at,
    });
  }

  for (const reminder of reminders) {
    const relevance = userOwnsOrIsLinkedToReminder(reminder, userId);
    const origin = resolveSpaceRollupOrigin(spaceId, reminder.source_project, projectSpaceById);
    const validSpace = reminder.space_id === spaceId;
    const validDate = Boolean(parseIso(reminder.remind_at));
    pushItem({
      id: `reminder:${reminder.reminder_id}`,
      type: 'reminder',
      sourceModule: 'reminders',
      spaceId: reminder.space_id,
      sourceProjectId: origin.sourceProjectId,
      sourceProjectName: origin.sourceProjectName,
      origin: validSpace && validDate ? origin.origin : null,
      rollupBucket: validSpace && validDate && origin.rollupBucket !== 'space.orphans' ? 'space.reminders' : 'space.orphans',
      homeRelevant: validSpace && validDate && origin.origin !== null && relevance.relevant,
      homeReason: validSpace && validDate && origin.origin !== null ? relevance.reason : 'invalid',
      sortKey: reminder.remind_at || reminder.created_at,
    });
  }

  for (const bucket of Object.values(rollup.buckets)) {
    bucket.sort(compareSpaceRollupItems);
  }
  rollup.home.sort(compareSpaceRollupItems);
  rollup.orphans.sort(compareSpaceRollupItems);

  const seen = new Map<string, number>();
  for (const item of Object.values(rollup.buckets).flat()) {
    seen.set(item.id, (seen.get(item.id) ?? 0) + 1);
  }
  for (const [id, count] of seen.entries()) {
    if (count !== 1) {
      rollup.invariantViolations.push(`${id} appears in ${count} Space roll-up buckets.`);
    }
  }
  if (seen.size !== rollup.totalItemsIn) {
    rollup.invariantViolations.push(`Expected ${rollup.totalItemsIn} Space roll-up items, found ${seen.size}.`);
  }
  return rollup;
};

const createRollupPipeline = (): DashboardRollupPipeline => ({
  totalItemsIn: 0,
  buckets: {},
  surfaces: {
    dailyBrief: { received: [], ghosts: [] },
    homeGround: { received: [], ghosts: [] },
    timeline: { received: [], ghosts: [] },
  },
  unrouted: [],
  invariantViolations: [],
});

const pushRollupItem = (rollup: DashboardRollupPipeline, item: DashboardRollupItemSummary) => {
  rollup.buckets[item.rollupBucket] = rollup.buckets[item.rollupBucket] ?? [];
  rollup.buckets[item.rollupBucket].push(item);
  if (item.targetSurface) {
    rollup.surfaces[item.targetSurface].received.push(item);
  } else {
    rollup.unrouted.push(item);
  }
};

const assertRollupInvariants = (rollup: DashboardRollupPipeline) => {
  const seen = new Map<string, number>();
  for (const items of Object.values(rollup.buckets)) {
    for (const item of items) {
      seen.set(item.id, (seen.get(item.id) ?? 0) + 1);
      if (!item.targetSurface && item.rollupBucket !== 'unrouted') {
        rollup.invariantViolations.push(`${item.id} has no target surface outside the unrouted bucket.`);
      }
    }
  }

  for (const [id, count] of seen.entries()) {
    if (count !== 1) {
      rollup.invariantViolations.push(`${id} appears in ${count} roll-up buckets.`);
    }
  }
  if (seen.size !== rollup.totalItemsIn) {
    rollup.invariantViolations.push(`Expected ${rollup.totalItemsIn} routed or unrouted items, found ${seen.size}.`);
  }

  for (const [bucketId, items] of Object.entries(rollup.buckets)) {
    for (let index = 1; index < items.length; index += 1) {
      if (compareRollupItems(items[index - 1], items[index]) > 0) {
        rollup.invariantViolations.push(`${bucketId} is not monotonic by sort key.`);
        break;
      }
    }
  }
};

export const buildDashboardAggregation = ({
  homeData,
  reminders,
  projects,
  now,
  quickThoughts = [],
}: UseDashboardAggregationParams): UseDashboardAggregationResult => {
  const items = [...buildTaskItems(homeData.tasks), ...buildEventItems(homeData.events)];

  const projectNameById = new Map<string, string>();
  for (const project of projects) {
    projectNameById.set(project.id, project.name);
  }

  const dailyData = emptyDailyData();
  const rollup = createRollupPipeline();
  rollup.totalItemsIn = homeData.tasks.length + homeData.events.length + reminders.length + quickThoughts.length;

  for (const event of homeData.events) {
    const startAt = parseIso(event.event_state.start_dt);
    const endAt = parseIso(event.event_state.end_dt);
    if (!startAt || !endAt) {
      pushRollupItem(rollup, {
        id: `event:${event.record_id}`,
        type: 'event',
        sourceModule: 'events',
        targetSurface: null,
        rollupBucket: 'unrouted',
        sortKey: event.event_state.start_dt || event.updated_at,
      });
      continue;
    }
    if (isSameCalendarDay(startAt, now)) {
      dailyData.dayEvents.push({
        id: `event:${event.record_id}`,
        recordId: event.record_id,
        projectId: event.space_id,
        projectName: event.space_name,
        title: event.title,
        startAtIso: startAt.toISOString(),
        endAtIso: endAt.toISOString(),
      });
      pushRollupItem(rollup, {
        id: `event:${event.record_id}`,
        type: 'event',
        sourceModule: 'events',
        targetSurface: 'dailyBrief',
        rollupBucket: 'dailyBrief.dayEvents',
        sortKey: startAt.toISOString(),
      });
      continue;
    }
    pushRollupItem(rollup, {
      id: `event:${event.record_id}`,
      type: 'event',
      sourceModule: 'events',
      targetSurface: 'timeline',
      rollupBucket: 'timeline.events',
      sortKey: startAt.toISOString(),
    });
  }

  for (const task of homeData.tasks) {
    const dueAt = parseIso(task.task_state.due_at);
    const complete = isTaskComplete(task.task_state.status);
    if (complete) {
      pushRollupItem(rollup, {
        id: `task:${task.record_id}`,
        type: 'task',
        sourceModule: 'tasks',
        targetSurface: 'homeGround',
        rollupBucket: 'homeGround.completedTasks',
        sortKey: task.updated_at,
      });
      continue;
    }
    const isUntimedToday = dueAt ? isSameCalendarDay(dueAt, now) && isMidnightLocal(dueAt) : false;
    if (dueAt && dueAt < now && !isUntimedToday) {
      dailyData.overdueTasks.push({
        id: `backlog-overdue:${task.record_id}`,
        recordId: task.record_id,
        projectId: task.space_id,
        projectName: task.space_name,
        title: task.title,
        dueAtIso: dueAt.toISOString(),
        priority: task.task_state.priority,
      });
      pushRollupItem(rollup, {
        id: `task:${task.record_id}`,
        type: 'task',
        sourceModule: 'tasks',
        targetSurface: 'dailyBrief',
        rollupBucket: 'dailyBrief.overdueTasks',
        sortKey: dueAt.toISOString(),
      });
      continue;
    }

    if (dueAt && isSameCalendarDay(dueAt, now)) {
      if (isUntimedToday) {
        dailyData.untimedTasks.push({
          id: `backlog-untimed:${task.record_id}`,
          recordId: task.record_id,
          projectId: task.space_id,
          projectName: task.space_name,
          title: task.title,
          dueAtIso: dueAt.toISOString(),
          priority: task.task_state.priority,
        });
        pushRollupItem(rollup, {
          id: `task:${task.record_id}`,
          type: 'task',
          sourceModule: 'tasks',
          targetSurface: 'dailyBrief',
          rollupBucket: 'dailyBrief.untimedTasks',
          sortKey: dueAt.toISOString(),
        });
      } else {
        dailyData.timedTasks.push({
          id: `task:${task.record_id}`,
          recordId: task.record_id,
          projectId: task.space_id,
          projectName: task.space_name,
          title: task.title,
          dueAtIso: dueAt.toISOString(),
          status: task.task_state.status,
        });
        pushRollupItem(rollup, {
          id: `task:${task.record_id}`,
          type: 'task',
          sourceModule: 'tasks',
          targetSurface: 'dailyBrief',
          rollupBucket: 'dailyBrief.timedTasks',
          sortKey: dueAt.toISOString(),
        });
      }
      continue;
    }

    pushRollupItem(rollup, {
      id: `task:${task.record_id}`,
      type: 'task',
      sourceModule: 'tasks',
      targetSurface: dueAt ? 'timeline' : 'homeGround',
      rollupBucket: dueAt ? 'timeline.tasks' : 'homeGround.unscheduledTasks',
      sortKey: dueAt?.toISOString() ?? task.updated_at,
    });
  }

  for (const reminder of reminders) {
    const remindAt = parseIso(reminder.remind_at);
    if (!remindAt) {
      pushRollupItem(rollup, {
        id: `reminder:${reminder.reminder_id}`,
        type: 'reminder',
        sourceModule: 'reminders',
        targetSurface: null,
        rollupBucket: 'unrouted',
        sortKey: reminder.remind_at || reminder.created_at,
      });
      continue;
    }
    const projectName = projectNameById.get(reminder.space_id) || null;
    if (remindAt < now) {
      dailyData.missedReminders.push({
        id: `backlog-reminder:${reminder.reminder_id}`,
        reminderId: reminder.reminder_id,
        recordId: reminder.record_id,
        projectId: reminder.space_id,
        projectName,
        title: reminder.record_title || 'Untitled reminder',
        remindAtIso: remindAt.toISOString(),
      });
      pushRollupItem(rollup, {
        id: `reminder:${reminder.reminder_id}`,
        type: 'reminder',
        sourceModule: 'reminders',
        targetSurface: 'dailyBrief',
        rollupBucket: 'dailyBrief.missedReminders',
        sortKey: remindAt.toISOString(),
      });
      continue;
    }

    if (isSameCalendarDay(remindAt, now)) {
      dailyData.timedReminders.push({
        id: `reminder:${reminder.reminder_id}`,
        reminderId: reminder.reminder_id,
        recordId: reminder.record_id,
        projectId: reminder.space_id,
        projectName,
        title: reminder.record_title || 'Untitled reminder',
        remindAtIso: remindAt.toISOString(),
        dismissed: false,
      });
      pushRollupItem(rollup, {
        id: `reminder:${reminder.reminder_id}`,
        type: 'reminder',
        sourceModule: 'reminders',
        targetSurface: 'dailyBrief',
        rollupBucket: 'dailyBrief.timedReminders',
        sortKey: remindAt.toISOString(),
      });
      continue;
    }
    pushRollupItem(rollup, {
      id: `reminder:${reminder.reminder_id}`,
      type: 'reminder',
      sourceModule: 'reminders',
      targetSurface: null,
      rollupBucket: 'unrouted',
      sortKey: remindAt.toISOString(),
    });
  }

  for (const thought of quickThoughts) {
    pushRollupItem(rollup, {
      id: `quickThought:${thought.id}`,
      type: 'quickThought',
      sourceModule: 'quickThoughts',
      targetSurface: thought.targetSurface ?? null,
      rollupBucket: thought.targetSurface ? `${thought.targetSurface}.quickThoughts` : 'unrouted',
      sortKey: parseIso(thought.createdAt)?.toISOString() ?? thought.createdAt,
    });
  }

  dailyData.dayEvents.sort((left, right) => compareNullableIsoAscending(left.startAtIso, right.startAtIso));
  dailyData.timedTasks.sort((left, right) => compareNullableIsoAscending(left.dueAtIso, right.dueAtIso));
  dailyData.untimedTasks.sort((left, right) => compareNullableIsoAscending(left.dueAtIso, right.dueAtIso));
  dailyData.overdueTasks.sort((left, right) => compareNullableIsoAscending(left.dueAtIso, right.dueAtIso));
  dailyData.timedReminders.sort((left, right) => compareNullableIsoAscending(left.remindAtIso, right.remindAtIso));
  dailyData.missedReminders.sort((left, right) => compareNullableIsoAscending(left.remindAtIso, right.remindAtIso));

  for (const bucket of Object.values(rollup.buckets)) {
    bucket.sort(compareRollupItems);
  }
  for (const surface of Object.values(rollup.surfaces)) {
    surface.received.sort(compareRollupItems);
  }
  rollup.unrouted.sort(compareRollupItems);
  assertRollupInvariants(rollup);

  const totalPipCounts: DashboardPipCounts = {
    events: homeData.events.filter((event) => {
      const startAt = parseIso(event.event_state.start_dt);
      return startAt ? isSameCalendarDay(startAt, now) : false;
    }).length,
    tasks: homeData.tasks.filter((task) => {
      if (isTaskComplete(task.task_state.status)) {
        return false;
      }
      const dueAt = parseIso(task.task_state.due_at);
      return dueAt ? isSameCalendarDay(dueAt, now) : false;
    }).length,
    reminders: reminders.filter((reminder) => {
      const remindAt = parseIso(reminder.remind_at);
      return remindAt ? isSameCalendarDay(remindAt, now) : false;
    }).length,
  };

  return {
    items,
    dailyData,
    totalPipCounts,
    rollup,
  };
};

export const useDashboardAggregation = ({
  homeData,
  reminders,
  projects,
  now,
  quickThoughts,
}: UseDashboardAggregationParams): UseDashboardAggregationResult =>
  useMemo(
    () => buildDashboardAggregation({
      homeData,
      reminders,
      projects,
      now,
      quickThoughts,
    }),
    [homeData, now, projects, quickThoughts, reminders],
  );
