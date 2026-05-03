import { Fragment, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Dialog, Icon, notifyError } from '../primitives';
import { BacklogAccessibilityTree } from './BacklogAccessibilityTree';
import type { BacklogDragPayload, BacklogReminderItem, BacklogTaskItem } from './types';

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
  'ghost-button bg-surface px-2 py-1 text-xs text-text transition-colors hover:bg-surface-highest disabled:cursor-not-allowed disabled:opacity-60';

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

const formatBacklogItemLabel = (title: string, groupLabel: BacklogListItem['groupLabel']): string =>
  `${title}. ${groupLabel}.`;

const formatBacklogItemHint = (dragToTimelineEnabled: boolean): string => (
  dragToTimelineEnabled
    ? 'Interact with element to reveal actions. Press Space to place on timeline or Enter to open.'
    : 'Interact with element to reveal actions. Press Enter to open.'
);

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
  dragToTimelineEnabled = false,
  activeKeyboardDragItemId = null,
  restoreFocusItemId = null,
  onRestoreFocusHandled,
  onBeginKeyboardDrag,
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
  dragToTimelineEnabled?: boolean;
  activeKeyboardDragItemId?: string | null;
  restoreFocusItemId?: string | null;
  onRestoreFocusHandled?: () => void;
  onBeginKeyboardDrag?: (item: { id: string; title: string; payload: BacklogDragPayload }) => void;
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
  const treeHintId = useId();
  const itemRefs = useRef<Record<string, HTMLElement | null>>({});
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

  useEffect(() => {
    if (!restoreFocusItemId) {
      return;
    }
    const targetIndex = backlogItems.findIndex((item) => item.id === restoreFocusItemId);
    if (targetIndex >= 0) {
      setActiveIndex(targetIndex);
      itemRefs.current[restoreFocusItemId]?.focus();
    }
    onRestoreFocusHandled?.();
  }, [backlogItems, onRestoreFocusHandled, restoreFocusItemId]);

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

  const handleRovingKeyDown = (event: KeyboardEvent<HTMLElement>, index: number) => {
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
      window.requestAnimationFrame(() => {
        focusItemAt(0);
      });
    }
  };

  const restoreFocus = (element: HTMLElement | null | undefined) => {
    if (!element) {
      return;
    }
    window.requestAnimationFrame(() => {
      element.focus();
    });
  };

  return (
    <div
      className={`section-scored rounded-panel bg-surface-low p-3 shadow-soft ${className ?? ''}`}
      data-testid="daily-brief-backlog"
    >
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
        <span className="flex items-center gap-2 text-xs text-muted">
          <span>{totalItemCount} items</span>
          <Icon
            name="chevron-down"
            className={`text-[12px] transition-transform ${isCollapsed ? '-rotate-90' : 'rotate-0'}`}
          />
        </span>
      </button>

      <div id={listId} role="group" aria-labelledby="backlog-heading" hidden={isCollapsed} className="mt-3">
        {backlogItems.length === 0 ? (
          <p className="text-sm text-muted">No items are currently in backlog.</p>
        ) : (
          <>
            <p id={treeHintId} className="sr-only">
              Interact with the list to reveal backlog actions.
            </p>
            <ul
              role="tree"
              aria-label="Backlog items"
              aria-roledescription="Interact with the list to reveal backlog"
              aria-describedby={treeHintId}
              className="space-y-3"
            >
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
                const cardRef = itemRefs.current[item.id];
                const taskActions = [
                  {
                    id: 'complete',
                    label: 'Complete',
                    disabled: itemBusy,
                    onInvoke: () => {
                      void runWithBusy(key, () => onCompleteTask(task.recordId));
                    },
                  },
                  item.groupLabel === 'Overdue task'
                    ? {
                      id: 'reschedule',
                      label: 'Reschedule',
                      disabled: itemBusy,
                      onInvoke: () => {
                        setRescheduleOpenId((current) => (current === task.recordId ? null : task.recordId));
                        setAssignTimeOpenId(null);
                      },
                    }
                    : {
                      id: 'assign-time',
                      label: 'Assign time',
                      disabled: itemBusy,
                      onInvoke: () => {
                        setAssignTimeOpenId((current) => (current === task.recordId ? null : task.recordId));
                        setRescheduleOpenId(null);
                      },
                    },
                  {
                    id: 'snooze',
                    label: 'Snooze',
                    disabled: itemBusy,
                    onInvoke: () => {
                      void runWithBusy(key, () => onSnoozeTask(task.recordId));
                    },
                  },
                ];

                return (
                  <Fragment key={item.id}>
                    <BacklogAccessibilityTree
                      active={index === activeIndex}
                      actions={taskActions}
                      accessibleLabel={formatBacklogItemLabel(task.title, item.groupLabel)}
                      accessibleDescription={`${item.detail} ${formatBacklogItemHint(dragToTimelineEnabled)}`}
                      activeKeyboardDrag={activeKeyboardDragItemId === item.id}
                      detail={item.detail}
                      dragPayload={dragToTimelineEnabled ? JSON.stringify(item.dragPayload) : undefined}
                      onSetRef={(node) => {
                        itemRefs.current[item.id] = node;
                      }}
                      onFocus={() => {
                        setActiveIndex(index);
                      }}
                      onOpen={() => {
                        onOpenRecord(task.recordId);
                      }}
                      onRovingKeyDown={(event) => {
                        handleRovingKeyDown(event, index);
                      }}
                      onBeginKeyboardDrag={dragToTimelineEnabled ? () => {
                        onBeginKeyboardDrag?.({
                          id: item.id,
                          title: task.title,
                          payload: item.dragPayload,
                        });
                      } : undefined}
                      positionInSet={index + 1}
                      priority={task.priority}
                      setSize={backlogItems.length}
                      title={task.title}
                      typeLabel={item.groupLabel}
                    />

                    <Dialog
                      open={showReschedule}
                      title={`Reschedule ${task.title}`}
                      description={`Choose a new date and time for ${task.title}.`}
                      onClose={() => {
                        setRescheduleOpenId(null);
                        restoreFocus(cardRef);
                      }}
                      panelClassName="max-w-md"
                    >
                      <div className="flex flex-col gap-3">
                        <input
                          autoFocus
                          type="datetime-local"
                          value={rescheduleDraft}
                          aria-label={`Reschedule ${task.title}`}
                          onChange={(event) => {
                            const value = event.target.value;
                            setRescheduleDrafts((current) => ({ ...current, [task.recordId]: value }));
                          }}
                          className="ghost-button bg-surface px-2 py-1 text-sm text-text"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            className={actionButtonClassName}
                            onClick={() => {
                              setRescheduleOpenId(null);
                              restoreFocus(cardRef);
                            }}
                          >
                            Cancel
                          </button>
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
                                restoreFocus(cardRef);
                              });
                            }}
                            disabled={itemBusy || !nextRescheduleIso}
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    </Dialog>

                    <Dialog
                      open={showAssignTime}
                      title={`Assign time for ${task.title}`}
                      description={`Choose a time for ${task.title}.`}
                      onClose={() => {
                        setAssignTimeOpenId(null);
                        restoreFocus(cardRef);
                      }}
                      panelClassName="max-w-md"
                    >
                      <div className="flex flex-col gap-3">
                        <input
                          autoFocus
                          type="time"
                          value={assignTimeDraft}
                          aria-label={`Assign time for ${task.title}`}
                          onChange={(event) => {
                            const value = event.target.value;
                            setAssignTimeDrafts((current) => ({ ...current, [task.recordId]: value }));
                          }}
                          className="ghost-button bg-surface px-2 py-1 text-sm text-text"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            className={actionButtonClassName}
                            onClick={() => {
                              setAssignTimeOpenId(null);
                              restoreFocus(cardRef);
                            }}
                          >
                            Cancel
                          </button>
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
                                restoreFocus(cardRef);
                              });
                            }}
                            disabled={itemBusy || !nextAssignedTimeIso}
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    </Dialog>
                  </Fragment>
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
              const cardRef = itemRefs.current[item.id];
              const reminderActions = [
                {
                  id: 'dismiss',
                  label: 'Dismiss',
                  disabled: itemBusy,
                  onInvoke: () => {
                    void runWithBusy(key, () => onDismissReminder(reminder.reminderId));
                  },
                },
                {
                  id: 'snooze',
                  label: 'Snooze',
                  disabled: itemBusy,
                  onInvoke: () => {
                    setReminderSnoozeOpenId((current) => (current === reminder.reminderId ? null : reminder.reminderId));
                    setReminderSnoozeDrafts((current) => ({
                      ...current,
                      [reminder.reminderId]: current[reminder.reminderId] || draft,
                    }));
                  },
                },
              ];

              return (
                <Fragment key={item.id}>
                  <BacklogAccessibilityTree
                    active={index === activeIndex}
                    actions={reminderActions}
                    accessibleLabel={formatBacklogItemLabel(reminder.title, item.groupLabel)}
                    accessibleDescription={`${item.detail} ${formatBacklogItemHint(dragToTimelineEnabled)}`}
                    activeKeyboardDrag={activeKeyboardDragItemId === item.id}
                    detail={item.detail}
                    dragPayload={dragToTimelineEnabled ? JSON.stringify(item.dragPayload) : undefined}
                    onSetRef={(node) => {
                      itemRefs.current[item.id] = node;
                    }}
                    onFocus={() => {
                      setActiveIndex(index);
                    }}
                    onOpen={() => {
                      onOpenRecord(reminder.recordId);
                    }}
                    onRovingKeyDown={(event) => {
                      handleRovingKeyDown(event, index);
                    }}
                    onBeginKeyboardDrag={dragToTimelineEnabled ? () => {
                      onBeginKeyboardDrag?.({
                        id: item.id,
                        title: reminder.title,
                        payload: item.dragPayload,
                      });
                    } : undefined}
                    positionInSet={index + 1}
                    setSize={backlogItems.length}
                    title={reminder.title}
                    typeLabel={item.groupLabel}
                  />

                  <Dialog
                    open={reminderSnoozeOpenId === reminder.reminderId}
                    title={`Snooze ${reminder.title}`}
                    description={`Choose a new reminder time for ${reminder.title}.`}
                    onClose={() => {
                      setReminderSnoozeOpenId(null);
                      restoreFocus(cardRef);
                    }}
                    panelClassName="max-w-md"
                  >
                    <div className="flex flex-col gap-3">
                      <input
                        autoFocus
                        type="datetime-local"
                        value={draft}
                        aria-label={`Snooze ${reminder.title}`}
                        onChange={(event) => {
                          const value = event.target.value;
                          setReminderSnoozeDrafts((current) => ({ ...current, [reminder.reminderId]: value }));
                        }}
                        className="ghost-button bg-surface px-2 py-1 text-sm text-text"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          className={actionButtonClassName}
                          onClick={() => {
                            setReminderSnoozeOpenId(null);
                            restoreFocus(cardRef);
                          }}
                        >
                          Cancel
                        </button>
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
                              restoreFocus(cardRef);
                            });
                          }}
                          disabled={itemBusy || !nextIso}
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  </Dialog>
                </Fragment>
              );
            })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
};
