import { useCallback, useEffect, useRef, useState } from 'react';
import { subscribeHubHomeRefresh } from '../../lib/hubHomeRefresh';
import { getHubHome } from '../../services/hub/records';
import type { HubHomeCapture } from '../../services/hub/types';

interface UseHomeThoughtPileRuntimeParams {
  accessToken: string | null | undefined;
  enabled: boolean;
}

export const useHomeThoughtPileRuntime = ({ accessToken, enabled }: UseHomeThoughtPileRuntimeParams) => {
  const [captures, setCaptures] = useState<HubHomeCapture[]>([]);
  const [loading, setLoading] = useState(false);
  const refreshSequenceRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    const refreshSequence = refreshSequenceRef.current + 1;
    refreshSequenceRef.current = refreshSequence;

    if (!mountedRef.current) {
      return;
    }

    if (!enabled || !accessToken) {
      if (mountedRef.current && refreshSequence === refreshSequenceRef.current) {
        setCaptures([]);
        setLoading(false);
      }
      return;
    }

    if (mountedRef.current && refreshSequence === refreshSequenceRef.current) {
      setLoading(true);
    }
    try {
      const homeData = await getHubHome(accessToken, {
        tasks_limit: 1,
        events_limit: 1,
        captures_limit: 50,
        notifications_limit: 1,
      });
      if (mountedRef.current && refreshSequence === refreshSequenceRef.current) {
        setCaptures(homeData.captures);
      }
    } catch {
      if (mountedRef.current && refreshSequence === refreshSequenceRef.current) {
        setCaptures([]);
      }
    } finally {
      if (mountedRef.current && refreshSequence === refreshSequenceRef.current) {
        setLoading(false);
      }
    }
  }, [accessToken, enabled]);

  useEffect(() => {
    if (!enabled) {
      setCaptures([]);
      setLoading(false);
      refreshSequenceRef.current += 1;
      return;
    }
    void refresh();
  }, [enabled, refresh]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    return subscribeHubHomeRefresh(() => {
      void refresh();
    });
  }, [enabled, refresh]);

  return {
    captures,
    loading,
    refresh,
  };
};
