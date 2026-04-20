import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDashboardMutations } from '../PersonalizedDashboardPanel/hooks/useDashboardMutations';
import { useRemindersRuntime } from '../../hooks/useRemindersRuntime';
import { subscribeHubHomeRefresh } from '../../lib/hubHomeRefresh';
import { getHubHome } from '../../services/hub/records';
import { subscribeHubLive } from '../../services/hubLive';
import type { HomeOverlayId } from './navigation';

type HomeData = Awaited<ReturnType<typeof getHubHome>>;

const emptyHomeData: HomeData = {
  personal_project_id: null,
  tasks: [],
  tasks_next_cursor: null,
  captures: [],
  events: [],
  notifications: [],
};

interface UseHomeDataParams {
  accessToken: string | null | undefined;
  activeOverlay: HomeOverlayId | null;
}

export type HomeRuntime = ReturnType<typeof useHomeRuntime>;

export const useHomeRuntime = ({ accessToken, activeOverlay }: UseHomeDataParams) => {
  const [homeLoading, setHomeLoading] = useState(false);
  const [homeReady, setHomeReady] = useState(false);
  const [homeError, setHomeError] = useState<string | null>(null);
  const [homeData, setHomeData] = useState<HomeData>(emptyHomeData);
  const [calendarScope, setCalendarScope] = useState<'relevant' | 'all'>('relevant');
  const liveRefreshHomeTimeoutRef = useRef<number | null>(null);
  const remindersRuntime = useRemindersRuntime(
    activeOverlay === 'reminders' ? accessToken ?? null : null,
    { autoload: activeOverlay === 'reminders' },
  );
  const { onDismissReminder, onSnoozeReminder } = useDashboardMutations({
    accessToken,
    refreshReminders: remindersRuntime.refresh,
  });

  const refreshHome = useCallback(async () => {
    if (!accessToken) {
      setHomeData(emptyHomeData);
      setHomeError(null);
      setHomeLoading(false);
      setHomeReady(false);
      return;
    }

    setHomeLoading(true);
    try {
      const next = await getHubHome(accessToken, {
        tasks_limit: activeOverlay === 'tasks' ? 50 : 8,
        events_limit: activeOverlay === 'calendar' ? 50 : 8,
        captures_limit: activeOverlay === 'thoughts' ? 50 : 20,
        unread: true,
      });
      setHomeData(next);
      setHomeError(null);
      setHomeReady(true);
    } catch (error) {
      setHomeError(error instanceof Error ? error.message : 'Failed to load Home.');
      setHomeReady(true);
    } finally {
      setHomeLoading(false);
    }
  }, [accessToken, activeOverlay]);

  const filteredCalendarEvents = useMemo(() => {
    if (calendarScope === 'all') {
      return homeData.events;
    }
    const now = new Date();
    const windowStart = now.getTime() - (24 * 60 * 60 * 1000);
    const windowEnd = now.getTime() + (14 * 24 * 60 * 60 * 1000);
    return homeData.events.filter((event) => {
      const startTime = new Date(event.event_state.start_dt).getTime();
      return Number.isFinite(startTime) && startTime >= windowStart && startTime <= windowEnd;
    });
  }, [calendarScope, homeData.events]);

  useEffect(() => {
    void refreshHome();
  }, [refreshHome]);

  useEffect(() => subscribeHubHomeRefresh(() => {
    void refreshHome();
  }), [refreshHome]);

  useEffect(() => {
    if (!accessToken) {
      if (liveRefreshHomeTimeoutRef.current !== null) {
        window.clearTimeout(liveRefreshHomeTimeoutRef.current);
        liveRefreshHomeTimeoutRef.current = null;
      }
      return;
    }

    const unsubscribe = subscribeHubLive(accessToken, (message) => {
      if (message.type !== 'task.changed') {
        return;
      }
      if (liveRefreshHomeTimeoutRef.current !== null) {
        window.clearTimeout(liveRefreshHomeTimeoutRef.current);
      }
      liveRefreshHomeTimeoutRef.current = window.setTimeout(() => {
        liveRefreshHomeTimeoutRef.current = null;
        void refreshHome();
      }, 500);
    });

    return () => {
      if (liveRefreshHomeTimeoutRef.current !== null) {
        window.clearTimeout(liveRefreshHomeTimeoutRef.current);
        liveRefreshHomeTimeoutRef.current = null;
      }
      unsubscribe();
    };
  }, [accessToken, refreshHome]);

  return {
    calendarScope,
    filteredCalendarEvents,
    homeData,
    homeError,
    homeLoading,
    homeReady,
    onDismissReminder,
    onSnoozeReminder,
    refreshHome,
    remindersRuntime,
    setCalendarScope,
  };
};
