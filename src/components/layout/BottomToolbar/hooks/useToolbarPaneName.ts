import { useEffect, useState } from 'react';
import { listPanes } from '../../../../services/hub/panes';

interface UseToolbarPaneNameArgs {
  accessToken: string | null | undefined;
  projectId: string | null;
  paneId: string | null;
}

export const useToolbarPaneName = ({ accessToken, projectId, paneId }: UseToolbarPaneNameArgs): string | null => {
  const [paneName, setPaneName] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken || !projectId || !paneId) {
      const timer = window.setTimeout(() => {
        setPaneName(null);
      }, 0);
      return () => {
        window.clearTimeout(timer);
      };
    }

    let cancelled = false;
    const resetTimer = window.setTimeout(() => {
      if (!cancelled) {
        setPaneName(null);
      }
    }, 0);

    const loadPaneName = async () => {
      try {
        const panes = await listPanes(accessToken, projectId);
        if (cancelled) {
          return;
        }
        const nextPaneName = panes.find((pane) => pane.pane_id === paneId)?.name || null;
        setPaneName(nextPaneName);
      } catch {
        if (!cancelled) {
          setPaneName(null);
        }
      }
    };

    void loadPaneName();
    return () => {
      cancelled = true;
      window.clearTimeout(resetTimer);
    };
  }, [accessToken, paneId, projectId]);

  return paneName;
};
