import { useMemo, useState } from 'react';
import { cn } from '../../../lib/cn';
import type { PriorityLevel } from '../designTokens';
import { getPriorityClasses } from '../../../lib/priorityStyles';
import { TaskRow } from './TaskRow';

export type SortDimension = 'date' | 'priority' | 'category';
export type SortChain = [SortDimension, SortDimension, SortDimension];
export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'cancelled';
export type TaskPriorityValue = 'low' | 'medium' | 'high' | 'urgent' | null;

export interface TaskSubtask {
  id: string;
  label: string;
  dueLabel: string;
  priority: PriorityLevel | null;
  subtasks?: TaskSubtask[];
}

export interface TaskItem {
  id: string;
  label: string;
  dueAt: string | null;
  dueLabel: string;
  categoryId: string;
  categoryValue: string | null;
  assigneeId: string;
  assigneeLabel: string;
  priority: PriorityLevel;
  priorityValue: TaskPriorityValue;
  status: TaskStatus;
  subtaskCount?: number;
  subtasks: TaskSubtask[];
}

interface LensOption {
  id: string;
  label: string;
}

interface Cluster {
  id: string;
  label: string;
  dimension: SortDimension;
  priorityKey?: PriorityLevel;
  items: TaskItem[];
}

interface TasksTabProps {
  tasks: TaskItem[];
  collaborators: LensOption[];
  categories: LensOption[];
  activeUserId: string;
  activeCategoryId: string;
  sortChain: SortChain;
  onSortChainChange: (chain: SortChain) => void;
  onUserChange: (userId: string) => void;
  onCategoryChange: (categoryId: string) => void;
  onAddSubtask?: (task: TaskItem) => void;
  onUpdateTaskStatus?: (taskId: string, status: TaskStatus) => void | Promise<void>;
  onUpdateTaskPriority?: (taskId: string, priority: TaskPriorityValue) => void | Promise<void>;
  onUpdateTaskDueDate?: (taskId: string, dueAt: string | null) => void | Promise<void>;
  onUpdateTaskCategory?: (taskId: string, category: string | null) => void | Promise<void>;
  onDeleteTask?: (taskId: string) => void | Promise<void>;
  showSortControls?: boolean;
}

const SORT_DIMENSIONS: SortDimension[] = ['date', 'priority', 'category'];
const GROUP_BY_LABELS: Record<SortDimension, string> = {
  date: 'Chronological',
  priority: 'Priority',
  category: 'Category',
};
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

const promoteDimension = (chain: SortChain, clicked: SortDimension): SortChain => {
  if (chain[0] === clicked) {
    return chain;
  }
  const rest = chain.filter((dimension) => dimension !== clicked) as [SortDimension, SortDimension];
  return [clicked, rest[0], rest[1]];
};

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

const buildDateClusters = (tasks: TaskItem[]): Cluster[] => {
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

const buildPriorityClusters = (tasks: TaskItem[]): Cluster[] =>
  PRIORITY_ORDER
    .map((priority) => ({
      id: priority,
      label: priority.charAt(0).toUpperCase() + priority.slice(1),
      dimension: 'priority' as const,
      priorityKey: priority,
      items: tasks.filter((task) => task.priority === priority),
    }))
    .filter((cluster) => cluster.items.length > 0);

const buildCategoryClusters = (tasks: TaskItem[]): Cluster[] => {
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
    })) as Cluster[];
};

const buildClusters = (tasks: TaskItem[], chain: SortChain): Cluster[] => {
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

export const TasksTab = ({
  tasks,
  collaborators,
  categories,
  activeUserId,
  activeCategoryId,
  sortChain,
  onSortChainChange,
  onUserChange,
  onCategoryChange,
  onAddSubtask,
  onUpdateTaskStatus,
  onUpdateTaskPriority,
  onUpdateTaskDueDate,
  onUpdateTaskCategory,
  onDeleteTask,
  showSortControls = true,
}: TasksTabProps) => {
  const [collapsedClusterIds, setCollapsedClusterIds] = useState<Set<string>>(new Set());
  const [optimisticStatus, setOptimisticStatus] = useState<{ taskKey: string; entries: Record<string, TaskStatus> }>({
    taskKey: '',
    entries: {},
  });
  const taskKey = useMemo(
    () =>
      JSON.stringify(
        tasks.map((task) => [
          task.id,
          task.status,
          task.priorityValue,
          task.dueAt,
          task.categoryId,
          task.subtaskCount ?? task.subtasks.length,
          task.label,
        ]),
      ),
    [tasks],
  );

  const filteredTasks = useMemo(
    () => tasks.filter((task) => (activeUserId === 'all' || task.assigneeId === activeUserId) && (activeCategoryId === 'all' || task.categoryId === activeCategoryId)),
    [activeCategoryId, activeUserId, tasks],
  );

  const clusters = useMemo(() => buildClusters(filteredTasks, sortChain), [filteredTasks, sortChain]);

  const toggleStatus = (taskId: string, status: TaskStatus) => {
    if (!onUpdateTaskStatus) {
      return;
    }

    setOptimisticStatus((current) => ({
      taskKey,
      entries: {
        ...(current.taskKey === taskKey ? current.entries : {}),
        [taskId]: status,
      },
    }));

    try {
      const mutation = onUpdateTaskStatus(taskId, status);
      void Promise.resolve(mutation).catch(() => {
        setOptimisticStatus((current) => {
          const next = { ...(current.taskKey === taskKey ? current.entries : {}) };
          delete next[taskId];
          return {
            taskKey,
            entries: next,
          };
        });
      });
    } catch (error) {
      setOptimisticStatus((current) => {
        const next = { ...(current.taskKey === taskKey ? current.entries : {}) };
        delete next[taskId];
        return {
          taskKey,
          entries: next,
        };
      });
      throw error;
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {showSortControls ? (
          <>
            <fieldset className="flex flex-wrap items-center gap-2">
              <legend className="text-xs text-muted">Group by</legend>
              {SORT_DIMENSIONS.map((dimension) => {
                const active = sortChain[0] === dimension;
                return (
                  <label
                    key={dimension}
                    className={cn(
                      'inline-flex cursor-pointer items-center rounded-control border px-2 py-1.5 text-xs transition-colors focus-within:ring-2 focus-within:ring-focus-ring',
                      active ? 'border-primary bg-primary/10 text-primary' : 'border-subtle bg-surface text-muted hover:text-text',
                    )}
                  >
                    <input
                      type="radio"
                      name="tasks-group-by"
                      value={dimension}
                      checked={active}
                      onChange={() => onSortChainChange(promoteDimension(sortChain, dimension))}
                      className="sr-only"
                    />
                    {GROUP_BY_LABELS[dimension]}
                  </label>
                );
              })}
            </fieldset>

            <span className="mx-1 h-4 w-px bg-border-subtle" aria-hidden="true" />
          </>
        ) : null}

        {collaborators.map((collaborator) => (
          <button
            key={collaborator.id}
            type="button"
            aria-pressed={activeUserId === collaborator.id}
            onClick={() => onUserChange(collaborator.id)}
            className={cn(
              'rounded-control border px-2 py-1.5 text-xs transition-colors',
              activeUserId === collaborator.id ? 'border-primary bg-primary/10 text-primary' : 'border-subtle bg-surface text-muted hover:text-text',
            )}
          >
            {collaborator.label}
          </button>
        ))}

        <span className="mx-1 h-4 w-px bg-border-subtle" aria-hidden="true" />

        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            aria-pressed={activeCategoryId === category.id}
            onClick={() => onCategoryChange(category.id)}
            className={cn(
              'rounded-control border px-2 py-1.5 text-xs transition-colors',
              activeCategoryId === category.id ? 'border-primary bg-primary/10 text-primary' : 'border-subtle bg-surface text-muted hover:text-text',
            )}
          >
            {category.label}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {clusters.map((cluster, clusterIndex) => {
          const collapsed = collapsedClusterIds.has(cluster.id);
          const itemCount = cluster.items.length;
          const clusterLabel = `${cluster.label}, ${itemCount} ${itemCount === 1 ? 'item' : 'items'}`;
          const clusterDomId = `task-cluster-${cluster.dimension}-${clusterIndex}`;
          const clusterHeadingId = `${clusterDomId}-heading`;
          const clusterListId = `${clusterDomId}-list`;
          const accentClass =
            cluster.dimension === 'priority' && cluster.priorityKey
              ? getPriorityClasses(cluster.priorityKey).dot
              : cluster.dimension === 'category'
                ? 'bg-primary'
                : 'bg-muted';

          return (
            <section key={cluster.id} aria-label={clusterLabel}>
              <h3 id={clusterHeadingId}>
                <button
                  type="button"
                  aria-expanded={!collapsed}
                  aria-controls={clusterListId}
                  onClick={() => {
                    setCollapsedClusterIds((current) => {
                      const next = new Set(current);
                      if (next.has(cluster.id)) {
                        next.delete(cluster.id);
                      } else {
                        next.add(cluster.id);
                      }
                      return next;
                    });
                  }}
                  className="flex w-full items-center gap-2 rounded-control px-1.5 py-1.5 text-left"
                >
                  <span className={cn('h-0.5 w-3 rounded-sm', accentClass)} aria-hidden="true" />
                  <span className="flex-1 text-xs font-bold uppercase tracking-wide text-muted">{cluster.label}</span>
                  <span className="rounded-control border border-subtle bg-surface px-1.5 py-0.5 text-[10px] text-muted">
                    {itemCount}
                  </span>
                  <span className={cn('text-[10px] text-muted transition-transform', !collapsed && 'rotate-90')}>▶</span>
                </button>
              </h3>

              <ul id={clusterListId} aria-labelledby={clusterHeadingId} hidden={collapsed} className="mt-1 space-y-1">
                {cluster.items.map((task) => (
                  <li key={task.id}>
                    <TaskRow
                      task={task}
                      status={(optimisticStatus.taskKey === taskKey ? optimisticStatus.entries[task.id] : undefined) ?? task.status}
                      onAddSubtask={onAddSubtask}
                      onToggleStatus={toggleStatus}
                      onUpdateTaskStatus={onUpdateTaskStatus}
                      onUpdateTaskPriority={onUpdateTaskPriority}
                      onUpdateTaskDueDate={onUpdateTaskDueDate}
                      onUpdateTaskCategory={onUpdateTaskCategory}
                      onDeleteTask={onDeleteTask}
                    />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
};
