import { useMemo } from 'react';
import type { PriorityLevel } from '../../designTokens';
import type { SortChain, SortDimension, TaskItem } from '../index';

export interface TaskCluster {
  id: string;
  label: string;
  dimension: SortDimension;
  priorityKey?: PriorityLevel;
  items: TaskItem[];
}

interface UseTasksTabFilteringArgs {
  tasks: TaskItem[];
  activeUserId: string;
  activeCategoryId: string;
  sortChain: SortChain;
}

const PRIORITY_ORDER: PriorityLevel[] = ['high', 'medium', 'low'];
const PRIORITY_RANK: Record<PriorityLevel, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const parseDueAt = (dueAt: string | null): Date | null => {
  if (!dueAt) {
    return null;
  }
  const parsed = new Date(dueAt);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const startOfDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const normalizeWeekday = (value: number): number => (Number.isInteger(value) && value >= 0 && value <= 6 ? value : 6);

const endOfWeek = (date: Date, weekEndDay = 6) => {
  const next = new Date(date);
  const day = next.getDay();
  const resolvedWeekEndDay = normalizeWeekday(weekEndDay);
  const daysUntilWeekEnd = (resolvedWeekEndDay - day + 7) % 7;
  next.setDate(next.getDate() + daysUntilWeekEnd);
  next.setHours(23, 59, 59, 999);
  return next;
};

const titleCaseCategory = (categoryId: string) =>
  categoryId
    .split(/[-_]/g)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');

const compareCategory = (left: string, right: string): number => {
  const leftIsUncategorized = left === 'uncategorized';
  const rightIsUncategorized = right === 'uncategorized';
  if (leftIsUncategorized && !rightIsUncategorized) {
    return 1;
  }
  if (!leftIsUncategorized && rightIsUncategorized) {
    return -1;
  }
  return left.localeCompare(right);
};

const compareSingleDimension = (left: TaskItem, right: TaskItem, dimension: SortDimension): number => {
  if (dimension === 'date') {
    const leftDue = parseDueAt(left.dueAt);
    const rightDue = parseDueAt(right.dueAt);
    if (!leftDue && !rightDue) {
      return 0;
    }
    if (!leftDue) {
      return 1;
    }
    if (!rightDue) {
      return -1;
    }
    return leftDue.getTime() - rightDue.getTime();
  }

  if (dimension === 'priority') {
    return PRIORITY_RANK[left.priority] - PRIORITY_RANK[right.priority];
  }

  return compareCategory(left.categoryId, right.categoryId);
};

const buildComparator = (dimensions: SortDimension[]): ((left: TaskItem, right: TaskItem) => number) => {
  return (left, right) => {
    for (const dimension of dimensions) {
      const result = compareSingleDimension(left, right, dimension);
      if (result !== 0) {
        return result;
      }
    }
    return left.label.localeCompare(right.label) || left.id.localeCompare(right.id);
  };
};

const buildDateClusters = (tasks: TaskItem[]): TaskCluster[] => {
  const now = new Date();
  const today = startOfDay(now);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const weekEnd = endOfWeek(now);
  const groups: Record<'overdue' | 'today' | 'thisWeek' | 'later', TaskItem[]> = {
    overdue: [],
    today: [],
    thisWeek: [],
    later: [],
  };

  for (const task of tasks) {
    const due = parseDueAt(task.dueAt);
    if (!due) {
      groups.later.push(task);
      continue;
    }

    if (due.getTime() < today.getTime()) {
      groups.overdue.push(task);
    } else if (due.getTime() < tomorrow.getTime()) {
      groups.today.push(task);
    } else if (due.getTime() <= weekEnd.getTime()) {
      groups.thisWeek.push(task);
    } else {
      groups.later.push(task);
    }
  }

  return [
    { id: 'overdue', label: 'Overdue', dimension: 'date', items: groups.overdue },
    { id: 'today', label: 'Today', dimension: 'date', items: groups.today },
    { id: 'thisWeek', label: 'This Week', dimension: 'date', items: groups.thisWeek },
    { id: 'later', label: 'Later', dimension: 'date', items: groups.later },
  ];
};

const buildPriorityClusters = (tasks: TaskItem[]): TaskCluster[] =>
  PRIORITY_ORDER
    .map((priority) => ({
      id: priority,
      label: priority.charAt(0).toUpperCase() + priority.slice(1),
      dimension: 'priority' as const,
      priorityKey: priority,
      items: tasks.filter((task) => task.priority === priority),
    }))
    .filter((cluster) => cluster.items.length > 0);

const buildCategoryClusters = (tasks: TaskItem[]): TaskCluster[] => {
  const map = new Map<string, TaskItem[]>();
  for (const task of tasks) {
    map.set(task.categoryId, [...(map.get(task.categoryId) ?? []), task]);
  }

  return [...map.entries()]
    .sort(([left], [right]) => compareCategory(left, right))
    .map(([categoryId, items]) => ({
      id: categoryId,
      label: titleCaseCategory(categoryId) || 'Uncategorized',
      dimension: 'category' as const,
      items,
    })) as TaskCluster[];
};

const buildClusters = (tasks: TaskItem[], chain: SortChain): TaskCluster[] => {
  const primary = chain[0];
  const comparator = buildComparator([chain[1], chain[2]]);
  const grouped =
    primary === 'date'
      ? buildDateClusters(tasks)
      : primary === 'priority'
        ? buildPriorityClusters(tasks)
        : buildCategoryClusters(tasks);

  return grouped.map((cluster) => ({
    ...cluster,
    items: [...cluster.items].sort(comparator),
  }));
};

export const useTasksTabFiltering = ({ tasks, activeUserId, activeCategoryId, sortChain }: UseTasksTabFilteringArgs) => {
  const filteredTasks = useMemo(
    () => tasks.filter((task) => (activeUserId === 'all' || task.assigneeId === activeUserId) && (activeCategoryId === 'all' || task.categoryId === activeCategoryId)),
    [activeCategoryId, activeUserId, tasks],
  );

  const clusters = useMemo(() => buildClusters(filteredTasks, sortChain), [filteredTasks, sortChain]);

  return { clusters, filteredTasks };
};
