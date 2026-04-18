import { useCallback, useEffect, useRef, useState } from 'react';
import { queryCalendar } from '../services/hub/records';

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
  source_pane: { pane_id: string | null; pane_name: string | null; doc_id: string | null } | null;
}

interface UseCalendarRuntimeParams {
  accessToken: string;
  projectId: string;
  initialMode?: 'relevant' | 'all';
}

export const useCalendarRuntime = ({ accessToken, projectId, initialMode = 'all' }: UseCalendarRuntimeParams) => {
  const [calendarMode, setCalendarMode] = useState<'relevant' | 'all'>(initialMode);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEventSummary[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const latestRequestRef = useRef(0);

  const refreshCalendar = useCallback(async () => {
    const requestId = latestRequestRef.current + 1;
    latestRequestRef.current = requestId;
    setCalendarLoading(true);
    setCalendarError(null);
    try {
      const result = await queryCalendar(accessToken, projectId, calendarMode);
      if (latestRequestRef.current === requestId) {
        setCalendarEvents(result.events);
      }
    } catch (error) {
      if (latestRequestRef.current === requestId) {
        setCalendarError(error instanceof Error ? error.message : 'Failed to load calendar.');
      }
    } finally {
      if (latestRequestRef.current === requestId) {
        setCalendarLoading(false);
      }
    }
  }, [accessToken, calendarMode, projectId]);

  useEffect(() => {
    void refreshCalendar();
  }, [refreshCalendar]);

  return {
    calendarError,
    calendarEvents,
    calendarLoading,
    calendarMode,
    refreshCalendar,
    setCalendarMode,
  };
};
