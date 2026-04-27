import { useCallback, useEffect, useRef, useState } from 'react';
import type { CreateReminderPayload, HubReminderSummary, ListRemindersOptions } from '../services/hub/reminders.ts';
import { createReminder, dismissReminder, listReminders } from '../services/hub/reminders.ts';
import { subscribeHubHomeRefresh } from '../lib/hubHomeRefresh.ts';
import { subscribeHubLive } from '../services/hubLive.ts';

export interface RemindersRuntime {
  reminders: HubReminderSummary[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  dismiss: (reminderId: string) => Promise<void>;
  create: (payload: CreateReminderPayload) => Promise<void>;
}

interface UseRemindersRuntimeOptions {
  autoload?: boolean;
  subscribeToHomeRefresh?: boolean;
  subscribeToLive?: boolean;
  scope?: ListRemindersOptions['scope'];
  projectId?: string;
  sourceProjectId?: string | null;
  sourceViewId?: string | null;
}

export const useRemindersRuntime = (accessToken: string | null, options?: UseRemindersRuntimeOptions): RemindersRuntime => {
  const autoload = options?.autoload ?? true;
  const subscribeToHomeRefresh = options?.subscribeToHomeRefresh ?? true;
  const subscribeToLive = options?.subscribeToLive ?? true;
  const reminderScope = options?.scope ?? 'personal';
  const projectId = options?.projectId;
  const sourceProjectId = options?.sourceProjectId ?? null;
  const sourceViewId = options?.sourceViewId ?? null;
  const [reminders, setReminders] = useState<HubReminderSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const refreshSequenceRef = useRef(0);
  const reminderRefreshTimerRef = useRef<number | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      if (reminderRefreshTimerRef.current !== null) {
        window.clearTimeout(reminderRefreshTimerRef.current);
        reminderRefreshTimerRef.current = null;
      }
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
    if (reminderScope === 'project' && !projectId) {
      if (mountedRef.current && sequence === refreshSequenceRef.current) {
        setReminders([]);
        setLoading(false);
        setError('Project reminders are unavailable without a project id.');
      }
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const reminderOptions: ListRemindersOptions | undefined = reminderScope === 'project' && projectId
        ? { scope: 'project', spaceId: projectId, projectId: sourceProjectId }
        : undefined;
      const data = await listReminders(accessToken, reminderOptions);
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
  }, [accessToken, projectId, sourceProjectId, reminderScope]);

  const refreshWithDebounce = useCallback(() => {
    if (reminderRefreshTimerRef.current !== null) {
      window.clearTimeout(reminderRefreshTimerRef.current);
    }
    reminderRefreshTimerRef.current = window.setTimeout(() => {
      reminderRefreshTimerRef.current = null;
      void refresh();
    }, 500);
  }, [refresh]);

  useEffect(() => {
    if (reminderRefreshTimerRef.current !== null) {
      window.clearTimeout(reminderRefreshTimerRef.current);
      reminderRefreshTimerRef.current = null;
    }
    refreshSequenceRef.current += 1;

    if (!accessToken) {
      setReminders([]);
      setLoading(false);
      setError(null);
    }
  }, [accessToken, projectId, sourceProjectId, reminderScope]);

  useEffect(() => {
    if (!autoload) {
      return;
    }
    void refresh();
  }, [autoload, refresh]);

  useEffect(() => {
    if (!subscribeToHomeRefresh) {
      return;
    }
    return subscribeHubHomeRefresh(() => {
      refreshWithDebounce();
    });
  }, [refreshWithDebounce, subscribeToHomeRefresh]);

  useEffect(() => {
    if (!accessToken || !subscribeToLive) {
      return;
    }
    return subscribeHubLive(accessToken, (message) => {
      if (message.type !== 'reminder.changed') {
        return;
      }
      refreshWithDebounce();
    });
  }, [accessToken, refreshWithDebounce, subscribeToLive]);

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
    if (reminderScope === 'project' && !projectId) {
      setError('Project reminders are unavailable without a project id.');
      return;
    }

    const requestPayload = reminderScope === 'project'
      ? {
          ...payload,
          scope: 'project' as const,
          space_id: projectId,
          ...(sourceProjectId ? { project_id: sourceProjectId } : {}),
          ...(sourceViewId ? { source_view_id: sourceViewId } : {}),
        }
      : payload;

    await createReminder(accessToken, requestPayload);
    await refresh();
  }, [accessToken, projectId, sourceProjectId, refresh, reminderScope, sourceViewId]);

  return { reminders, loading, error, refresh, dismiss, create };
};
