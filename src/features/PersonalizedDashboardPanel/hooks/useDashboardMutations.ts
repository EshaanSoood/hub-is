import { useCallback } from 'react';
import type { TriageDragPayload } from '../../../components/hub-home/types';
import { requestHubHomeRefresh } from '../../../lib/hubHomeRefresh';
import { updateRecord } from '../../../services/hub/records';
import { dismissReminder, updateReminder } from '../../../services/hub/reminders';
import { tomorrowAtNineIso } from '../utils';

interface UseDashboardMutationsParams {
  accessToken: string | null | undefined;
  refreshReminders: () => Promise<void>;
}

export const useDashboardMutations = ({ accessToken, refreshReminders }: UseDashboardMutationsParams) => {
  const refreshAfterMutation = useCallback(async () => {
    requestHubHomeRefresh();
    await refreshReminders();
  }, [refreshReminders]);

  const onCompleteTask = useCallback(async (recordId: string) => {
    if (!accessToken) {
      return;
    }
    await updateRecord(accessToken, recordId, { task_state: { status: 'done' } });
    await refreshAfterMutation();
  }, [accessToken, refreshAfterMutation]);

  const onRescheduleTask = useCallback(async (recordId: string, dueAtIso: string) => {
    if (!accessToken) {
      return;
    }
    await updateRecord(accessToken, recordId, { task_state: { due_at: dueAtIso } });
    await refreshAfterMutation();
  }, [accessToken, refreshAfterMutation]);

  const onSnoozeTask = useCallback(async (recordId: string) => {
    if (!accessToken) {
      return;
    }
    await updateRecord(accessToken, recordId, { task_state: { due_at: tomorrowAtNineIso() } });
    await refreshAfterMutation();
  }, [accessToken, refreshAfterMutation]);

  const onDismissReminder = useCallback(async (reminderId: string) => {
    if (!accessToken) {
      return;
    }
    await dismissReminder(accessToken, reminderId);
    await refreshAfterMutation();
  }, [accessToken, refreshAfterMutation]);

  const onSnoozeReminder = useCallback(async (reminderId: string, remindAtIso: string) => {
    if (!accessToken) {
      return;
    }
    await updateReminder(accessToken, reminderId, { remind_at: remindAtIso });
    await refreshAfterMutation();
  }, [accessToken, refreshAfterMutation]);

  const onDropFromTriage = useCallback(async (payload: TriageDragPayload, assignedAt: Date) => {
    if (!accessToken) {
      return;
    }
    const assignedAtIso = assignedAt.toISOString();
    if (payload.kind === 'task') {
      await updateRecord(accessToken, payload.recordId, { task_state: { due_at: assignedAtIso } });
    } else {
      await updateReminder(accessToken, payload.reminderId, { remind_at: assignedAtIso });
    }
    await refreshAfterMutation();
  }, [accessToken, refreshAfterMutation]);

  return {
    onCompleteTask,
    onRescheduleTask,
    onSnoozeTask,
    onDismissReminder,
    onSnoozeReminder,
    onDropFromTriage,
  };
};
