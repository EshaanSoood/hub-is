import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useInlineExpansionFocus } from '../../hooks/accessibility/useInlineExpansionFocus';
import { useLongPress } from '../../hooks/useLongPress';
import { mapReminderFailureReasonToMessage, useReminderNLDraft } from '../../hooks/useReminderNLDraft';
import { useWidgetInsertState, type WidgetInsertState } from './hooks/useWidgetInsertState';
import { ReminderRecordSummary, formatReminderRecurrenceLabel } from './record-primitives/ReminderRecordSummary';
import { Icon } from '../primitives';
import type { ReminderParseResult } from '../../lib/nlp/reminder-parser/types';
import type { CreateReminderPayload, HubReminderSummary } from '../../services/hub/reminders';
import { WidgetEmptyState } from './WidgetFeedback';

export type RemindersSizeTier = 'S' | 'M' | 'L';

export interface RemindersWidgetSkinProps {
  reminders: HubReminderSummary[];
  loading: boolean;
  error?: string | null;
  onDismiss: (reminderId: string) => Promise<void>;
  onSnooze?: (reminderId: string) => Promise<void>;
  onCreate: (payload: CreateReminderPayload) => Promise<void>;
  onInsertToEditor?: (item: { id: string; type: string; title: string }) => void;
  sizeTier: RemindersSizeTier;
  readOnly?: boolean;
  previewMode?: boolean;
}

interface SparkleParticle {
  id: string;
  size: number;
  color: string;
  x: number;
  y: number;
  duration: number;
  delay: number;
}

interface ReminderAnimationState {
  reminder: HubReminderSummary;
  phase: 'pull' | 'celebrate';
  phrase: string;
  particles: SparkleParticle[];
}

const STYLE_ELEMENT_ID = 'reminders-widget-animations';
const REMINDER_PHRASES = [
  'Lets Go!',
  "Show 'em How It's Done!",
  'Done and Done',
  'Procrastinator? More Like Pro Task Terminator.',
] as const;
const MAX_VISIBLE_BY_SIZE: Record<RemindersSizeTier, number> = {
  S: 3,
  M: 6,
  L: Number.POSITIVE_INFINITY,
};
const REMINDER_ANIMATIONS_CSS = `
@keyframes ribbonPull {
  0% { opacity: 1; transform: scaleX(1) translateX(0); }
  35% { transform: scaleX(1.08) translateX(4px); }
  70% { opacity: 1; transform: scaleX(1.18) translateX(12px); }
  100% { opacity: 0; transform: scaleX(0.92) translateX(22px); }
}

@keyframes sparkle {
  0% { opacity: 0; transform: translate(0, 0) scale(0.6); }
  18% { opacity: 1; }
  100% { opacity: 0; transform: translate(var(--sparkle-x), var(--sparkle-y)) scale(1.15); }
}

@keyframes phraseFade {
  0% { opacity: 0; transform: translateY(6px); }
  14% { opacity: 1; transform: translateY(0); }
  80% { opacity: 1; transform: translateY(0); }
  100% { opacity: 0; transform: translateY(-8px); }
}

.reminders-ribbon--pull {
  transform-origin: left center;
  animation: ribbonPull 600ms ease forwards;
}

.reminders-sparkle {
  animation: sparkle var(--sparkle-duration, 900ms) ease-out forwards;
  animation-delay: var(--sparkle-delay, 0ms);
}

.reminders-phrase {
  animation: phraseFade 2000ms ease forwards;
}
`;

const installReminderAnimations = () => {
  if (typeof document === 'undefined') {
    return;
  }
  if (document.getElementById(STYLE_ELEMENT_ID)) {
    return;
  }
  const style = document.createElement('style');
  style.id = STYLE_ELEMENT_ID;
  style.textContent = REMINDER_ANIMATIONS_CSS;
  document.head.appendChild(style);
};

const formatPreviewDateTime = (value: string | null): string | null => {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return value;
  }
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const recurrenceLabel = (preview: ReminderParseResult): string | null =>
  formatReminderRecurrenceLabel(preview.fields.recurrence);

const previewFallbackLabel = (value: string | null, fallback: string): string => value?.trim() || fallback;

const createSparkles = (): SparkleParticle[] =>
  Array.from({ length: 10 }, (_, index) => ({
    id: `sparkle-${index}-${Math.random().toString(36).slice(2, 8)}`,
    size: 4 + Math.floor(Math.random() * 5),
    color: Math.random() > 0.5 ? 'var(--color-primary)' : 'var(--color-capture-rail)',
    x: Math.round((Math.random() - 0.5) * 110),
    y: Math.round((Math.random() - 0.5) * 80),
    duration: 700 + Math.round(Math.random() * 350),
    delay: Math.round(Math.random() * 140),
  }));

const ReminderRibbonRow = ({
  reminder,
  animationPhase,
  isOverdue,
  readOnly,
  previewMode,
  onSnooze,
  onDismiss,
  activeItemId,
  activeItemType,
  setActiveItem,
  clearActiveItem,
  onInsertToEditor,
}: {
  reminder: HubReminderSummary;
  animationPhase: ReminderAnimationState['phase'] | null;
  isOverdue: boolean;
  readOnly: boolean;
  previewMode: boolean;
  onSnooze?: (reminder: HubReminderSummary) => void;
  onDismiss: (reminder: HubReminderSummary) => void;
  activeItemId: WidgetInsertState['activeItemId'];
  activeItemType: WidgetInsertState['activeItemType'];
  setActiveItem: WidgetInsertState['setActiveItem'];
  clearActiveItem: WidgetInsertState['clearActiveItem'];
  onInsertToEditor?: WidgetInsertState['onInsertToEditor'];
}) => {
  const longPressHandlers = useLongPress(() => {
    if (!previewMode) {
      setActiveItem(reminder.reminder_id, 'reminder', reminder.record_title || 'Untitled reminder');
    }
  });
  const showInsertAction = activeItemId === reminder.reminder_id && activeItemType === 'reminder';

  return (
    <div
      className={`relative flex min-h-16 items-stretch overflow-hidden border-l-2 ${
        animationPhase === 'pull' ? 'reminders-ribbon--pull' : ''
      } ${isOverdue ? 'bg-danger-subtle border-danger' : 'bg-surface-elevated border-border-muted'}`}
      style={{
        clipPath: 'polygon(0 0, calc(100% - 16px) 0, 100% 50%, calc(100% - 16px) 100%, 0 100%)',
        borderLeftColor: isOverdue ? 'var(--color-danger)' : 'var(--color-capture-rail)',
      }}
      {...(!previewMode ? longPressHandlers : {})}
    >
      <div className="flex min-w-0 flex-1 items-center justify-between gap-3 px-3 py-3 pr-8">
        {previewMode ? (
          <div className="min-w-0">
            <ReminderRecordSummary
              title={reminder.record_title || 'Untitled reminder'}
              remindAt={reminder.remind_at}
              overdue={isOverdue}
              recurrenceLabel={formatReminderRecurrenceLabel(reminder.recurrence_json)}
            />
          </div>
        ) : (
          <button
            type="button"
            className="min-w-0 rounded-control text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            aria-label={`Insert reminder ${reminder.record_title || 'Untitled reminder'}`}
            onClick={() => {
              setActiveItem(reminder.reminder_id, 'reminder', reminder.record_title || 'Untitled reminder');
            }}
            onFocus={() => {
              setActiveItem(reminder.reminder_id, 'reminder', reminder.record_title || 'Untitled reminder');
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                clearActiveItem();
              }
            }}
          >
          <ReminderRecordSummary
            title={reminder.record_title || 'Untitled reminder'}
            remindAt={reminder.remind_at}
            overdue={isOverdue}
            recurrenceLabel={formatReminderRecurrenceLabel(reminder.recurrence_json)}
          />
          </button>
        )}
        {onSnooze && !previewMode ? (
          <button
            type="button"
            aria-label={`Snooze reminder ${reminder.record_title || 'Untitled reminder'} to tomorrow at 9 AM`}
            disabled={readOnly}
            onClick={() => onSnooze(reminder)}
            className="rounded-control border border-border-muted px-2 py-1 text-xs font-medium text-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            Later
          </button>
        ) : null}
        {!showInsertAction && !previewMode ? (
          <button
            type="button"
            aria-label="Mark complete"
            disabled={readOnly}
            onClick={() => onDismiss(reminder)}
            className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full p-1 text-primary outline-none transition hover:scale-105 focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon name="checkmark" className="text-[14px]" />
          </button>
        ) : null}
        {showInsertAction && !previewMode ? (
          <button
            type="button"
            data-widget-insert-ignore="true"
            onClick={() => {
              onInsertToEditor?.({
                id: reminder.reminder_id,
                type: 'reminder',
                title: reminder.record_title || 'Untitled reminder',
              });
              clearActiveItem();
            }}
            className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-control bg-primary px-2 py-1 text-xs font-semibold text-on-primary shadow-soft"
          >
            Insert
          </button>
        ) : null}
      </div>
    </div>
  );
};

export const RemindersWidgetSkin = ({
  reminders,
  loading,
  error = null,
  onDismiss,
  onSnooze,
  onCreate,
  onInsertToEditor,
  sizeTier,
  readOnly = false,
  previewMode = false,
}: RemindersWidgetSkinProps) => {
  const {
    activeItemId,
    activeItemType,
    setActiveItem,
    clearActiveItem,
  } = useWidgetInsertState({ onInsertToEditor: previewMode ? undefined : onInsertToEditor });
  const {
    draft,
    setDraft,
    preview,
    clear: clearDraft,
    createPayload,
  } = useReminderNLDraft({ parseDelayMs: 150 });
  const [submitting, setSubmitting] = useState(false);
  const [inputError, setInputError] = useState<string | null>(null);
  const [animations, setAnimations] = useState<Record<string, ReminderAnimationState>>({});
  const phraseIndexRef = useRef(0);
  const reminderInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    installReminderAnimations();
  }, []);

  const maxVisible = MAX_VISIBLE_BY_SIZE[sizeTier];
  const visibleReminders = useMemo(
    () => reminders.slice(0, Number.isFinite(maxVisible) ? maxVisible : reminders.length),
    [maxVisible, reminders],
  );

  const renderedReminders = useMemo(() => {
    const reminderMap = new Map<string, HubReminderSummary>();
    for (const reminder of visibleReminders) {
      reminderMap.set(reminder.reminder_id, reminder);
    }
    for (const [reminderId, animation] of Object.entries(animations)) {
      if (!reminderMap.has(reminderId)) {
        reminderMap.set(reminderId, animation.reminder);
      }
    }
    return Array.from(reminderMap.values()).sort((left, right) => {
      if (left.remind_at !== right.remind_at) {
        return String(left.remind_at).localeCompare(String(right.remind_at));
      }
      return String(left.reminder_id).localeCompare(String(right.reminder_id));
    });
  }, [animations, visibleReminders]);

  const hiddenCount = Math.max(0, reminders.length - visibleReminders.length);
  const showPreview = draft.trim().length > 0;
  useInlineExpansionFocus({
    anchorRef: reminderInputRef,
    active: showPreview,
    expansionKey: draft,
    enabled: !readOnly && !submitting,
  });
  const previewRows = [
    {
      label: 'Title',
      value: preview.fields.title.trim() || null,
      fallback: 'Listening for the reminder title…',
    },
    {
      label: 'When',
      value: preview.fields.context_hint || formatPreviewDateTime(preview.fields.remind_at),
      fallback: 'Add a date or time like “tomorrow at 3pm”.',
    },
    {
      label: 'Repeats',
      value: recurrenceLabel(preview),
      fallback: 'One-time reminder',
    },
  ];

  const submitReminder = async () => {
    if (readOnly || submitting) {
      return;
    }
    const payloadResult = createPayload({
      fallbackTitleFromDraft: true,
      forceReparse: true,
    });
    if (!payloadResult.payload) {
      setInputError(mapReminderFailureReasonToMessage(payloadResult.failureReason));
      return;
    }

    setSubmitting(true);
    setInputError(null);
    try {
      await onCreate(payloadResult.payload);
      clearDraft();
    } catch (error) {
      setInputError(error instanceof Error ? error.message : 'Failed to create reminder.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDismiss = async (reminder: HubReminderSummary) => {
    if (readOnly || animations[reminder.reminder_id]) {
      return;
    }

    const phrase = REMINDER_PHRASES[phraseIndexRef.current % REMINDER_PHRASES.length];
    phraseIndexRef.current += 1;
    setAnimations((current) => ({
      ...current,
      [reminder.reminder_id]: {
        reminder,
        phase: 'pull',
        phrase,
        particles: createSparkles(),
      },
    }));

    window.setTimeout(() => {
      setAnimations((current) => {
        const existing = current[reminder.reminder_id];
        if (!existing) {
          return current;
        }
        return {
          ...current,
          [reminder.reminder_id]: {
            ...existing,
            phase: 'celebrate',
          },
        };
      });
    }, 600);

    window.setTimeout(() => {
      setAnimations((current) => {
        const next = { ...current };
        delete next[reminder.reminder_id];
        return next;
      });
    }, 2600);

    try {
      await onDismiss(reminder.reminder_id);
    } catch (error) {
      console.error('Failed to dismiss reminder ribbon:', error);
    }
  };

  const handleSnooze = async (reminder: HubReminderSummary) => {
    if (!onSnooze || readOnly || animations[reminder.reminder_id]) {
      return;
    }
    setInputError(null);
    try {
      await onSnooze(reminder.reminder_id);
    } catch (error) {
      setInputError(error instanceof Error ? error.message : 'Failed to snooze reminder.');
      console.error('Failed to snooze reminder ribbon:', error);
    }
  };

  return (
    <section className="flex h-full min-h-0 flex-col gap-3" aria-label="Reminders widget">
      {!previewMode ? <form
        className="shrink-0 space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          void submitReminder();
        }}
      >
        <div className="flex items-start gap-2">
          <input
            ref={reminderInputRef}
            type="text"
            value={draft}
            disabled={readOnly || submitting}
            onChange={(event) => {
              setDraft(event.target.value);
              if (inputError) {
                setInputError(null);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void submitReminder();
              }
            }}
            placeholder="Write A Reminder in Natural Language"
            aria-label="Write a reminder in natural language"
            className="ghost-button min-h-11 flex-1 bg-surface px-3 py-2 text-sm text-text outline-none placeholder:text-text-secondary focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={readOnly || submitting}
            className="cta-primary inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Icon name="plus" className="text-[14px]" />
            Add
          </button>
        </div>

        {showPreview ? (
          <div className="widget-toolbar px-3 py-2 text-xs text-text-secondary">
            <div className="space-y-1">
              {previewRows.map((row) => {
                const resolvedValue = previewFallbackLabel(row.value, row.fallback);
                const isParsed = Boolean(row.value?.trim());
                return (
                  <p key={row.label}>
                    <span className="font-semibold text-text">{row.label}:</span>{' '}
                    <span className={isParsed ? 'text-text' : 'text-text-secondary'}>
                      {resolvedValue}
                    </span>
                  </p>
                );
              })}
            </div>
          </div>
        ) : null}

        {inputError ? <p role="alert" aria-live="assertive" className="text-xs text-danger">{inputError}</p> : null}
      </form> : null}

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
        {error ? (
          <p role="alert" aria-live="assertive" className="rounded-panel border border-danger bg-danger-subtle px-3 py-4 text-sm text-danger">
            {error}
          </p>
        ) : null}

        {loading && reminders.length === 0 ? (
          <p className="widget-sheet-raised px-3 py-4 text-sm text-text-secondary">
            Loading reminders…
          </p>
        ) : null}

        {!error && !loading && renderedReminders.length === 0 ? (
          <WidgetEmptyState
            title="No reminders yet."
            iconName="reminders"
            sizeTier={sizeTier}
          />
        ) : null}

        {renderedReminders.map((reminder) => {
          const animation = animations[reminder.reminder_id];
          const isOverdue = reminder.overdue;

          if (animation?.phase === 'celebrate') {
            return (
              <div
                key={reminder.reminder_id}
                className="relative min-h-16 overflow-hidden rounded-panel border border-dashed border-border-muted bg-surface px-3 py-4"
              >
                <div className="pointer-events-none absolute inset-0">
                  {animation.particles.map((particle) => (
                    <span
                      key={particle.id}
                      className="reminders-sparkle absolute left-1/2 top-1/2 rounded-full"
                      style={{
                        width: `${particle.size}px`,
                        height: `${particle.size}px`,
                        backgroundColor: particle.color,
                        '--sparkle-x': `${particle.x}px`,
                        '--sparkle-y': `${particle.y}px`,
                        '--sparkle-duration': `${particle.duration}ms`,
                        '--sparkle-delay': `${particle.delay}ms`,
                      } as CSSProperties}
                    />
                  ))}
                </div>
                <div className="reminders-phrase relative flex min-h-8 items-center justify-center text-center text-sm font-semibold text-primary">
                  {animation.phrase}
                </div>
              </div>
            );
          }

          return (
            <ReminderRibbonRow
              key={reminder.reminder_id}
              reminder={reminder}
              animationPhase={animation?.phase ?? null}
              isOverdue={isOverdue}
              readOnly={readOnly}
              previewMode={previewMode}
              onSnooze={onSnooze ? (nextReminder) => void handleSnooze(nextReminder) : undefined}
              onDismiss={(nextReminder) => {
                void handleDismiss(nextReminder);
              }}
              activeItemId={activeItemId}
              activeItemType={activeItemType}
              setActiveItem={setActiveItem}
              clearActiveItem={clearActiveItem}
              onInsertToEditor={onInsertToEditor}
            />
          );
        })}
      </div>

      {hiddenCount > 0 ? <p className="shrink-0 text-xs text-text-secondary">+{hiddenCount} more</p> : null}
    </section>
  );
};
