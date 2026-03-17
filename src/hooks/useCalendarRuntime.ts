import { useEffect, useState } from 'react';
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

type ProjectSpaceTab = 'overview' | 'work' | 'tools';

interface UseCalendarRuntimeParams {
  accessToken: string;
  projectId: string;
  activeTab: ProjectSpaceTab;
}

export const useCalendarRuntime = ({ accessToken, projectId, activeTab }: UseCalendarRuntimeParams) => {
  const [calendarMode, setCalendarMode] = useState<'relevant' | 'all'>('relevant');
  const [calendarEvents, setCalendarEvents] = useState<CalendarEventSummary[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab !== 'overview') {
      return;
    }

    let cancelled = false;
    const refreshCalendar = async () => {
      setCalendarLoading(true);
      setCalendarError(null);
      try {
        const result = await queryCalendar(accessToken, projectId, calendarMode);
        if (!cancelled) {
          setCalendarEvents(result.events);
        }
      } catch (error) {
        if (!cancelled) {
          setCalendarError(error instanceof Error ? error.message : 'Failed to load calendar.');
        }
      } finally {
        if (!cancelled) {
          setCalendarLoading(false);
        }
      }
    };

    void refreshCalendar();
    return () => {
      cancelled = true;
    };
  }, [accessToken, activeTab, calendarMode, projectId]);

  return {
    calendarError,
    calendarEvents,
    calendarLoading,
    calendarMode,
    setCalendarMode,
  };
};
