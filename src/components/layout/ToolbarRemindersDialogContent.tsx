import { useState, type FC } from 'react';
import { formatQuickNavTime } from './appShellUtils';

interface ToolbarRemindersDialogContentProps {
  bucketedReminders: Array<{
    id: string;
    label: string;
    items: Array<{
      reminder_id: string;
      record_id: string;
      record_title: string;
      remind_at: string | null;
      project_id: string | null;
      project_name?: string | null;
      fired_at?: string | null;
    }>;
  }>;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onOpenReminder: (recordId: string, projectId: string | null) => void;
  onDismiss: (reminderId: string) => Promise<void>;
  onSnooze: (reminderId: string) => Promise<void>;
  onNewReminder: () => void;
}

export const ToolbarRemindersDialogContent: FC<ToolbarRemindersDialogContentProps> = ({
  bucketedReminders,
  loading,
  error,
  onRetry,
  onOpenReminder,
  onDismiss,
  onSnooze,
  onNewReminder,
}) => {
  const [actionError, setActionError] = useState<string | null>(null);

  const handleDismiss = async (reminderId: string) => {
    try {
      setActionError(null);
      await onDismiss(reminderId);
    } catch {
      setActionError('Failed to dismiss reminder. Please try again.');
    }
  };

  const handleSnooze = async (reminderId: string) => {
    try {
      setActionError(null);
      await onSnooze(reminderId);
    } catch {
      setActionError('Failed to snooze reminder. Please try again.');
    }
  };

  return (
    <div className="space-y-4 rounded-panel bg-surface-elevated p-4">
      {loading ? <p className="text-sm text-muted">Loading reminders...</p> : null}
      {error ? (
        <div className="rounded-panel border border-danger/30 bg-danger/5 p-3" role="alert">
          <p className="text-sm text-danger">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 rounded-control border border-border-muted px-3 py-1.5 text-sm text-text"
          >
            Retry
          </button>
        </div>
      ) : null}
      {!error && actionError ? (
        <div className="rounded-panel border border-danger/30 bg-danger/5 p-3" role="alert">
          <p className="text-sm text-danger">{actionError}</p>
        </div>
      ) : null}
      {!loading && !error ? (
        bucketedReminders.length === 0 ? (
          <div className="space-y-3 rounded-panel border border-border-muted bg-surface px-4 py-8 text-center">
            <p className="text-sm text-muted">No active reminders.</p>
            <button
              type="button"
              onClick={onNewReminder}
              className="rounded-control border border-primary bg-primary px-3 py-1.5 text-sm font-medium text-on-primary"
            >
              New reminder
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {bucketedReminders.map((bucket) => (
              <section key={bucket.id} aria-labelledby={`toolbar-reminder-bucket-${bucket.id}`} className="space-y-2 pt-6 first:pt-0">
                <h3 id={`toolbar-reminder-bucket-${bucket.id}`} className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                  {bucket.label}
                </h3>
                <div className="space-y-2">
                  {bucket.items.map((reminder) => {
                    const projectLabel = reminder.project_name || 'Personal';
                    const dueLabel = formatQuickNavTime(reminder.remind_at, 'No time');
                    return (
                      <article key={reminder.reminder_id} className="rounded-panel border border-border-muted bg-surface-elevated px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <button
                            type="button"
                            onClick={() => onOpenReminder(reminder.record_id, reminder.project_id)}
                            aria-label={`Open reminder ${reminder.record_title}, ${dueLabel}`}
                            className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                          >
                            <p className="truncate text-sm font-semibold text-text">{reminder.record_title}</p>
                            <p className="mt-1 truncate text-[11px] uppercase tracking-[0.08em] text-muted">{projectLabel}</p>
                            <p className="whitespace-nowrap text-xs text-text-secondary">{dueLabel}</p>
                          </button>

                          <div className="flex shrink-0 items-center gap-3">
                            <button
                              type="button"
                              onClick={() => {
                                void handleDismiss(reminder.reminder_id);
                              }}
                              className="rounded-control border border-border-muted px-3 py-2 text-xs font-medium text-text"
                              aria-label={`Dismiss reminder ${reminder.record_title}`}
                            >
                              Dismiss
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                void handleSnooze(reminder.reminder_id);
                              }}
                              className="rounded-control border border-border-muted px-3 py-2 text-xs font-medium text-primary"
                              aria-label={`Snooze reminder ${reminder.record_title} to tomorrow at 9 AM`}
                            >
                              Snooze
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )
      ) : null}
    </div>
  );
};
