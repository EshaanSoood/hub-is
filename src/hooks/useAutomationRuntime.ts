import { useCallback, useEffect, useState } from 'react';

import {
  createAutomationRule,
  deleteAutomationRule,
  listAutomationRules,
  listAutomationRuns,
  updateAutomationRule,
} from '../services/hub/records';

interface UseAutomationRuntimeParams {
  accessToken: string;
  projectId: string;
}

export const useAutomationRuntime = ({ accessToken, projectId }: UseAutomationRuntimeParams) => {
  const [automationRules, setAutomationRules] = useState<
    Array<{ automation_rule_id: string; name: string; enabled: boolean; trigger_json: Record<string, unknown>; actions_json: unknown[] }>
  >([]);
  const [automationRuns, setAutomationRuns] = useState<
    Array<{ automation_run_id: string; automation_rule_id: string; status: string; started_at: string; finished_at: string | null }>
  >([]);
  const [automationMutationError, setAutomationMutationError] = useState<string | null>(null);

  const refreshToolsData = useCallback(async () => {
    const [nextAutomationRules, nextAutomationRuns] = await Promise.all([
      listAutomationRules(accessToken, projectId),
      listAutomationRuns(accessToken, projectId),
    ]);
    setAutomationRules(nextAutomationRules);
    setAutomationRuns(nextAutomationRuns);
  }, [accessToken, projectId]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([listAutomationRules(accessToken, projectId), listAutomationRuns(accessToken, projectId)]).then(
      ([nextAutomationRules, nextAutomationRuns]) => {
        if (cancelled) {
          return;
        }
        setAutomationRules(nextAutomationRules);
        setAutomationRuns(nextAutomationRuns);
      },
    ).catch((error) => {
      if (cancelled) {
        return;
      }
      console.error('Failed to load automation data:', error);
    });

    return () => {
      cancelled = true;
    };
  }, [accessToken, projectId]);

  const onCreateAutomationRule = useCallback(
    async (payload: {
      name: string;
      enabled: boolean;
      trigger_json: Record<string, unknown>;
      actions_json: unknown[];
    }) => {
      setAutomationMutationError(null);
      try {
        await createAutomationRule(accessToken, projectId, {
          name: payload.name,
          enabled: payload.enabled,
          trigger_json: payload.trigger_json,
          actions_json: payload.actions_json,
        });
        await refreshToolsData();
      } catch (error) {
        setAutomationMutationError(error instanceof Error ? error.message : 'Failed to create automation rule.');
      }
    },
    [accessToken, projectId, refreshToolsData],
  );

  const onUpdateAutomationRule = useCallback(
    async (
      ruleId: string,
      payload: {
        name?: string;
        enabled?: boolean;
        trigger_json?: Record<string, unknown>;
        actions_json?: unknown[];
      },
    ) => {
      setAutomationMutationError(null);
      try {
        await updateAutomationRule(accessToken, ruleId, payload);
        await refreshToolsData();
      } catch (error) {
        setAutomationMutationError(error instanceof Error ? error.message : 'Failed to update automation rule.');
      }
    },
    [accessToken, refreshToolsData],
  );

  const onDeleteAutomationRule = useCallback(
    async (ruleId: string) => {
      setAutomationMutationError(null);
      try {
        await deleteAutomationRule(accessToken, ruleId);
        await refreshToolsData();
      } catch (error) {
        setAutomationMutationError(error instanceof Error ? error.message : 'Failed to delete automation rule.');
      }
    },
    [accessToken, refreshToolsData],
  );

  const onToggleAutomationRule = useCallback(
    async (ruleId: string, enabled: boolean) => {
      setAutomationMutationError(null);
      try {
        await updateAutomationRule(accessToken, ruleId, { enabled });
        await refreshToolsData();
      } catch (error) {
        setAutomationMutationError(error instanceof Error ? error.message : 'Failed to toggle automation rule.');
      }
    },
    [accessToken, refreshToolsData],
  );

  return {
    automationMutationError,
    automationRules,
    automationRuns,
    onCreateAutomationRule,
    onDeleteAutomationRule,
    onToggleAutomationRule,
    onUpdateAutomationRule,
    refreshToolsData,
  };
};
