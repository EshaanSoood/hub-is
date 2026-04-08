export type CalendarScope = 'relevant' | 'all';
export type CalendarView = 'month' | 'year' | 'week' | 'day';

export interface CreateCalendarEventPayload {
  title: string;
  start_dt: string;
  end_dt: string;
  timezone: string;
  location?: string;
}

export interface RescheduleCalendarEventPayload {
  record_id: string;
  start_dt: string;
  end_dt: string;
  timezone: string;
}

export interface CalendarEventSummary {
  record_id: string;
  title: string;
  project_id?: string | null;
  project_name?: string | null;
  source_pane?: { pane_id: string | null; pane_name: string | null; doc_id: string | null } | null;
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

export interface CalendarModuleSkinProps {
  events: CalendarEventSummary[];
  loading: boolean;
  sizeTier?: 'S' | 'M' | 'L';
  scope: CalendarScope;
  onScopeChange: (scope: CalendarScope) => void;
  onCreateEvent?: (payload: CreateCalendarEventPayload) => Promise<void>;
  onRescheduleEvent?: (payload: RescheduleCalendarEventPayload) => Promise<void>;
  onOpenRecord: (recordId: string) => void;
}

export interface DayCell {
  iso: string;
  day: number;
  currentMonth: boolean;
}

export interface MediumWeekDay {
  key: string;
  date: Date;
  dayName: string;
  dateLabel: string;
  isToday: boolean;
  events: CalendarEventSummary[];
}

export interface CalendarCreatePanelPrefill {
  title?: string;
  startTime?: string;
  endTime?: string;
}
