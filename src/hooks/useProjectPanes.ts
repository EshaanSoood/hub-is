import { useCallback, useEffect, useState } from 'react';
import { listPanes } from '../services/hub/panes';
import type { HubPaneSummary } from '../services/hub/types';

interface ProjectPanesState {
  error: unknown;
  loading: boolean;
  panes: HubPaneSummary[];
  projectId: string | null;
}

interface UseProjectPanesResult {
  error: unknown;
  loading: boolean;
  panes: HubPaneSummary[];
  refetch: () => void;
}

export const useProjectPanes = (
  accessToken: string | null | undefined,
  projectId: string | null,
): UseProjectPanesResult => {
  const [state, setState] = useState<ProjectPanesState>({
    error: null,
    loading: false,
    panes: [],
    projectId: null,
  });
  const [requestVersion, setRequestVersion] = useState(0);

  const refetch = useCallback(() => {
    if (!accessToken || !projectId) {
      return;
    }
    setState((current) => ({
      ...current,
      error: null,
      loading: true,
      projectId,
    }));
    setRequestVersion((current) => current + 1);
  }, [accessToken, projectId]);

  useEffect(() => {
    if (!accessToken || !projectId) {
      return;
    }

    let cancelled = false;

    void listPanes(accessToken, projectId)
      .then((panes) => {
        if (!cancelled) {
          setState({
            error: null,
            loading: false,
            panes,
            projectId,
          });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setState((current) => ({
            ...current,
            error,
            loading: false,
            projectId,
          }));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken, projectId, requestVersion]);

  return {
    error: accessToken && projectId && state.projectId === projectId ? state.error : null,
    loading: accessToken && projectId ? state.projectId !== projectId || state.loading : false,
    panes: accessToken && projectId ? state.panes : [],
    refetch,
  };
};
