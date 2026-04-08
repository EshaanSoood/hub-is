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
      setPaneName(null);
      return;
    }

    let cancelled = false;
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
    };
  }, [accessToken, paneId, projectId]);

  return paneName;
};
