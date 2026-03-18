import { useMemo, useRef, useState } from 'react';
import { cn } from '../../lib/cn';
import { PRIORITY_COLORS, PRIORITY_DOT_COLORS, PRIORITY_TINT_COLORS, type PriorityLevel } from './designTokens';

export type SortDimension = 'date' | 'priority' | 'category';
export type SortChain = [SortDimension, SortDimension, SortDimension];

export interface TaskSubtask {
  id: string;
  label: string;
  dueLabel: string;
  priority: PriorityLevel | null;
}

export interface TaskItem {
  id: string;
  label: string;
  dueAt: string | null;
  dueLabel: string;
  categoryId: string;
  assigneeId: string;
  priority: PriorityLevel;
  status: 'todo' | 'in_progress' | 'done' | 'cancelled';
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
}

const SORT_DIMENSIONS: SortDimension[] = ['date', 'priority', 'category'];
const SORT_LABELS: Record<SortDimension, string> = {
  date: 'Date',
  priority: 'Priority',
  category: 'Category',
};
const POSITION_LABELS = ['primary', 'secondary', 'tertiary'] as const;
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

const moveDimension = (chain: SortChain, fromIndex: number, toIndex: number): SortChain => {
  if (fromIndex === toIndex || fromIndex < 0 || fromIndex > 2 || toIndex < 0 || toIndex > 2) {
    return chain;
  }
  const next = [...chain];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next as SortChain;
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
  const today = startOfDay(new Date());
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

    const dueDay = startOfDay(due);
    const diff = Math.floor((dueDay.getTime() - today.getTime()) / 86_400_000);

    if (diff < 0) {
      groups.overdue.push(task);
    } else if (diff === 0) {
      groups.today.push(task);
    } else if (diff <= 7) {
      groups.thisWeek.push(task);
    } else {
      groups.later.push(task);
    }
  }

  const clusters: Cluster[] = [
    { id: 'overdue', label: 'Overdue', dimension: 'date', items: groups.overdue },
    { id: 'today', label: 'Today', dimension: 'date', items: groups.today },
    { id: 'thisWeek', label: 'This Week', dimension: 'date', items: groups.thisWeek },
    { id: 'later', label: 'Later', dimension: 'date', items: groups.later },
  ];

  return clusters.filter((cluster) => cluster.items.length > 0);
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

const SubtaskRow = ({ subtask, parentPriority }: { subtask: TaskSubtask; parentPriority: PriorityLevel }) => {
  const resolvedPriority = subtask.priority ?? parentPriority;
  return (
    <li className="flex items-center gap-2 pl-5 text-xs text-muted">
      <span
        className={cn('h-1.5 w-1.5 rounded-full', !subtask.priority && 'opacity-50')}
        style={{ backgroundColor: PRIORITY_DOT_COLORS[resolvedPriority] }}
        aria-hidden="true"
      />
      <span className="flex-1">{subtask.label}</span>
      <span className="opacity-70">{subtask.dueLabel}</span>
    </li>
  );
};

const TaskRow = ({ task }: { task: TaskItem }) => {
  const [expanded, setExpanded] = useState(false);
  const visibleSubtaskCount = task.subtaskCount ?? task.subtasks.length;
  return (
    <div className="rounded-control px-1 py-0.5 hover:bg-elevated">
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        disabled={task.subtasks.length === 0}
        className="flex w-full items-center gap-2 text-left disabled:cursor-default"
      >
        <span className="h-7 w-0.5 rounded-sm" style={{ backgroundColor: PRIORITY_DOT_COLORS[task.priority] }} aria-hidden="true" />
        <span className="flex-1 text-sm text-text">{task.label}</span>
        {visibleSubtaskCount > 0 ? (
          <span
            className="rounded-control border px-1.5 py-0.5 text-[10px] font-semibold"
            style={{
              color: PRIORITY_COLORS[task.priority],
              borderColor: PRIORITY_COLORS[task.priority],
              backgroundColor: PRIORITY_TINT_COLORS[task.priority],
            }}
          >
            {visibleSubtaskCount}
          </span>
        ) : null}
        <span className="text-xs text-text-secondary">{task.dueLabel}</span>
        {task.subtasks.length > 0 ? <span className={cn('text-[10px] text-muted transition-transform', expanded && 'rotate-90')}>▶</span> : null}
      </button>

      {expanded && task.subtasks.length > 0 ? (
        <ul className="mt-1 space-y-1">
          {task.subtasks.map((subtask) => (
            <SubtaskRow key={subtask.id} subtask={subtask} parentPriority={task.priority} />
          ))}
        </ul>
      ) : null}
    </div>
  );
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
}: TasksTabProps) => {
  const [collapsedClusterIds, setCollapsedClusterIds] = useState<Set<string>>(new Set());
  const dragIndexRef = useRef<number | null>(null);

  const filteredTasks = useMemo(
    () => tasks.filter((task) => (activeUserId === 'all' || task.assigneeId === activeUserId) && (activeCategoryId === 'all' || task.categoryId === activeCategoryId)),
    [activeCategoryId, activeUserId, tasks],
  );

  const clusters = useMemo(() => buildClusters(filteredTasks, sortChain), [filteredTasks, sortChain]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted">Sort by</span>
        <div role="listbox" aria-label="Sort order" className="flex flex-wrap items-center gap-2">
          {SORT_DIMENSIONS.map((dimension) => {
            const position = sortChain.indexOf(dimension);
            const positionLabel = POSITION_LABELS[position];
            return (
              <button
                key={dimension}
                type="button"
                role="option"
                aria-selected={position === 0}
                aria-roledescription="sortable"
                aria-label={`${SORT_LABELS[dimension]} — ${positionLabel} sort`}
                draggable="true"
                onClick={() => {
                  onSortChainChange(promoteDimension(sortChain, dimension));
                }}
                onDragStart={() => {
                  dragIndexRef.current = position;
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                }}
                onDrop={() => {
                  const fromIndex = dragIndexRef.current;
                  dragIndexRef.current = null;
                  if (fromIndex === null) {
                    return;
                  }
                  onSortChainChange(moveDimension(sortChain, fromIndex, position));
                }}
                onDragEnd={() => {
                  dragIndexRef.current = null;
                }}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowLeft') {
                    event.preventDefault();
                    onSortChainChange(moveDimension(sortChain, position, position - 1));
                    return;
                  }
                  if (event.key === 'ArrowRight') {
                    event.preventDefault();
                    onSortChainChange(moveDimension(sortChain, position, position + 1));
                    return;
                  }
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSortChainChange(promoteDimension(sortChain, dimension));
                  }
                }}
                className={cn(
                  'rounded-control border px-2 py-1 text-xs transition-all duration-300 ease-in-out',
                  position === 0 ? 'border-primary bg-primary/10 text-primary' : 'border-subtle bg-surface text-muted hover:text-text',
                )}
                style={{ order: position }}
              >
                {SORT_LABELS[dimension]}
              </button>
            );
          })}
        </div>

        <span className="mx-1 h-4 w-px bg-border-subtle" aria-hidden="true" />

        {collaborators.map((collaborator) => (
          <button
            key={collaborator.id}
            type="button"
            aria-pressed={activeUserId === collaborator.id}
            onClick={() => onUserChange(collaborator.id)}
            className={cn(
              'rounded-control border px-2 py-1 text-xs transition-colors',
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
              'rounded-control border px-2 py-1 text-xs transition-colors',
              activeCategoryId === category.id ? 'border-primary bg-primary/10 text-primary' : 'border-subtle bg-surface text-muted hover:text-text',
            )}
          >
            {category.label}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {clusters.map((cluster) => {
          const collapsed = collapsedClusterIds.has(cluster.id);
          const accent =
            cluster.dimension === 'priority' && cluster.priorityKey
              ? PRIORITY_DOT_COLORS[cluster.priorityKey]
              : cluster.dimension === 'category'
                ? 'var(--color-info)'
                : 'var(--color-muted)';

          return (
            <section key={cluster.id}>
              <button
                type="button"
                aria-expanded={!collapsed}
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
                className="flex w-full items-center gap-2 rounded-control px-1 py-1 text-left"
              >
                <span className="h-0.5 w-3 rounded-sm" style={{ backgroundColor: accent }} aria-hidden="true" />
                <span className="flex-1 text-xs font-bold uppercase tracking-wide text-muted">{cluster.label}</span>
                <span className="rounded-control border border-subtle bg-surface px-1.5 py-0.5 text-[10px] text-muted">
                  {cluster.items.length}
                </span>
                <span className={cn('text-[10px] text-muted transition-transform', collapsed && '-rotate-90')}>▶</span>
              </button>

              {!collapsed ? (
                <div className="mt-1 space-y-1">
                  {cluster.items.map((task) => (
                    <TaskRow key={task.id} task={task} />
                  ))}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
};
