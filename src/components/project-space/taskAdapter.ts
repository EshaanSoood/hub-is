import type { HubTaskSummary } from '../../services/hub/types';
import type { PriorityLevel } from './designTokens';
import type { TaskItem } from './TasksTab';

const monthDayFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
});

const monthDayYearFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const weekdayFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
});

const startOfDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const mapPriority = (priority: HubTaskSummary['task_state']['priority']): PriorityLevel => {
  if (priority === 'high' || priority === 'medium' || priority === 'low') {
    return priority;
  }
  if (priority === 'urgent') {
    return 'high';
  }
  return 'low';
};

export const formatDueLabel = (isoString: string | null): string => {
  if (!isoString) {
    return 'No date';
  }

  const dueAt = new Date(isoString);
  if (Number.isNaN(dueAt.getTime())) {
    return 'No date';
  }

  const today = startOfDay(new Date());
  const dueDay = startOfDay(dueAt);
  const diffDays = Math.round((dueDay.getTime() - today.getTime()) / 86_400_000);

  if (diffDays < 0) {
    return `Overdue · ${monthDayFormatter.format(dueAt)}`;
  }
  if (diffDays === 0) {
    return 'Today';
  }
  if (diffDays === 1) {
    return 'Tomorrow';
  }
  if (diffDays <= 7) {
    return weekdayFormatter.format(dueAt);
  }

  return monthDayYearFormatter.format(dueAt);
};

export const adaptTaskSummary = (task: HubTaskSummary): TaskItem => ({
  // TODO: resolve assignee display names from user service when task assignments expose only user IDs.
  assigneeLabel:
    (task.assignments?.[0] as (HubTaskSummary['assignments'][number] & { display_name?: string }) | undefined)?.display_name
    ?? task.assignments?.[0]?.user_id
    ?? 'Unassigned',
  id: task.record_id,
  label: task.title,
  dueAt: task.task_state.due_at,
  dueLabel: formatDueLabel(task.task_state.due_at),
  categoryId: task.task_state.category ?? 'uncategorized',
  categoryValue: task.task_state.category,
  assigneeId: task.assignments?.[0]?.user_id ?? 'unassigned',
  priority: mapPriority(task.task_state.priority),
  priorityValue: task.task_state.priority,
  status: task.task_state.status,
  subtaskCount: task.subtask_count,
  // TODO: lazy-load subtasks on expand via GET /api/hub/records/:id/subtasks
  subtasks: [],
});

export const adaptTaskSummaries = (tasks: HubTaskSummary[]): TaskItem[] => tasks.map(adaptTaskSummary);
