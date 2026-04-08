import { useMemo, useState } from 'react';
import { cn } from '../../../lib/cn';
import type { PriorityLevel } from '../designTokens';
import { getPriorityClasses } from '../../../lib/priorityStyles';
import type { ModuleInsertItemType } from '../moduleContracts';
import { TaskRow } from './TaskRow';
import { TasksTabHeader } from './TasksTabHeader';
import { useTasksTabFiltering } from './hooks/useTasksTabFiltering';

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
  activeItemId?: string | null;
  activeItemType?: ModuleInsertItemType;
  setActiveItem?: (id: string, type: ModuleInsertItemType, title: string) => void;
  clearActiveItem?: () => void;
  onInsertToEditor?: (item: { id: string; type: string; title: string }) => void;
  showSortControls?: boolean;
}

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
  activeItemId = null,
  activeItemType = null,
  setActiveItem,
  clearActiveItem,
  onInsertToEditor,
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

  const { clusters } = useTasksTabFiltering({
    tasks,
    activeUserId,
    activeCategoryId,
    sortChain,
  });

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
      <TasksTabHeader
        showSortControls={showSortControls}
        sortChain={sortChain}
        onSortChainChange={onSortChainChange}
        collaborators={collaborators}
        categories={categories}
        activeUserId={activeUserId}
        activeCategoryId={activeCategoryId}
        onUserChange={onUserChange}
        onCategoryChange={onCategoryChange}
      />

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
                      activeItemId={activeItemId}
                      activeItemType={activeItemType}
                      setActiveItem={setActiveItem}
                      clearActiveItem={clearActiveItem}
                      onInsertToEditor={onInsertToEditor}
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
