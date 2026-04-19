import { useEffect } from 'react';
import { type NavigateFunction, type SetURLSearchParams } from 'react-router-dom';
import { buildProjectWorkHref } from '../../../lib/hubRoutes';

interface UseWorkRouteAndInspectorQueryEffectsParams {
  activePane: { pane_id: string } | null;
  activeTab: string;
  hasRequestedPane: boolean;
  navigate: NavigateFunction;
  openRecordInspector: (recordId: string) => Promise<void>;
  paneId: string | undefined;
  projectId: string;
  searchParams: URLSearchParams;
  setSearchParams: SetURLSearchParams;
}

export const useWorkRouteAndInspectorQueryEffects = ({
  activePane,
  activeTab,
  hasRequestedPane,
  navigate,
  openRecordInspector,
  paneId,
  projectId,
  searchParams,
  setSearchParams,
}: UseWorkRouteAndInspectorQueryEffectsParams): void => {
  useEffect(() => {
    if (activeTab !== 'work') {
      return;
    }
    if (activePane && ((!paneId) || (activePane.pane_id !== paneId && hasRequestedPane))) {
      const nextPath = buildProjectWorkHref(projectId, activePane.pane_id);
      const query = searchParams.toString();
      navigate(query ? `${nextPath}?${query}` : nextPath, { replace: true });
    }
  }, [activePane, activeTab, hasRequestedPane, navigate, paneId, projectId, searchParams]);

  useEffect(() => {
    const recordId = searchParams.get('record_id');
    if (activeTab !== 'work' || !recordId || !activePane || (paneId && !hasRequestedPane)) {
      return;
    }

    let cancelled = false;
    void (async () => {
      await openRecordInspector(recordId);
      if (cancelled) {
        return;
      }
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.delete('record_id');
        return next;
      }, { replace: true });
    })().catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [activePane, activeTab, hasRequestedPane, openRecordInspector, paneId, searchParams, setSearchParams]);
};
