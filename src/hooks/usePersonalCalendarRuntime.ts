import { useCallback, useEffect, useRef, useState } from 'react';
import { queryPersonalCalendar } from '../services/hub/records';

interface PersonalCalendarEventSummary {
  record_id: string;
  title: string;
  project_id: string;
  project_name: string | null;
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

export const usePersonalCalendarRuntime = (accessToken: string | null) => {
  const [calendarMode, setCalendarMode] = useState<'relevant' | 'all'>('relevant');
  const [calendarEvents, setCalendarEvents] = useState<PersonalCalendarEventSummary[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const latestRequestRef = useRef(0);

  const refreshCalendar = useCallback(async () => {
    if (!accessToken) {
      latestRequestRef.current += 1;
      setCalendarEvents([]);
      setCalendarLoading(false);
      setCalendarError(null);
      return;
    }

    const requestId = latestRequestRef.current + 1;
    latestRequestRef.current = requestId;
    setCalendarLoading(true);
    setCalendarError(null);
    try {
      const result = await queryPersonalCalendar(accessToken, calendarMode);
      if (latestRequestRef.current === requestId) {
        setCalendarEvents(result.events);
      }
    } catch (error) {
      if (latestRequestRef.current === requestId) {
        setCalendarEvents([]);
        setCalendarError(error instanceof Error ? error.message : 'Failed to load calendar.');
      }
    } finally {
      if (latestRequestRef.current === requestId) {
        setCalendarLoading(false);
      }
    }
  }, [accessToken, calendarMode]);

  useEffect(() => {
    void refreshCalendar();
  }, [refreshCalendar]);

  return {
    calendarEvents,
    calendarLoading,
    calendarError,
    calendarMode,
    setCalendarMode,
    refreshCalendar,
  };
};
