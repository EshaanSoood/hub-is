import { useMemo, useState } from 'react';
import { HUB_TRIAGE_DRAG_MIME } from './types';
import type { TriageReminderItem, TriageTaskItem } from './types';

const toDateTimeLocalValue = (iso: string): string => {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) {
    return '';
  }
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
};

const toTimeValue = (iso: string | null): string => {
  if (!iso) {
    return '';
  }
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) {
    return '';
  }
  const hour = `${date.getHours()}`.padStart(2, '0');
  const minute = `${date.getMinutes()}`.padStart(2, '0');
  return `${hour}:${minute}`;
};

const fromDateTimeLocalValue = (value: string): string | null => {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
};

const combineDateWithTime = (baseIso: string | null, timeValue: string): string | null => {
  if (!timeValue) {
    return null;
  }
  const base = baseIso ? new Date(baseIso) : new Date();
  if (!Number.isFinite(base.getTime())) {
    return null;
  }
  const [hourString, minuteString] = timeValue.split(':');
  const hour = Number.parseInt(hourString || '', 10);
  const minute = Number.parseInt(minuteString || '', 10);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
    return null;
  }
  const next = new Date(base);
  next.setHours(hour, minute, 0, 0);
  return next.toISOString();
};

const formatDateTime = (iso: string | null): string => {
  if (!iso) {
    return 'No date';
  }
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) {
    return 'No date';
  }
  return date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

const defaultReminderSnoozeValue = (): string => {
  const next = new Date();
  next.setMinutes(0, 0, 0);
  next.setHours(next.getHours() + 1);
  return toDateTimeLocalValue(next.toISOString());
};

const actionButtonClassName =
  'rounded-control border border-border-muted px-2 py-1 text-xs text-text disabled:cursor-not-allowed disabled:opacity-60';

const priorityClassName = (priority: TriageTaskItem['priority']): string => {
  if (priority === 'urgent') {
    return 'border-danger/40 bg-danger/10 text-danger';
  }
  if (priority === 'high') {
    return 'border-warning/40 bg-warning/10 text-warning';
  }
  if (priority === 'medium') {
    return 'border-info/40 bg-info/10 text-info';
  }
  if (priority === 'low') {
    return 'border-success/40 bg-success/10 text-success';
  }
  return 'border-border-muted bg-surface-elevated text-muted';
};

export const TriagePanel = ({
  className,
  open,
  overdueTasks,
  untimedTasks,
  missedReminders,
  onCompleteTask,
  onRescheduleTask,
  onSnoozeTask,
  onAssignTaskTime,
  onDismissReminder,
  onSnoozeReminder,
}: {
  className?: string;
  open: boolean;
  overdueTasks: TriageTaskItem[];
  untimedTasks: TriageTaskItem[];
  missedReminders: TriageReminderItem[];
  onCompleteTask: (recordId: string) => Promise<void>;
  onRescheduleTask: (recordId: string, dueAtIso: string) => Promise<void>;
  onSnoozeTask: (recordId: string) => Promise<void>;
  onAssignTaskTime: (recordId: string, dueAtIso: string) => Promise<void>;
  onDismissReminder: (reminderId: string) => Promise<void>;
  onSnoozeReminder: (reminderId: string, remindAtIso: string) => Promise<void>;
}) => {
  const [rescheduleOpenId, setRescheduleOpenId] = useState<string | null>(null);
  const [rescheduleDrafts, setRescheduleDrafts] = useState<Record<string, string>>({});
  const [assignTimeOpenId, setAssignTimeOpenId] = useState<string | null>(null);
  const [assignTimeDrafts, setAssignTimeDrafts] = useState<Record<string, string>>({});
  const [reminderSnoozeOpenId, setReminderSnoozeOpenId] = useState<string | null>(null);
  const [reminderSnoozeDrafts, setReminderSnoozeDrafts] = useState<Record<string, string>>({});
  const [busyKeys, setBusyKeys] = useState<Record<string, boolean>>({});

  const anyGroups = overdueTasks.length > 0 || untimedTasks.length > 0 || missedReminders.length > 0;
  const busy = (key: string): boolean => busyKeys[key] === true;

  const runWithBusy = async (key: string, run: () => Promise<void>) => {
    setBusyKeys((current) => ({ ...current, [key]: true }));
    try {
      await run();
    } finally {
      setBusyKeys((current) => ({ ...current, [key]: false }));
    }
  };

  const reminderDefaultDrafts = useMemo(
    () =>
      missedReminders.reduce<Record<string, string>>((acc, reminder) => {
        acc[reminder.reminderId] = reminderSnoozeDrafts[reminder.reminderId] || defaultReminderSnoozeValue();
        return acc;
      }, {}),
    [missedReminders, reminderSnoozeDrafts],
  );

  if (!open) {
    return null;
  }

  return (
    <div role="region" aria-label="Items needing attention" className={`rounded-panel border border-border-muted bg-surface p-3 ${className ?? ''}`}>
      {!anyGroups ? (
        <p className="text-sm text-muted">No items currently need triage.</p>
      ) : (
        <div className="max-h-80 space-y-4 overflow-y-auto pr-1">
          {overdueTasks.length > 0 ? (
            <section className="space-y-2" aria-labelledby="triage-overdue-heading">
              <h4 id="triage-overdue-heading" className="text-sm font-semibold text-text">
                Overdue tasks ({overdueTasks.length})
              </h4>
              <div className="space-y-2">
                {overdueTasks.map((task) => {
                  const key = `task-overdue-${task.recordId}`;
                  const draft = rescheduleDrafts[task.recordId] || (task.dueAtIso ? toDateTimeLocalValue(task.dueAtIso) : '');
                  return (
                    <article
                      key={task.id}
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = 'move';
                        event.dataTransfer.setData(HUB_TRIAGE_DRAG_MIME, JSON.stringify({ kind: 'task', recordId: task.recordId }));
                      }}
                      className="rounded-control border border-border-muted bg-surface-elevated p-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-text">{task.title}</p>
                          <p className="text-xs text-muted">
                            Due {formatDateTime(task.dueAtIso)} · {task.projectName || 'Inbox & Unassigned'}
                          </p>
                        </div>
                        <span className={`rounded-control border px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${priorityClassName(task.priority)}`}>
                          {task.priority || 'none'}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          className={actionButtonClassName}
                          onClick={() => {
                            void runWithBusy(`${key}-complete`, () => onCompleteTask(task.recordId));
                          }}
                          disabled={busy(`${key}-complete`)}
                        >
                          Complete
                        </button>
                        <button
                          type="button"
                          className={actionButtonClassName}
                          onClick={() => {
                            setRescheduleOpenId((current) => (current === task.recordId ? null : task.recordId));
                          }}
                        >
                          Reschedule
                        </button>
                        <button
                          type="button"
                          className={actionButtonClassName}
                          onClick={() => {
                            void runWithBusy(`${key}-snooze`, () => onSnoozeTask(task.recordId));
                          }}
                          disabled={busy(`${key}-snooze`)}
                        >
                          Snooze
                        </button>
                      </div>
                      {rescheduleOpenId === task.recordId ? (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <input
                            type="datetime-local"
                            value={draft}
                            onChange={(event) => {
                              const value = event.target.value;
                              setRescheduleDrafts((current) => ({ ...current, [task.recordId]: value }));
                            }}
                            className="rounded-control border border-border-muted bg-surface px-2 py-1 text-xs text-text"
                          />
                          <button
                            type="button"
                            className={actionButtonClassName}
                            onClick={() => {
                              const nextIso = fromDateTimeLocalValue(draft);
                              if (!nextIso) {
                                return;
                              }
                              void runWithBusy(`${key}-reschedule`, async () => {
                                await onRescheduleTask(task.recordId, nextIso);
                                setRescheduleOpenId(null);
                              });
                            }}
                            disabled={busy(`${key}-reschedule`)}
                          >
                            Save
                          </button>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </section>
          ) : null}

          {untimedTasks.length > 0 ? (
            <section className="space-y-2" aria-labelledby="triage-unscheduled-heading">
              <h4 id="triage-unscheduled-heading" className="text-sm font-semibold text-text">
                Unscheduled today ({untimedTasks.length})
              </h4>
              <div className="space-y-2">
                {untimedTasks.map((task) => {
                  const key = `task-untimed-${task.recordId}`;
                  const draft = assignTimeDrafts[task.recordId] || toTimeValue(task.dueAtIso);
                  return (
                    <article
                      key={task.id}
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = 'move';
                        event.dataTransfer.setData(HUB_TRIAGE_DRAG_MIME, JSON.stringify({ kind: 'task', recordId: task.recordId }));
                      }}
                      className="rounded-control border border-border-muted bg-surface-elevated p-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-text">{task.title}</p>
                          <p className="text-xs text-muted">{task.projectName || 'Inbox & Unassigned'}</p>
                        </div>
                        <span className={`rounded-control border px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${priorityClassName(task.priority)}`}>
                          {task.priority || 'none'}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          className={actionButtonClassName}
                          onClick={() => {
                            void runWithBusy(`${key}-complete`, () => onCompleteTask(task.recordId));
                          }}
                          disabled={busy(`${key}-complete`)}
                        >
                          Complete
                        </button>
                        <button
                          type="button"
                          className={actionButtonClassName}
                          onClick={() => {
                            setAssignTimeOpenId((current) => (current === task.recordId ? null : task.recordId));
                          }}
                        >
                          Assign time
                        </button>
                        <button
                          type="button"
                          className={actionButtonClassName}
                          onClick={() => {
                            void runWithBusy(`${key}-snooze`, () => onSnoozeTask(task.recordId));
                          }}
                          disabled={busy(`${key}-snooze`)}
                        >
                          Snooze
                        </button>
                      </div>
                      {assignTimeOpenId === task.recordId ? (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <input
                            type="time"
                            value={draft}
                            onChange={(event) => {
                              const value = event.target.value;
                              setAssignTimeDrafts((current) => ({ ...current, [task.recordId]: value }));
                            }}
                            className="rounded-control border border-border-muted bg-surface px-2 py-1 text-xs text-text"
                          />
                          <button
                            type="button"
                            className={actionButtonClassName}
                            onClick={() => {
                              const nextIso = combineDateWithTime(task.dueAtIso, draft);
                              if (!nextIso) {
                                return;
                              }
                              void runWithBusy(`${key}-assign`, async () => {
                                await onAssignTaskTime(task.recordId, nextIso);
                                setAssignTimeOpenId(null);
                              });
                            }}
                            disabled={busy(`${key}-assign`)}
                          >
                            Save
                          </button>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </section>
          ) : null}

          {missedReminders.length > 0 ? (
            <section className="space-y-2" aria-labelledby="triage-reminders-heading">
              <h4 id="triage-reminders-heading" className="text-sm font-semibold text-text">
                Missed reminders ({missedReminders.length})
              </h4>
              <div className="space-y-2">
                {missedReminders.map((reminder) => {
                  const key = `reminder-${reminder.reminderId}`;
                  const draft = reminderDefaultDrafts[reminder.reminderId] || defaultReminderSnoozeValue();
                  return (
                    <article
                      key={reminder.id}
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = 'move';
                        event.dataTransfer.setData(HUB_TRIAGE_DRAG_MIME, JSON.stringify({ kind: 'reminder', reminderId: reminder.reminderId }));
                      }}
                      className="rounded-control border border-border-muted bg-surface-elevated p-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-text">{reminder.title}</p>
                        <p className="text-xs text-muted">Due {formatDateTime(reminder.remindAtIso)}</p>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          className={actionButtonClassName}
                          onClick={() => {
                            void runWithBusy(`${key}-dismiss`, () => onDismissReminder(reminder.reminderId));
                          }}
                          disabled={busy(`${key}-dismiss`)}
                        >
                          Dismiss
                        </button>
                        <button
                          type="button"
                          className={actionButtonClassName}
                          onClick={() => {
                            setReminderSnoozeOpenId((current) => (current === reminder.reminderId ? null : reminder.reminderId));
                            setReminderSnoozeDrafts((current) => ({
                              ...current,
                              [reminder.reminderId]: current[reminder.reminderId] || draft,
                            }));
                          }}
                        >
                          Snooze
                        </button>
                      </div>
                      {reminderSnoozeOpenId === reminder.reminderId ? (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <input
                            type="datetime-local"
                            value={draft}
                            onChange={(event) => {
                              const value = event.target.value;
                              setReminderSnoozeDrafts((current) => ({ ...current, [reminder.reminderId]: value }));
                            }}
                            className="rounded-control border border-border-muted bg-surface px-2 py-1 text-xs text-text"
                          />
                          <button
                            type="button"
                            className={actionButtonClassName}
                            onClick={() => {
                              const nextIso = fromDateTimeLocalValue(draft);
                              if (!nextIso) {
                                return;
                              }
                              void runWithBusy(`${key}-snooze`, async () => {
                                await onSnoozeReminder(reminder.reminderId, nextIso);
                                setReminderSnoozeOpenId(null);
                              });
                            }}
                            disabled={busy(`${key}-snooze`)}
                          >
                            Save
                          </button>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
};
