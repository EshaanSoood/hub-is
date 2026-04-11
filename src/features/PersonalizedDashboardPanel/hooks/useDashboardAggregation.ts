import { useMemo } from 'react';
import type { ProjectRecord } from '../../../types/domain';
import type { HubReminderSummary } from '../../../services/hub/reminders';
import { buildEventDestinationHref, buildTaskDestinationHref } from '../../../lib/hubRoutes';
import type { DashboardPipCounts, HubDashboardItem, HubHomeData, HubTask, DashboardDailyData } from '../types';
import { isMidnightLocal, isSameCalendarDay, isTaskComplete, parseIso, startOfDay } from '../utils';

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
    projectId: event.project_id,
    projectName: event.project_name,
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
}

interface UseDashboardAggregationResult {
  items: HubDashboardItem[];
  dailyData: DashboardDailyData;
  totalPipCounts: DashboardPipCounts;
}

export const useDashboardAggregation = ({
  homeData,
  reminders,
  projects,
  now,
}: UseDashboardAggregationParams): UseDashboardAggregationResult => {
  const items = useMemo(
    () => [...buildTaskItems(homeData.tasks), ...buildEventItems(homeData.events)],
    [homeData.events, homeData.tasks],
  );

  const projectNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const project of projects) {
      map.set(project.id, project.name);
    }
    return map;
  }, [projects]);

  const dailyData = useMemo<DashboardDailyData>(() => {
    const todayStart = startOfDay(now);

    const dayEvents = homeData.events.flatMap((event) => {
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

    const timedTasks: DashboardDailyData['timedTasks'] = [];
    const overdueTasks: DashboardDailyData['overdueTasks'] = [];
    const untimedTasks: DashboardDailyData['untimedTasks'] = [];

    for (const task of homeData.tasks) {
      const dueAt = parseIso(task.task_state.due_at);
      const complete = isTaskComplete(task.task_state.status);
      if (complete) {
        continue;
      }
      if (dueAt && dueAt < todayStart) {
        overdueTasks.push({
          id: `backlog-overdue:${task.record_id}`,
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
          id: `backlog-untimed:${task.record_id}`,
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

    const timedReminders: DashboardDailyData['timedReminders'] = [];
    const missedReminders: DashboardDailyData['missedReminders'] = [];

    for (const reminder of reminders) {
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
      } else if (remindAt < now) {
        missedReminders.push({
          id: `backlog-reminder:${reminder.reminder_id}`,
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
  }, [homeData.events, homeData.tasks, now, projectNameById, reminders]);

  const totalPipCounts = useMemo<DashboardPipCounts>(() => {
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
    const remindersCount = reminders.filter((reminder) => {
      const remindAt = parseIso(reminder.remind_at);
      return remindAt ? isSameCalendarDay(remindAt, now) : false;
    }).length;
    return { events, tasks, reminders: remindersCount };
  }, [homeData.events, homeData.tasks, now, reminders]);

  return {
    items,
    dailyData,
    totalPipCounts,
  };
};
