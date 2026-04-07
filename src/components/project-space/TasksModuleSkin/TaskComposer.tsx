import { useMemo, useState } from 'react';
import { Icon } from '../../primitives';
import { cn } from '../../../lib/cn';
import type { TaskItem, TaskPriorityValue } from '../TasksTab';

const CREATE_PRIORITY_OPTIONS: Array<{ value: TaskPriorityValue; label: string }> = [
  { value: null, label: 'None' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

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

interface TaskComposerProps {
  tasks: TaskItem[];
  onCreateTask: (task: {
    title: string;
    priority: string | null;
    due_at: string | null;
    parent_record_id?: string | null;
  }) => Promise<void>;
  compact?: boolean;
  submitLabel?: string;
  initialParentTask?: TaskItem | null;
  onCancel?: () => void;
}

export const TaskComposer = ({
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

      {errorMsg ? <p role="alert" aria-live="assertive" className="mt-1 text-sm text-danger">{errorMsg}</p> : null}

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
