import { cn } from '../../../lib/cn';
import { EventCard } from '../../cards/EventCard';

interface CalendarWeekStripEvent {
  record_id: string;
  title: string;
  space_id?: string | null;
  space_name?: string | null;
  source_project?: { project_id: string | null; project_name: string | null; doc_id: string | null } | null;
  event_state: {
    start_dt: string;
    end_dt: string;
    timezone: string;
    location: string | null;
    updated_at: string;
  };
  participants: Array<{ user_id: string; role: string | null }>;
  item_kind?: 'event' | 'task' | 'reminder';
}

interface CalendarWeekStripDay {
  key: string;
  date: Date;
  dayName: string;
  dateLabel: string;
  isToday: boolean;
  events: CalendarWeekStripEvent[];
}

interface CalendarMediumWeekStripProps {
  weekDays: CalendarWeekStripDay[];
  selectedDayKey: string;
  onSelectDay: (dayKey: string) => void;
  onOpenRecord: (recordId: string) => void;
  onCreateEvent?: (dayKey: string) => void;
  previewMode?: boolean;
}

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

export const CalendarMediumWeekStrip = ({
  weekDays,
  selectedDayKey,
  onSelectDay,
  onOpenRecord,
  onCreateEvent,
  previewMode = false,
}: CalendarMediumWeekStripProps) => {
  const selectedDay = weekDays.find((day) => day.key === selectedDayKey) ?? weekDays[3] ?? weekDays[0] ?? null;

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-3" aria-label="Week overview">
      <div className="grid grid-cols-7 gap-1">
        {weekDays.map((day) => {
          const isSelected = day.key === selectedDayKey;
          const eventCount = day.events.length;
          return previewMode ? (
            <div
              key={day.key}
              className={cn(
                'min-w-0 rounded-control px-1 py-2 text-center shadow-soft-subtle',
                isSelected ? 'bg-primary/10 text-primary' : 'bg-surface text-text',
              )}
            >
              <p className={cn('truncate text-[10px] font-semibold uppercase tracking-wide', isSelected ? 'text-primary' : 'text-muted')}>
                {day.dayName}
              </p>
              <p className="mt-1 text-sm font-semibold">{day.dateLabel}</p>
              <p className={cn('mt-1 truncate text-[10px]', isSelected ? 'text-primary' : 'text-text-secondary')}>
                {eventCount} {eventCount === 1 ? 'event' : 'events'}
              </p>
            </div>
          ) : (
            <button
              key={day.key}
              type="button"
              onClick={() => onSelectDay(day.key)}
              aria-pressed={isSelected}
              aria-current={day.isToday ? 'date' : undefined}
              className={cn(
                'min-w-0 rounded-control px-1 py-2 text-center shadow-soft-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
                isSelected ? 'bg-primary/10 text-primary' : 'bg-surface text-text',
              )}
            >
              <p className={cn('truncate text-[10px] font-semibold uppercase tracking-wide', isSelected ? 'text-primary' : 'text-muted')}>
                {day.dayName}
              </p>
              <p className="mt-1 text-sm font-semibold">{day.dateLabel}</p>
              <p className={cn('mt-1 truncate text-[10px]', isSelected ? 'text-primary' : 'text-text-secondary')}>
                {eventCount} {eventCount === 1 ? 'event' : 'events'}
              </p>
            </button>
          );
        })}
      </div>

      <div className="module-sheet flex min-h-0 flex-1 flex-col p-3">
        {selectedDay ? (
          <>
            <div className="flex items-center justify-between gap-3 pb-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-text">
                  {selectedDay.date.toLocaleDateString(undefined, {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric',
                  })}
                </p>
                <p className="text-xs text-text-secondary">
                  {selectedDay.events.length} {selectedDay.events.length === 1 ? 'event' : 'events'}
                </p>
              </div>
              {onCreateEvent && !previewMode ? (
                <button
                  type="button"
                  onClick={() => onCreateEvent(selectedDay.key)}
                  className="interactive interactive-fold cta-primary shrink-0 px-2.5 py-1.5 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                >
                  New Event
                </button>
              ) : null}
            </div>

            <div className="module-rule min-h-0 flex-1 overflow-y-auto pt-3">
              {selectedDay.events.length === 0 ? (
                <div className="module-dropzone flex h-full min-h-24 items-center justify-center px-3 text-center">
                  <p className="text-sm text-muted">No events for this day.</p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {selectedDay.events.map((event) => {
                    const timeLabel = formatEventTime(event.event_state.start_dt);
                    const projectName = event.space_name || event.source_project?.project_name || 'Calendar';
                    const projectId = event.space_id || event.source_project?.project_id || null;
                    return (
                      <li key={`${event.record_id}-${event.event_state.start_dt}`}>
                        {previewMode ? (
                          <div className="w-full rounded-control border border-border-muted bg-surface px-3 py-2 text-left">
                            <EventCard
                              title={event.title}
                              timeLabel={timeLabel || '--'}
                              projectId={projectId}
                              projectName={projectName}
                            />
                          </div>
                        ) : (
                          <button
                          type="button"
                          onClick={() => onOpenRecord(event.record_id)}
                          className="w-full rounded-control border border-border-muted bg-surface px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                        >
                          <EventCard
                            title={event.title}
                            timeLabel={timeLabel || '--'}
                            projectId={projectId}
                            projectName={projectName}
                          />
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
};
