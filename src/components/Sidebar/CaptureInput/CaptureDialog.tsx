import { AnimatePresence, useReducedMotion } from 'framer-motion';
import { startTransition, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { parseTaskInput } from '../../../lib/nlp/task-parser';
import { requestHubHomeRefresh } from '../../../lib/hubHomeRefresh';
import { useCalendarNLDraft } from '../../../hooks/useCalendarNLDraft';
import { buildReminderCreatePayload, mapReminderFailureReasonToMessage, useReminderNLDraft } from '../../../hooks/useReminderNLDraft';
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

interface CaptureDialogProps {
  accessToken: string | null | undefined;
  containerRef: React.RefObject<HTMLDivElement | null>;
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
  const [eventTitle, setEventTitle] = useState('');
  const [eventStartAt, setEventStartAt] = useState('');
  const [eventEndAt, setEventEndAt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const calendar = useCalendarNLDraft({
    initialDraft: draft,
    enabled: open && captureKind === 'event',
  });
  const reminder = useReminderNLDraft({
    initialDraft: draft,
    enabled: open && captureKind === 'reminder',
  });
  const lastAppliedEventDraftRef = useRef('');

  useEffect(() => {
    if (!open) {
      return;
    }
    setDestinationValue('hub');
    setError(null);
    setSubmitting(false);
    if (captureKind === 'event') {
      setEventTitle(draft.trim());
      setEventStartAt('');
      setEventEndAt('');
      calendar.setDraft(draft);
    }
    if (captureKind === 'reminder') {
      reminder.setDraft(draft);
    }
  }, [calendar, captureKind, draft, open, reminder]);

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
    if (!trimmedDraft) {
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
        if (destination.kind === 'pane' && destination.pane) {
          const pane = destination.pane;
          const collectionId = await selectCollectionId(accessToken, pane.project_id, ['task', 'todo']);
          if (!collectionId) {
            throw new Error('No task collection is available for this pane.');
          }
          const taskPreview = parseTaskInput(trimmedDraft, { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
          await createRecord(accessToken, pane.project_id, {
            collection_id: collectionId,
            title: taskPreview.fields.title.trim() || trimmedDraft,
            capability_types: ['task'],
            task_state: {
              status: 'todo',
              priority: taskPreview.fields.priority ?? null,
              due_at: taskPreview.fields.due_at ?? null,
            },
            source_pane_id: pane.pane_id,
          });
          startTransition(() => {
            navigate(buildProjectWorkHref(pane.project_id, pane.pane_id));
          });
        } else {
          if (!personalProject?.id) {
            throw new Error('Personal task capture is unavailable right now.');
          }
          await createPersonalTask(accessToken, {
            project_id: personalProject.id,
            title: parseTaskInput(trimmedDraft, { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }).fields.title.trim() || trimmedDraft,
          });
          requestHubHomeRefresh();
        }
      }

      if (captureKind === 'reminder') {
        const reminderPayload = buildReminderCreatePayload({
          preview: reminder.parseNow(),
          draft: trimmedDraft,
          fallbackTitleFromDraft: true,
        });
        if (!reminderPayload.payload) {
          throw new Error(mapReminderFailureReasonToMessage(reminderPayload.failureReason));
        }
        await createReminder(accessToken, {
          ...reminderPayload.payload,
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

            {captureKind === 'event' ? (
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
                className="interactive interactive-subtle rounded-control border border-border-muted px-3 py-2 text-sm font-medium text-text"
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
                className="interactive rounded-control bg-primary px-3 py-2 text-sm font-semibold text-on-primary disabled:cursor-not-allowed disabled:opacity-60"
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
