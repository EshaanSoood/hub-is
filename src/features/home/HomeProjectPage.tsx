import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { InlineNotice } from '../../components/primitives';
import { useAuthz } from '../../context/AuthzContext';
import { useProjects } from '../../context/ProjectsContext';
import { useDashboardMutations } from '../PersonalizedDashboardPanel/hooks/useDashboardMutations';
import { useCalendarRuntime } from '../../hooks/useCalendarRuntime';
import { useProjectBootstrap } from '../../hooks/useProjectBootstrap';
import { useProjectTasksRuntime } from '../../hooks/useProjectTasksRuntime';
import { useRemindersRuntime } from '../../hooks/useRemindersRuntime';
import { useTimelineRuntime } from '../../hooks/useTimelineRuntime';
import { updateProject } from '../../services/hub/projects';
import { HomeDashboardSurface } from './HomeDashboardSurface';
import { HomeOverviewSurface } from './HomeOverviewSurface';
import { HomeProjectNamingDialog } from './HomeProjectNamingDialog';
import { HomeProjectWorkSection } from './HomeProjectWorkSection';
import { HomeRecordInspectorDialog } from './HomeRecordInspectorDialog';
import { HomeProjectSectionHeader, suppressNextHomeProjectHeaderFocus } from './HomeProjectSectionHeader';
import { HomeShell } from './HomeShell';
import { HomeThoughtPileOverlay } from './HomeThoughtPileOverlay';
import {
  focusHomeLauncher,
  parseHomeContentViewId,
  parseHomeOverviewViewId,
  parseHomeOverlayId,
  parseHomePaneId,
  parseHomeTabId,
  parseHomeTaskRecordId,
  type HomeOverviewViewId,
  type HomeTabId,
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
  const location = useLocation();
  const navigate = useNavigate();
  const { accessToken, sessionSummary } = useAuthz();
  const { projects, refreshProjects } = useProjects();
  const activeTab = parseHomeTabId(searchParams.get('tab'));
  const activeContentView = parseHomeContentViewId(searchParams.get('content') ?? searchParams.get('view'));
  const activeOverviewView = parseHomeOverviewViewId(searchParams.get('overview'));
  const activeOverlay = parseHomeOverlayId(searchParams.get('surface'));
  const activePaneId = parseHomePaneId(searchParams.get('pane'));
  const homeRuntime = useHomeRuntime({ accessToken, activeOverlay });
  const homeRecordInspector = useHomeRecordInspectorRuntime({ accessToken });
  const homeIdentity = useHomeSurfaceIdentity({
    backendPersonalProjectId: homeRuntime.homeData.personal_project_id,
    projects,
  });
  const { openRecord } = homeRecordInspector;
  const autoFocusHeading = true;
  const [projectNameDraft, setProjectNameDraft] = useState(homeIdentity.projectName);
  const [projectNameSaving, setProjectNameSaving] = useState(false);
  const [projectNameError, setProjectNameError] = useState<string | null>(null);

  const projectBootstrap = useProjectBootstrap({
    accessToken,
    projectId: homeIdentity.backingProjectId ?? '',
  });
  const projectRuntimeEnabled = Boolean(accessToken && homeIdentity.backingProjectId);
  const calendarRuntime = useCalendarRuntime({
    accessToken: accessToken ?? '',
    projectId: homeIdentity.backingProjectId ?? '',
    initialMode: 'all',
    enabled: projectRuntimeEnabled,
  });
  const tasksRuntime = useProjectTasksRuntime({
    accessToken: accessToken ?? '',
    projectId: homeIdentity.backingProjectId ?? '',
    activeTab,
    overviewView: (activeOverviewView === 'reminders' ? 'timeline' : activeOverviewView) as Exclude<HomeOverviewViewId, 'reminders'>,
    enabled: projectRuntimeEnabled,
  });
  const projectRemindersRuntime = useRemindersRuntime(accessToken ?? null, {
    autoload: projectRuntimeEnabled && activeTab === 'overview' && activeContentView === 'project' && activeOverviewView === 'reminders',
    subscribeToHomeRefresh: true,
    subscribeToLive: true,
    scope: 'project',
    projectId: homeIdentity.backingProjectId ?? undefined,
  });
  const homeReminderMutations = useDashboardMutations({
    accessToken,
    refreshReminders: projectRemindersRuntime.refresh,
  });
  const timelineRuntime = useTimelineRuntime({
    accessToken: accessToken ?? '',
    projectId: homeIdentity.backingProjectId ?? '',
    timeline: projectBootstrap.timeline,
    setTimeline: projectBootstrap.setTimeline,
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

  const onSelectTab = useCallback((tab: HomeTabId) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete('surface');
      next.delete('record_id');
      next.delete('view_id');
      if (tab === 'overview') {
        next.delete('tab');
        next.delete('pane');
        next.delete('pinned');
      } else {
        next.set('tab', 'work');
      }
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const closeQuickThoughts = useCallback((options?: { restoreFocus?: boolean }) => {
    suppressNextHomeProjectHeaderFocus();
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete('surface');
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
      await updateProject(accessToken, homeIdentity.backingProjectId, {
        name: nextName,
      });
      await refreshProjects();
    } catch (error) {
      setProjectNameError(error instanceof Error ? error.message : 'Failed to save space name.');
    } finally {
      setProjectNameSaving(false);
    }
  }, [accessToken, homeIdentity.backingProjectId, projectNameDraft, refreshProjects]);

  const overviewProjectContent = !projectRuntimeEnabled ? (
    <section className="rounded-panel border border-subtle bg-elevated p-4" role="status" aria-live="polite">
      Loading your personal space…
    </section>
  ) : projectBootstrap.loading ? (
    <section className="rounded-panel border border-subtle bg-elevated p-4" role="status" aria-live="polite">
      Loading your space overview…
    </section>
  ) : projectBootstrap.error || !projectBootstrap.project ? (
    <InlineNotice variant="danger" title="Space load failed">
      {projectBootstrap.error || 'Your personal space is unavailable.'}
    </InlineNotice>
  ) : (
    <>
      <HomeOverviewSurface
        accessToken={accessToken ?? ''}
        activeOverlay={activeOverlay}
        activeTab={activeTab}
        activeView={activeOverviewView}
        autoFocusTabs={autoFocusHeading}
        calendarEvents={calendarRuntime.calendarEvents}
        calendarLoading={calendarRuntime.calendarLoading}
        calendarScope={calendarRuntime.calendarMode}
        onCalendarScopeChange={calendarRuntime.setCalendarMode}
        onCreateReminder={projectRemindersRuntime.create}
        onDismissReminder={homeReminderMutations.onDismissReminder}
        onOpenRecord={openRecord}
        onRefreshTasks={() => {
          void tasksRuntime.loadProjectTaskPage();
        }}
        onSelectTab={onSelectTab}
        onSelectView={(view) => {
          setSearchParams((current) => {
            const next = new URLSearchParams(current);
            if (view === 'timeline') {
              next.delete('overview');
            } else {
              next.set('overview', view);
            }
            return next;
          }, { replace: true });
        }}
        onSnoozeReminder={homeReminderMutations.onSnoozeReminder}
        projectId={projectBootstrap.project.project_id}
        projectName={projectBootstrap.project.name}
        reminders={projectRemindersRuntime.reminders}
        remindersError={projectRemindersRuntime.error}
        remindersLoading={projectRemindersRuntime.loading}
        tasks={tasksRuntime.tasksOverviewRows}
        tasksError={tasksRuntime.projectTasksError}
        tasksLoading={tasksRuntime.projectTasksLoading}
        timelineClusters={timelineRuntime.timelineClusters}
        timelineFilters={timelineRuntime.timelineFilters}
        onTimelineFilterToggle={timelineRuntime.toggleTimelineFilter}
      />
    </>
  );

  const workContent = !projectRuntimeEnabled ? (
    <section className="rounded-panel border border-subtle bg-elevated p-4" role="status" aria-live="polite">
      Loading your work surface…
    </section>
  ) : projectBootstrap.loading ? (
    <section className="rounded-panel border border-subtle bg-elevated p-4" role="status" aria-live="polite">
      Loading your work surface…
    </section>
  ) : projectBootstrap.error || !projectBootstrap.project ? (
    <InlineNotice variant="danger" title="Space load failed">
      {projectBootstrap.error || 'Your personal space is unavailable.'}
    </InlineNotice>
  ) : (
    <>
      <HomeProjectSectionHeader
        activeOverlay={activeOverlay}
        activeTab={activeTab}
        autoFocusTabs={autoFocusHeading}
        onSelectTab={onSelectTab}
        projectName={projectBootstrap.project.name}
      />
      <HomeProjectWorkSection
        accessToken={accessToken ?? ''}
        activeTab={activeTab}
        calendarEvents={calendarRuntime.calendarEvents}
        calendarLoading={calendarRuntime.calendarLoading}
        calendarMode={calendarRuntime.calendarMode}
        loadProjectTaskPage={tasksRuntime.loadProjectTaskPage}
        locationPathname={location.pathname}
        locationState={location.state}
        navigate={navigate}
        paneId={activePaneId}
        panes={projectBootstrap.panes}
        project={projectBootstrap.project}
        projectMembers={projectBootstrap.projectMembers}
        projectTasksLoading={tasksRuntime.projectTasksLoading}
        refreshCalendar={calendarRuntime.refreshCalendar}
        refreshProjectData={projectBootstrap.refreshProjectData}
        searchParams={searchParams}
        sessionUserId={sessionSummary.userId}
        setPanes={projectBootstrap.setPanes}
        setSearchParams={setSearchParams}
        setTimeline={projectBootstrap.setTimeline}
        setCalendarMode={calendarRuntime.setCalendarMode}
        tasksOverviewRows={tasksRuntime.tasksOverviewRows}
        timeline={projectBootstrap.timeline}
      />
    </>
  );

  return (
    <>
      <HomeShell
        activeTab={activeTab}
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
        overviewContent={(
          <HomeDashboardSurface
            activeContentView={activeContentView}
            homeError={homeRuntime.homeError}
            onOpenRecord={openRecord}
            projectContent={overviewProjectContent}
            projects={projects}
            runtime={homeRuntime}
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
        workContent={workContent}
      />
      <HomeRecordInspectorDialog runtime={homeRecordInspector} />
    </>
  );
};
