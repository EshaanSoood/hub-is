import { useEffect, useState } from 'react';
import { listPanes } from '../services/hub/panes';
import type { HubPaneSummary } from '../services/hub/types';

interface ProjectPanesState {
  panes: HubPaneSummary[];
  projectId: string | null;
}

export const useProjectPanes = (
  accessToken: string | null | undefined,
  projectId: string | null,
): HubPaneSummary[] => {
  const [state, setState] = useState<ProjectPanesState>({
    panes: [],
    projectId: null,
  });

  useEffect(() => {
    if (!accessToken || !projectId) {
      return;
    }

    let cancelled = false;

    void listPanes(accessToken, projectId)
      .then((panes) => {
        if (!cancelled) {
          setState({ panes, projectId });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState({ panes: [], projectId });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken, projectId]);

  return state.projectId === projectId ? state.panes : [];
};
