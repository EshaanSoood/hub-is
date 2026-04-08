import type { ReactNode } from 'react';
import { EventCard } from '../../cards/EventCard';
import { ModuleEmptyState } from '../ModuleFeedback';
import type { CalendarEventSummary, CreateCalendarEventPayload } from './types';
import { formatCompactDateLabel, formatEventTime, toLocalDateKey } from './utils';

interface CalendarSmallViewProps {
  sizeTier?: 'S' | 'M' | 'L';
  selectedDate: Date;
  onShiftSelectedDate: (days: number) => void;
  eventsByDate: Map<string, CalendarEventSummary[]>;
  onOpenRecord: (recordId: string) => void;
  onCreateEvent?: (payload: CreateCalendarEventPayload) => Promise<void>;
  openCreatePanel: (day: string) => void;
  createPanel: ReactNode;
}

export const CalendarSmallView = ({
  sizeTier,
  selectedDate,
  onShiftSelectedDate,
  eventsByDate,
  onOpenRecord,
  onCreateEvent,
  openCreatePanel,
  createPanel,
}: CalendarSmallViewProps) => {
  const selectedDateKey = toLocalDateKey(selectedDate);
  const compactDateLabel = formatCompactDateLabel(selectedDate);
  const compactDayEvents = eventsByDate.get(selectedDateKey) ?? [];

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="rounded-control border border-border-muted px-2 py-1 text-xs text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          onClick={() => onShiftSelectedDate(-1)}
          aria-label="Previous day"
        >
          ←
        </button>
        <p className="min-w-0 flex-1 text-center text-sm font-semibold text-text">{compactDateLabel}</p>
        <button
          type="button"
          className="rounded-control border border-border-muted px-2 py-1 text-xs text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          onClick={() => onShiftSelectedDate(1)}
          aria-label="Next day"
        >
          →
        </button>
        <button
          type="button"
          disabled={!onCreateEvent}
          onClick={() => openCreatePanel(selectedDateKey)}
          aria-label={`Create event for ${compactDateLabel}`}
          className="rounded-control border border-primary bg-primary px-2.5 py-1 text-sm font-semibold text-on-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          +
        </button>
      </div>

      {compactDayEvents.length === 0 ? (
        <ModuleEmptyState
          iconName="calendar"
          title={`No events for ${compactDateLabel}.`}
          description="Try another day or create an event for this date."
          sizeTier={sizeTier}
        />
      ) : (
        <ul className="space-y-2">
          {compactDayEvents.map((event) => {
            const timeLabel = formatEventTime(event.event_state.start_dt);
            const projectName = event.project_name || event.source_pane?.pane_name || 'Calendar';
            const projectId = event.project_id || event.source_pane?.pane_id || null;
            return (
              <li key={`${event.record_id}-${event.event_state.start_dt}`}>
                <button
                  type="button"
                  onClick={() => onOpenRecord(event.record_id)}
                  className="w-full rounded-control border border-border-muted bg-surface-elevated px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                >
                  <EventCard
                    title={event.title}
                    timeLabel={timeLabel || '--'}
                    projectId={projectId}
                    projectName={projectName}
                  />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {createPanel}
    </div>
  );
};
