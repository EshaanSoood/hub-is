import { useEffect } from 'react';
import { type NavigateFunction, type SetURLSearchParams } from 'react-router-dom';
import { buildProjectWorkHref } from '../../../lib/hubRoutes';
import type { TopLevelProjectTab } from '../ProjectSpaceWorkspace/types';

interface UseWorkRouteAndInspectorQueryEffectsParams {
  activeProject: { project_id: string } | null;
  activeTab: TopLevelProjectTab;
  hasRequestedProject: boolean;
  navigate: NavigateFunction;
  openRecordInspector: (recordId: string) => Promise<void>;
  requestedProjectId: string | undefined;
  projectId: string;
  searchParams: URLSearchParams;
  setSearchParams: SetURLSearchParams;
}

export const useWorkRouteAndInspectorQueryEffects = ({
  activeProject,
  activeTab,
  hasRequestedProject,
  navigate,
  openRecordInspector,
  requestedProjectId,
  projectId,
  searchParams,
  setSearchParams,
}: UseWorkRouteAndInspectorQueryEffectsParams): void => {
  useEffect(() => {
    if (activeTab !== 'work') {
      return;
    }
    if (activeProject && ((!requestedProjectId) || (activeProject.project_id !== requestedProjectId && hasRequestedProject))) {
      const nextPath = buildProjectWorkHref(projectId, activeProject.project_id);
      const query = searchParams.toString();
      navigate(query ? `${nextPath}?${query}` : nextPath, { replace: true });
    }
  }, [activeProject, activeTab, hasRequestedProject, navigate, requestedProjectId, projectId, searchParams]);

  useEffect(() => {
    const recordId = searchParams.get('record_id');
    if (activeTab !== 'work' || !recordId || !activeProject || (requestedProjectId && !hasRequestedProject)) {
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
  }, [activeProject, activeTab, hasRequestedProject, openRecordInspector, requestedProjectId, searchParams, setSearchParams]);
};
