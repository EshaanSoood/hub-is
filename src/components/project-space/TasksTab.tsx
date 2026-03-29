import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { cn } from '../../lib/cn';
import type { PriorityLevel } from './designTokens';
import { getPriorityClasses } from '../../lib/priorityStyles';

export type SortDimension = 'date' | 'priority' | 'category';
export type SortChain = [SortDimension, SortDimension, SortDimension];
export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'cancelled';
export type TaskPriorityValue = 'low' | 'medium' | 'high' | 'urgent' | null;

export interface TaskSubtask {
  id: string;
  label: string;
  dueLabel: string;
  priority: PriorityLevel | null;
  subtasks?: TaskSubtask[];
}

export interface TaskItem {
  id: string;
  label: string;
  dueAt: string | null;
  dueLabel: string;
  categoryId: string;
  categoryValue: string | null;
  assigneeId: string;
  assigneeLabel: string;
  priority: PriorityLevel;
  priorityValue: TaskPriorityValue;
  status: TaskStatus;
  subtaskCount?: number;
  subtasks: TaskSubtask[];
}

interface LensOption {
  id: string;
  label: string;
}

interface Cluster {
  id: string;
  label: string;
  dimension: SortDimension;
  priorityKey?: PriorityLevel;
  items: TaskItem[];
}

interface TasksTabProps {
  tasks: TaskItem[];
  collaborators: LensOption[];
  categories: LensOption[];
  activeUserId: string;
  activeCategoryId: string;
  sortChain: SortChain;
  onSortChainChange: (chain: SortChain) => void;
  onUserChange: (userId: string) => void;
  onCategoryChange: (categoryId: string) => void;
  onAddSubtask?: (task: TaskItem) => void;
  onUpdateTaskStatus?: (taskId: string, status: TaskStatus) => void | Promise<void>;
  onUpdateTaskPriority?: (taskId: string, priority: TaskPriorityValue) => void | Promise<void>;
  onUpdateTaskDueDate?: (taskId: string, dueAt: string | null) => void | Promise<void>;
  onUpdateTaskCategory?: (taskId: string, category: string | null) => void | Promise<void>;
  onDeleteTask?: (taskId: string) => void | Promise<void>;
  showSortControls?: boolean;
}

const SORT_DIMENSIONS: SortDimension[] = ['date', 'priority', 'category'];
const GROUP_BY_LABELS: Record<SortDimension, string> = {
  date: 'Chronological',
  priority: 'Priority',
  category: 'Category',
};
const PRIORITY_ORDER: PriorityLevel[] = ['high', 'medium', 'low'];
const PRIORITY_RANK: Record<PriorityLevel, number> = {
  high: 0,
  medium: 1,
  low: 2,
};
const PRIORITY_MENU_OPTIONS: Array<{ value: TaskPriorityValue; label: string; tone: PriorityLevel | null }> = [
  { value: 'urgent', label: 'Urgent', tone: 'high' },
  { value: 'high', label: 'High', tone: 'high' },
  { value: 'medium', label: 'Medium', tone: 'medium' },
  { value: 'low', label: 'Low', tone: 'low' },
  { value: null, label: 'None', tone: null },
];
const STATUS_SYMBOLS: Record<TaskStatus, string> = {
  todo: '○',
  in_progress: '◐',
  done: '✓',
  cancelled: '⊘',
};
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

const startOfDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const normalizeWeekday = (value: number): number => (Number.isInteger(value) && value >= 0 && value <= 6 ? value : 6);

const endOfWeek = (date: Date, weekEndDay = 6) => {
  const next = new Date(date);
  const day = next.getDay();
  const resolvedWeekEndDay = normalizeWeekday(weekEndDay);
  const daysUntilWeekEnd = (resolvedWeekEndDay - day + 7) % 7;
  next.setDate(next.getDate() + daysUntilWeekEnd);
  next.setHours(23, 59, 59, 999);
  return next;
};

const titleCaseCategory = (categoryId: string) =>
  categoryId
    .split(/[-_]/g)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');

const promoteDimension = (chain: SortChain, clicked: SortDimension): SortChain => {
  if (chain[0] === clicked) {
    return chain;
  }
  const rest = chain.filter((dimension) => dimension !== clicked) as [SortDimension, SortDimension];
  return [clicked, rest[0], rest[1]];
};

const compareCategory = (left: string, right: string): number => {
  const leftIsUncategorized = left === 'uncategorized';
  const rightIsUncategorized = right === 'uncategorized';
  if (leftIsUncategorized && !rightIsUncategorized) {
    return 1;
  }
  if (!leftIsUncategorized && rightIsUncategorized) {
    return -1;
  }
  return left.localeCompare(right);
};

const compareSingleDimension = (left: TaskItem, right: TaskItem, dimension: SortDimension): number => {
  if (dimension === 'date') {
    const leftDue = parseDueAt(left.dueAt);
    const rightDue = parseDueAt(right.dueAt);
    if (!leftDue && !rightDue) {
      return 0;
    }
    if (!leftDue) {
      return 1;
    }
    if (!rightDue) {
      return -1;
    }
    return leftDue.getTime() - rightDue.getTime();
  }

  if (dimension === 'priority') {
    return PRIORITY_RANK[left.priority] - PRIORITY_RANK[right.priority];
  }

  return compareCategory(left.categoryId, right.categoryId);
};

const buildComparator = (dimensions: SortDimension[]): ((left: TaskItem, right: TaskItem) => number) => {
  return (left, right) => {
    for (const dimension of dimensions) {
      const result = compareSingleDimension(left, right, dimension);
      if (result !== 0) {
        return result;
      }
    }
    return left.label.localeCompare(right.label) || left.id.localeCompare(right.id);
  };
};

const buildDateClusters = (tasks: TaskItem[]): Cluster[] => {
  const now = new Date();
  const today = startOfDay(now);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const weekEnd = endOfWeek(now);
  const groups: Record<'overdue' | 'today' | 'thisWeek' | 'later', TaskItem[]> = {
    overdue: [],
    today: [],
    thisWeek: [],
    later: [],
  };

  for (const task of tasks) {
    const due = parseDueAt(task.dueAt);
    if (!due) {
      groups.later.push(task);
      continue;
    }

    if (due.getTime() < today.getTime()) {
      groups.overdue.push(task);
    } else if (due.getTime() < tomorrow.getTime()) {
      groups.today.push(task);
    } else if (due.getTime() <= weekEnd.getTime()) {
      groups.thisWeek.push(task);
    } else {
      groups.later.push(task);
    }
  }

  return [
    { id: 'overdue', label: 'Overdue', dimension: 'date', items: groups.overdue },
    { id: 'today', label: 'Today', dimension: 'date', items: groups.today },
    { id: 'thisWeek', label: 'This Week', dimension: 'date', items: groups.thisWeek },
    { id: 'later', label: 'Later', dimension: 'date', items: groups.later },
  ];
};

const buildPriorityClusters = (tasks: TaskItem[]): Cluster[] =>
  PRIORITY_ORDER
    .map((priority) => ({
      id: priority,
      label: priority.charAt(0).toUpperCase() + priority.slice(1),
      dimension: 'priority' as const,
      priorityKey: priority,
      items: tasks.filter((task) => task.priority === priority),
    }))
    .filter((cluster) => cluster.items.length > 0);

const buildCategoryClusters = (tasks: TaskItem[]): Cluster[] => {
  const map = new Map<string, TaskItem[]>();
  for (const task of tasks) {
    map.set(task.categoryId, [...(map.get(task.categoryId) ?? []), task]);
  }

  return [...map.entries()]
    .sort(([left], [right]) => compareCategory(left, right))
    .map(([categoryId, items]) => ({
      id: categoryId,
      label: titleCaseCategory(categoryId) || 'Uncategorized',
      dimension: 'category' as const,
      items,
    })) as Cluster[];
};

const buildClusters = (tasks: TaskItem[], chain: SortChain): Cluster[] => {
  const primary = chain[0];
  const comparator = buildComparator([chain[1], chain[2]]);
  const grouped =
    primary === 'date'
      ? buildDateClusters(tasks)
      : primary === 'priority'
        ? buildPriorityClusters(tasks)
        : buildCategoryClusters(tasks);

  return grouped.map((cluster) => ({
    ...cluster,
    items: [...cluster.items].sort(comparator),
  }));
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
}

const TaskRow = ({
  task,
  status,
  onAddSubtask,
  onToggleStatus,
  onUpdateTaskStatus,
  onUpdateTaskPriority,
  onUpdateTaskDueDate,
  onUpdateTaskCategory,
  onDeleteTask,
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
  const hasMenuActions = Boolean(onUpdateTaskPriority || onUpdateTaskDueDate || onUpdateTaskCategory || onUpdateTaskStatus || onDeleteTask);
  const priorityTone = getPriorityTone(task.priorityValue, task.priority);
  const priorityClasses = getPriorityClasses(priorityTone);

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
    <div className="group relative rounded-control border border-border-muted bg-surface px-2 py-1.5 hover:bg-surface-elevated focus-within:bg-surface-elevated">
      <span
        className={cn('absolute bottom-0 left-0 top-0 w-[3px] rounded-l-control', priorityTone ? priorityClasses.dot : 'bg-border-muted')}
        aria-hidden="true"
      />

      <div className="flex items-center gap-2 pl-1">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            if (!onToggleStatus || status === 'cancelled') {
              return;
            }
            onToggleStatus(task.id, getNextStatus(status));
          }}
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-50',
            status === 'done' && 'text-primary',
            status === 'cancelled' && 'text-danger',
          )}
          aria-label={status === 'cancelled' ? `${task.label} is cancelled. Use actions to reopen.` : `Advance ${task.label} from ${STATUS_LABELS[status]}`}
          disabled={!onToggleStatus || status === 'cancelled'}
        >
          <span aria-hidden="true">{STATUS_SYMBOLS[status]}</span>
        </button>

        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          disabled={!taskHasSubtasks}
          className="flex min-w-0 flex-1 items-center gap-2 text-left disabled:cursor-default"
        >
          <span className="min-w-0 flex-1 truncate text-sm text-text">
            <span className={cn(status === 'cancelled' && 'line-through text-text-secondary')}>{task.label}</span>
          </span>
          {visibleSubtaskCount > 0 ? (
            <span className={cn('shrink-0 rounded-control border px-1.5 py-0.5 text-[10px] font-semibold', priorityClasses.text, priorityClasses.border, priorityClasses.tint)}>
              {visibleSubtaskCount}
            </span>
          ) : null}
          <span className="shrink-0 text-xs text-text-secondary">{task.dueLabel}</span>
          {taskHasSubtasks ? <span className={cn('text-[10px] text-muted transition-transform', expanded && 'rotate-90')}>▶</span> : null}
        </button>

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

          {hasMenuActions ? (
            <div className="relative">
              <button
                ref={triggerRef}
                type="button"
                aria-haspopup="menu"
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

              {menuOpen ? (
                <div
                  ref={menuRef}
                  role="menu"
                  tabIndex={-1}
                  aria-label={`Task actions for ${task.label}`}
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={handleMenuKeyDown}
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
                                role="menuitem"
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
                            role="menuitem"
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
                          role="menuitem"
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
                          role="menuitem"
                          data-menu-item="true"
                          onClick={handleArchiveClick}
                          className="rounded-control px-2 py-1 text-left text-sm text-danger hover:bg-danger-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                        >
                          {confirmArchive ? 'Confirm archive?' : 'Archive task'}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {expanded && taskHasSubtasks ? (
        <ul className="mt-2 space-y-1">
          {task.subtasks.map((subtask) => (
            <SubtaskTree key={subtask.id} subtask={subtask} parentPriority={task.priority} level={1} visitedIds={EMPTY_VISITED_IDS} />
          ))}
        </ul>
      ) : null}
    </div>
  );
};

export const TasksTab = ({
  tasks,
  collaborators,
  categories,
  activeUserId,
  activeCategoryId,
  sortChain,
  onSortChainChange,
  onUserChange,
  onCategoryChange,
  onAddSubtask,
  onUpdateTaskStatus,
  onUpdateTaskPriority,
  onUpdateTaskDueDate,
  onUpdateTaskCategory,
  onDeleteTask,
  showSortControls = true,
}: TasksTabProps) => {
  const [collapsedClusterIds, setCollapsedClusterIds] = useState<Set<string>>(new Set());
  const [optimisticStatus, setOptimisticStatus] = useState<{ taskKey: string; entries: Record<string, TaskStatus> }>({
    taskKey: '',
    entries: {},
  });
  const taskKey = useMemo(
    () =>
      JSON.stringify(
        tasks.map((task) => [
          task.id,
          task.status,
          task.priorityValue,
          task.dueAt,
          task.categoryId,
          task.subtaskCount ?? task.subtasks.length,
          task.label,
        ]),
      ),
    [tasks],
  );

  const filteredTasks = useMemo(
    () => tasks.filter((task) => (activeUserId === 'all' || task.assigneeId === activeUserId) && (activeCategoryId === 'all' || task.categoryId === activeCategoryId)),
    [activeCategoryId, activeUserId, tasks],
  );

  const clusters = useMemo(() => buildClusters(filteredTasks, sortChain), [filteredTasks, sortChain]);

  const toggleStatus = (taskId: string, status: TaskStatus) => {
    if (!onUpdateTaskStatus) {
      return;
    }

    setOptimisticStatus((current) => ({
      taskKey,
      entries: {
        ...(current.taskKey === taskKey ? current.entries : {}),
        [taskId]: status,
      },
    }));

    try {
      const mutation = onUpdateTaskStatus(taskId, status);
      void Promise.resolve(mutation).catch(() => {
        setOptimisticStatus((current) => {
          const next = { ...(current.taskKey === taskKey ? current.entries : {}) };
          delete next[taskId];
          return {
            taskKey,
            entries: next,
          };
        });
      });
    } catch (error) {
      setOptimisticStatus((current) => {
        const next = { ...(current.taskKey === taskKey ? current.entries : {}) };
        delete next[taskId];
        return {
          taskKey,
          entries: next,
        };
      });
      throw error;
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {showSortControls ? (
          <>
            <fieldset className="flex flex-wrap items-center gap-2">
              <legend className="text-xs text-muted">Group by</legend>
              {SORT_DIMENSIONS.map((dimension) => {
                const active = sortChain[0] === dimension;
                return (
                  <label
                    key={dimension}
                    className={cn(
                      'inline-flex cursor-pointer items-center rounded-control border px-2 py-1.5 text-xs transition-colors focus-within:ring-2 focus-within:ring-focus-ring',
                      active ? 'border-primary bg-primary/10 text-primary' : 'border-subtle bg-surface text-muted hover:text-text',
                    )}
                  >
                    <input
                      type="radio"
                      name="tasks-group-by"
                      value={dimension}
                      checked={active}
                      onChange={() => onSortChainChange(promoteDimension(sortChain, dimension))}
                      className="sr-only"
                    />
                    {GROUP_BY_LABELS[dimension]}
                  </label>
                );
              })}
            </fieldset>

            <span className="mx-1 h-4 w-px bg-border-subtle" aria-hidden="true" />
          </>
        ) : null}

        {collaborators.map((collaborator) => (
          <button
            key={collaborator.id}
            type="button"
            aria-pressed={activeUserId === collaborator.id}
            onClick={() => onUserChange(collaborator.id)}
            className={cn(
              'rounded-control border px-2 py-1.5 text-xs transition-colors',
              activeUserId === collaborator.id ? 'border-primary bg-primary/10 text-primary' : 'border-subtle bg-surface text-muted hover:text-text',
            )}
          >
            {collaborator.label}
          </button>
        ))}

        <span className="mx-1 h-4 w-px bg-border-subtle" aria-hidden="true" />

        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            aria-pressed={activeCategoryId === category.id}
            onClick={() => onCategoryChange(category.id)}
            className={cn(
              'rounded-control border px-2 py-1.5 text-xs transition-colors',
              activeCategoryId === category.id ? 'border-primary bg-primary/10 text-primary' : 'border-subtle bg-surface text-muted hover:text-text',
            )}
          >
            {category.label}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {clusters.map((cluster, clusterIndex) => {
          const collapsed = collapsedClusterIds.has(cluster.id);
          const itemCount = cluster.items.length;
          const clusterLabel = `${cluster.label}, ${itemCount} ${itemCount === 1 ? 'item' : 'items'}`;
          const clusterDomId = `task-cluster-${cluster.dimension}-${clusterIndex}`;
          const clusterHeadingId = `${clusterDomId}-heading`;
          const clusterListId = `${clusterDomId}-list`;
          const accentClass =
            cluster.dimension === 'priority' && cluster.priorityKey
              ? getPriorityClasses(cluster.priorityKey).dot
              : cluster.dimension === 'category'
                ? 'bg-primary'
                : 'bg-muted';

          return (
            <section key={cluster.id} aria-label={clusterLabel}>
              <h3 id={clusterHeadingId}>
                <button
                  type="button"
                  aria-expanded={!collapsed}
                  aria-controls={clusterListId}
                  onClick={() => {
                    setCollapsedClusterIds((current) => {
                      const next = new Set(current);
                      if (next.has(cluster.id)) {
                        next.delete(cluster.id);
                      } else {
                        next.add(cluster.id);
                      }
                      return next;
                    });
                  }}
                  className="flex w-full items-center gap-2 rounded-control px-1.5 py-1.5 text-left"
                >
                  <span className={cn('h-0.5 w-3 rounded-sm', accentClass)} aria-hidden="true" />
                  <span className="flex-1 text-xs font-bold uppercase tracking-wide text-muted">{cluster.label}</span>
                  <span className="rounded-control border border-subtle bg-surface px-1.5 py-0.5 text-[10px] text-muted">
                    {itemCount}
                  </span>
                  <span className={cn('text-[10px] text-muted transition-transform', !collapsed && 'rotate-90')}>▶</span>
                </button>
              </h3>

              <ul id={clusterListId} aria-labelledby={clusterHeadingId} hidden={collapsed} className="mt-1 space-y-1">
                {cluster.items.map((task) => (
                  <li key={task.id}>
                    <TaskRow
                      task={task}
                      status={(optimisticStatus.taskKey === taskKey ? optimisticStatus.entries[task.id] : undefined) ?? task.status}
                      onAddSubtask={onAddSubtask}
                      onToggleStatus={toggleStatus}
                      onUpdateTaskStatus={onUpdateTaskStatus}
                      onUpdateTaskPriority={onUpdateTaskPriority}
                      onUpdateTaskDueDate={onUpdateTaskDueDate}
                      onUpdateTaskCategory={onUpdateTaskCategory}
                      onDeleteTask={onDeleteTask}
                    />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
};
