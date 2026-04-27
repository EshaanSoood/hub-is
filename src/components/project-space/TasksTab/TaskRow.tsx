import { AnimatePresence } from 'framer-motion';
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { cn } from '../../../lib/cn';
import { useLongPress } from '../../../hooks/useLongPress';
import { TaskCard } from '../../cards/TaskCard';
import { AnimatedSurface } from '../../motion/AnimatedSurface';
import type { PriorityLevel } from '../designTokens';
import { getPriorityClasses } from '../../../lib/priorityStyles';
import type { TaskItem, TaskPriorityValue, TaskStatus, TaskSubtask } from './index';
import type { WidgetInsertItemType } from '../widgetContracts';

const PRIORITY_MENU_OPTIONS: Array<{ value: TaskPriorityValue; label: string; tone: PriorityLevel | null }> = [
  { value: 'urgent', label: 'Urgent', tone: 'high' },
  { value: 'high', label: 'High', tone: 'high' },
  { value: 'medium', label: 'Medium', tone: 'medium' },
  { value: 'low', label: 'Low', tone: 'low' },
  { value: null, label: 'None', tone: null },
];

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
  cancelled: 'Cancelled',
};

const EMPTY_VISITED_IDS = new Set<string>();

const parseDueAt = (dueAt: string | null): Date | null => {
  if (!dueAt) {
    return null;
  }
  const parsed = new Date(dueAt);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toDateInputValue = (dueAt: string | null): string => {
  const parsed = parseDueAt(dueAt);
  if (!parsed) {
    return '';
  }
  return new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};

const fromDateInputValue = (value: string): string | null => {
  if (!value) {
    return null;
  }
  return new Date(`${value}T12:00:00`).toISOString();
};

const getPriorityTone = (priorityValue: TaskPriorityValue, fallbackPriority: PriorityLevel): PriorityLevel | null => {
  if (priorityValue === null) {
    return null;
  }
  if (priorityValue === 'urgent') {
    return 'high';
  }
  return priorityValue ?? fallbackPriority;
};

const getNextStatus = (status: TaskStatus): TaskStatus => {
  if (status === 'todo') {
    return 'in_progress';
  }
  if (status === 'in_progress') {
    return 'done';
  }
  return 'todo';
};

const getConnectorMetrics = (level: number): { width: number; opacity: number } => {
  if (level <= 1) {
    return { width: 2, opacity: 0.8 };
  }
  if (level === 2) {
    return { width: 1.5, opacity: 0.5 };
  }
  return { width: 1, opacity: Math.max(0.25, 0.5 - (level - 2) * 0.1) };
};

const MAX_SUBTASK_DEPTH = 10;

const SubtaskTree = ({
  subtask,
  parentPriority,
  level,
  visitedIds,
}: {
  subtask: TaskSubtask;
  parentPriority: PriorityLevel;
  level: number;
  visitedIds: Set<string>;
}) => {
  const resolvedPriority = subtask.priority ?? parentPriority;
  const nested = subtask.subtasks ?? [];
  const metrics = getConnectorMetrics(level);
  const connectorLeft = (level - 1) * 20 + 8;
  const contentPadding = level * 20;
  const reachedMaxDepth = level >= MAX_SUBTASK_DEPTH;
  const hasCycle = visitedIds.has(subtask.id);
  const canRenderNested = !reachedMaxDepth && !hasCycle;
  const nextVisitedIds = new Set(visitedIds);
  nextVisitedIds.add(subtask.id);
  return (
    <li className="space-y-1">
      <div className="relative flex items-center gap-2 text-xs text-muted" style={{ paddingLeft: `${contentPadding}px` }}>
        <span
          className="absolute bottom-0 top-0 rounded-full"
          style={{
            left: `${connectorLeft}px`,
            width: `${metrics.width}px`,
            backgroundColor: 'var(--color-border-muted)',
            opacity: metrics.opacity,
          }}
          aria-hidden="true"
        />
        <span
          className={cn('h-1.5 w-1.5 rounded-full', getPriorityClasses(resolvedPriority).dot, !subtask.priority && 'opacity-50')}
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1 truncate">{subtask.label}</span>
        <span className="shrink-0 opacity-70">{subtask.dueLabel}</span>
      </div>

      {nested.length > 0 && canRenderNested ? (
        <ul className="space-y-1">
          {nested.map((child) => (
            <SubtaskTree
              key={child.id}
              subtask={child}
              parentPriority={resolvedPriority}
              level={level + 1}
              visitedIds={nextVisitedIds}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
};

interface TaskRowProps {
  task: TaskItem;
  status: TaskStatus;
  onAddSubtask?: (task: TaskItem) => void;
  onToggleStatus?: (taskId: string, status: TaskStatus) => void;
  onUpdateTaskStatus?: (taskId: string, status: TaskStatus) => void | Promise<void>;
  onUpdateTaskPriority?: (taskId: string, priority: TaskPriorityValue) => void | Promise<void>;
  onUpdateTaskDueDate?: (taskId: string, dueAt: string | null) => void | Promise<void>;
  onUpdateTaskCategory?: (taskId: string, category: string | null) => void | Promise<void>;
  onDeleteTask?: (taskId: string) => void | Promise<void>;
  onOpenRecord?: (recordId: string) => void;
  activeItemId?: string | null;
  activeItemType?: WidgetInsertItemType;
  setActiveItem?: (id: string, type: WidgetInsertItemType, title: string) => void;
  clearActiveItem?: () => void;
  onInsertToEditor?: (item: { id: string; type: string; title: string }) => void;
}

export const TaskRow = ({
  task,
  status,
  onAddSubtask,
  onToggleStatus,
  onUpdateTaskStatus,
  onUpdateTaskPriority,
  onUpdateTaskDueDate,
  onUpdateTaskCategory,
  onDeleteTask,
  onOpenRecord,
  activeItemId = null,
  activeItemType = null,
  setActiveItem,
  clearActiveItem,
  onInsertToEditor,
}: TaskRowProps) => {
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [categoryDraft, setCategoryDraft] = useState(task.categoryValue ?? '');
  const [confirmArchive, setConfirmArchive] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const archiveTimerRef = useRef<number | null>(null);
  const visibleSubtaskCount = task.subtaskCount ?? task.subtasks.length;
  const taskHasSubtasks = task.subtasks.length > 0;
  const subtaskListId = taskHasSubtasks ? `task-subtasks-${task.id}` : undefined;
  const hasMenuActions = Boolean(onUpdateTaskPriority || onUpdateTaskDueDate || onUpdateTaskCategory || onUpdateTaskStatus || onDeleteTask);
  const priorityTone = getPriorityTone(task.priorityValue, task.priority);
  const priorityClasses = getPriorityClasses(priorityTone);
  const longPressHandlers = useLongPress(() => {
    setActiveItem?.(task.id, 'task', task.label);
  });
  const showInsertAction = Boolean(activeItemId === task.id && activeItemType === 'task' && onInsertToEditor && clearActiveItem);

  const closeMenu = (options?: { restoreFocus?: boolean }) => {
    setMenuOpen(false);
    setConfirmArchive(false);
    if (archiveTimerRef.current !== null) {
      window.clearTimeout(archiveTimerRef.current);
      archiveTimerRef.current = null;
    }
    if (options?.restoreFocus) {
      requestAnimationFrame(() => {
        triggerRef.current?.focus();
      });
    }
  };

  const runMenuAction = (action?: () => void | Promise<void>) => {
    closeMenu();
    if (!action) {
      return;
    }
    void action();
  };

  const commitCategory = () => {
    const nextValue = categoryDraft.trim() || null;
    const currentValue = task.categoryValue?.trim() || null;
    if (nextValue === currentValue) {
      closeMenu();
      return;
    }
    runMenuAction(() => onUpdateTaskCategory?.(task.id, nextValue));
  };

  useEffect(() => {
    return () => {
      if (archiveTimerRef.current !== null) {
        window.clearTimeout(archiveTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      menuRef.current?.querySelector<HTMLElement>('[data-menu-item="true"]')?.focus();
    });

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) {
        return;
      }
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) {
        return;
      }
      closeMenu();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMenu({ restoreFocus: true });
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
      return;
    }

    const items = [...(menuRef.current?.querySelectorAll<HTMLElement>('[data-menu-item="true"]') ?? [])];
    if (items.length === 0) {
      return;
    }

    event.preventDefault();
    const activeIndex = items.findIndex((item) => item === document.activeElement);
    const nextIndex =
      activeIndex === -1
        ? event.key === 'ArrowDown'
          ? 0
          : items.length - 1
        : event.key === 'ArrowDown'
          ? (activeIndex + 1) % items.length
          : (activeIndex - 1 + items.length) % items.length;
    items[nextIndex]?.focus();
  };

  const handleArchiveClick = () => {
    if (!onDeleteTask) {
      return;
    }
    if (!confirmArchive) {
      setConfirmArchive(true);
      if (archiveTimerRef.current !== null) {
        window.clearTimeout(archiveTimerRef.current);
      }
      archiveTimerRef.current = window.setTimeout(() => {
        setConfirmArchive(false);
        archiveTimerRef.current = null;
      }, 3000);
      return;
    }

    runMenuAction(() => onDeleteTask(task.id));
  };

  return (
    <div
      className="group relative rounded-control border border-border-muted bg-surface px-2 py-1.5 hover:bg-surface-elevated focus-within:bg-surface-elevated"
      {...longPressHandlers}
    >
      <span
        className={cn('absolute bottom-0 left-0 top-0 w-[3px] rounded-l-control', priorityTone ? priorityClasses.dot : 'bg-border-muted')}
        aria-hidden="true"
      />

      <div className="flex items-center gap-2 pl-1">
        <TaskCard
          title={task.label}
          status={status}
          dueLabel={task.dueLabel}
          className="flex-1"
          onToggleStatus={
            !onToggleStatus || status === 'cancelled'
              ? undefined
              : () => {
                  onToggleStatus(task.id, getNextStatus(status));
                }
          }
          toggleDisabled={!onToggleStatus || status === 'cancelled'}
          toggleAriaLabel={status === 'cancelled' ? `${task.label} is cancelled. Use actions to reopen.` : `Advance ${task.label} from ${STATUS_LABELS[status]}`}
          onTitleClick={taskHasSubtasks ? () => setExpanded((current) => !current) : undefined}
          titleExpanded={taskHasSubtasks ? expanded : undefined}
          titleControls={subtaskListId}
          trailing={
            visibleSubtaskCount > 0 || taskHasSubtasks ? (
              <span className="flex shrink-0 items-center gap-1">
                {visibleSubtaskCount > 0 ? (
                  <span className={cn('shrink-0 rounded-control border px-1.5 py-0.5 text-[10px] font-semibold', priorityClasses.text, priorityClasses.border, priorityClasses.tint)}>
                    {visibleSubtaskCount}
                  </span>
                ) : null}
                {taskHasSubtasks ? <span className={cn('text-[10px] text-muted transition-transform', expanded && 'rotate-90')}>▶</span> : null}
              </span>
            ) : null
          }
        />

        <div className="ml-auto flex items-center gap-1">
          {onAddSubtask ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onAddSubtask(task);
              }}
              className={cn(
                'text-[10px] text-muted opacity-0 transition-opacity focus:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100',
                menuOpen && 'opacity-100',
              )}
              aria-label={`Add subtask to ${task.label}`}
            >
              + Subtask
            </button>
          ) : null}

          {onOpenRecord ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onOpenRecord(task.id);
              }}
              className={cn(
                'rounded-control border border-border-muted px-2 py-1 text-[10px] text-muted transition-opacity hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
                !hasMenuActions && !onAddSubtask ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',
                menuOpen && 'opacity-100',
              )}
              aria-label={`Open record inspector for ${task.label}`}
            >
              Inspect
            </button>
          ) : null}

          {hasMenuActions ? (
            <div className="relative">
              <button
                ref={triggerRef}
                type="button"
                aria-haspopup="dialog"
                aria-expanded={menuOpen}
                onClick={(event) => {
                  event.stopPropagation();
                  if (!menuOpen) {
                    setCategoryDraft(task.categoryValue ?? '');
                  }
                  setMenuOpen((current) => !current);
                  setConfirmArchive(false);
                  if (archiveTimerRef.current !== null) {
                    window.clearTimeout(archiveTimerRef.current);
                    archiveTimerRef.current = null;
                  }
                }}
                className={cn(
                  'rounded-control px-2 py-1 text-sm text-muted opacity-0 transition-opacity hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring group-hover:opacity-100 group-focus-within:opacity-100',
                  menuOpen && 'opacity-100',
                )}
                aria-label={`Open actions for ${task.label}`}
              >
                ⋯
              </button>

              <AnimatePresence>
                {menuOpen ? (
                  <AnimatedSurface
                    ref={menuRef}
                    role="dialog"
                    tabIndex={-1}
                    ariaLabel={`Task actions for ${task.label}`}
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={handleMenuKeyDown}
                    transformOrigin="top right"
                    className="absolute right-0 top-full z-20 mt-1 w-72 rounded-panel border border-border-muted bg-surface p-3 shadow-lg"
                  >
                  <div className="space-y-2">
                    {onUpdateTaskPriority ? (
                      <div>
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-muted">Priority</p>
                        <div className="flex flex-wrap gap-1.5">
                          {PRIORITY_MENU_OPTIONS.map((option) => {
                            const optionPriorityClasses = getPriorityClasses(option.tone);
                            const active = task.priorityValue === option.value;
                            return (
                              <button
                                key={option.label}
                                type="button"
                                data-menu-item="true"
                                onClick={() => runMenuAction(() => onUpdateTaskPriority(task.id, option.value))}
                                className={cn(
                                  'rounded-control border px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
                                  optionPriorityClasses.text,
                                  optionPriorityClasses.border,
                                  optionPriorityClasses.tint,
                                  active && 'font-semibold',
                                )}
                              >
                                {option.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}

                    {onUpdateTaskDueDate ? (
                      <div>
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-muted">Due date</p>
                        <div className="flex items-center gap-2">
                          <input
                            type="date"
                            value={toDateInputValue(task.dueAt)}
                            onChange={(event) => {
                              runMenuAction(() => onUpdateTaskDueDate(task.id, fromDateInputValue(event.target.value)));
                            }}
                            onClick={(event) => event.stopPropagation()}
                            className="min-w-0 flex-1 rounded-control border border-border-muted bg-surface-elevated px-2 py-1 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                          />
                          <button
                            type="button"
                            data-menu-item="true"
                            onClick={() => runMenuAction(() => onUpdateTaskDueDate(task.id, null))}
                            className="rounded-control border border-border-muted px-2 py-1 text-xs text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {onUpdateTaskCategory ? (
                      <div>
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-muted">Category</p>
                        <input
                          type="text"
                          value={categoryDraft}
                          placeholder="Uncategorized"
                          onChange={(event) => setCategoryDraft(event.target.value)}
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              commitCategory();
                            }
                          }}
                          onBlur={(event) => {
                            const relatedTarget = event.relatedTarget as Node | null;
                            if (relatedTarget && menuRef.current?.contains(relatedTarget)) {
                              return;
                            }
                            commitCategory();
                          }}
                          className="w-full rounded-control border border-border-muted bg-surface-elevated px-2 py-1 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                        />
                      </div>
                    ) : null}

                    <div className="flex flex-col gap-1">
                      {onUpdateTaskStatus ? (
                        <button
                          type="button"
                          data-menu-item="true"
                          onClick={() => runMenuAction(() => onUpdateTaskStatus(task.id, status === 'cancelled' ? 'todo' : 'cancelled'))}
                          className="rounded-control px-2 py-1 text-left text-sm text-text hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                        >
                          {status === 'cancelled' ? 'Reopen' : 'Mark as cancelled'}
                        </button>
                      ) : null}
                      {onDeleteTask ? (
                        <button
                          type="button"
                          data-menu-item="true"
                          onClick={handleArchiveClick}
                          className="rounded-control px-2 py-1 text-left text-sm text-danger hover:bg-danger-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                        >
                          {confirmArchive ? 'Confirm archive?' : 'Archive task'}
                        </button>
                      ) : null}
                    </div>
                  </div>
                  </AnimatedSurface>
                ) : null}
              </AnimatePresence>
            </div>
          ) : null}
        </div>
      </div>

      {expanded && taskHasSubtasks ? (
        <ul id={subtaskListId} className="mt-2 space-y-1">
          {task.subtasks.map((subtask) => (
            <SubtaskTree key={subtask.id} subtask={subtask} parentPriority={task.priority} level={1} visitedIds={EMPTY_VISITED_IDS} />
          ))}
        </ul>
      ) : null}
      {showInsertAction ? (
        <button
          type="button"
          data-widget-insert-ignore="true"
          onClick={() => {
            onInsertToEditor?.({ id: task.id, type: 'task', title: task.label });
            clearActiveItem?.();
          }}
          className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-control bg-primary px-2 py-1 text-xs font-semibold text-on-primary shadow-soft"
        >
          Insert
        </button>
      ) : null}
    </div>
  );
};
