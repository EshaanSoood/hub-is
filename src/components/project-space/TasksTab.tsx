import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { cn } from '../../lib/cn';
import { PRIORITY_COLORS, PRIORITY_DOT_COLORS, PRIORITY_TINT_COLORS, type PriorityLevel } from './designTokens';

export type SortDimension = 'date' | 'priority' | 'category';
export type SortChain = [SortDimension, SortDimension, SortDimension];
export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'cancelled';
export type TaskPriorityValue = 'low' | 'medium' | 'high' | 'urgent' | null;

export interface TaskSubtask {
  id: string;
  label: string;
  dueLabel: string;
  priority: PriorityLevel | null;
}

export interface TaskItem {
  id: string;
  label: string;
  dueAt: string | null;
  dueLabel: string;
  categoryId: string;
  categoryValue: string | null;
  assigneeId: string;
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
}

const SORT_DIMENSIONS: SortDimension[] = ['date', 'priority', 'category'];
const SORT_LABELS: Record<SortDimension, string> = {
  date: 'Date',
  priority: 'Priority',
  category: 'Category',
};
const POSITION_LABELS = ['primary', 'secondary', 'tertiary'] as const;
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

const moveDimension = (chain: SortChain, fromIndex: number, toIndex: number): SortChain => {
  if (fromIndex === toIndex || fromIndex < 0 || fromIndex > 2 || toIndex < 0 || toIndex > 2) {
    return chain;
  }
  const next = [...chain];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next as SortChain;
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
  const today = startOfDay(new Date());
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

    const dueDay = startOfDay(due);
    const diff = Math.floor((dueDay.getTime() - today.getTime()) / 86_400_000);

    if (diff < 0) {
      groups.overdue.push(task);
    } else if (diff === 0) {
      groups.today.push(task);
    } else if (diff <= 7) {
      groups.thisWeek.push(task);
    } else {
      groups.later.push(task);
    }
  }

  const clusters: Cluster[] = [
    { id: 'overdue', label: 'Overdue', dimension: 'date', items: groups.overdue },
    { id: 'today', label: 'Today', dimension: 'date', items: groups.today },
    { id: 'thisWeek', label: 'This Week', dimension: 'date', items: groups.thisWeek },
    { id: 'later', label: 'Later', dimension: 'date', items: groups.later },
  ];

  return clusters.filter((cluster) => cluster.items.length > 0);
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

const getPriorityChipStyles = (priorityValue: TaskPriorityValue, fallbackPriority: PriorityLevel) => {
  const tone = getPriorityTone(priorityValue, fallbackPriority);
  if (!tone) {
    return {
      color: 'var(--color-text-secondary)',
      borderColor: 'var(--color-border-muted)',
      backgroundColor: 'var(--color-surface)',
    };
  }
  return {
    color: PRIORITY_COLORS[tone],
    borderColor: PRIORITY_COLORS[tone],
    backgroundColor: PRIORITY_TINT_COLORS[tone],
  };
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

const SubtaskRow = ({ subtask, parentPriority }: { subtask: TaskSubtask; parentPriority: PriorityLevel }) => {
  const resolvedPriority = subtask.priority ?? parentPriority;
  return (
    <li className="flex items-center gap-2 pl-5 text-xs text-muted">
      <span
        className={cn('h-1.5 w-1.5 rounded-full', !subtask.priority && 'opacity-50')}
        style={{ backgroundColor: PRIORITY_DOT_COLORS[resolvedPriority] }}
        aria-hidden="true"
      />
      <span className="flex-1">{subtask.label}</span>
      <span className="opacity-70">{subtask.dueLabel}</span>
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
  const priorityTone = getPriorityTone(task.priorityValue, task.priority);
  const priorityChipStyles = getPriorityChipStyles(task.priorityValue, task.priority);

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
    <div className="group rounded-control px-1 py-0.5 hover:bg-elevated focus-within:bg-elevated">
      <div className="flex items-center gap-2">
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
          <span
            className={cn('h-7 w-0.5 rounded-sm', priorityTone ? '' : 'opacity-60')}
            style={{ backgroundColor: priorityTone ? PRIORITY_DOT_COLORS[priorityTone] : 'var(--color-border-muted)' }}
            aria-hidden="true"
          />
          <span className={cn('min-w-0 flex-1 truncate text-sm text-text', status === 'cancelled' && 'line-through text-text-secondary')}>
            {task.label}
          </span>
          <span className="shrink-0 text-xs text-text-secondary">{task.dueLabel}</span>
          {visibleSubtaskCount > 0 ? (
            <span className="shrink-0 rounded-control border px-1.5 py-0.5 text-[10px] font-semibold" style={priorityChipStyles}>
              {visibleSubtaskCount}
            </span>
          ) : null}
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
                  <div>
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-muted">Priority</p>
                    <div className="flex flex-wrap gap-1.5">
                      {PRIORITY_MENU_OPTIONS.map((option) => {
                        const optionStyles = option.tone
                          ? {
                              color: PRIORITY_COLORS[option.tone],
                              borderColor: PRIORITY_COLORS[option.tone],
                              backgroundColor: PRIORITY_TINT_COLORS[option.tone],
                            }
                          : {
                              color: 'var(--color-text-secondary)',
                              borderColor: 'var(--color-border-muted)',
                              backgroundColor: 'var(--color-surface-elevated)',
                            };
                        const active = task.priorityValue === option.value;
                        return (
                          <button
                            key={option.label}
                            type="button"
                            role="menuitem"
                            data-menu-item="true"
                            onClick={() => runMenuAction(() => onUpdateTaskPriority?.(task.id, option.value))}
                            className={cn(
                              'rounded-control border px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
                              active && 'font-semibold',
                            )}
                            style={optionStyles}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-muted">Due date</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={toDateInputValue(task.dueAt)}
                        onChange={(event) => {
                          runMenuAction(() => onUpdateTaskDueDate?.(task.id, fromDateInputValue(event.target.value)));
                        }}
                        onClick={(event) => event.stopPropagation()}
                        className="min-w-0 flex-1 rounded-control border border-border-muted bg-surface-elevated px-2 py-1 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                      />
                      <button
                        type="button"
                        role="menuitem"
                        data-menu-item="true"
                        onClick={() => runMenuAction(() => onUpdateTaskDueDate?.(task.id, null))}
                        className="rounded-control border border-border-muted px-2 py-1 text-xs text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

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

                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      role="menuitem"
                      data-menu-item="true"
                      onClick={() =>
                        runMenuAction(() => onUpdateTaskStatus?.(task.id, status === 'cancelled' ? 'todo' : 'cancelled'))
                      }
                      className="rounded-control px-2 py-1 text-left text-sm text-text hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                    >
                      {status === 'cancelled' ? 'Reopen' : 'Mark as cancelled'}
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      data-menu-item="true"
                      onClick={handleArchiveClick}
                      disabled={!onDeleteTask}
                      className="rounded-control px-2 py-1 text-left text-sm text-danger hover:bg-danger-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {confirmArchive ? 'Confirm archive?' : 'Archive task'}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {expanded && taskHasSubtasks ? (
        <ul className="mt-1 space-y-1">
          {task.subtasks.map((subtask) => (
            <SubtaskRow key={subtask.id} subtask={subtask} parentPriority={task.priority} />
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
}: TasksTabProps) => {
  const [collapsedClusterIds, setCollapsedClusterIds] = useState<Set<string>>(new Set());
  const [optimisticStatus, setOptimisticStatus] = useState<{ taskKey: string; entries: Record<string, TaskStatus> }>({
    taskKey: '',
    entries: {},
  });
  const dragIndexRef = useRef<number | null>(null);
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
        <span className="text-xs text-muted">Sort by</span>
        <div role="listbox" aria-label="Sort order" className="flex flex-wrap items-center gap-2">
          {SORT_DIMENSIONS.map((dimension) => {
            const position = sortChain.indexOf(dimension);
            const positionLabel = POSITION_LABELS[position];
            return (
              <button
                key={dimension}
                type="button"
                role="option"
                aria-selected={position === 0}
                aria-roledescription="sortable"
                aria-label={`${SORT_LABELS[dimension]} — ${positionLabel} sort`}
                draggable="true"
                onClick={() => {
                  onSortChainChange(promoteDimension(sortChain, dimension));
                }}
                onDragStart={() => {
                  dragIndexRef.current = position;
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                }}
                onDrop={() => {
                  const fromIndex = dragIndexRef.current;
                  dragIndexRef.current = null;
                  if (fromIndex === null) {
                    return;
                  }
                  onSortChainChange(moveDimension(sortChain, fromIndex, position));
                }}
                onDragEnd={() => {
                  dragIndexRef.current = null;
                }}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowLeft') {
                    event.preventDefault();
                    onSortChainChange(moveDimension(sortChain, position, position - 1));
                    return;
                  }
                  if (event.key === 'ArrowRight') {
                    event.preventDefault();
                    onSortChainChange(moveDimension(sortChain, position, position + 1));
                    return;
                  }
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSortChainChange(promoteDimension(sortChain, dimension));
                  }
                }}
                className={cn(
                  'rounded-control border px-2 py-1 text-xs transition-all duration-300 ease-in-out',
                  position === 0 ? 'border-primary bg-primary/10 text-primary' : 'border-subtle bg-surface text-muted hover:text-text',
                )}
                style={{ order: position }}
              >
                {SORT_LABELS[dimension]}
              </button>
            );
          })}
        </div>

        <span className="mx-1 h-4 w-px bg-border-subtle" aria-hidden="true" />

        {collaborators.map((collaborator) => (
          <button
            key={collaborator.id}
            type="button"
            aria-pressed={activeUserId === collaborator.id}
            onClick={() => onUserChange(collaborator.id)}
            className={cn(
              'rounded-control border px-2 py-1 text-xs transition-colors',
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
              'rounded-control border px-2 py-1 text-xs transition-colors',
              activeCategoryId === category.id ? 'border-primary bg-primary/10 text-primary' : 'border-subtle bg-surface text-muted hover:text-text',
            )}
          >
            {category.label}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {clusters.map((cluster) => {
          const collapsed = collapsedClusterIds.has(cluster.id);
          const accent =
            cluster.dimension === 'priority' && cluster.priorityKey
              ? PRIORITY_DOT_COLORS[cluster.priorityKey]
              : cluster.dimension === 'category'
                ? 'var(--color-info)'
                : 'var(--color-muted)';

          return (
            <section key={cluster.id}>
              <button
                type="button"
                aria-expanded={!collapsed}
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
                className="flex w-full items-center gap-2 rounded-control px-1 py-1 text-left"
              >
                <span className="h-0.5 w-3 rounded-sm" style={{ backgroundColor: accent }} aria-hidden="true" />
                <span className="flex-1 text-xs font-bold uppercase tracking-wide text-muted">{cluster.label}</span>
                <span className="rounded-control border border-subtle bg-surface px-1.5 py-0.5 text-[10px] text-muted">
                  {cluster.items.length}
                </span>
                <span className={cn('text-[10px] text-muted transition-transform', collapsed && '-rotate-90')}>▶</span>
              </button>

              {!collapsed ? (
                <div className="mt-1 space-y-1">
                  {cluster.items.map((task) => (
                    <TaskRow
                      key={task.id}
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
                  ))}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
};
