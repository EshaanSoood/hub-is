import { AnimatePresence, useReducedMotion } from 'framer-motion';
import { startTransition, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { requestHubHomeRefresh } from '../../../lib/hubHomeRefresh';
import { useCalendarNLDraft } from '../../../hooks/useCalendarNLDraft';
import { useReminderNLDraft } from '../../../hooks/useReminderNLDraft';
import { useTaskNLDraft } from '../../../hooks/useTaskNLDraft';
import { createEventFromNlp, createPersonalTask, createRecord } from '../../../services/hub/records';
import { createReminder } from '../../../services/hub/reminders';
import type { ProjectRecord } from '../../../types/domain';
import { buildProjectWorkHref } from '../../../lib/hubRoutes';
import { AnimatedSurface } from '../../motion/AnimatedSurface';
import { Select } from '../../primitives';
import { sidebarMotionLayoutIds } from '../motion/sidebarMotion';
import type { CaptureDestination, CaptureKind, DestinationKind } from './shared';
import {
  createQuickThoughtEntry,
  labelForCaptureKind,
  readQuickThoughtStorageKey,
  selectCollectionId,
} from './shared';

type TaskPriorityValue = '' | 'low' | 'medium' | 'high';

interface CaptureDialogProps {
  accessToken: string | null | undefined;
  containerRef: React.RefObject<HTMLDivElement | null>;
  defaultDestinationValue: DestinationKind;
  destinations: CaptureDestination[];
  draft: string;
  captureKind: CaptureKind;
  open: boolean;
  personalProject: ProjectRecord | null;
  setDraft: (nextDraft: string) => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onSaved: () => void;
}

export const CaptureDialog = ({
  accessToken,
  containerRef,
  defaultDestinationValue,
  destinations,
  draft,
  captureKind,
  open,
  personalProject,
  setDraft,
  triggerRef,
  onClose,
  onSaved,
}: CaptureDialogProps) => {
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion() ?? false;
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [destinationValue, setDestinationValue] = useState<DestinationKind>('hub');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDueAt, setTaskDueAt] = useState('');
  const [taskPriority, setTaskPriority] = useState<TaskPriorityValue>('');
  const [reminderTitle, setReminderTitle] = useState('');
  const [reminderAt, setReminderAt] = useState('');
  const [eventTitle, setEventTitle] = useState('');
  const [eventStartAt, setEventStartAt] = useState('');
  const [eventEndAt, setEventEndAt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const task = useTaskNLDraft({
    initialDraft: draft,
    enabled: open && captureKind === 'task',
  });
  const calendar = useCalendarNLDraft({
    initialDraft: draft,
    enabled: open && captureKind === 'event',
  });
  const reminder = useReminderNLDraft({
    initialDraft: draft,
    enabled: open && captureKind === 'reminder',
  });
  const lastAppliedTaskDraftRef = useRef('');
  const taskTouchedFieldsRef = useRef<Set<'title' | 'dueAt' | 'priority'>>(new Set());
  const lastAppliedReminderDraftRef = useRef('');
  const reminderTouchedFieldsRef = useRef<Set<'title' | 'remindAt'>>(new Set());
  const lastAppliedEventDraftRef = useRef('');
  const initializedOpenRef = useRef(false);
  const setTaskDraft = task.setDraft;
  const setCalendarDraft = calendar.setDraft;
  const setReminderDraft = reminder.setDraft;

  useEffect(() => {
    if (!open) {
      initializedOpenRef.current = false;
      lastAppliedTaskDraftRef.current = '';
      lastAppliedReminderDraftRef.current = '';
      lastAppliedEventDraftRef.current = '';
      taskTouchedFieldsRef.current.clear();
      reminderTouchedFieldsRef.current.clear();
      return;
    }
    if (initializedOpenRef.current) {
      return;
    }
    initializedOpenRef.current = true;
    setDestinationValue(defaultDestinationValue);
    setError(null);
    setSubmitting(false);
    if (captureKind === 'task') {
      taskTouchedFieldsRef.current.clear();
      setTaskTitle(draft.trim());
      setTaskDueAt('');
      setTaskPriority('');
      setTaskDraft(draft);
    }
    if (captureKind === 'event') {
      setEventTitle(draft.trim());
      setEventStartAt('');
      setEventEndAt('');
      setCalendarDraft(draft);
    }
    if (captureKind === 'reminder') {
      reminderTouchedFieldsRef.current.clear();
      setReminderTitle(draft.trim());
      setReminderAt('');
      setReminderDraft(draft);
    }
  }, [captureKind, defaultDestinationValue, draft, open, setCalendarDraft, setReminderDraft, setTaskDraft]);

  useEffect(() => {
    if (!open || captureKind !== 'task') {
      lastAppliedTaskDraftRef.current = '';
      return;
    }
    const parsedDraft = task.lastParsedDraft.trim();
    if (!parsedDraft || lastAppliedTaskDraftRef.current === task.lastParsedDraft) {
      return;
    }
    if (!taskTouchedFieldsRef.current.has('title') && task.formPreview.title !== null) {
      setTaskTitle(task.formPreview.title);
    }
    if (!taskTouchedFieldsRef.current.has('dueAt') && task.formPreview.dueAt !== null) {
      setTaskDueAt(task.formPreview.dueAt);
    }
    if (!taskTouchedFieldsRef.current.has('priority')) {
      setTaskPriority(task.formPreview.priority || '');
    }
    lastAppliedTaskDraftRef.current = task.lastParsedDraft;
  }, [captureKind, open, task.formPreview.dueAt, task.formPreview.priority, task.formPreview.title, task.lastParsedDraft]);

  useEffect(() => {
    if (!open || captureKind !== 'event') {
      lastAppliedEventDraftRef.current = '';
      return;
    }
    const parsedDraft = calendar.lastParsedDraft.trim();
    if (!parsedDraft || lastAppliedEventDraftRef.current === calendar.lastParsedDraft) {
      return;
    }
    if (calendar.formPreview.title !== null) {
      setEventTitle(calendar.formPreview.title);
    }
    if (calendar.formPreview.startAt !== null) {
      setEventStartAt(calendar.formPreview.startAt);
    }
    if (calendar.formPreview.endAt !== null) {
      setEventEndAt(calendar.formPreview.endAt);
    }
    lastAppliedEventDraftRef.current = calendar.lastParsedDraft;
  }, [calendar.formPreview.endAt, calendar.formPreview.startAt, calendar.formPreview.title, calendar.lastParsedDraft, captureKind, open]);

  useEffect(() => {
    if (!open || captureKind !== 'reminder') {
      lastAppliedReminderDraftRef.current = '';
      return;
    }
    const parsedDraft = reminder.lastParsedDraft.trim();
    if (!parsedDraft || lastAppliedReminderDraftRef.current === reminder.lastParsedDraft) {
      return;
    }
    if (!reminderTouchedFieldsRef.current.has('title') && reminder.formPreview.title !== null) {
      setReminderTitle(reminder.formPreview.title);
    }
    if (!reminderTouchedFieldsRef.current.has('remindAt') && reminder.formPreview.remindAt !== null) {
      setReminderAt(reminder.formPreview.remindAt);
    }
    lastAppliedReminderDraftRef.current = reminder.lastParsedDraft;
  }, [captureKind, open, reminder.formPreview.remindAt, reminder.formPreview.title, reminder.lastParsedDraft]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const restoreTriggerFocus = () => {
      requestAnimationFrame(() => {
        const activeElement = document.activeElement;
        if (!(activeElement instanceof HTMLElement) || activeElement === document.body) {
          triggerRef.current?.focus();
        }
      });
    };

    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || containerRef.current?.contains(target)) {
        return;
      }
      onClose();
      restoreTriggerFocus();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        restoreTriggerFocus();
      }
    };

    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [containerRef, onClose, open, triggerRef]);

  const submitCapture = async () => {
    const trimmedDraft = draft.trim();
    if (captureKind === 'thought' && !trimmedDraft) {
      setError('Capture text is required.');
      return;
    }
    if (!accessToken) {
      setError('An authenticated session is required.');
      return;
    }

    const destination = destinations.find((entry) => entry.kind === destinationValue) || destinations[0];
    if (!destination) {
      setError('Select a destination.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      if (captureKind === 'thought') {
        if (destination.kind === 'pane' && destination.pane) {
          const pane = destination.pane;
          const storageKey = readQuickThoughtStorageKey(pane);
          if (!storageKey) {
            throw new Error('Quick Thoughts is unavailable for this pane.');
          }
          createQuickThoughtEntry(storageKey, trimmedDraft);
          startTransition(() => {
            navigate(buildProjectWorkHref(pane.project_id, pane.pane_id));
          });
        } else {
          if (!personalProject?.id) {
            throw new Error('Personal capture is unavailable right now.');
          }
          const collectionId = await selectCollectionId(accessToken, personalProject.id, ['inbox', 'capture', 'note', 'journal']);
          if (!collectionId) {
            throw new Error('No capture collection is available in myHub.');
          }
          await createRecord(accessToken, personalProject.id, {
            collection_id: collectionId,
            title: trimmedDraft,
          });
          requestHubHomeRefresh();
        }
      }

      if (captureKind === 'task') {
        const normalizedTaskTitle = taskTitle.trim();
        const dueAtDate = taskDueAt ? new Date(taskDueAt) : null;
        if (!normalizedTaskTitle) {
          throw new Error('Task title is required.');
        }
        if (dueAtDate && Number.isNaN(dueAtDate.getTime())) {
          throw new Error('Task due date is invalid.');
        }

        if (destination.kind === 'pane' && destination.pane) {
          const pane = destination.pane;
          const collectionId = await selectCollectionId(accessToken, pane.project_id, ['task', 'todo']);
          if (!collectionId) {
            throw new Error('No task collection is available for this pane.');
          }
          await createRecord(accessToken, pane.project_id, {
            collection_id: collectionId,
            title: normalizedTaskTitle,
            capability_types: ['task'],
            task_state: {
              status: 'todo',
              priority: taskPriority || null,
              due_at: dueAtDate ? dueAtDate.toISOString() : null,
            },
            source_pane_id: pane.pane_id,
          });
          requestHubHomeRefresh();
          startTransition(() => {
            navigate(buildProjectWorkHref(pane.project_id, pane.pane_id));
          });
        } else {
          if (!personalProject?.id) {
            throw new Error('Personal task capture is unavailable right now.');
          }
          await createPersonalTask(accessToken, {
            project_id: personalProject.id,
            title: normalizedTaskTitle,
            priority: taskPriority || null,
            due_at: dueAtDate ? dueAtDate.toISOString() : null,
          });
          requestHubHomeRefresh();
        }
      }

      if (captureKind === 'reminder') {
        const parsedReminder = reminder.parseNow();
        const normalizedReminderTitle = reminderTitle.trim();
        const remindAtDate = reminderAt ? new Date(reminderAt) : null;
        if (!normalizedReminderTitle || !reminderAt) {
          throw new Error('Add a title and time to create a reminder.');
        }
        if (!remindAtDate || Number.isNaN(remindAtDate.getTime())) {
          throw new Error('Reminder time is invalid.');
        }
        await createReminder(accessToken, {
          title: normalizedReminderTitle,
          remind_at: remindAtDate.toISOString(),
          recurrence_json: parsedReminder.fields.recurrence ? { ...parsedReminder.fields.recurrence } : null,
          ...(destination.kind === 'pane' && destination.pane
            ? {
                scope: 'project',
                project_id: destination.pane.project_id,
                pane_id: destination.pane.pane_id,
              }
            : {
                scope: 'personal',
              }),
        });
        requestHubHomeRefresh();
      }

      if (captureKind === 'event') {
        const startDate = new Date(eventStartAt);
        const endDate = new Date(eventEndAt);
        if (!eventTitle.trim()) {
          throw new Error('Event title is required.');
        }
        if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate.getTime() <= startDate.getTime()) {
          throw new Error('End time must be after start time.');
        }

        const projectId = destination.kind === 'pane' && destination.pane
          ? destination.pane.project_id
          : personalProject?.id;
        if (!projectId) {
          throw new Error('Select a destination project.');
        }
        await createEventFromNlp(accessToken, projectId, {
          title: eventTitle.trim(),
          start_dt: startDate.toISOString(),
          end_dt: endDate.toISOString(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          ...(destination.kind === 'pane' && destination.pane
            ? {
                pane_id: destination.pane.pane_id,
                source_pane_id: destination.pane.pane_id,
              }
            : {}),
        });
        requestHubHomeRefresh();
      }

      onSaved();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Failed to capture item.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence initial={false}>
      {open ? (
        <AnimatedSurface
          ref={panelRef}
          layoutId={prefersReducedMotion ? undefined : sidebarMotionLayoutIds.captureSurface}
          variant="dialog"
          role="dialog"
          ariaLabel={`Confirm ${labelForCaptureKind[captureKind]}`}
          className="sidebar-flyout-offset absolute left-0 right-0 z-[130] rounded-panel border border-border-muted bg-surface-elevated p-4 shadow-soft"
        >
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Type</p>
              <p className="text-sm font-semibold text-text">{labelForCaptureKind[captureKind]}</p>
            </div>

            <div className="flex flex-col gap-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Add to</p>
              <Select
                value={destinationValue}
                onValueChange={(value) => setDestinationValue(value as DestinationKind)}
                ariaLabel="Capture destination"
                options={destinations.map((destination) => ({
                  value: destination.kind,
                  label: destination.label,
                }))}
                triggerClassName="w-full"
              />
            </div>

            {captureKind === 'task' ? (
              <>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted">Describe task</span>
                  <input
                    type="text"
                    value={task.draft}
                    onChange={(event) => {
                      setTaskDraft(event.target.value);
                    }}
                    className="rounded-control border border-border-muted bg-surface px-3 py-2 text-sm text-text"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted">Task title</span>
                  <input
                    type="text"
                    value={taskTitle}
                    onChange={(event) => {
                      taskTouchedFieldsRef.current.add('title');
                      setTaskTitle(event.target.value);
                    }}
                    className="rounded-control border border-border-muted bg-surface px-3 py-2 text-sm text-text"
                  />
                </label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted">Due</span>
                    <input
                      type="datetime-local"
                      value={taskDueAt}
                      onChange={(event) => {
                        taskTouchedFieldsRef.current.add('dueAt');
                        setTaskDueAt(event.target.value);
                      }}
                      className="rounded-control border border-border-muted bg-surface px-3 py-2 text-sm text-text"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted">Priority</span>
                    <select
                      value={taskPriority}
                      onChange={(event) => {
                        taskTouchedFieldsRef.current.add('priority');
                        setTaskPriority(event.target.value as TaskPriorityValue);
                      }}
                      className="rounded-control border border-border-muted bg-surface px-3 py-2 text-sm text-text"
                    >
                      <option value="">None</option>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </label>
                </div>
              </>
            ) : captureKind === 'event' ? (
              <>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted">Describe event</span>
                  <input
                    type="text"
                    value={calendar.draft}
                    onChange={(event) => {
                      calendar.setDraft(event.target.value);
                      setDraft(event.target.value);
                    }}
                    className="rounded-control border border-border-muted bg-surface px-3 py-2 text-sm text-text"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted">Event title</span>
                  <input
                    type="text"
                    value={eventTitle}
                    onChange={(event) => setEventTitle(event.target.value)}
                    className="rounded-control border border-border-muted bg-surface px-3 py-2 text-sm text-text"
                  />
                </label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted">Start</span>
                    <input
                      type="datetime-local"
                      value={eventStartAt}
                      onChange={(event) => setEventStartAt(event.target.value)}
                      className="rounded-control border border-border-muted bg-surface px-3 py-2 text-sm text-text"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted">End</span>
                    <input
                      type="datetime-local"
                      value={eventEndAt}
                      onChange={(event) => setEventEndAt(event.target.value)}
                      className="rounded-control border border-border-muted bg-surface px-3 py-2 text-sm text-text"
                    />
                  </label>
                </div>
              </>
            ) : captureKind === 'reminder' ? (
              <>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted">Describe reminder</span>
                  <input
                    type="text"
                    value={reminder.draft}
                    onChange={(event) => {
                      setReminderDraft(event.target.value);
                    }}
                    className="rounded-control border border-border-muted bg-surface px-3 py-2 text-sm text-text"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted">Reminder title</span>
                  <input
                    type="text"
                    value={reminderTitle}
                    onChange={(event) => {
                      reminderTouchedFieldsRef.current.add('title');
                      setReminderTitle(event.target.value);
                    }}
                    className="rounded-control border border-border-muted bg-surface px-3 py-2 text-sm text-text"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted">Remind at</span>
                  <input
                    type="datetime-local"
                    value={reminderAt}
                    onChange={(event) => {
                      reminderTouchedFieldsRef.current.add('remindAt');
                      setReminderAt(event.target.value);
                    }}
                    className="rounded-control border border-border-muted bg-surface px-3 py-2 text-sm text-text"
                  />
                </label>
                {reminder.preview.fields.recurrence ? (
                  <p className="rounded-control border border-border-muted bg-surface px-3 py-2 text-xs text-text-secondary">
                    Recurs: {reminder.preview.fields.recurrence.frequency}
                  </p>
                ) : null}
              </>
            ) : (
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium uppercase tracking-wide text-muted">
                  {captureKind === 'thought' ? 'Thought' : labelForCaptureKind[captureKind]}
                </span>
                <input
                  type="text"
                  value={draft}
                  onChange={(event) => {
                    setDraft(event.target.value);
                    setTaskDraft(event.target.value);
                    reminder.setDraft(event.target.value);
                    calendar.setDraft(event.target.value);
                  }}
                  className="rounded-control border border-border-muted bg-surface px-3 py-2 text-sm text-text"
                />
              </label>
            )}

            {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="interactive interactive-subtle rounded-control border border-secondary/30 px-3 py-2 text-sm font-medium text-secondary hover:border-secondary/45 hover:bg-secondary/10 hover:text-secondary-strong"
                onClick={() => {
                  onClose();
                  triggerRef.current?.focus();
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                className="interactive interactive-fold rounded-control bg-primary px-3 py-2 text-sm font-semibold text-on-primary disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => {
                  void submitCapture();
                }}
              >
                {submitting ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </AnimatedSurface>
      ) : null}
    </AnimatePresence>
  );
};
