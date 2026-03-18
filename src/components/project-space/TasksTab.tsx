import { useMemo, useState } from 'react';
import { cn } from '../../lib/cn';
import { PRIORITY_COLORS, PRIORITY_DOT_COLORS, PRIORITY_TINT_COLORS, type PriorityLevel } from './designTokens';

export type TasksClusterMode = 'chronological' | 'category' | 'priority';

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
  mode: TasksClusterMode;
  priorityKey?: PriorityLevel;
  items: TaskItem[];
}

interface TasksTabProps {
  tasks: TaskItem[];
  collaborators: LensOption[];
  categories: LensOption[];
  activeUserId: string;
  activeCategoryId: string;
  clusterMode: TasksClusterMode;
  onUserChange: (userId: string) => void;
  onCategoryChange: (categoryId: string) => void;
  onClusterModeChange: (mode: TasksClusterMode) => void;
}

const CLUSTER_LABELS: Array<{ id: TasksClusterMode; label: string }> = [
  { id: 'chronological', label: 'Chronological' },
  { id: 'category', label: 'Category' },
  { id: 'priority', label: 'Priority' },
];

const PRIORITY_ORDER: PriorityLevel[] = ['high', 'medium', 'low'];

const parseDueAt = (dueAt: string | null): Date | null => {
  if (!dueAt) {
    return null;
  }
  const parsed = new Date(dueAt);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const clusterByChronological = (tasks: TaskItem[]): Cluster[] => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const groups: Record<string, TaskItem[]> = {
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

    due.setHours(0, 0, 0, 0);
    const diff = Math.floor((due.getTime() - today.getTime()) / 86400000);

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

  const ordered: Array<{ id: string; label: string }> = [
    { id: 'overdue', label: 'Overdue' },
    { id: 'today', label: 'Today' },
    { id: 'thisWeek', label: 'This Week' },
    { id: 'later', label: 'Later' },
  ];

  return ordered
    .map((group) => ({ id: group.id, label: group.label, mode: 'chronological' as const, items: groups[group.id] }))
    .filter((group) => group.items.length > 0);
};

const clusterByCategory = (tasks: TaskItem[]): Cluster[] => {
  const map = new Map<string, TaskItem[]>();
  for (const task of tasks) {
    map.set(task.categoryId, [...(map.get(task.categoryId) ?? []), task]);
  }

  return Array.from(map.entries()).map(([categoryId, items]) => ({
    id: categoryId,
    label: categoryId.charAt(0).toUpperCase() + categoryId.slice(1),
    mode: 'category',
    items,
  }));
};

const clusterByPriority = (tasks: TaskItem[]): Cluster[] =>
  PRIORITY_ORDER
    .map((priority) => ({
      id: priority,
      label: priority.charAt(0).toUpperCase() + priority.slice(1),
      mode: 'priority' as const,
      priorityKey: priority,
      items: tasks.filter((task) => task.priority === priority),
    }))
    .filter((group) => group.items.length > 0);

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
  clusterMode,
  onUserChange,
  onCategoryChange,
  onClusterModeChange,
}: TasksTabProps) => {
  const [collapsedClusterIds, setCollapsedClusterIds] = useState<Set<string>>(new Set());

  const filteredTasks = useMemo(
    () => tasks.filter((task) => (activeUserId === 'all' || task.assigneeId === activeUserId) && (activeCategoryId === 'all' || task.categoryId === activeCategoryId)),
    [activeCategoryId, activeUserId, tasks],
  );

  const clusters = useMemo(() => {
    if (clusterMode === 'chronological') {
      return clusterByChronological(filteredTasks);
    }
    if (clusterMode === 'category') {
      return clusterByCategory(filteredTasks);
    }
    return clusterByPriority(filteredTasks);
  }, [clusterMode, filteredTasks]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted">Group by</span>
        {CLUSTER_LABELS.map((cluster) => (
          <button
            key={cluster.id}
            type="button"
            aria-pressed={clusterMode === cluster.id}
            onClick={() => onClusterModeChange(cluster.id)}
            className={cn(
              'rounded-control border px-2 py-1 text-xs transition-colors',
              clusterMode === cluster.id ? 'border-primary bg-primary/10 text-primary' : 'border-subtle bg-surface text-muted hover:text-text',
            )}
          >
            {cluster.label}
          </button>
        ))}

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
          const accent = cluster.priorityKey ? PRIORITY_DOT_COLORS[cluster.priorityKey] : 'var(--color-muted)';

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
