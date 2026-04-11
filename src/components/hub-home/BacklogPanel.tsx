import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { notifyError } from '../primitives';
import { HUB_BACKLOG_DRAG_MIME } from './types';
import type { BacklogReminderItem, BacklogTaskItem } from './types';

const BACKLOG_COLLAPSED_STORAGE_KEY = 'hubHome.backlog.collapsed';

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

const priorityClassName = (priority: BacklogTaskItem['priority']): string => {
  if (priority === 'urgent') {
    return 'border-danger/40 bg-danger/10 text-danger';
  }
  if (priority === 'high') {
    return 'border-warning-subtle bg-warning-subtle text-text';
  }
  if (priority === 'medium') {
    return 'border-info-subtle bg-info-subtle text-text';
  }
  if (priority === 'low') {
    return 'border-success-subtle bg-success-subtle text-text';
  }
  return 'border-border-muted bg-surface-elevated text-muted';
};

const readStoredBacklogCollapsed = (): boolean | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(BACKLOG_COLLAPSED_STORAGE_KEY);
    if (raw === 'true') {
      return true;
    }
    if (raw === 'false') {
      return false;
    }
  } catch {
    // Ignore storage failures so the region still works without persistence.
  }

  return null;
};

type BacklogListItem =
  | {
      id: string;
      kind: 'task';
      groupLabel: 'Overdue task' | 'Unscheduled task';
      title: string;
      detail: string;
      priority: BacklogTaskItem['priority'];
      recordId: string;
      dragPayload: { kind: 'task'; recordId: string };
    }
  | {
      id: string;
      kind: 'reminder';
      groupLabel: 'Missed reminder';
      title: string;
      detail: string;
      recordId: string;
      dragPayload: { kind: 'reminder'; reminderId: string };
    };

export const BacklogPanel = ({
  className,
  countReady,
  overdueTasks,
  untimedTasks,
  missedReminders,
  onOpenRecord,
  onCompleteTask,
  onRescheduleTask,
  onSnoozeTask,
  onAssignTaskTime,
  onDismissReminder,
  onSnoozeReminder,
}: {
  className?: string;
  countReady: boolean;
  overdueTasks: BacklogTaskItem[];
  untimedTasks: BacklogTaskItem[];
  missedReminders: BacklogReminderItem[];
  onOpenRecord: (recordId: string) => void;
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
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const listId = useId();
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const storedCollapsedRef = useRef<boolean | null>(readStoredBacklogCollapsed());
  const hasInitializedRef = useRef(false);

  const totalItemCount = overdueTasks.length + untimedTasks.length + missedReminders.length;
  const busy = (key: string): boolean => busyKeys[key] === true;

  const backlogItems = useMemo<BacklogListItem[]>(
    () => [
      ...overdueTasks.map((task) => ({
        id: task.id,
        kind: 'task' as const,
        groupLabel: 'Overdue task' as const,
        title: task.title,
        detail: `Due ${formatDateTime(task.dueAtIso)} · ${task.projectName || 'Inbox & Unassigned'}`,
        priority: task.priority,
        recordId: task.recordId,
        dragPayload: { kind: 'task' as const, recordId: task.recordId },
      })),
      ...untimedTasks.map((task) => ({
        id: task.id,
        kind: 'task' as const,
        groupLabel: 'Unscheduled task' as const,
        title: task.title,
        detail: task.projectName || 'Inbox & Unassigned',
        priority: task.priority,
        recordId: task.recordId,
        dragPayload: { kind: 'task' as const, recordId: task.recordId },
      })),
      ...missedReminders.map((reminder) => ({
        id: reminder.id,
        kind: 'reminder' as const,
        groupLabel: 'Missed reminder' as const,
        title: reminder.title,
        detail: `Due ${formatDateTime(reminder.remindAtIso)} · ${reminder.projectName || 'Inbox & Unassigned'}`,
        recordId: reminder.recordId,
        dragPayload: { kind: 'reminder' as const, reminderId: reminder.reminderId },
      })),
    ],
    [missedReminders, overdueTasks, untimedTasks],
  );

  const reminderDefaultDrafts = useMemo(
    () =>
      missedReminders.reduce<Record<string, string>>((acc, reminder) => {
        acc[reminder.reminderId] = reminderSnoozeDrafts[reminder.reminderId] || defaultReminderSnoozeValue();
        return acc;
      }, {}),
    [missedReminders, reminderSnoozeDrafts],
  );

  useEffect(() => {
    if (hasInitializedRef.current || !countReady) {
      return;
    }

    const initialCollapsed = storedCollapsedRef.current ?? totalItemCount > 5;
    setIsCollapsed(initialCollapsed);
    hasInitializedRef.current = true;
  }, [countReady, totalItemCount]);

  useEffect(() => {
    if (backlogItems.length === 0) {
      setActiveIndex(0);
      return;
    }
    setActiveIndex((current) => Math.min(current, backlogItems.length - 1));
  }, [backlogItems.length]);

  const persistCollapsed = (nextCollapsed: boolean) => {
    storedCollapsedRef.current = nextCollapsed;
    try {
      window.localStorage.setItem(BACKLOG_COLLAPSED_STORAGE_KEY, String(nextCollapsed));
    } catch {
      // Ignore storage failures so the disclosure still works.
    }
  };

  const runWithBusy = async (key: string, run: () => Promise<void>) => {
    setBusyKeys((current) => ({ ...current, [key]: true }));
    try {
      await run();
    } catch (error) {
      console.error('Failed to run backlog action:', error);
      notifyError('Could not update this backlog item.', error instanceof Error ? error.message : undefined);
    } finally {
      setBusyKeys((current) => ({ ...current, [key]: false }));
    }
  };

  const focusItemAt = (index: number) => {
    const clampedIndex = Math.max(0, Math.min(index, backlogItems.length - 1));
    const item = backlogItems[clampedIndex];
    if (!item) {
      return;
    }
    setActiveIndex(clampedIndex);
    itemRefs.current[item.id]?.focus();
  };

  const handleRovingKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusItemAt(index + 1);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      focusItemAt(index - 1);
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      focusItemAt(0);
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      focusItemAt(backlogItems.length - 1);
    }
  };

  const toggleCollapsed = () => {
    const nextCollapsed = !isCollapsed;
    setIsCollapsed(nextCollapsed);
    persistCollapsed(nextCollapsed);
    if (!nextCollapsed) {
      setActiveIndex(0);
    }
  };

  return (
    <section aria-labelledby="backlog-heading" className={`rounded-panel border border-border-muted bg-surface p-3 ${className ?? ''}`}>
      <button
        id="backlog-toggle"
        type="button"
        aria-label={`Backlog, ${totalItemCount} items`}
        aria-expanded={!isCollapsed}
        aria-controls={listId}
        onClick={toggleCollapsed}
        className="flex w-full items-center justify-between gap-3 rounded-control text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
      >
        <span id="backlog-heading" role="heading" aria-level={3} className="text-sm font-semibold text-text">
          Backlog
        </span>
        <span className="text-xs text-muted">{totalItemCount} items</span>
      </button>

      <div id={listId} hidden={isCollapsed} className="mt-3">
        {backlogItems.length === 0 ? (
          <p className="text-sm text-muted">No items are currently in backlog.</p>
        ) : (
          <ul className="space-y-3">
            {backlogItems.map((item, index) => {
              if (item.kind === 'task') {
                const task = overdueTasks.find((candidate) => candidate.id === item.id)
                  ?? untimedTasks.find((candidate) => candidate.id === item.id);
                if (!task) {
                  return null;
                }

                const key = `task-${task.recordId}`;
                const itemBusy = busy(key);
                const rescheduleDraft = rescheduleDrafts[task.recordId] || (task.dueAtIso ? toDateTimeLocalValue(task.dueAtIso) : '');
                const assignTimeDraft = assignTimeDrafts[task.recordId] || toTimeValue(task.dueAtIso);
                const nextRescheduleIso = fromDateTimeLocalValue(rescheduleDraft);
                const nextAssignedTimeIso = combineDateWithTime(task.dueAtIso, assignTimeDraft);
                const showReschedule = item.groupLabel === 'Overdue task' && rescheduleOpenId === task.recordId;
                const showAssignTime = item.groupLabel === 'Unscheduled task' && assignTimeOpenId === task.recordId;

                return (
                  <li key={item.id} className="rounded-control border border-border-muted bg-surface-elevated p-3">
                    <button
                      ref={(node) => {
                        itemRefs.current[item.id] = node;
                      }}
                      type="button"
                      tabIndex={index === activeIndex ? 0 : -1}
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = 'move';
                        event.dataTransfer.setData(HUB_BACKLOG_DRAG_MIME, JSON.stringify(item.dragPayload));
                      }}
                      onFocus={() => {
                        setActiveIndex(index);
                      }}
                      onKeyDown={(event) => {
                        handleRovingKeyDown(event, index);
                      }}
                      onClick={() => {
                        onOpenRecord(task.recordId);
                      }}
                      className="w-full rounded-control text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-control border border-border-muted bg-surface px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted">
                              {item.groupLabel}
                            </span>
                            <span className={`rounded-control border px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${priorityClassName(task.priority)}`}>
                              {task.priority || 'none'}
                            </span>
                          </div>
                          <p className="mt-2 truncate text-sm font-medium text-text">{task.title}</p>
                          <p className="mt-1 text-xs text-muted">{item.detail}</p>
                        </div>
                      </div>
                    </button>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        tabIndex={-1}
                        className={actionButtonClassName}
                        onClick={() => {
                          void runWithBusy(key, () => onCompleteTask(task.recordId));
                        }}
                        disabled={itemBusy}
                      >
                        Complete
                      </button>
                      {item.groupLabel === 'Overdue task' ? (
                        <button
                          type="button"
                          tabIndex={-1}
                          className={actionButtonClassName}
                          onClick={() => {
                            setRescheduleOpenId((current) => (current === task.recordId ? null : task.recordId));
                            setAssignTimeOpenId(null);
                          }}
                          disabled={itemBusy}
                        >
                          Reschedule
                        </button>
                      ) : (
                        <button
                          type="button"
                          tabIndex={-1}
                          className={actionButtonClassName}
                          onClick={() => {
                            setAssignTimeOpenId((current) => (current === task.recordId ? null : task.recordId));
                            setRescheduleOpenId(null);
                          }}
                          disabled={itemBusy}
                        >
                          Assign time
                        </button>
                      )}
                      <button
                        type="button"
                        tabIndex={-1}
                        className={actionButtonClassName}
                        onClick={() => {
                          void runWithBusy(key, () => onSnoozeTask(task.recordId));
                        }}
                        disabled={itemBusy}
                      >
                        Snooze
                      </button>
                    </div>

                    {showReschedule ? (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <input
                          type="datetime-local"
                          value={rescheduleDraft}
                          aria-label={`Reschedule ${task.title}`}
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
                            if (!nextRescheduleIso) {
                              return;
                            }
                            void runWithBusy(key, async () => {
                              await onRescheduleTask(task.recordId, nextRescheduleIso);
                              setRescheduleOpenId(null);
                            });
                          }}
                          disabled={itemBusy || !nextRescheduleIso}
                        >
                          Save
                        </button>
                      </div>
                    ) : null}

                    {showAssignTime ? (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <input
                          type="time"
                          value={assignTimeDraft}
                          aria-label={`Assign time for ${task.title}`}
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
                            if (!nextAssignedTimeIso) {
                              return;
                            }
                            void runWithBusy(key, async () => {
                              await onAssignTaskTime(task.recordId, nextAssignedTimeIso);
                              setAssignTimeOpenId(null);
                            });
                          }}
                          disabled={itemBusy || !nextAssignedTimeIso}
                        >
                          Save
                        </button>
                      </div>
                    ) : null}
                  </li>
                );
              }

              const reminder = missedReminders.find((candidate) => candidate.id === item.id);
              if (!reminder) {
                return null;
              }

              const key = `reminder-${reminder.reminderId}`;
              const itemBusy = busy(key);
              const draft = reminderDefaultDrafts[reminder.reminderId] || defaultReminderSnoozeValue();
              const nextIso = fromDateTimeLocalValue(draft);

              return (
                <li key={item.id} className="rounded-control border border-border-muted bg-surface-elevated p-3">
                  <button
                    ref={(node) => {
                      itemRefs.current[item.id] = node;
                    }}
                    type="button"
                    tabIndex={index === activeIndex ? 0 : -1}
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = 'move';
                      event.dataTransfer.setData(HUB_BACKLOG_DRAG_MIME, JSON.stringify(item.dragPayload));
                    }}
                    onFocus={() => {
                      setActiveIndex(index);
                    }}
                    onKeyDown={(event) => {
                      handleRovingKeyDown(event, index);
                    }}
                    onClick={() => {
                      onOpenRecord(reminder.recordId);
                    }}
                    className="w-full rounded-control text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                  >
                    <div className="min-w-0">
                      <span className="rounded-control border border-border-muted bg-surface px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted">
                        {item.groupLabel}
                      </span>
                      <p className="mt-2 truncate text-sm font-medium text-text">{reminder.title}</p>
                      <p className="mt-1 text-xs text-muted">{item.detail}</p>
                    </div>
                  </button>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      tabIndex={-1}
                      className={actionButtonClassName}
                      onClick={() => {
                        void runWithBusy(key, () => onDismissReminder(reminder.reminderId));
                      }}
                      disabled={itemBusy}
                    >
                      Dismiss
                    </button>
                    <button
                      type="button"
                      tabIndex={-1}
                      className={actionButtonClassName}
                      onClick={() => {
                        setReminderSnoozeOpenId((current) => (current === reminder.reminderId ? null : reminder.reminderId));
                        setReminderSnoozeDrafts((current) => ({
                          ...current,
                          [reminder.reminderId]: current[reminder.reminderId] || draft,
                        }));
                      }}
                      disabled={itemBusy}
                    >
                      Snooze
                    </button>
                  </div>

                  {reminderSnoozeOpenId === reminder.reminderId ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <input
                        type="datetime-local"
                        value={draft}
                        aria-label={`Snooze ${reminder.title}`}
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
                          if (!nextIso) {
                            return;
                          }
                          void runWithBusy(key, async () => {
                            await onSnoozeReminder(reminder.reminderId, nextIso);
                            setReminderSnoozeOpenId(null);
                          });
                        }}
                        disabled={itemBusy || !nextIso}
                      >
                        Save
                      </button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
};
