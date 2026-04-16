import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { cn } from '../../../lib/cn';
import { AnimatedSurface } from '../../motion/AnimatedSurface';
import { CalendarDayView } from '../CalendarDayView';
import { CalendarWeekView } from '../CalendarWeekView';
import { ModuleEmptyState } from '../ModuleFeedback';
import type {
  CalendarCreatePanelPrefill,
  CalendarEventSummary,
  CalendarScope,
  CalendarView,
  CreateCalendarEventPayload,
  RescheduleCalendarEventPayload,
} from './types';
import {
  OVERFLOW_LIMIT,
  WEEKDAYS,
  asDateLabel,
  buildMonthCells,
  formatEventTime,
  fromLocalDateKey,
  toTimeInputValue,
  toLocalDateKey,
} from './utils';

interface CalendarLargeViewProps {
  events: CalendarEventSummary[];
  sizeTier?: 'S' | 'M' | 'L';
  scope: CalendarScope;
  onScopeChange: (scope: CalendarScope) => void;
  view: CalendarView;
  setView: (view: CalendarView) => void;
  monthCursor: Date;
  setMonthCursor: (next: Date | ((current: Date) => Date)) => void;
  onCreateEvent?: (payload: CreateCalendarEventPayload) => Promise<void>;
  onRescheduleEvent?: (payload: RescheduleCalendarEventPayload) => Promise<void>;
  onOpenRecord: (recordId: string) => void;
  eventsByDate: Map<string, CalendarEventSummary[]>;
  selectedDate: Date;
  todayDate: Date;
  todayKey: string;
  openCreatePanel: (day: string, prefill?: CalendarCreatePanelPrefill) => void;
  createPanel: ReactNode;
}

export const CalendarLargeView = ({
  events,
  sizeTier,
  scope,
  onScopeChange,
  view,
  setView,
  monthCursor,
  setMonthCursor,
  onCreateEvent,
  onRescheduleEvent,
  onOpenRecord,
  eventsByDate,
  selectedDate,
  todayDate,
  todayKey,
  openCreatePanel,
  createPanel,
}: CalendarLargeViewProps) => {
  const [overflowDay, setOverflowDay] = useState<string | null>(null);
  const [overflowPopoverMounted, setOverflowPopoverMounted] = useState(false);
  const overflowPopoverRef = useRef<HTMLDivElement | null>(null);
  const overflowTriggerRef = useRef<HTMLButtonElement | null>(null);

  const setOverflowPopoverNode = useCallback((node: HTMLDivElement | null) => {
    overflowPopoverRef.current = node;
    setOverflowPopoverMounted(Boolean(node));
  }, []);

  const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
  const monthLabel = monthCursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const dayViewDate = selectedDate;
  const weekViewToday = todayDate;

  const dayViewEvents = useMemo(() => {
    const dayKey = toLocalDateKey(dayViewDate);
    return eventsByDate.get(dayKey) ?? [];
  }, [dayViewDate, eventsByDate]);

  const monthCells = useMemo(() => buildMonthCells(monthCursor), [monthCursor]);

  const closeOverflowDay = useCallback((restoreFocus = true) => {
    const overflowTrigger = overflowTriggerRef.current;
    setOverflowDay(null);
    if (restoreFocus) {
      window.setTimeout(() => {
        if (overflowTrigger?.isConnected) {
          overflowTrigger.focus();
        }
      }, 0);
    }
  }, []);

  useEffect(() => {
    if (!overflowDay || !overflowPopoverMounted) {
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
      closeOverflowDay(false);
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
  }, [closeOverflowDay, overflowDay, overflowPopoverMounted]);

  const openCreatePanelAndCloseOverflow = useCallback(
    (day: string, prefill?: CalendarCreatePanelPrefill) => {
      setOverflowDay(null);
      openCreatePanel(day, prefill);
    },
    [openCreatePanel],
  );

  if (events.length === 0) {
    return (
      <div className="flex h-full min-h-0 flex-col gap-3">
        <ModuleEmptyState
          iconName="calendar"
          title={scope === 'relevant' ? 'No relevant events yet.' : 'No project events yet.'}
          description={
            scope === 'relevant'
              ? 'Relevant is showing only your events right now. Switch to All to see the wider project calendar.'
              : 'Create an event to populate this calendar.'
          }
          ctaLabel={scope === 'relevant' ? 'Show All' : onCreateEvent ? 'New Event' : undefined}
          onCta={
            scope === 'relevant'
              ? () => onScopeChange('all')
              : onCreateEvent
                ? () => openCreatePanelAndCloseOverflow(todayKey)
                : undefined
          }
          sizeTier={sizeTier}
        />
        {createPanel}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
        <div role="group" aria-label="Calendar scope" className="flex items-center gap-0.5">
          {(['relevant', 'all'] as CalendarScope[]).map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={scope === item}
              onClick={() => onScopeChange(item)}
              className={cn(
                'rounded-control border px-2.5 py-1.5 text-xs font-medium leading-[1.2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
                scope === item ? 'border-primary bg-primary/10 text-primary' : 'border-subtle bg-surface text-muted',
              )}
            >
              {item[0].toUpperCase() + item.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
        <span className="mx-1 h-4 w-px bg-border-subtle" aria-hidden="true" />

        {(['month', 'year', 'week', 'day'] as CalendarView[]).map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={view === item}
            onClick={() => setView(item)}
            className={cn(
              'rounded-control border px-2.5 py-1.5 text-xs font-medium leading-[1.2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
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
              openCreatePanelAndCloseOverflow(todayKey);
            }}
            className="interactive interactive-fold ml-auto shrink-0 rounded-control border border-primary bg-primary px-2.5 py-1.5 text-xs font-medium leading-[1.2] text-on-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            New Event
          </button>
        ) : (
          <button
            type="button"
            disabled
            aria-disabled="true"
            className="ml-auto shrink-0 rounded-control border border-subtle bg-surface px-2.5 py-1.5 text-xs leading-[1.2] text-text-secondary"
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
                  onClick={onCreateEvent ? () => openCreatePanelAndCloseOverflow(cell.iso) : undefined}
                  onKeyDown={
                    onCreateEvent
                      ? (event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            openCreatePanelAndCloseOverflow(cell.iso);
                          }
                        }
                      : undefined
                  }
                  tabIndex={onCreateEvent ? 0 : undefined}
                  className={cn(
                    'relative min-h-16 rounded-control p-1 shadow-[0_1px_2px_rgb(0_0_0_/_0.12)]',
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
                  <AnimatePresence>
                    {overflowDay === cell.iso ? (
                      <AnimatedSurface
                        ref={setOverflowPopoverNode}
                        role="dialog"
                        ariaLabel="All events this day"
                        transformOrigin="top left"
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
                      </AnimatedSurface>
                    ) : null}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {createPanel}

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
                  className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted [font-family:var(--font-heading)]"
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

      {view === 'day' ? (
        <CalendarDayView
          events={dayViewEvents}
          date={dayViewDate}
          onOpenRecord={onOpenRecord}
          onRescheduleEvent={onRescheduleEvent}
          onCreateEvent={
            onCreateEvent
              ? (payload) => {
                  const startDate = new Date(payload.start_dt);
                  const nextDayKey = Number.isNaN(startDate.getTime())
                    ? todayKey
                    : toLocalDateKey(startDate);
                  openCreatePanelAndCloseOverflow(nextDayKey, {
                    title: payload.title,
                    startTime: toTimeInputValue(payload.start_dt, '09:00'),
                    endTime: toTimeInputValue(payload.end_dt, '10:00'),
                  });
                }
              : undefined
          }
        />
      ) : null}

      {view === 'week' ? (
        <CalendarWeekView
          events={events}
          today={weekViewToday}
          onOpenRecord={onOpenRecord}
          onCreateEvent={
            onCreateEvent
              ? (payload) => {
                  const startDate = new Date(payload.start_dt);
                  const nextDayKey = Number.isNaN(startDate.getTime())
                    ? todayKey
                    : toLocalDateKey(startDate);
                  openCreatePanelAndCloseOverflow(nextDayKey, {
                    title: payload.title,
                    startTime: toTimeInputValue(payload.start_dt, '09:00'),
                    endTime: toTimeInputValue(payload.end_dt, '10:00'),
                  });
                }
              : undefined
          }
        />
      ) : null}
    </div>
  );
};
