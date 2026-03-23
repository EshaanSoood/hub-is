import { useCallback, useEffect, useRef, useState } from 'react';
import type { CreateReminderPayload, HubReminderSummary } from '../services/hub/reminders.ts';
import { createReminder, dismissReminder, listReminders } from '../services/hub/reminders.ts';

export interface RemindersRuntime {
  reminders: HubReminderSummary[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  dismiss: (reminderId: string) => Promise<void>;
  create: (payload: CreateReminderPayload) => Promise<void>;
}

export const useRemindersRuntime = (accessToken: string | null): RemindersRuntime => {
  const [reminders, setReminders] = useState<HubReminderSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const refreshSequenceRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    const sequence = ++refreshSequenceRef.current;
    if (!accessToken) {
      if (mountedRef.current && sequence === refreshSequenceRef.current) {
        setReminders([]);
        setLoading(false);
        setError(null);
      }
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await listReminders(accessToken);
      if (mountedRef.current && sequence === refreshSequenceRef.current) {
        setReminders(data);
      }
    } catch (err) {
      if (mountedRef.current && sequence === refreshSequenceRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to load reminders.');
      }
    } finally {
      if (mountedRef.current && sequence === refreshSequenceRef.current) {
        setLoading(false);
      }
    }
  }, [accessToken]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const dismiss = useCallback(async (reminderId: string) => {
    if (!accessToken) {
      return;
    }

    setReminders((prev) => prev.filter((reminder) => reminder.reminder_id !== reminderId));
    try {
      await dismissReminder(accessToken, reminderId);
      await refresh();
    } catch (err) {
      console.error('Failed to dismiss reminder:', err);
      await refresh();
    }
  }, [accessToken, refresh]);

  const create = useCallback(async (payload: CreateReminderPayload) => {
    if (!accessToken) {
      return;
    }

    await createReminder(accessToken, payload);
    await refresh();
  }, [accessToken, refresh]);

  return { reminders, loading, error, refresh, dismiss, create };
};
