import { useEffect, useRef, useState, type RefObject } from 'react';
import { Dialog } from '../primitives/Dialog';
import { classifyIntent, type IntentResult } from '../../lib/nlp/intent';
import { parseTaskInput, type TaskParseResult } from '../../lib/nlp/task-parser';
import { createRecord } from '../../services/hub/records';

interface TaskCreateDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  accessToken: string;
  projectId: string;
  tasksCollectionId: string | null;
  projectMembers: Array<{ user_id: string; display_name: string }>;
  parentRecordId?: string | null;
  parentTaskTitle?: string | null;
  showRememberedParentNote?: boolean;
  onSwitchToStandaloneTask?: () => void;
  triggerRef?: RefObject<HTMLElement | null>;
}

type TouchField = 'title' | 'priority' | 'dueDate' | 'assignee' | 'category' | 'status';

const toDateTimeLocal = (isoString: string | null) => {
  if (!isoString) {
    return '';
  }
  const parsed = new Date(isoString);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }
  return new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

const findSuggestedAssignee = (
  hints: string[],
  projectMembers: Array<{ user_id: string; display_name: string }>,
): string => {
  for (const hint of hints) {
    const normalizedHint = hint.trim().toLowerCase();
    if (!normalizedHint) {
      continue;
    }
    const matches = projectMembers.filter((member) => member.display_name.toLowerCase().includes(normalizedHint));
    if (matches.length === 1) {
      return matches[0].user_id;
    }
  }
  return '';
};

export const TaskCreateDialog = ({
  open,
  onClose,
  onCreated,
  accessToken,
  projectId,
  tasksCollectionId,
  projectMembers,
  parentRecordId = null,
  parentTaskTitle = null,
  showRememberedParentNote = false,
  onSwitchToStandaloneTask,
  triggerRef,
}: TaskCreateDialogProps) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const touchedFieldsRef = useRef<Set<TouchField>>(new Set());
  const [nlInput, setNlInput] = useState('');
  const [titleValue, setTitleValue] = useState('');
  const [statusValue, setStatusValue] = useState<'todo' | 'in_progress' | 'done'>('todo');
  const [priorityValue, setPriorityValue] = useState('');
  const [dueDateValue, setDueDateValue] = useState('');
  const [categoryValue, setCategoryValue] = useState('');
  const [assigneeValue, setAssigneeValue] = useState('');
  const [parseResult, setParseResult] = useState<TaskParseResult | null>(null);
  const [intentResult, setIntentResult] = useState<IntentResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [titleError, setTitleError] = useState<string | null>(null);

  const resetState = () => {
    touchedFieldsRef.current.clear();
    setNlInput('');
    setTitleValue('');
    setStatusValue('todo');
    setPriorityValue('');
    setDueDateValue('');
    setCategoryValue('');
    setAssigneeValue('');
    setParseResult(null);
    setIntentResult(null);
    setSubmitting(false);
    setSubmitError(null);
    setTitleError(null);
  };

  useEffect(() => {
    if (!open) {
      resetState();
      return;
    }
    resetState();
  }, [open, parentRecordId, parentTaskTitle]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const frame = requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (!nlInput.trim()) {
      setParseResult(null);
      setIntentResult(null);
      return;
    }

    const timeout = window.setTimeout(() => {
      const intent = classifyIntent(nlInput);
      const parsed = parseTaskInput(nlInput);
      setIntentResult(intent);
      setParseResult(parsed);

      if (!touchedFieldsRef.current.has('title')) {
        setTitleValue(parsed.title || nlInput.trim());
      }
      if (!touchedFieldsRef.current.has('priority')) {
        setPriorityValue(parsed.priority || '');
      }
      if (!touchedFieldsRef.current.has('dueDate')) {
        setDueDateValue(toDateTimeLocal(parsed.due_at));
      }
      if (!touchedFieldsRef.current.has('assignee')) {
        setAssigneeValue(findSuggestedAssignee(parsed.assignee_hints, projectMembers));
      }
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [nlInput, open, projectMembers]);

  const markTouched = (field: TouchField) => {
    touchedFieldsRef.current.add(field);
  };

  const dialogTitle = parentRecordId
    ? `New Subtask of ${parentTaskTitle || 'Task'}`
    : 'New Task';
  const submitLabel = parentRecordId ? 'Create Subtask' : 'Create Task';

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedTitle = titleValue.trim();
    setTitleError(null);
    setSubmitError(null);

    if (!trimmedTitle) {
      setTitleError('Title is required.');
      return;
    }

    if (!tasksCollectionId) {
      setSubmitError('No task collection found for this project. Create a task from a pane first.');
      return;
    }

    setSubmitting(true);
    try {
      await createRecord(accessToken, projectId, {
        collection_id: tasksCollectionId,
        title: trimmedTitle,
        capability_types: ['task'],
        task_state: {
          status: statusValue,
          priority: priorityValue || null,
          due_at: dueDateValue ? new Date(dueDateValue).toISOString() : null,
          category: categoryValue.trim() || null,
        },
        assignment_user_ids: assigneeValue ? [assigneeValue] : [],
        parent_record_id: parentRecordId || null,
      });
      onCreated();
      handleClose();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to create task.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      title={dialogTitle}
      description="Create a task from natural language or structured fields."
      onClose={handleClose}
      triggerRef={triggerRef}
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label className="text-xs font-medium uppercase tracking-wide text-muted" htmlFor="task-create-nl">
            Task Description
          </label>
          <textarea
            id="task-create-nl"
            ref={textareaRef}
            value={nlInput}
            onChange={(event) => setNlInput(event.target.value)}
            aria-label="Describe your task in natural language"
            placeholder="Describe your task..."
            rows={4}
            className="min-h-24 w-full resize-y rounded-control border border-border-muted bg-surface px-3 py-2 text-sm text-text"
          />
          <div role="status" aria-live="polite" className="text-xs text-muted">
            {intentResult?.ambiguous ? 'Not sure if this is a task — check the fields below.' : null}
            {!intentResult?.ambiguous && intentResult && intentResult.intent !== 'task'
              ? `This looks more like a ${intentResult.intent} than a task. Creating as a task anyway.`
              : null}
            {!intentResult && parseResult ? `Parsed task title: ${parseResult.title || 'Untitled task'}` : null}
          </div>
        </div>

        {showRememberedParentNote && parentRecordId ? (
          <div className="rounded-panel border border-border-muted bg-surface px-3 py-2 text-sm text-muted">
            Creating subtask of {parentTaskTitle || 'task'}.
            {onSwitchToStandaloneTask ? (
              <button
                type="button"
                className="ml-2 font-semibold text-primary underline"
                onClick={onSwitchToStandaloneTask}
              >
                Switch to standalone task
              </button>
            ) : null}
          </div>
        ) : null}

        {parentRecordId ? (
          <p className="text-sm text-muted">This task will be created as a subtask.</p>
        ) : null}

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium uppercase tracking-wide text-muted" htmlFor="task-create-title">
              Title
            </label>
            <input
              id="task-create-title"
              value={titleValue}
              onChange={(event) => {
                markTouched('title');
                setTitleValue(event.target.value);
                if (titleError) {
                  setTitleError(null);
                }
              }}
              className="w-full rounded-control border border-border-muted bg-surface px-3 py-2 text-sm text-text"
            />
            {titleError ? <p role="alert" className="text-xs text-danger">{titleError}</p> : null}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium uppercase tracking-wide text-muted" htmlFor="task-create-status">
                Status
              </label>
              <select
                id="task-create-status"
                value={statusValue}
                onChange={(event) => {
                  markTouched('status');
                  setStatusValue(event.target.value as 'todo' | 'in_progress' | 'done');
                }}
                className="w-full rounded-control border border-border-muted bg-surface px-3 py-2 text-sm text-text"
              >
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="done">Done</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium uppercase tracking-wide text-muted" htmlFor="task-create-priority">
                Priority
              </label>
              <select
                id="task-create-priority"
                value={priorityValue}
                onChange={(event) => {
                  markTouched('priority');
                  setPriorityValue(event.target.value);
                }}
                className="w-full rounded-control border border-border-muted bg-surface px-3 py-2 text-sm text-text"
              >
                <option value="">None</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium uppercase tracking-wide text-muted" htmlFor="task-create-due-date">
              Due Date
            </label>
            <input
              id="task-create-due-date"
              type="datetime-local"
              value={dueDateValue}
              onChange={(event) => {
                markTouched('dueDate');
                setDueDateValue(event.target.value);
              }}
              className="w-full rounded-control border border-border-muted bg-surface px-3 py-2 text-sm text-text"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium uppercase tracking-wide text-muted" htmlFor="task-create-category">
              Category
            </label>
            <input
              id="task-create-category"
              value={categoryValue}
              onChange={(event) => {
                markTouched('category');
                setCategoryValue(event.target.value);
              }}
              placeholder="e.g. Design, Writing, Marketing"
              className="w-full rounded-control border border-border-muted bg-surface px-3 py-2 text-sm text-text"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium uppercase tracking-wide text-muted" htmlFor="task-create-assignee">
              Assignee
            </label>
            <select
              id="task-create-assignee"
              value={assigneeValue}
              onChange={(event) => {
                markTouched('assignee');
                setAssigneeValue(event.target.value);
              }}
              className="w-full rounded-control border border-border-muted bg-surface px-3 py-2 text-sm text-text"
            >
              <option value="">Unassigned</option>
              {projectMembers.map((member) => (
                <option key={member.user_id} value={member.user_id}>
                  {member.display_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {submitError ? <p role="alert" className="text-sm text-danger">{submitError}</p> : null}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-control border border-border-muted px-3 py-2 text-sm font-medium text-primary"
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-control bg-primary px-3 py-2 text-sm font-semibold text-on-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Creating...' : submitLabel}
          </button>
        </div>
      </form>
    </Dialog>
  );
};
