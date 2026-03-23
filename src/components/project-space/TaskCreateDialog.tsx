import { useEffect, useRef, useState, type RefObject } from 'react';
import { Dialog } from '../primitives/Dialog';
import { classifyIntent, type IntentResult } from '../../lib/nlp/intent';
import { parseTaskInput, type TaskParseResult } from '../../lib/nlp/task-parser';
import { createTask } from '../../services/hub/records';

interface TaskCreateDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  accessToken: string;
  projectId: string;
  projectMembers: Array<{ user_id: string; display_name: string }>;
  parentRecordId?: string | null;
  parentTaskTitle?: string | null;
  showRememberedParentNote?: boolean;
  onSwitchToStandaloneTask?: () => void;
  triggerRef?: RefObject<HTMLElement | null>;
  projectOptions?: Array<{ value: string; label: string }>;
  selectedProjectId?: string;
  onSelectedProjectIdChange?: (projectId: string) => void;
  titleInputRef?: RefObject<HTMLInputElement | null>;
}

type TouchField = 'title' | 'priority' | 'dueDate' | 'assignee' | 'category' | 'status';
type PrioritySelectValue = '' | 'low' | 'medium' | 'high' | 'urgent';
const PARSE_DEBOUNCE_MS = 120;

const toDateTimeLocal = (isoString: string | null) => {
  if (!isoString) {
    return '';
  }
  const normalizedIso = isoString.includes('T') ? isoString : `${isoString}T23:59`;
  const parsed = new Date(normalizedIso);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }
  return new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

const getDefaultDueDateValue = () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  return new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
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

const normalizePriorityValue = (value: string | null | undefined): PrioritySelectValue => {
  if (value === 'low' || value === 'medium' || value === 'high' || value === 'urgent') {
    return value;
  }
  return '';
};

export const TaskCreateDialog = ({
  open,
  onClose,
  onCreated,
  accessToken,
  projectId,
  projectMembers,
  parentRecordId = null,
  parentTaskTitle = null,
  showRememberedParentNote = false,
  onSwitchToStandaloneTask,
  triggerRef,
  projectOptions,
  selectedProjectId = '',
  onSelectedProjectIdChange,
  titleInputRef,
}: TaskCreateDialogProps) => {
  const localTitleInputRef = useRef<HTMLInputElement | null>(null);
  const projectSelectRef = useRef<HTMLSelectElement | null>(null);
  const touchedFieldsRef = useRef<Set<TouchField>>(new Set());
  const submitInFlightRef = useRef(false);
  const [titleValue, setTitleValue] = useState('');
  const [statusValue, setStatusValue] = useState<'todo' | 'in_progress' | 'done'>('todo');
  const [priorityValue, setPriorityValue] = useState<PrioritySelectValue>('medium');
  const [dueDateValue, setDueDateValue] = useState(getDefaultDueDateValue);
  const [categoryValue, setCategoryValue] = useState('');
  const [assigneeValue, setAssigneeValue] = useState('');
  const [parseResult, setParseResult] = useState<TaskParseResult | null>(null);
  const [intentResult, setIntentResult] = useState<IntentResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [titleError, setTitleError] = useState<string | null>(null);

  const resetState = () => {
    touchedFieldsRef.current.clear();
    setTitleValue('');
    setStatusValue('todo');
    setPriorityValue('medium');
    setDueDateValue(getDefaultDueDateValue());
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
      if (titleInputRef?.current) {
        titleInputRef.current.focus();
        return;
      }
      if (projectOptions && onSelectedProjectIdChange) {
        projectSelectRef.current?.focus();
        return;
      }
      localTitleInputRef.current?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [onSelectedProjectIdChange, open, projectOptions, titleInputRef]);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (!titleValue.trim()) {
      setParseResult(null);
      setIntentResult(null);
      return;
    }

    const timeout = window.setTimeout(() => {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const intent = classifyIntent(titleValue);
      const parsed = parseTaskInput(titleValue, { timezone });
      setIntentResult(intent);
      setParseResult(parsed);

      if (!touchedFieldsRef.current.has('priority')) {
        setPriorityValue(normalizePriorityValue(parsed.fields.priority) || 'medium');
      }
      if (!touchedFieldsRef.current.has('dueDate')) {
        setDueDateValue(parsed.fields.due_at ? toDateTimeLocal(parsed.fields.due_at) : getDefaultDueDateValue());
      }
      if (!touchedFieldsRef.current.has('assignee')) {
        setAssigneeValue(findSuggestedAssignee(parsed.fields.assignee_hints, projectMembers));
      }
    }, PARSE_DEBOUNCE_MS);

    return () => window.clearTimeout(timeout);
  }, [titleValue, open, projectMembers]);

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

    if (submitInFlightRef.current) return;
    submitInFlightRef.current = true;
    setSubmitting(true);
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const parsedOnSubmit = parseTaskInput(trimmedTitle, { timezone });
      const untouchedFields = touchedFieldsRef.current;
      const parsedDueDateValue = parsedOnSubmit.fields.due_at ? toDateTimeLocal(parsedOnSubmit.fields.due_at) : '';
      const parsedAssigneeValue = findSuggestedAssignee(parsedOnSubmit.fields.assignee_hints, projectMembers);
      const parsedTitleValue = parsedOnSubmit.fields.title.trim();
      const effectiveTitle = parsedTitleValue && parsedTitleValue !== 'Task'
        ? parsedTitleValue
        : trimmedTitle;
      const effectiveProjectId = projectOptions && onSelectedProjectIdChange
        ? (selectedProjectId || projectId)
        : projectId;

      const effectivePriority: PrioritySelectValue = untouchedFields.has('priority')
        ? priorityValue
        : (normalizePriorityValue(parsedOnSubmit.fields.priority) || 'medium');
      const effectiveDueDateValue = untouchedFields.has('dueDate')
        ? dueDateValue
        : (parsedDueDateValue || getDefaultDueDateValue());
      const effectiveAssigneeValue = untouchedFields.has('assignee')
        ? assigneeValue
        : parsedAssigneeValue;

      if (!untouchedFields.has('priority') && effectivePriority !== priorityValue) {
        setPriorityValue(effectivePriority);
      }
      if (!untouchedFields.has('dueDate') && effectiveDueDateValue !== dueDateValue) {
        setDueDateValue(effectiveDueDateValue);
      }
      if (!untouchedFields.has('assignee') && effectiveAssigneeValue !== assigneeValue) {
        setAssigneeValue(effectiveAssigneeValue);
      }

      await createTask(accessToken, {
        project_id: effectiveProjectId,
        parent_record_id: parentRecordId || null,
        title: effectiveTitle,
        status: statusValue,
        priority: effectivePriority === '' ? null : effectivePriority,
        due_at: effectiveDueDateValue ? new Date(effectiveDueDateValue).toISOString() : null,
        category: categoryValue.trim() || null,
        assignee_user_ids: effectiveAssigneeValue ? [effectiveAssigneeValue] : [],
      });
      onCreated();
      handleClose();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to create task.');
    } finally {
      submitInFlightRef.current = false;
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
        {projectOptions && onSelectedProjectIdChange ? (
          <div className="space-y-1">
            <label className="text-xs font-medium uppercase tracking-wide text-muted" htmlFor="task-create-project">
              Project
            </label>
            <select
              id="task-create-project"
              ref={projectSelectRef}
              value={selectedProjectId}
              onChange={(event) => onSelectedProjectIdChange(event.target.value)}
              className="w-full rounded-control border border-border-muted bg-surface px-3 py-2 text-sm text-text"
            >
              {projectOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}

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
              ref={titleInputRef ?? localTitleInputRef}
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
            <div role="status" aria-live="polite" className="text-xs text-muted">
              {intentResult?.ambiguous ? 'Not sure if this is a task — check the fields below.' : null}
              {!intentResult?.ambiguous && intentResult && intentResult.intent !== 'task'
                ? `This looks more like a ${intentResult.intent} than a task. Creating as a task anyway.`
                : null}
              {parseResult && parseResult.meta.confidence.title < 0.6 ? 'Title confidence is low — review before saving.' : null}
            </div>
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
                  setPriorityValue(normalizePriorityValue(event.target.value));
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
