import { useMemo, useState } from 'react';
import { useLongPress } from '../../../hooks/useLongPress';
import { Icon } from '../../primitives';
import { TaskCard } from '../../cards/TaskCard';
import { cn } from '../../../lib/cn';
import { TasksTab, type SortChain, type SortDimension, type TaskItem, type TaskPriorityValue, type TaskStatus } from '../TasksTab';
import { formatDueLabel } from '../taskAdapter';
import { ModuleEmptyState } from '../ModuleFeedback';
import { useModuleInsertState, type ModuleInsertState } from '../hooks/useModuleInsertState';
import { TaskComposer } from './TaskComposer';

interface TasksModuleSkinProps {
  sizeTier: 'S' | 'M' | 'L';
  tasks: TaskItem[];
  tasksLoading: boolean;
  onOpenRecord?: (recordId: string) => void;
  onCreateTask?: (task: {
    title: string;
    priority: string | null;
    due_at: string | null;
    parent_record_id?: string | null;
  }) => Promise<void>;
  onUpdateTaskStatus?: (taskId: string, status: 'todo' | 'in_progress' | 'done' | 'cancelled') => void | Promise<void>;
  onUpdateTaskPriority?: (taskId: string, priority: 'low' | 'medium' | 'high' | 'urgent' | null) => void | Promise<void>;
  onUpdateTaskDueDate?: (taskId: string, dueAt: string | null) => void | Promise<void>;
  onDeleteTask?: (taskId: string) => void | Promise<void>;
  onAddSubtask?: (task: TaskItem) => void;
  onInsertToEditor?: (item: { id: string; type: string; title: string }) => void;
  hideHeader?: boolean;
  readOnly?: boolean;
}

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'to do',
  in_progress: 'in progress',
  done: 'done',
  cancelled: 'cancelled',
};
const MEDIUM_PRIORITY_RANK: Record<Exclude<TaskPriorityValue, null>, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const parseDueAt = (isoString: string | null): Date | null => {
  if (!isoString) {
    return null;
  }
  const parsed = new Date(isoString);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getNextStatus = (status: TaskStatus): TaskStatus => {
  if (status === 'todo') {
    return 'in_progress';
  }
  if (status === 'in_progress') {
    return 'done';
  }
  return 'todo';
};

const compareMediumTasks = (left: TaskItem, right: TaskItem) => {
  const leftDue = parseDueAt(left.dueAt);
  const rightDue = parseDueAt(right.dueAt);
  if (leftDue && rightDue && leftDue.getTime() !== rightDue.getTime()) {
    return leftDue.getTime() - rightDue.getTime();
  }
  if (leftDue && !rightDue) {
    return -1;
  }
  if (!leftDue && rightDue) {
    return 1;
  }
  const leftPriority = left.priorityValue ? MEDIUM_PRIORITY_RANK[left.priorityValue] : 4;
  const rightPriority = right.priorityValue ? MEDIUM_PRIORITY_RANK[right.priorityValue] : 4;
  if (leftPriority !== rightPriority) {
    return leftPriority - rightPriority;
  }
  return left.label.localeCompare(right.label) || left.id.localeCompare(right.id);
};

const countLargeTaskSections = (tasks: TaskItem[]): number => tasks.length;

const humanizeOption = (value: string, fallback: string) => {
  if (!value || value === fallback) {
    return fallback.charAt(0).toUpperCase() + fallback.slice(1);
  }
  return value
    .split(/[-_]/g)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
};

const isOpaqueIdLabel = (value: string): boolean => UUID_PATTERN.test(value) || /^[0-9a-f]{24,}$/i.test(value);

const sortChainForGroupBy = (groupBy: SortDimension): SortChain => {
  if (groupBy === 'priority') {
    return ['priority', 'date', 'category'];
  }
  if (groupBy === 'category') {
    return ['category', 'date', 'priority'];
  }
  return ['date', 'priority', 'category'];
};

const TaskSummaryRows = ({
  tasks,
  readOnly = false,
  onUpdateTaskStatus,
  activeItemId,
  activeItemType,
  setActiveItem,
  clearActiveItem,
  onInsertToEditor,
}: {
  tasks: TaskItem[];
  readOnly?: boolean;
  onUpdateTaskStatus?: TasksModuleSkinProps['onUpdateTaskStatus'];
  activeItemId: ModuleInsertState['activeItemId'];
  activeItemType: ModuleInsertState['activeItemType'];
  setActiveItem: ModuleInsertState['setActiveItem'];
  clearActiveItem: ModuleInsertState['clearActiveItem'];
  onInsertToEditor?: ModuleInsertState['onInsertToEditor'];
}) => (
  <ul className="space-y-2">
    {tasks.map((task) => (
      <TaskSummaryRow
        key={task.id}
        task={task}
        readOnly={readOnly}
        onUpdateTaskStatus={onUpdateTaskStatus}
        activeItemId={activeItemId}
        activeItemType={activeItemType}
        setActiveItem={setActiveItem}
        clearActiveItem={clearActiveItem}
        onInsertToEditor={onInsertToEditor}
      />
    ))}
  </ul>
);

const TaskSummaryRow = ({
  task,
  readOnly = false,
  onUpdateTaskStatus,
  activeItemId,
  activeItemType,
  setActiveItem,
  clearActiveItem,
  onInsertToEditor,
}: {
  task: TaskItem;
  readOnly?: boolean;
  onUpdateTaskStatus?: TasksModuleSkinProps['onUpdateTaskStatus'];
  activeItemId: ModuleInsertState['activeItemId'];
  activeItemType: ModuleInsertState['activeItemType'];
  setActiveItem: ModuleInsertState['setActiveItem'];
  clearActiveItem: ModuleInsertState['clearActiveItem'];
  onInsertToEditor?: ModuleInsertState['onInsertToEditor'];
}) => {
  const nextStatus = getNextStatus(task.status);
  const longPressHandlers = useLongPress(() => {
    setActiveItem(task.id, 'task', task.label);
  });
  const showInsertAction = Boolean(activeItemId === task.id && activeItemType === 'task' && onInsertToEditor);

  return (
    <li className="relative" {...longPressHandlers}>
      <TaskCard
        title={task.label}
        status={task.status}
        dueLabel={formatDueLabel(task.dueAt)}
        subtitle={task.priorityValue ? `Priority ${task.priorityValue}` : null}
        onToggleStatus={() => {
          void Promise.resolve()
            .then(() => onUpdateTaskStatus?.(task.id, nextStatus))
            .catch((error) => {
              console.error('Failed to update task status:', error);
            });
        }}
        toggleDisabled={readOnly || !onUpdateTaskStatus || task.status === 'cancelled'}
        toggleAriaLabel={`Mark ${task.label} as ${STATUS_LABELS[nextStatus]}`}
        onTitleClick={() => setActiveItem(task.id, 'task', task.label)}
        onTitleFocus={() => setActiveItem(task.id, 'task', task.label)}
        onTitleKeyDown={(event) => {
          if (event.key === 'Escape') {
            clearActiveItem();
          }
        }}
        titleAriaLabel={`Insert task ${task.label}`}
        titlePressed={showInsertAction}
        className={cn(
          'items-center gap-1',
          task.status === 'cancelled' && 'text-text-secondary',
        )}
      />
      {showInsertAction ? (
        <button
          type="button"
          data-module-insert-ignore="true"
          onClick={() => {
            onInsertToEditor?.({ id: task.id, type: 'task', title: task.label });
            clearActiveItem();
          }}
          className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-control bg-primary px-2 py-1 text-xs font-semibold text-on-primary shadow-soft"
        >
          Insert
        </button>
      ) : null}
    </li>
  );
};

const TasksModuleSmall = ({
  tasks,
  tasksLoading,
  onCreateTask,
  onUpdateTaskStatus,
  insertState,
  readOnly = false,
}: Pick<TasksModuleSkinProps, 'tasks' | 'tasksLoading' | 'onCreateTask' | 'onUpdateTaskStatus' | 'readOnly'> & {
  insertState: ModuleInsertState;
}) => {
  const visibleTasks = useMemo(() => [...tasks].sort(compareMediumTasks).slice(0, 3), [tasks]);
  const canCreateTask = !readOnly && typeof onCreateTask === 'function';

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {canCreateTask ? (
        <div className="shrink-0">
          <TaskComposer tasks={tasks} onCreateTask={onCreateTask} compact />
        </div>
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pr-1">
        {tasksLoading ? (
          <p role="status" aria-live="polite" className="text-sm text-muted">
            Loading tasks...
          </p>
        ) : null}
        {!tasksLoading && visibleTasks.length === 0 ? (
          <ModuleEmptyState
            title="No tasks in this pane."
            iconName="tasks"
            sizeTier="S"
          />
        ) : null}
        {!tasksLoading && visibleTasks.length > 0 ? (
          <TaskSummaryRows
            tasks={visibleTasks}
            readOnly={readOnly}
            onUpdateTaskStatus={onUpdateTaskStatus}
            activeItemId={insertState.activeItemId}
            activeItemType={insertState.activeItemType}
            setActiveItem={insertState.setActiveItem}
            clearActiveItem={insertState.clearActiveItem}
            onInsertToEditor={insertState.onInsertToEditor}
          />
        ) : null}
      </div>
    </div>
  );
};

const TasksModuleMedium = ({
  tasks,
  tasksLoading,
  onCreateTask,
  onUpdateTaskStatus,
  insertState,
  readOnly = false,
}: Pick<TasksModuleSkinProps, 'tasks' | 'tasksLoading' | 'onCreateTask' | 'onUpdateTaskStatus' | 'readOnly'> & {
  insertState: ModuleInsertState;
}) => {
  const [composerOpen, setComposerOpen] = useState(false);
  const visibleTasks = useMemo(() => [...tasks].sort(compareMediumTasks), [tasks]);
  const displayedTasks = visibleTasks.slice(0, 8);
  const canCreateTask = !readOnly && typeof onCreateTask === 'function';

  return (
    <section className="flex h-full min-h-0 flex-col rounded-panel border border-border-muted bg-surface-elevated p-4" aria-label="Tasks module">
      {canCreateTask && displayedTasks.length > 0 && !composerOpen ? (
        <div className="mb-3 flex justify-end">
          <button
            type="button"
            onClick={() => setComposerOpen(true)}
            className="interactive interactive-fold rounded-control border border-primary bg-primary px-3 py-1.5 text-xs font-semibold text-on-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            New Task
          </button>
        </div>
      ) : null}
      {canCreateTask && composerOpen ? (
        <TaskComposer
          tasks={tasks}
          onCreateTask={onCreateTask}
          submitLabel="Create task"
          onCancel={() => setComposerOpen(false)}
        />
      ) : null}
      {tasksLoading ? <p role="status" aria-live="polite" className="text-sm text-muted">Loading tasks...</p> : null}
      {!tasksLoading && displayedTasks.length === 0 ? (
        <ModuleEmptyState
          title="No tasks in this pane."
          iconName="tasks"
          ctaLabel={canCreateTask ? 'New Task' : undefined}
          onCta={canCreateTask ? () => setComposerOpen(true) : undefined}
          sizeTier="M"
        />
      ) : null}
      {!tasksLoading && displayedTasks.length > 0 ? (
        <TaskSummaryRows
          tasks={displayedTasks}
          readOnly={readOnly}
          onUpdateTaskStatus={onUpdateTaskStatus}
          activeItemId={insertState.activeItemId}
          activeItemType={insertState.activeItemType}
          setActiveItem={insertState.setActiveItem}
          clearActiveItem={insertState.clearActiveItem}
          onInsertToEditor={insertState.onInsertToEditor}
        />
      ) : null}
      {!tasksLoading && tasks.length > displayedTasks.length ? (
        <p className="mt-3 text-xs text-muted">+{tasks.length - displayedTasks.length} more</p>
      ) : null}
    </section>
  );
};

const TasksModuleLarge = ({
  tasks,
  tasksLoading,
  onCreateTask,
  onUpdateTaskStatus,
  onUpdateTaskPriority,
  onUpdateTaskDueDate,
  onDeleteTask,
  onOpenRecord,
  onAddSubtask,
  insertState,
  readOnly = false,
}: Omit<TasksModuleSkinProps, 'sizeTier'> & {
  insertState: ModuleInsertState;
}) => {
  const [activeUserId, setActiveUserId] = useState('all');
  const [activeCategoryId, setActiveCategoryId] = useState('all');
  const [groupBy, setGroupBy] = useState<SortDimension>('date');
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerParentTask, setComposerParentTask] = useState<TaskItem | null>(null);
  const filteredTasks = useMemo(
    () => tasks.filter((task) => (activeUserId === 'all' || task.assigneeId === activeUserId) && (activeCategoryId === 'all' || task.categoryId === activeCategoryId)),
    [activeCategoryId, activeUserId, tasks],
  );
  const visibleLargeTaskCount = useMemo(() => countLargeTaskSections(filteredTasks), [filteredTasks]);
  const hasDefaultLargeFilters = activeUserId === 'all' && activeCategoryId === 'all';
  const canCreateTask = !readOnly && typeof onCreateTask === 'function';

  const collaboratorOptions = useMemo(
    () => {
      const labelsById = new Map<string, string>();
      let collaboratorFallbackIndex = 1;
      for (const task of tasks) {
        if (!task.assigneeId || labelsById.has(task.assigneeId)) {
          continue;
        }
        if (task.assigneeId === 'unassigned') {
          labelsById.set(task.assigneeId, 'Unassigned');
          continue;
        }
        const trimmedLabel = task.assigneeLabel.trim();
        if (trimmedLabel && trimmedLabel.toLowerCase() !== 'collaborator' && !isOpaqueIdLabel(trimmedLabel)) {
          labelsById.set(task.assigneeId, trimmedLabel);
          continue;
        }
        labelsById.set(task.assigneeId, `Collaborator ${collaboratorFallbackIndex}`);
        collaboratorFallbackIndex += 1;
      }
      return [
        { id: 'all', label: 'All' },
        ...Array.from(labelsById, ([assigneeId, assigneeLabel]) => ({
          id: assigneeId,
          label: assigneeLabel,
        })),
      ];
    },
    [tasks],
  );
  const categoryOptions = useMemo(
    () => [
      { id: 'all', label: 'All' },
      ...[...new Set(tasks.map((task) => task.categoryId))]
        .filter(Boolean)
        .map((categoryId) => ({
          id: categoryId,
          label: humanizeOption(categoryId, 'uncategorized'),
        })),
    ],
    [tasks],
  );

  const handleOpenComposer = (parentTask: TaskItem | null) => {
    setComposerParentTask(parentTask);
    setComposerOpen(true);
  };

  return (
    <section className="flex h-full min-h-0 flex-col gap-3" aria-label="Tasks module">
      {canCreateTask ? (
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => handleOpenComposer(null)}
            className="interactive interactive-fold inline-flex items-center gap-2 rounded-control bg-primary px-3 py-2 text-sm font-semibold text-on-primary"
          >
            <Icon name="plus" className="text-[14px]" />
            New Task
          </button>
          {tasksLoading ? <p role="status" aria-live="polite" className="text-sm text-muted">Loading tasks...</p> : null}
        </div>
      ) : tasksLoading ? (
        <p role="status" aria-live="polite" className="text-sm text-muted">Loading tasks...</p>
      ) : null}

      {canCreateTask && composerOpen ? (
        <TaskComposer
          key={composerParentTask?.id ?? 'standalone'}
          tasks={tasks}
          onCreateTask={onCreateTask}
          submitLabel={composerParentTask ? 'Create subtask' : 'Create task'}
          initialParentTask={composerParentTask}
          onCancel={() => {
            setComposerOpen(false);
            setComposerParentTask(null);
          }}
        />
      ) : null}

      {!tasksLoading && hasDefaultLargeFilters && visibleLargeTaskCount === 0 ? (
        <ModuleEmptyState
          title="No tasks in this pane."
          iconName="tasks"
          description="It's Procrastinators vs ProTaskinators out here."
          sizeTier="L"
        />
      ) : null}

      {(!tasksLoading || tasks.length > 0) && !(hasDefaultLargeFilters && visibleLargeTaskCount === 0) ? (
        <TasksTab
          tasks={tasks}
          collaborators={collaboratorOptions}
          categories={categoryOptions}
          activeUserId={activeUserId}
          activeCategoryId={activeCategoryId}
          sortChain={sortChainForGroupBy(groupBy)}
          onSortChainChange={(chain) => setGroupBy(chain[0])}
          onUserChange={setActiveUserId}
          onCategoryChange={setActiveCategoryId}
          onAddSubtask={
            !canCreateTask
              ? undefined
              : (task) => {
                  if (onAddSubtask) {
                    onAddSubtask(task);
                    return;
                  }
                  handleOpenComposer(task);
                }
          }
          onUpdateTaskStatus={readOnly ? undefined : onUpdateTaskStatus}
          onUpdateTaskPriority={readOnly ? undefined : onUpdateTaskPriority}
          onUpdateTaskDueDate={readOnly ? undefined : onUpdateTaskDueDate}
          onDeleteTask={readOnly ? undefined : onDeleteTask}
          onOpenRecord={onOpenRecord}
          activeItemId={insertState.activeItemId}
          activeItemType={insertState.activeItemType}
          setActiveItem={insertState.setActiveItem}
          clearActiveItem={insertState.clearActiveItem}
          onInsertToEditor={insertState.onInsertToEditor}
        />
      ) : null}
    </section>
  );
};

export const TasksModuleSkin = ({ sizeTier, onInsertToEditor, ...props }: TasksModuleSkinProps) => {
  const insertState = useModuleInsertState({ onInsertToEditor });

  return (
    <div className="flex h-full min-h-0 flex-col">
      {sizeTier === 'S' ? <TasksModuleSmall {...props} insertState={insertState} /> : null}
      {sizeTier === 'M' ? <TasksModuleMedium {...props} insertState={insertState} /> : null}
      {sizeTier === 'L' ? <TasksModuleLarge {...props} insertState={insertState} /> : null}
    </div>
  );
};
