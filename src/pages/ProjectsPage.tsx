import { useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuthz } from '../context/AuthzContext';
import { useProjects } from '../context/ProjectsContext';
import { HomeRecordInspectorDialog } from '../features/home/HomeRecordInspectorDialog';
import { HomeShell } from '../features/home/HomeShell';
import { parseHomeOverlayId, parseHomeTaskRecordId, parseHomeViewId, type HomeViewId } from '../features/home/navigation';
import { useHomeRecordInspectorRuntime } from '../features/home/useHomeRecordInspectorRuntime';
import { useHomeRuntime } from '../features/home/useHomeRuntime';
import { useHomeSurfaceIdentity } from '../features/home/useHomeSurfaceIdentity';

export const ProjectsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { projects } = useProjects();
  const { accessToken } = useAuthz();
  const activeView = parseHomeViewId(searchParams.get('view'));
  const activeOverlay = parseHomeOverlayId(searchParams.get('surface'));
  const homeRuntime = useHomeRuntime({ accessToken, activeOverlay });
  const homeRecordInspector = useHomeRecordInspectorRuntime({ accessToken });
  const homeIdentity = useHomeSurfaceIdentity({
    backendPersonalProjectId: homeRuntime.homeData.personal_project_id,
    projects,
  });
  const { openRecord } = homeRecordInspector;

  useEffect(() => {
    const rawTaskId = searchParams.get('task_id');
    if (rawTaskId == null) {
      return;
    }

    const taskId = parseHomeTaskRecordId(rawTaskId);

    if (taskId) {
      openRecord(taskId);
    }
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete('task_id');
      return next;
    }, { replace: true });
  }, [openRecord, searchParams, setSearchParams]);

  const onViewChange = useCallback((view: HomeViewId) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set('view', view);
      next.delete('surface');
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const onClearOverlay = useCallback(() => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete('surface');
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  return (
    <>
      <HomeShell
        accessToken={accessToken}
        activeOverlay={activeOverlay}
        activeView={activeView}
        identity={homeIdentity}
        onClearOverlay={onClearOverlay}
        onOpenRecord={openRecord}
        onViewChange={onViewChange}
        projects={projects}
        runtime={homeRuntime}
      />
      <HomeRecordInspectorDialog runtime={homeRecordInspector} />
    </>
  );
};
