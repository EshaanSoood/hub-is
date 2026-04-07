import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useModuleInsertContext } from '../../context/ModuleInsertContext';
import { useLongPress } from '../../hooks/useLongPress';
import { useReminderNLDraft } from '../../hooks/useReminderNLDraft';
import { Icon } from '../primitives';
import { ReminderCard } from '../cards/ReminderCard';
import type { ReminderParseResult } from '../../lib/nlp/reminder-parser/types';
import type { CreateReminderPayload, HubReminderSummary } from '../../services/hub/reminders';
import { ModuleEmptyState } from './ModuleFeedback';

export type RemindersSizeTier = 'S' | 'M' | 'L';

export interface RemindersModuleSkinProps {
  reminders: HubReminderSummary[];
  loading: boolean;
  error?: string | null;
  onDismiss: (reminderId: string) => Promise<void>;
  onSnooze?: (reminderId: string) => Promise<void>;
  onCreate: (payload: CreateReminderPayload) => Promise<void>;
  sizeTier: RemindersSizeTier;
  readOnly?: boolean;
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

const STYLE_ELEMENT_ID = 'reminders-module-animations';
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

const formatReminderChip = (value: string): string => {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return value;
  }

  const now = new Date();
  const sameDay = date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();

  return sameDay
    ? date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
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

const recurrenceLabel = (preview: ReminderParseResult): string | null => {
  if (!preview.fields.recurrence) {
    return null;
  }
  const unit =
    preview.fields.recurrence.frequency === 'daily'
      ? 'day'
      : preview.fields.recurrence.frequency === 'weekly'
        ? 'week'
        : preview.fields.recurrence.frequency === 'monthly'
          ? 'month'
          : 'year';
  const interval = preview.fields.recurrence.interval && preview.fields.recurrence.interval > 0
    ? preview.fields.recurrence.interval
    : 1;
  return interval > 1 ? `Every ${interval} ${unit}s` : `Every ${unit}`;
};

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
  onSnooze,
  onDismiss,
}: {
  reminder: HubReminderSummary;
  animationPhase: ReminderAnimationState['phase'] | null;
  isOverdue: boolean;
  readOnly: boolean;
  onSnooze?: (reminder: HubReminderSummary) => void;
  onDismiss: (reminder: HubReminderSummary) => void;
}) => {
  const { activeItemId, activeItemType, clearActiveItem, onInsertToEditor, setActiveItem } = useModuleInsertContext();
  const longPressHandlers = useLongPress(() => {
    setActiveItem(reminder.reminder_id, 'reminder', reminder.record_title || 'Untitled reminder');
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
      {...longPressHandlers}
    >
      <div className="flex min-w-0 flex-1 items-center justify-between gap-3 px-3 py-3 pr-8">
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
          <ReminderCard
            title={reminder.record_title || 'Untitled reminder'}
            whenLabel={formatReminderChip(reminder.remind_at)}
            overdue={isOverdue}
          />
        </button>
        {onSnooze ? (
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
        {!showInsertAction ? (
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
        {showInsertAction ? (
          <button
            type="button"
            data-module-insert-ignore="true"
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

export const RemindersModuleSkin = ({
  reminders,
  loading,
  error = null,
  onDismiss,
  onSnooze,
  onCreate,
  sizeTier,
  readOnly = false,
}: RemindersModuleSkinProps) => {
  const {
    draft,
    setDraft,
    preview,
    clear: clearDraft,
    createPayload,
    hasMeaningfulPreview,
  } = useReminderNLDraft({ parseDelayMs: 300 });
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
  const showPreview = draft.length > 0;

  const submitReminder = async () => {
    if (readOnly || submitting) {
      return;
    }
    const payloadResult = createPayload({
      fallbackTitleFromDraft: true,
      forceReparse: true,
    });
    if (!payloadResult.payload) {
      setInputError(payloadResult.failureReason === 'invalid-remind-at' ? 'Reminder time is invalid.' : 'Add a title and time to create a reminder.');
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
    <section className="flex h-full min-h-0 flex-col gap-3" aria-label="Reminders module">
      <form
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
            placeholder="Add a reminder…"
            aria-label="Add a reminder"
            className="min-h-11 flex-1 rounded-panel border border-border-muted bg-surface-elevated px-3 py-2 text-sm text-text outline-none placeholder:text-text-secondary focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={readOnly || submitting}
            className="inline-flex items-center gap-2 rounded-panel border border-border-muted px-3 py-2 text-sm font-semibold text-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Icon name="plus" className="text-[14px]" />
            Add
          </button>
        </div>

        {showPreview ? (
          <div className="rounded-panel border border-border-muted bg-surface px-3 py-2 text-xs text-text-secondary">
            {hasMeaningfulPreview ? (
              <div className="space-y-1">
                {preview.fields.title ? (
                  <p>
                    <span className="font-semibold text-text">Title:</span> {preview.fields.title}
                  </p>
                ) : null}
                {preview.fields.remind_at ? (
                  <p>
                    <span className="font-semibold text-text">When:</span> {preview.fields.context_hint || formatPreviewDateTime(preview.fields.remind_at)}
                  </p>
                ) : null}
                {preview.fields.recurrence ? (
                  <p>
                    <span className="font-semibold text-text">Recurs:</span> {recurrenceLabel(preview)}
                  </p>
                ) : null}
              </div>
            ) : (
              <p>Just set a time — e.g. &quot;call dentist tomorrow at 3pm&quot;</p>
            )}
            {import.meta.env.DEV ? (
              <details className="mt-2">
                <summary className="cursor-pointer select-none">Reminder Parser Debug</summary>
                <pre className="mt-1 whitespace-pre-wrap text-[11px]">
                  {preview.meta.debugSteps.map((step) => `${step.pass} | ${step.ruleId} | ${step.note}`).join('\n') || 'No steps'}
                </pre>
              </details>
            ) : null}
          </div>
        ) : null}

        {inputError ? <p role="alert" aria-live="assertive" className="text-xs text-danger">{inputError}</p> : null}
      </form>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
        {error ? (
          <p role="alert" aria-live="assertive" className="rounded-panel border border-danger bg-danger-subtle px-3 py-4 text-sm text-danger">
            {error}
          </p>
        ) : null}

        {loading && reminders.length === 0 ? (
          <p className="rounded-panel border border-border-muted bg-surface-elevated px-3 py-4 text-sm text-text-secondary">
            Loading reminders…
          </p>
        ) : null}

        {!error && !loading && renderedReminders.length === 0 ? (
          <ModuleEmptyState
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
              onSnooze={onSnooze ? (nextReminder) => void handleSnooze(nextReminder) : undefined}
              onDismiss={(nextReminder) => {
                void handleDismiss(nextReminder);
              }}
            />
          );
        })}
      </div>

      {hiddenCount > 0 ? <p className="shrink-0 text-xs text-text-secondary">+{hiddenCount} more</p> : null}
    </section>
  );
};
