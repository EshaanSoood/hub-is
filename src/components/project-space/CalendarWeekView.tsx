import { useEffect, useMemo, useRef, useState } from 'react';
import { EventRecordSummary } from './record-primitives/EventRecordSummary';
import type { CalendarDayEvent } from './CalendarDayView';
import { cn } from '../../lib/cn';

interface CreateEventPrefillPayload {
  title: string;
  start_dt: string;
  end_dt: string;
  timezone: string;
  location?: string;
}

interface CalendarWeekViewProps {
  events: CalendarDayEvent[];
  onOpenRecord: (recordId: string) => void;
  onCreateEvent?: (payload: CreateEventPrefillPayload) => void | Promise<void>;
  today?: Date;
}

interface WeekDayEntry {
  key: string;
  date: Date;
  dayName: string;
  dateNumber: string;
  offsetFromToday: -3 | -2 | -1 | 0 | 1 | 2 | 3;
  isToday: boolean;
  events: CalendarDayEvent[];
}

const startOfLocalDay = (date: Date): Date => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const toLocalDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseIsoDate = (value: string): Date | null => {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
};

const addDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const formatTimeLabel = (value: string): string => {
  const parsed = parseIsoDate(value);
  if (!parsed) {
    return '';
  }
  return parsed.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

const eventPipColorClassName = (event: CalendarDayEvent): string => {
  if (event.item_kind === 'task') {
    return 'bg-[color:var(--color-primary-strong)]';
  }
  if (event.item_kind === 'reminder') {
    return 'bg-[color:var(--color-capture-rail)]';
  }
  return 'bg-[color:var(--color-primary)]';
};

const extractProjectLabel = (event: CalendarDayEvent): string =>
  event.project_name || event.source_pane?.pane_name || 'Calendar';

const formatWeekRangeLabel = (start: Date, end: Date): string => {
  const left = start.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
  const right = end.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
  return `Week view, ${left} to ${right}`;
};

const formatDayCardLabel = (day: WeekDayEntry): string => {
  const fullDate = day.date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  const count = day.events.length;
  const noun = count === 1 ? 'event' : 'events';
  const dayLabel = day.isToday ? `Today, ${fullDate}` : fullDate;
  return `${dayLabel}, ${count} ${noun}`;
};

const formatEventAriaLabel = (event: CalendarDayEvent): string => {
  const startLabel = formatTimeLabel(event.event_state.start_dt);
  const endLabel = formatTimeLabel(event.event_state.end_dt);
  const timeLabel = startLabel && endLabel ? `${startLabel} to ${endLabel}` : startLabel || endLabel || 'unscheduled';
  return `Event: ${event.title}, ${timeLabel}`;
};

const createAtNinePayload = (dayDate: Date, timezone: string): CreateEventPrefillPayload => {
  const start = startOfLocalDay(dayDate);
  start.setHours(9, 0, 0, 0);
  const end = new Date(start);
  end.setHours(10, 0, 0, 0);
  return {
    title: '',
    start_dt: start.toISOString(),
    end_dt: end.toISOString(),
    timezone,
  };
};

const sortEventsByStart = (events: CalendarDayEvent[]): CalendarDayEvent[] =>
  [...events].sort((left, right) => {
    const leftTime = parseIsoDate(left.event_state.start_dt)?.getTime() ?? 0;
    const rightTime = parseIsoDate(right.event_state.start_dt)?.getTime() ?? 0;
    if (leftTime !== rightTime) {
      return leftTime - rightTime;
    }
    return left.record_id.localeCompare(right.record_id);
  });

const EventPips = ({ events }: { events: CalendarDayEvent[] }) => {
  const maxVisible = 5;
  const visible = events.slice(0, maxVisible);
  const hiddenCount = events.length - visible.length;

  return (
    <div className="mt-1 flex items-center gap-1.5" aria-hidden="true">
      {visible.map((event) => (
        <span
          key={`${event.record_id}-${event.event_state.start_dt}`}
          className={cn('inline-block h-2 w-2 rounded-full', eventPipColorClassName(event))}
        />
      ))}
      {hiddenCount > 0 ? <span className="text-[10px] text-text-secondary">+{hiddenCount}</span> : null}
    </div>
  );
};

const EventList = ({
  events,
  onOpenRecord,
}: {
  events: CalendarDayEvent[];
  onOpenRecord: (recordId: string) => void;
}) => (
  <ul className="space-y-1.5">
    {events.map((event) => {
      const startLabel = formatTimeLabel(event.event_state.start_dt);
      const endLabel = formatTimeLabel(event.event_state.end_dt);
      const timeLabel = startLabel && endLabel ? `${startLabel} - ${endLabel}` : startLabel || endLabel || 'No time';
      const projectLabel = extractProjectLabel(event);

      return (
        <li key={`${event.record_id}-${event.event_state.start_dt}`}>
          <button
            type="button"
            onClick={() => onOpenRecord(event.record_id)}
            aria-label={formatEventAriaLabel(event)}
            className="w-full rounded-control border border-border-muted bg-surface px-2.5 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            <EventRecordSummary
              title={event.title}
              timeLabel={timeLabel}
              detailLabel={event.item_kind === 'reminder' ? 'Reminder' : event.item_kind === 'task' ? 'Task' : null}
              projectName={projectLabel}
              location={event.event_state.location}
              timezone={event.event_state.timezone}
            />
          </button>
        </li>
      );
    })}
  </ul>
);

const DayPanelContent = ({
  day,
  onOpenRecord,
  onCreateEvent,
  timezone,
}: {
  day: WeekDayEntry;
  onOpenRecord: (recordId: string) => void;
  onCreateEvent?: (payload: CreateEventPrefillPayload) => void | Promise<void>;
  timezone: string;
}) => (
  day.events.length === 0 ? (
    <div className="flex items-center justify-between rounded-control border border-border-muted bg-surface px-2.5 py-2">
      <p className="text-xs text-muted">No events</p>
      {onCreateEvent ? (
        <button
          type="button"
          onClick={() => {
            void onCreateEvent(createAtNinePayload(day.date, timezone));
          }}
          className="interactive interactive-fold h-6 w-6 rounded-control border border-primary bg-primary text-sm font-semibold leading-none text-on-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          aria-label={`Create event for ${day.dayName} ${day.dateNumber}`}
        >
          +
        </button>
      ) : null}
    </div>
  ) : (
    <div className="max-h-56 overflow-y-auto pr-1">
      <EventList events={day.events} onOpenRecord={onOpenRecord} />
    </div>
  )
);

export const CalendarWeekView = ({
  events,
  onOpenRecord,
  onCreateEvent,
  today = new Date(),
}: CalendarWeekViewProps) => {
  const [activeDayKey, setActiveDayKey] = useState<string | null>(null);
  const [hoveredDayKey, setHoveredDayKey] = useState<string | null>(null);
  const mobileScrollViewportRef = useRef<HTMLDivElement | null>(null);
  const desktopCardRefs = useRef<Record<string, HTMLElement | null>>({});
  const mobileCardRefs = useRef<Record<string, HTMLElement | null>>({});
  const didAutoScrollRef = useRef(false);
  const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);

  const todayStart = useMemo(() => startOfLocalDay(today), [today]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarDayEvent[]>();
    for (const event of events) {
      const start = parseIsoDate(event.event_state.start_dt);
      if (!start) {
        continue;
      }
      const key = toLocalDateKey(start);
      map.set(key, [...(map.get(key) ?? []), event]);
    }

    for (const [key, dayEvents] of map.entries()) {
      map.set(key, sortEventsByStart(dayEvents));
    }

    return map;
  }, [events]);

  const chronologicalWeekDays = useMemo<WeekDayEntry[]>(() => {
    const offsets: WeekDayEntry['offsetFromToday'][] = [-3, -2, -1, 0, 1, 2, 3];
    return offsets.map((offset) => {
      const date = addDays(todayStart, offset);
      const key = toLocalDateKey(date);
      return {
        key,
        date,
        dayName: date.toLocaleDateString([], { weekday: 'short' }),
        dateNumber: String(date.getDate()),
        offsetFromToday: offset,
        isToday: offset === 0,
        events: eventsByDate.get(key) ?? [],
      };
    });
  }, [eventsByDate, todayStart]);

  const weekDays = useMemo<WeekDayEntry[]>(() => {
    const todayEntry = chronologicalWeekDays.find((day) => day.offsetFromToday === 0);
    const futureDays = chronologicalWeekDays.filter((day) => day.offsetFromToday > 0);
    const pastDays = chronologicalWeekDays.filter((day) => day.offsetFromToday < 0);
    return [
      ...(todayEntry ? [todayEntry] : []),
      ...futureDays,
      ...pastDays,
    ];
  }, [chronologicalWeekDays]);

  useEffect(() => {
    setActiveDayKey((current) => {
      if (current && weekDays.some((day) => day.key === current)) {
        return current;
      }
      const todayEntry = weekDays.find((day) => day.offsetFromToday === 0);
      return todayEntry?.key ?? weekDays[0]?.key ?? null;
    });
  }, [weekDays]);

  useEffect(() => {
    if (didAutoScrollRef.current) {
      return;
    }

    let frameId = 0;
    const centerActiveCard = () => {
      if (window.matchMedia('(min-width: 768px)').matches) {
        didAutoScrollRef.current = true;
        return;
      }
      const viewport = mobileScrollViewportRef.current;
      const activeCard = activeDayKey ? mobileCardRefs.current[activeDayKey] : null;
      if (!viewport || !activeCard) {
        frameId = window.requestAnimationFrame(centerActiveCard);
        return;
      }
      if (viewport.clientHeight <= 0 || viewport.scrollHeight <= 0) {
        frameId = window.requestAnimationFrame(centerActiveCard);
        return;
      }

      const targetTop = activeCard.offsetTop + (activeCard.offsetHeight / 2) - (viewport.clientHeight / 2);
      const maxScrollTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
      viewport.scrollTop = Math.min(maxScrollTop, Math.max(0, targetTop));
      didAutoScrollRef.current = true;
    };

    frameId = window.requestAnimationFrame(centerActiveCard);
    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [activeDayKey]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 768px)');
    const onViewportChange = (event: MediaQueryListEvent) => {
      if (!event.matches) {
        didAutoScrollRef.current = false;
      }
    };

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', onViewportChange);
    } else {
      mediaQuery.addListener(onViewportChange);
    }

    return () => {
      if (typeof mediaQuery.removeEventListener === 'function') {
        mediaQuery.removeEventListener('change', onViewportChange);
      } else {
        mediaQuery.removeListener(onViewportChange);
      }
    };
  }, []);

  const weekRangeLabel = useMemo(() => {
    const start = chronologicalWeekDays[0]?.date ?? todayStart;
    const end = chronologicalWeekDays[chronologicalWeekDays.length - 1]?.date ?? todayStart;
    return formatWeekRangeLabel(start, end);
  }, [chronologicalWeekDays, todayStart]);

  const activateDay = (dayKey: string) => {
    setActiveDayKey(dayKey);
  };

  return (
    <div role="region" tabIndex={-1} aria-label={weekRangeLabel} className="space-y-3">
      <div className="hidden md:flex md:items-start md:gap-2 md:pb-1">
        {weekDays.map((day) => {
          const isActive = day.key === activeDayKey;
          const cardLabel = formatDayCardLabel(day);
          const dayTriggerId = `calendar-week-desktop-day-trigger-${day.key}`;
          const dayPanelId = `calendar-week-desktop-day-panel-${day.key}`;

          return (
            <article
              key={`desktop-${day.key}`}
              ref={(node) => {
                desktopCardRefs.current[day.key] = node;
              }}
              className="min-w-0 flex-1"
            >
              <div
                className={cn(
                  'max-h-[20rem] overflow-hidden rounded-panel border border-border-muted bg-surface-elevated px-3 py-2 transition-[transform,box-shadow] duration-150',
                  isActive ? 'week-card-active' : 'week-card-inactive',
                  !isActive && hoveredDayKey === day.key ? 'week-card-hover' : null,
                  day.isToday ? 'border-b-2 border-b-[color:var(--color-primary)]' : null,
                )}
                onMouseEnter={() => {
                  setHoveredDayKey(day.key);
                }}
                onMouseLeave={() => {
                  setHoveredDayKey((current) => (current === day.key ? null : current));
                }}
              >
                <button
                  type="button"
                  onClick={() => activateDay(day.key)}
                  onFocus={() => {
                    if (!isActive) {
                      activateDay(day.key);
                    }
                  }}
                  id={dayTriggerId}
                  aria-expanded={isActive}
                  aria-controls={dayPanelId}
                  aria-current={day.isToday ? 'date' : undefined}
                  className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                  aria-label={cardLabel}
                >
                  <p className="text-xs text-text-secondary [font-family:var(--font-heading)]">{day.dayName}</p>
                  <p className="text-base text-text [font-family:var(--font-heading)]">{day.dateNumber}</p>
                  <EventPips events={day.events} />
                </button>

                <div
                  id={dayPanelId}
                  hidden={!isActive}
                  className="mt-2 overflow-y-auto border-t border-border-muted pt-2"
                >
                  <DayPanelContent day={day} onOpenRecord={onOpenRecord} onCreateEvent={onCreateEvent} timezone={timezone} />
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <div ref={mobileScrollViewportRef} className="max-h-[70vh] space-y-2 overflow-y-auto md:hidden">
        {weekDays.map((day) => {
          const isActive = day.key === activeDayKey;
          const cardLabel = formatDayCardLabel(day);
          const dayTriggerId = `calendar-week-mobile-day-trigger-${day.key}`;
          const dayPanelId = `calendar-week-mobile-day-panel-${day.key}`;

          return (
            <article
              key={`mobile-${day.key}`}
              ref={(node) => {
                mobileCardRefs.current[day.key] = node;
              }}
              className="transition-all duration-150"
            >
              <div
                className={cn(
                  'max-h-[20rem] overflow-hidden rounded-panel border border-border-muted bg-surface-elevated px-3 py-2',
                  isActive ? 'week-card-active' : 'week-card-inactive',
                  day.isToday ? 'border-b-2 border-b-[color:var(--color-primary)]' : null,
                )}
              >
                <button
                  type="button"
                  onClick={() => activateDay(day.key)}
                  onFocus={() => {
                    if (!isActive) {
                      activateDay(day.key);
                    }
                  }}
                  id={dayTriggerId}
                  aria-expanded={isActive}
                  aria-controls={dayPanelId}
                  aria-current={day.isToday ? 'date' : undefined}
                  className={cn(
                    'w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
                    isActive ? 'text-left' : 'flex items-center justify-between gap-2 text-left',
                  )}
                  aria-label={cardLabel}
                >
                  <div>
                    <p className="text-xs text-text-secondary [font-family:var(--font-heading)]">{day.dayName}</p>
                    <p className="text-base text-text [font-family:var(--font-heading)]">{day.dateNumber}</p>
                  </div>
                  <EventPips events={day.events} />
                </button>

                <div
                  id={dayPanelId}
                  hidden={!isActive}
                  className="mt-2 overflow-y-auto border-t border-border-muted pt-2"
                >
                  <DayPanelContent day={day} onOpenRecord={onOpenRecord} onCreateEvent={onCreateEvent} timezone={timezone} />
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
};
