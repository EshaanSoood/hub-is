import { useMemo, useState } from 'react';
import { cn } from '../../lib/cn';
import { PRIORITY_DOT_COLORS, type PriorityLevel } from './designTokens';
import { TasksTab, type SortChain, type TaskItem, type TaskPriorityValue, type TaskStatus } from './TasksTab';
import { formatDueLabel } from './taskAdapter';

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
  onUpdateTaskStatus?: (taskId: string, status: 'todo' | 'in_progress' | 'done' | 'cancelled') => void;
  onUpdateTaskPriority?: (taskId: string, priority: 'low' | 'medium' | 'high' | 'urgent' | null) => void;
  onUpdateTaskDueDate?: (taskId: string, dueAt: string | null) => void;
  onDeleteTask?: (taskId: string) => void;
  onAddSubtask?: (task: TaskItem) => void;
  readOnly?: boolean;
}

const FIXED_SORT_CHAIN: SortChain = ['date', 'priority', 'category'];
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

const toIsoDate = (value: string): string | null => {
  if (!value) {
    return null;
  }
  return new Date(`${value}T12:00:00`).toISOString();
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
          'w-full rounded-control border border-border-muted bg-surface px-3 py-2 text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
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
            onClick={() => {
              reset();
              onCancel();
            }}
            className="rounded-control border border-border-muted px-3 py-1.5 text-xs font-semibold text-primary"
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
              className="text-xs text-muted hover:text-danger"
              aria-label="Clear parent task"
            >
              ×
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setParentPickerOpen((current) => !current)}
            className="text-xs text-muted hover:text-text"
          >
            + Subtask of...
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
  onCreateTask,
  readOnly = false,
}: Pick<TasksModuleSkinProps, 'tasks' | 'onCreateTask' | 'readOnly'>) => {
  if (readOnly) {
    return <p className="rounded-panel border border-border-muted bg-surface-elevated p-3 text-sm text-muted">Tasks (read-only)</p>;
  }

  return <TaskComposer tasks={tasks} onCreateTask={onCreateTask} compact />;
};

const TasksModuleMedium = ({
  tasks,
  tasksLoading,
  onUpdateTaskStatus,
  readOnly = false,
}: Pick<TasksModuleSkinProps, 'tasks' | 'tasksLoading' | 'onUpdateTaskStatus' | 'readOnly'>) => {
  const visibleTasks = useMemo(() => [...tasks].sort(compareMediumTasks), [tasks]);
  const displayedTasks = visibleTasks.slice(0, 8);

  return (
    <section className="rounded-panel border border-border-muted bg-surface-elevated p-4" aria-label="Tasks module">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-text">Tasks</p>
        <span className="rounded-control border border-border-muted bg-surface px-2 py-0.5 text-xs text-muted">{tasks.length}</span>
      </div>

      {tasksLoading ? <p role="status" aria-live="polite" className="text-sm text-muted">Loading tasks...</p> : null}
      {!tasksLoading && displayedTasks.length === 0 ? <p className="text-sm text-muted">No tasks in this pane.</p> : null}
      {!tasksLoading && displayedTasks.length > 0 ? (
        <ul className="space-y-2">
          {displayedTasks.map((task) => {
            const nextStatus = getNextStatus(task.status);
            return (
              <li key={task.id} className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={readOnly || !onUpdateTaskStatus || task.status === 'cancelled'}
                  onClick={() => onUpdateTaskStatus?.(task.id, nextStatus)}
                  aria-label={`Mark ${task.label} as ${STATUS_LABELS[nextStatus]}`}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm text-text-secondary hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span aria-hidden="true">{STATUS_SYMBOLS[task.status]}</span>
                </button>
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: PRIORITY_DOT_COLORS[priorityTone(task)] }}
                  aria-hidden="true"
                />
                <span className={cn('min-w-0 flex-1 truncate text-sm text-text', task.status === 'cancelled' && 'line-through text-text-secondary')}>
                  {task.label}
                </span>
                <span className="shrink-0 text-xs text-muted">{formatDueLabel(task.dueAt)}</span>
              </li>
            );
          })}
        </ul>
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
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerParentTask, setComposerParentTask] = useState<TaskItem | null>(null);

  const collaboratorOptions = useMemo(
    () => [
      { id: 'all', label: 'All' },
      ...[...new Set(tasks.map((task) => task.assigneeId))]
        .filter(Boolean)
        .map((assigneeId) => ({
          id: assigneeId,
          label: humanizeOption(assigneeId, 'unassigned'),
        })),
    ],
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
    <section className="space-y-3" aria-label="Tasks module">
      {!readOnly ? (
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => handleOpenComposer(null)}
            className="rounded-control bg-primary px-3 py-2 text-sm font-semibold text-on-primary"
          >
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

      <TasksTab
        tasks={tasks}
        collaborators={collaboratorOptions}
        categories={categoryOptions}
        activeUserId={activeUserId}
        activeCategoryId={activeCategoryId}
        sortChain={FIXED_SORT_CHAIN}
        onSortChainChange={() => undefined}
        onUserChange={setActiveUserId}
        onCategoryChange={setActiveCategoryId}
        showSortControls={false}
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
    </section>
  );
};

export const TasksModuleSkin = ({ sizeTier, ...props }: TasksModuleSkinProps) => {
  if (sizeTier === 'S') {
    return <TasksModuleSmall {...props} />;
  }
  if (sizeTier === 'M') {
    return <TasksModuleMedium {...props} />;
  }
  return <TasksModuleLarge {...props} />;
};
