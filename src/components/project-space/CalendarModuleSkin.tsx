import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ModuleEmptyState, ModuleLoadingState } from './ModuleFeedback';
import { cn } from '../../lib/cn';

export type CalendarScope = 'relevant' | 'all';
type CalendarView = 'month' | 'year' | 'week' | 'day';

interface CalendarEventSummary {
  record_id: string;
  title: string;
  event_state: {
    start_dt: string;
    end_dt: string;
    timezone: string;
    location: string | null;
    updated_at: string;
  };
  participants: Array<{ user_id: string; role: string | null }>;
}

interface CalendarModuleSkinProps {
  events: CalendarEventSummary[];
  loading: boolean;
  scope: CalendarScope;
  onScopeChange: (scope: CalendarScope) => void;
  onCreateEvent?: (payload: {
    title: string;
    start_dt: string;
    end_dt: string;
    timezone: string;
    location?: string;
  }) => Promise<void>;
  onOpenRecord: (recordId: string) => void;
}

interface DayCell {
  iso: string;
  day: number;
  currentMonth: boolean;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const OVERFLOW_LIMIT = 3;

const asDateLabel = (date: Date): string =>
  date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

const toLocalDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const fromLocalDateKey = (key: string): Date => {
  const [year, month, day] = key.split('-').map((part) => Number.parseInt(part, 10));
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return new Date(key);
  }
  return new Date(year, month - 1, day);
};

const toDateKey = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return toLocalDateKey(date);
};

const formatEventTime = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
};

const buildMonthCells = (monthCursor: Date): DayCell[] => {
  const year = monthCursor.getFullYear();
  const month = monthCursor.getMonth();
  const firstDay = new Date(year, month, 1);
  const firstWeekday = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const previousMonthDays = new Date(year, month, 0).getDate();
  const cells: DayCell[] = [];

  for (let i = firstWeekday - 1; i >= 0; i -= 1) {
    const day = previousMonthDays - i;
    const date = new Date(year, month - 1, day);
    cells.push({ iso: toLocalDateKey(date), day, currentMonth: false });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day);
    cells.push({ iso: toLocalDateKey(date), day, currentMonth: true });
  }

  while (cells.length < 42) {
    const day = cells.length - (firstWeekday + daysInMonth) + 1;
    const date = new Date(year, month + 1, day);
    cells.push({ iso: toLocalDateKey(date), day, currentMonth: false });
  }

  return cells;
};

export const CalendarModuleSkin = ({
  events,
  loading,
  scope,
  onScopeChange,
  onCreateEvent,
  onOpenRecord,
}: CalendarModuleSkinProps) => {
  const [view, setView] = useState<CalendarView>('month');
  const [monthCursor, setMonthCursor] = useState(() => new Date());
  const [overflowDay, setOverflowDay] = useState<string | null>(null);
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [draftDay, setDraftDay] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftStartTime, setDraftStartTime] = useState('09:00');
  const [draftEndTime, setDraftEndTime] = useState('10:00');
  const overflowPopoverRef = useRef<HTMLDivElement | null>(null);
  const overflowTriggerRef = useRef<HTMLButtonElement | null>(null);

  const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
  const monthLabel = monthCursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const todayKey = toLocalDateKey(new Date());
  const openCreatePanel = (day: string) => {
    setDraftDay(day);
    setOverflowDay(null);
    setCreateError(null);
  };
  const resetCreateDraft = () => {
    setDraftDay(null);
    setDraftTitle('');
    setDraftStartTime('09:00');
    setDraftEndTime('10:00');
    setCreateError(null);
  };
  const closeOverflowDay = useCallback((restoreFocus = true) => {
    setOverflowDay(null);
    if (restoreFocus) {
      window.setTimeout(() => {
        if (overflowTriggerRef.current?.isConnected) {
          overflowTriggerRef.current.focus();
        }
      }, 0);
    }
  }, []);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEventSummary[]>();
    for (const event of events) {
      const key = toDateKey(event.event_state.start_dt);
      if (!key) {
        continue;
      }
      map.set(key, [...(map.get(key) ?? []), event]);
    }
    return map;
  }, [events]);

  const monthCells = useMemo(() => buildMonthCells(monthCursor), [monthCursor]);

  useEffect(() => {
    if (!overflowDay) {
      return;
    }

    const focusTimer = window.setTimeout(() => {
      const focusTarget = overflowPopoverRef.current?.querySelector<HTMLElement>('button:not([disabled])');
      if (focusTarget?.isConnected) {
        focusTarget.focus();
      }
    }, 0);

    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (overflowPopoverRef.current?.contains(target) || overflowTriggerRef.current?.contains(target)) {
        return;
      }
      closeOverflowDay(true);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeOverflowDay(true);
      }
    };

    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [closeOverflowDay, overflowDay]);

  const createEventPanel =
    draftDay && onCreateEvent ? (
      <section className="space-y-3 rounded-panel border border-subtle bg-surface-elevated p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-text">{asDateLabel(fromLocalDateKey(draftDay))}</h3>
        </div>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Event title
          <input
            autoFocus
            type="text"
            value={draftTitle}
            onChange={(event) => setDraftTitle(event.target.value)}
            disabled={isCreatingEvent}
            className="rounded-control border border-border-muted bg-surface px-3 py-2 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            placeholder="New event"
          />
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-muted">
            Start time
            <input
              type="time"
              value={draftStartTime}
              onChange={(event) => setDraftStartTime(event.target.value)}
              disabled={isCreatingEvent}
              className="rounded-control border border-border-muted bg-surface px-3 py-2 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            End time
            <input
              type="time"
              value={draftEndTime}
              onChange={(event) => setDraftEndTime(event.target.value)}
              disabled={isCreatingEvent}
              className="rounded-control border border-border-muted bg-surface px-3 py-2 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            />
          </label>
        </div>
        <div aria-live="polite" className="min-h-5 text-xs text-danger">
          {createError || ''}
        </div>
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={resetCreateDraft}
            disabled={isCreatingEvent}
            className="rounded-control border border-border-muted px-3 py-1.5 text-sm text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={draftTitle.trim().length === 0 || isCreatingEvent}
            onClick={async () => {
              if (!onCreateEvent || !draftDay || draftTitle.trim().length === 0) {
                return;
              }

              const startDate = new Date(`${draftDay}T${draftStartTime}:00`);
              const endDate = new Date(`${draftDay}T${draftEndTime}:00`);
              if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate.getTime() <= startDate.getTime()) {
                setCreateError('End time must be after start time.');
                return;
              }

              setCreateError(null);
              setIsCreatingEvent(true);
              try {
                await onCreateEvent({
                  title: draftTitle.trim(),
                  start_dt: startDate.toISOString(),
                  end_dt: endDate.toISOString(),
                  timezone,
                });
                resetCreateDraft();
              } catch (error) {
                setCreateError(error instanceof Error ? error.message : 'Failed to create event.');
              } finally {
                setIsCreatingEvent(false);
              }
            }}
            className="rounded-control border border-primary bg-primary px-3 py-1.5 text-sm font-medium text-on-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isCreatingEvent ? 'Creating...' : 'Create'}
          </button>
        </div>
      </section>
    ) : null;

  if (loading) {
    return <ModuleLoadingState label="Loading calendar" rows={5} />;
  }

  if (events.length === 0) {
    return (
      <div className="space-y-3">
        <ModuleEmptyState
          title={scope === 'relevant' ? 'No relevant events yet.' : 'No project events yet.'}
          description={
            scope === 'relevant'
              ? 'Relevant is showing only your events right now. Switch to All to see the wider project calendar.'
              : 'Create an event to populate this calendar.'
          }
        />
        {onCreateEvent ? (
          <button
            type="button"
            onClick={() => openCreatePanel(todayKey)}
            className="rounded-control border border-primary bg-primary px-3 py-1.5 text-sm font-medium text-on-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            New Event
          </button>
        ) : null}
        {createEventPanel}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
        <div role="group" aria-label="Calendar scope" className="flex items-center gap-0.5">
          {(['relevant', 'all'] as CalendarScope[]).map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={scope === item}
              onClick={() => onScopeChange(item)}
              className={cn(
                'rounded-control border px-2 py-1 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
                scope === item ? 'border-primary bg-primary/10 text-primary' : 'border-subtle bg-surface text-muted',
              )}
            >
              {item[0].toUpperCase() + item.slice(1)}
            </button>
          ))}
        </div>

        <span className="mx-1 h-4 w-px bg-border-subtle" aria-hidden="true" />

        {(['month', 'year', 'week', 'day'] as CalendarView[]).map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={view === item}
            onClick={() => setView(item)}
            className={cn(
              'rounded-control border px-2 py-1 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
              view === item ? 'border-primary bg-primary/10 text-primary' : 'border-subtle bg-surface text-muted',
            )}
          >
            {item[0].toUpperCase() + item.slice(1)}
          </button>
        ))}

        {onCreateEvent ? (
          <button
            type="button"
            onClick={() => {
              setView('month');
              openCreatePanel(todayKey);
            }}
            className="ml-auto shrink-0 rounded-control border border-primary bg-primary px-2 py-1 text-xs font-medium text-on-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            New Event
          </button>
        ) : (
          <button
            type="button"
            disabled
            aria-disabled="true"
            className="ml-auto shrink-0 rounded-control border border-subtle bg-surface px-2 py-1 text-xs text-text-secondary"
            title="Timezone controls are coming soon."
          >
            {timezone}
          </button>
        )}
      </div>

      {view === 'month' ? (
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              className="rounded-control border border-border-muted px-2 py-1 text-xs text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              onClick={() => setMonthCursor((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
              aria-label="Previous month"
            >
              Prev
            </button>
            <p className="text-sm font-semibold text-text">{monthLabel}</p>
            <button
              type="button"
              className="rounded-control border border-border-muted px-2 py-1 text-xs text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              onClick={() => setMonthCursor((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
              aria-label="Next month"
            >
              Next
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {WEEKDAYS.map((weekday) => (
              <div key={weekday} className="py-1 text-center text-[11px] font-medium uppercase tracking-wide text-muted">
                {weekday}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {monthCells.map((cell) => {
              const dayEvents = eventsByDate.get(cell.iso) ?? [];
              const visible = dayEvents.slice(0, OVERFLOW_LIMIT);
              const hiddenCount = dayEvents.length - visible.length;
              const isToday = cell.iso === todayKey;

              return (
                <div
                  key={cell.iso}
                  role="gridcell"
                  aria-label={asDateLabel(fromLocalDateKey(cell.iso))}
                  onClick={onCreateEvent ? () => openCreatePanel(cell.iso) : undefined}
                  onKeyDown={
                    onCreateEvent
                      ? (event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            openCreatePanel(cell.iso);
                          }
                        }
                      : undefined
                  }
                  tabIndex={onCreateEvent ? 0 : undefined}
                  className={cn(
                    'relative min-h-24 rounded-control p-1 shadow-[0_1px_2px_rgb(0_0_0_/_0.12)]',
                    isToday ? 'border border-primary bg-primary/10' : 'border border-transparent bg-surface-elevated',
                    !cell.currentMonth && 'opacity-20',
                    onCreateEvent && 'cursor-pointer',
                  )}
                >
                  <p className="flex justify-end">
                    <span
                      className={cn(
                        'inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[11px]',
                        isToday ? 'bg-primary font-bold text-on-primary' : 'text-muted',
                      )}
                    >
                      {cell.day}
                    </span>
                  </p>
                  <div className="mt-1 space-y-1">
                    {visible.map((event) => {
                      const timeLabel = formatEventTime(event.event_state.start_dt);
                      return (
                        <button
                          key={event.record_id}
                          type="button"
                          className="w-full truncate rounded-control border-l-2 border-primary bg-primary/10 px-1 py-0.5 text-left text-[11px] text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                          onClick={(clickEvent) => {
                            clickEvent.stopPropagation();
                            onOpenRecord(event.record_id);
                          }}
                          aria-label={`${event.title}${timeLabel ? `, ${timeLabel}` : ''}`}
                        >
                          {timeLabel ? <span className="mr-1 text-text-secondary">{timeLabel}</span> : null}
                          {event.title}
                        </button>
                      );
                    })}
                    {hiddenCount > 0 ? (
                      <button
                        ref={overflowDay === cell.iso ? overflowTriggerRef : undefined}
                        type="button"
                        onClick={(clickEvent) => {
                          clickEvent.stopPropagation();
                          overflowTriggerRef.current = clickEvent.currentTarget;
                          setOverflowDay((current) => (current === cell.iso ? null : cell.iso));
                        }}
                        className="text-[11px] text-muted underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                        aria-label={`${hiddenCount} more events on ${asDateLabel(fromLocalDateKey(cell.iso))}. Show all.`}
                      >
                        +{hiddenCount} more
                      </button>
                    ) : null}
                  </div>
                  {overflowDay === cell.iso ? (
                    <div
                      ref={overflowPopoverRef}
                      role="dialog"
                      aria-label="All events this day"
                      className="absolute left-0 top-full z-20 mt-1 w-56 rounded-control border border-border-muted bg-surface-elevated p-2 shadow-soft"
                    >
                      <ul className="space-y-1">
                        {dayEvents.map((event) => {
                          const timeLabel = formatEventTime(event.event_state.start_dt);
                          return (
                            <li key={`${event.record_id}-${event.event_state.start_dt}`}>
                              <button
                                type="button"
                                className="w-full truncate rounded-control px-1 py-1 text-left text-xs text-text hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                                onClick={(clickEvent) => {
                                  clickEvent.stopPropagation();
                                  setOverflowDay(null);
                                  onOpenRecord(event.record_id);
                                }}
                              >
                                {timeLabel ? <span className="mr-1 text-text-secondary">{timeLabel}</span> : null}
                                {event.title}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {view === 'month' ? createEventPanel : null}

      {view === 'year' ? (
        <section className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {Array.from({ length: 12 }, (_, monthIndex) => {
            const label = new Date(monthCursor.getFullYear(), monthIndex, 1).toLocaleDateString(undefined, { month: 'short' });
            const monthEvents = events.filter((event) => {
              const date = new Date(event.event_state.start_dt);
              return date.getFullYear() === monthCursor.getFullYear() && date.getMonth() === monthIndex;
            });

            return (
              <button
                key={label}
                type="button"
                onClick={() => {
                  setMonthCursor(new Date(monthCursor.getFullYear(), monthIndex, 1));
                  setView('month');
                }}
                aria-label={`${label} month, click to view month`}
                className="rounded-control border border-subtle bg-surface px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                <div
                  className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted"
                  style={{ fontFamily: 'var(--font-heading)' }}
                >
                  {label}
                </div>
                <div className="flex min-h-8 flex-wrap content-start gap-1">
                  {monthEvents.slice(0, 16).map((event) => (
                    <span key={`${event.record_id}-${event.event_state.start_dt}`} className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
                  ))}
                </div>
              </button>
            );
          })}
        </section>
      ) : null}

      {view === 'week' || view === 'day' ? (
        <div className="rounded-panel border border-subtle bg-surface p-4 text-sm text-muted">
          {view[0].toUpperCase() + view.slice(1)} view coming soon.
        </div>
      ) : null}
    </div>
  );
};
