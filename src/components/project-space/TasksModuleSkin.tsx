import { useMemo, useState } from 'react';
import { useModuleInsertContext } from '../../context/ModuleInsertContext';
import { useLongPress } from '../../hooks/useLongPress';
import { Icon } from '../primitives';
import { cn } from '../../lib/cn';
import type { PriorityLevel } from './designTokens';
import { getPriorityClasses } from '../../lib/priorityStyles';
import { TasksTab, type SortChain, type SortDimension, type TaskItem, type TaskPriorityValue, type TaskStatus } from './TasksTab';
import { formatDueLabel } from './taskAdapter';
import { ModuleEmptyState } from './ModuleFeedback';

interface TasksModuleSkinProps {
  sizeTier: 'S' | 'M' | 'L';
  tasks: TaskItem[];
  tasksLoading: boolean;
  onCreateTask: (task: {
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
  hideHeader?: boolean;
  readOnly?: boolean;
}

const CREATE_PRIORITY_OPTIONS: Array<{ value: TaskPriorityValue; label: string }> = [
  { value: null, label: 'None' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];
const STATUS_SYMBOLS: Record<TaskStatus, string> = {
  todo: '○',
  in_progress: '◐',
  done: '✓',
  cancelled: '⊘',
};
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

const toIsoDate = (value: string): string | null => {
  if (!value) {
    return null;
  }
  const d = new Date(`${value}T12:00:00`);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  return d.toISOString();
};

const parseDueAt = (isoString: string | null): Date | null => {
  if (!isoString) {
    return null;
  }
  const parsed = new Date(isoString);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const priorityTone = (task: TaskItem): PriorityLevel => {
  if (task.priorityValue === 'urgent') {
    return 'high';
  }
  if (task.priorityValue === 'medium' || task.priorityValue === 'low' || task.priorityValue === 'high') {
    return task.priorityValue;
  }
  return task.priority;
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

const countLargeTaskSections = (tasks: TaskItem[]): number => {
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const weekEnd = new Date(now);
  const daysUntilWeekEnd = (6 - weekEnd.getDay() + 7) % 7;
  weekEnd.setDate(weekEnd.getDate() + daysUntilWeekEnd);
  weekEnd.setHours(23, 59, 59, 999);

  return tasks.reduce((count, task) => {
    const due = parseDueAt(task.dueAt);
    if (!due) {
      return count + 1;
    }
    if (due.getTime() < today.getTime()) {
      return count + 1;
    }
    if (due.getTime() < tomorrow.getTime()) {
      return count + 1;
    }
    if (due.getTime() <= weekEnd.getTime()) {
      return count + 1;
    }
    return count + 1;
  }, 0);
};

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
}: {
  tasks: TaskItem[];
  readOnly?: boolean;
  onUpdateTaskStatus?: TasksModuleSkinProps['onUpdateTaskStatus'];
}) => (
  <ul className="space-y-2">
    {tasks.map((task) => (
      <TaskSummaryRow key={task.id} task={task} readOnly={readOnly} onUpdateTaskStatus={onUpdateTaskStatus} />
    ))}
  </ul>
);

const TaskSummaryRow = ({
  task,
  readOnly = false,
  onUpdateTaskStatus,
}: {
  task: TaskItem;
  readOnly?: boolean;
  onUpdateTaskStatus?: TasksModuleSkinProps['onUpdateTaskStatus'];
}) => {
  const nextStatus = getNextStatus(task.status);
  const { activeItemId, activeItemType, clearActiveItem, onInsertToEditor, setActiveItem } = useModuleInsertContext();
  const longPressHandlers = useLongPress(() => {
    setActiveItem(task.id, 'task', task.label);
  });
  const showInsertAction = activeItemId === task.id && activeItemType === 'task';

  return (
    <li className="relative flex items-center gap-2" {...longPressHandlers}>
      <button
        type="button"
        disabled={readOnly || !onUpdateTaskStatus || task.status === 'cancelled'}
        onClick={() => {
          void Promise.resolve(onUpdateTaskStatus?.(task.id, nextStatus)).catch((error) => {
            console.error('Failed to update task status:', error);
          });
        }}
        aria-label={`Mark ${task.label} as ${STATUS_LABELS[nextStatus]}`}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm text-text-secondary hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span aria-hidden="true">{STATUS_SYMBOLS[task.status]}</span>
      </button>
      <span
        className={cn('h-2 w-2 shrink-0 rounded-full', getPriorityClasses(priorityTone(task)).dot)}
        aria-hidden="true"
      />
      <span className={cn('min-w-0 flex-1 truncate pr-16 text-sm text-text', task.status === 'cancelled' && 'line-through text-text-secondary')}>
        {task.label}
      </span>
      <span className="shrink-0 text-xs text-muted">{formatDueLabel(task.dueAt)}</span>
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

interface TaskComposerProps {
  tasks: TaskItem[];
  onCreateTask: TasksModuleSkinProps['onCreateTask'];
  compact?: boolean;
  submitLabel?: string;
  initialParentTask?: TaskItem | null;
  onCancel?: () => void;
}

const TaskComposer = ({
  tasks,
  onCreateTask,
  compact = false,
  submitLabel = 'Add',
  initialParentTask = null,
  onCancel,
}: TaskComposerProps) => {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<string>('');
  const [dueDate, setDueDate] = useState('');
  const [parentPickerOpen, setParentPickerOpen] = useState(Boolean(initialParentTask));
  const [parentTaskId, setParentTaskId] = useState(initialParentTask?.id ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const selectedParentTask = useMemo(() => tasks.find((task) => task.id === parentTaskId) ?? null, [parentTaskId, tasks]);

  const reset = () => {
    setTitle('');
    setPriority('');
    setDueDate('');
    setParentPickerOpen(false);
    setParentTaskId('');
  };

  return (
    <form
      className={cn(
        'rounded-panel border border-border-muted bg-surface-elevated',
        compact ? 'space-y-2 p-3' : 'space-y-3 p-4',
      )}
      onSubmit={async (event) => {
        event.preventDefault();
        setErrorMsg(null);
        const trimmedTitle = title.trim();
        if (!trimmedTitle || submitting) {
          return;
        }
        try {
          setSubmitting(true);
          await onCreateTask({
            title: trimmedTitle,
            priority: priority || null,
            due_at: toIsoDate(dueDate),
            parent_record_id: selectedParentTask?.id ?? null,
          });
          reset();
          onCancel?.();
        } catch (err) {
          console.error('Failed to create task:', err);
          setErrorMsg(err instanceof Error ? err.message : 'Failed to create task.');
        } finally {
          setSubmitting(false);
        }
      }}
    >
      <input
        type="text"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="New task..."
        aria-label="New task title"
        className={cn(
          'w-full rounded-control border border-border-muted bg-surface px-3 py-2 text-text placeholder:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
          compact ? 'text-sm' : 'text-sm',
        )}
      />

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={priority}
          onChange={(event) => setPriority(event.target.value)}
          aria-label="Task priority"
          className="rounded-control border border-border-muted bg-surface px-2 py-1 text-xs text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          {CREATE_PRIORITY_OPTIONS.map((option) => (
            <option key={option.label} value={option.value ?? ''}>
              {option.label}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={dueDate}
          onChange={(event) => setDueDate(event.target.value)}
          aria-label="Task due date"
          className="rounded-control border border-border-muted bg-surface px-2 py-1 text-xs text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        />
        <button
          type="submit"
          disabled={submitting}
          className="rounded-control bg-primary px-3 py-1.5 text-xs font-semibold text-on-primary disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitLabel}
        </button>
        {onCancel ? (
          <button
            type="button"
            disabled={submitting}
            onClick={() => {
              if (submitting) return;
              reset();
              onCancel();
            }}
            className="rounded-control border border-border-muted px-3 py-1.5 text-xs font-semibold text-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
        ) : null}
      </div>

      {errorMsg ? <p className="mt-1 text-sm text-red-500">{errorMsg}</p> : null}

      <div className="space-y-2">
        {selectedParentTask ? (
          <div className="flex items-center gap-2 text-xs text-muted">
            <span className="rounded-control border border-border-muted bg-surface px-2 py-1">
              Subtask of {selectedParentTask.label}
            </span>
            <button
              type="button"
              onClick={() => {
                setParentTaskId('');
                setParentPickerOpen(false);
              }}
              className="inline-flex items-center text-xs text-muted hover:text-danger"
              aria-label="Clear parent task"
            >
              <Icon name="close" className="text-[12px]" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setParentPickerOpen((current) => !current)}
            className="inline-flex items-center gap-1 text-xs text-muted hover:text-text"
          >
            <Icon name="plus" className="text-[12px]" />
            Subtask of...
          </button>
        )}

        {parentPickerOpen && !selectedParentTask ? (
          <select
            value={parentTaskId}
            onChange={(event) => setParentTaskId(event.target.value)}
            aria-label="Select parent task for subtask"
            className="w-full rounded-control border border-border-muted bg-surface px-2 py-1 text-xs text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            <option value="">Select parent task</option>
            {tasks.map((task) => (
              <option key={task.id} value={task.id}>
                {task.label}
              </option>
            ))}
          </select>
        ) : null}
      </div>
    </form>
  );
};

const TasksModuleSmall = ({
  tasks,
  tasksLoading,
  onCreateTask,
  onUpdateTaskStatus,
  readOnly = false,
}: Pick<TasksModuleSkinProps, 'tasks' | 'tasksLoading' | 'onCreateTask' | 'onUpdateTaskStatus' | 'readOnly'>) => {
  const visibleTasks = useMemo(() => [...tasks].sort(compareMediumTasks).slice(0, 3), [tasks]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {!readOnly ? (
        <TaskComposer tasks={tasks} onCreateTask={onCreateTask} compact />
      ) : null}
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {tasksLoading ? <p className="text-sm text-muted">Loading...</p> : null}
        {!tasksLoading && visibleTasks.length === 0 ? (
          <ModuleEmptyState
            title="No tasks in this pane."
            iconName="tasks"
            sizeTier="S"
          />
        ) : null}
        {!tasksLoading && visibleTasks.length > 0 ? (
          <TaskSummaryRows tasks={visibleTasks} readOnly={readOnly} onUpdateTaskStatus={onUpdateTaskStatus} />
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
  readOnly = false,
}: Pick<TasksModuleSkinProps, 'tasks' | 'tasksLoading' | 'onCreateTask' | 'onUpdateTaskStatus' | 'readOnly'>) => {
  const [composerOpen, setComposerOpen] = useState(false);
  const visibleTasks = useMemo(() => [...tasks].sort(compareMediumTasks), [tasks]);
  const displayedTasks = visibleTasks.slice(0, 8);
  const canCreateTask = !readOnly && typeof onCreateTask === 'function';

  return (
    <section className="flex h-full min-h-0 flex-col rounded-panel border border-border-muted bg-surface-elevated p-4" aria-label="Tasks module">
      {!readOnly && composerOpen ? (
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
        <TaskSummaryRows tasks={displayedTasks} readOnly={readOnly} onUpdateTaskStatus={onUpdateTaskStatus} />
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
  onAddSubtask,
  readOnly = false,
}: Omit<TasksModuleSkinProps, 'sizeTier'>) => {
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
      {!readOnly ? (
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => handleOpenComposer(null)}
            className="inline-flex items-center gap-2 rounded-control bg-primary px-3 py-2 text-sm font-semibold text-on-primary"
          >
            <Icon name="plus" className="text-[14px]" />
            New Task
          </button>
          {tasksLoading ? <p role="status" aria-live="polite" className="text-sm text-muted">Loading tasks...</p> : null}
        </div>
      ) : tasksLoading ? (
        <p role="status" aria-live="polite" className="text-sm text-muted">Loading tasks...</p>
      ) : null}

      {!readOnly && composerOpen ? (
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
          description="Its Procrastinators vs ProTaskinators out here."
          ctaLabel={canCreateTask ? 'New Task' : undefined}
          onCta={canCreateTask ? () => handleOpenComposer(null) : undefined}
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
            readOnly
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
        />
      ) : null}
    </section>
  );
};

export const TasksModuleSkin = ({ sizeTier, ...props }: TasksModuleSkinProps) => {
  return (
    <div className="h-full min-h-0">
      {sizeTier === 'S' ? <TasksModuleSmall {...props} /> : null}
      {sizeTier === 'M' ? <TasksModuleMedium {...props} /> : null}
      {sizeTier === 'L' ? <TasksModuleLarge {...props} /> : null}
    </div>
  );
};
