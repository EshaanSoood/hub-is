import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuthz } from '../../context/AuthzContext';
import { useProjects } from '../../context/ProjectsContext';
import { useCalendarRuntime } from '../../hooks/useCalendarRuntime';
import { useProjectTasksRuntime } from '../../hooks/useProjectTasksRuntime';
import { updateSpace } from '../../services/hub/spaces';
import { HomeDashboardSurface } from './HomeDashboardSurface';
import { HomeProjectNamingDialog } from './HomeProjectNamingDialog';
import { HomeRecordInspectorDialog } from './HomeRecordInspectorDialog';
import { HomeShell } from './HomeShell';
import { HomeThoughtPileOverlay } from './HomeThoughtPileOverlay';
import {
  focusHomeLauncher,
  parseHomeOverlayId,
  parseHomeSurfaceId,
  parseHomeTaskRecordId,
} from './navigation';
import { useHomeRecordInspectorRuntime } from './useHomeRecordInspectorRuntime';
import { useHomeRuntime } from './useHomeRuntime';
import { useHomeSurfaceIdentity } from './useHomeSurfaceIdentity';

const focusHomeFallbackTarget = (): void => {
  const mainContent = document.getElementById('main-content');
  if (!(mainContent instanceof HTMLElement)) {
    return;
  }
  if (!mainContent.hasAttribute('tabindex')) {
    mainContent.setAttribute('tabindex', '-1');
  }
  mainContent.focus();
};

export const HomeProjectPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { accessToken } = useAuthz();
  const { projects, refreshProjects } = useProjects();
  const rawSurface = searchParams.get('surface');
  const activeSurface = parseHomeSurfaceId(rawSurface);
  const activeOverlay = parseHomeOverlayId(searchParams.get('overlay') ?? (rawSurface === 'thoughts' ? rawSurface : null));
  const homeRuntime = useHomeRuntime({ accessToken, activeOverlay });
  const homeRecordInspector = useHomeRecordInspectorRuntime({ accessToken });
  const homeIdentity = useHomeSurfaceIdentity({
    backendPersonalProjectId: homeRuntime.homeData.personal_space_id,
    projects,
  });
  const { openRecord } = homeRecordInspector;
  const [projectNameDraft, setProjectNameDraft] = useState(homeIdentity.projectName);
  const [projectNameSaving, setProjectNameSaving] = useState(false);
  const [projectNameError, setProjectNameError] = useState<string | null>(null);

  const calendarRuntime = useCalendarRuntime({
    accessToken: accessToken ?? '',
    initialMode: 'relevant',
    enabled: Boolean(accessToken),
  });
  const tasksRuntime = useProjectTasksRuntime({
    accessToken: accessToken ?? '',
    enabled: Boolean(accessToken),
    autoload: activeSurface === 'tasks',
    taskQuery: { lens: 'assigned' },
  });

  const requiresNamePrompt = Boolean(homeIdentity.backingProject?.isPersonal && homeIdentity.backingProject?.needsNamePrompt);

  useEffect(() => {
    setProjectNameDraft(homeIdentity.projectName);
  }, [homeIdentity.projectName]);

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
      next.delete('intent');
      return next;
    }, { replace: true });
  }, [openRecord, searchParams, setSearchParams]);

  const closeQuickThoughts = useCallback((options?: { restoreFocus?: boolean }) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete('overlay');
      if (next.get('surface') === 'thoughts') {
        next.delete('surface');
      }
      return next;
    }, { replace: true });

    if (options?.restoreFocus === false) {
      return;
    }

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (!focusHomeLauncher('thoughts')) {
          focusHomeFallbackTarget();
        }
      });
    });
  }, [setSearchParams]);

  const saveProjectName = useCallback(async () => {
    if (!accessToken || !homeIdentity.backingProjectId) {
      return;
    }

    const nextName = projectNameDraft.trim();
    if (!nextName) {
      setProjectNameError('Space name is required.');
      return;
    }

    setProjectNameSaving(true);
    setProjectNameError(null);
    try {
      await updateSpace(accessToken, homeIdentity.backingProjectId, {
        name: nextName,
      });
      await refreshProjects();
    } catch (error) {
      setProjectNameError(error instanceof Error ? error.message : 'Failed to save space name.');
    } finally {
      setProjectNameSaving(false);
    }
  }, [accessToken, homeIdentity.backingProjectId, projectNameDraft, refreshProjects]);

  return (
    <>
      <HomeShell
        namingDialog={(
          <HomeProjectNamingDialog
            error={projectNameError}
            onSubmit={saveProjectName}
            onValueChange={setProjectNameDraft}
            open={requiresNamePrompt}
            projectName={projectNameDraft}
            saving={projectNameSaving}
          />
        )}
        content={(
          <HomeDashboardSurface
            accessToken={accessToken ?? ''}
            activeSurface={activeSurface}
            calendarEvents={calendarRuntime.calendarEvents}
            calendarLoading={calendarRuntime.calendarLoading}
            calendarScope={calendarRuntime.calendarMode}
            homeError={homeRuntime.homeError}
            onCalendarScopeChange={calendarRuntime.setCalendarMode}
            onOpenRecord={openRecord}
            onRefreshTasks={() => {
              void tasksRuntime.loadProjectTaskPage();
            }}
            onSelectSurface={(surface) => {
              setSearchParams((current) => {
                const next = new URLSearchParams(current);
                next.delete('tab');
                next.delete('content');
                next.delete('view');
                next.delete('overview');
                next.delete('project');
                next.delete('pinned');
                next.delete('record_id');
                next.delete('view_id');
                if (surface === 'hub') {
                  next.delete('surface');
                } else {
                  next.set('surface', surface);
                }
                return next;
              }, { replace: true });
            }}
            projects={projects}
            runtime={homeRuntime}
            tasks={tasksRuntime.tasksOverviewRows}
            tasksError={tasksRuntime.projectTasksError}
            tasksLoading={tasksRuntime.projectTasksLoading}
          />
        )}
        quickThoughts={(
          <HomeThoughtPileOverlay
            accessToken={accessToken}
            activeOverlay={activeOverlay}
            identity={homeIdentity}
            onClose={closeQuickThoughts}
            projects={projects}
          />
        )}
      />
      <HomeRecordInspectorDialog runtime={homeRecordInspector} />
    </>
  );
};
