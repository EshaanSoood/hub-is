import { useCallback, useMemo, type ComponentProps } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { HubBacklink, HubProjectSummary, HubProject, HubProjectMember } from '../../../../services/hub/types';
import { buildProjectOverviewHref, buildProjectWorkHref } from '../../../../lib/hubRoutes';
import { useCalendarRuntime } from '../../../../hooks/useCalendarRuntime';
import { useProjectMutations } from '../../../../hooks/useProjectMutations';
import { useProjectMembers } from '../../../../hooks/useProjectMembers';
import { useProjectFilesRuntime } from '../../../../hooks/useProjectFilesRuntime';
import { useProjectTasksRuntime } from '../../../../hooks/useProjectTasksRuntime';
import { useProjectViewsRuntime } from '../../../../hooks/useProjectViewsRuntime';
import { useQuickCapture } from '../../../../hooks/useQuickCapture';
import { useRemindersRuntime } from '../../../../hooks/useRemindersRuntime';
import { useTimelineRuntime } from '../../../../hooks/useTimelineRuntime';
import { useWorkspaceDocRuntime } from '../../../../hooks/useWorkspaceDocRuntime';
import { withHubMotionState } from '../../../../lib/hubMotionState';
import { adaptTaskSummaries } from '../../../../components/project-space/taskAdapter';
import type { ProjectLateralSource } from '../../../../components/motion/hubMotion';
import { useFocusNodeQueryEffect } from '../../hooks/useFocusNodeQueryEffect';
import { useProjectSpaceInspectorRuntime } from './useProjectSpaceInspectorRuntime';
import { useQuickCaptureQueryIntentEffect } from '../../hooks/useQuickCaptureQueryIntentEffect';
import { useWorkViewWidgetRuntime } from '../../hooks/useWorkViewWidgetRuntime';
import { useWorkRouteAndInspectorQueryEffects } from '../../hooks/useWorkRouteAndInspectorQueryEffects';
import { useProjectSpaceOverviewState } from './useProjectSpaceOverviewState';
import { collectProjectTaskCollectionIds, projectCanEditForUser, readLayoutBool } from '../projectModel';
import { ProjectSpaceInspectorOverlay } from '../ProjectSpaceInspectorOverlay';
import { ProjectSpaceOverviewSurface } from '../ProjectSpaceOverviewSurface';
import { ProjectSpaceWorkSurface } from '../ProjectSpaceWorkSurface';
import type { TimelineEvent, TopLevelProjectTab } from '../types';

export interface UseProjectSpacePageRuntimeParams {
  activeTab: TopLevelProjectTab;
  project: HubProject;
  projects: HubProjectSummary[];
  setProjects: React.Dispatch<React.SetStateAction<HubProjectSummary[]>>;
  projectMembers: HubProjectMember[];
  accessToken: string;
  sessionUserId: string;
  refreshProjectData: () => Promise<void>;
  timeline: TimelineEvent[];
  setTimeline: React.Dispatch<React.SetStateAction<TimelineEvent[]>>;
  prefersReducedMotion: boolean;
}

export interface ProjectSpaceNavigatorProps {
  projectId: string;
  projectName: string;
  activeTab: TopLevelProjectTab;
  currentProjectId: string | undefined;
  activeProject: HubProjectSummary | null;
  openedFromPinned: boolean;
  pinnedProjects: HubProjectSummary[];
  onNavigateOverview: () => void;
  onNavigateWork: () => void;
  onNavigatePinnedProject: (project: HubProjectSummary) => void;
}

export interface UseProjectSpacePageRuntimeResult {
  projectLayoutId: string | undefined;
  navigatorProps: ProjectSpaceNavigatorProps;
  overviewProps: ComponentProps<typeof ProjectSpaceOverviewSurface>;
  workProps: ComponentProps<typeof ProjectSpaceWorkSurface>;
  recordInspectorOverlayProps: ComponentProps<typeof ProjectSpaceInspectorOverlay>;
}

export const useProjectSpacePageRuntime = ({
  activeTab,
  project,
  projects,
  setProjects,
  projectMembers,
  accessToken,
  sessionUserId,
  refreshProjectData,
  timeline,
  setTimeline,
  prefersReducedMotion,
}: UseProjectSpacePageRuntimeParams): UseProjectSpacePageRuntimeResult => {
  const { projectId, workProjectId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { overviewView, setOverviewView } = useProjectSpaceOverviewState({
    activeTab,
    searchParams,
    setSearchParams,
  });

  const { calendarEvents, calendarLoading, calendarMode, refreshCalendar, setCalendarMode } = useCalendarRuntime({
    accessToken,
    projectId: project.space_id,
    initialMode: 'all',
  });
  const { loadProjectTaskPage, projectTasksError, projectTasksLoading, tasksOverviewRows } = useProjectTasksRuntime({
    accessToken,
    projectId: project.space_id,
    activeTab,
    overviewView,
  });

  const activeProject = useMemo(
    () => projects.find((project) => project.project_id === workProjectId) || projects[0] || null,
    [workProjectId, projects],
  );
  const {
    collections,
    views,
    kanbanRuntimeDataByViewId,
    kanbanViews,
    creatingKanbanViewByWidgetId,
    focusedWorkView,
    focusedWorkViewData,
    focusedWorkViewError,
    focusedWorkViewId,
    focusedWorkViewLoading,
    onCreateKanbanRecord,
    onConfigureKanbanGrouping,
    onCreateTableRecord,
    onDeleteKanbanRecord,
    onDeleteTableRecords,
    onBulkUpdateTableRecords,
    onMoveKanbanRecord,
    onEnsureKanbanView,
    onUpdateKanbanRecord,
    onUpdateTableRecord,
    recordsError,
    refreshViewsAndRecords,
    selectedEmbedViewId,
    setRecordsError,
    setSelectedEmbedViewId,
    tableViewRuntimeDataById,
    tableViews,
  } = useProjectViewsRuntime({
    accessToken,
    projectId: project.space_id,
    projectName: project.name,
    activeTab,
    projects,
    sessionUserId,
    setTimeline,
    projectCanEditForUser,
  });
  const {
    ensureProjectAssetRoot,
    onOpenProjectFile,
    onUploadProjectFiles,
    onUploadSpaceFiles,
    projectFiles,
    spaceFiles,
    refreshTrackedSpaceFiles,
  } = useProjectFilesRuntime({
    accessToken,
    projectId: project.space_id,
    projectName: project.name,
    activeProject: activeProject ? { project_id: activeProject.project_id, name: activeProject.name } : null,
    onError: (message) => setRecordsError(message),
  });
  const activeProjectId = activeProject?.project_id || null;
  const activeProjectDocId = activeProject?.doc_id || null;
  const buildProjectNavigationState = useCallback(({
    projectName,
    projectSource,
    extraState,
  }: {
    projectName?: string | null;
    projectSource?: ProjectLateralSource;
    extraState?: unknown;
  }) => withHubMotionState(extraState, {
    hubProjectName: projectName ?? project.name,
    hubProjectSource: projectSource,
  }), [project.name]);

  const navigateToProject = useCallback(({
    projectId: nextProjectId,
    projectName,
    projectSource,
    query,
    extraState,
  }: {
    projectId: string;
    projectName?: string | null;
    projectSource?: ProjectLateralSource;
    query?: string;
    extraState?: unknown;
  }) => {
    const nextHrefBase = buildProjectWorkHref(project.space_id, nextProjectId);
    const nextHref = query ? `${nextHrefBase}?${query}` : nextHrefBase;
    navigate(nextHref, {
      state: buildProjectNavigationState({
        projectName,
        projectSource,
        extraState,
      }),
    });
  }, [buildProjectNavigationState, navigate, project.space_id]);

  const onOpenBacklink = useCallback((backlink: HubBacklink) => {
    if (!backlink.source.project_id) {
      return;
    }
    navigateToProject({
      projectId: backlink.source.project_id,
      projectName: backlink.source.project_name,
      projectSource: 'click',
      extraState: backlink.source.node_key ? { focusNodeKey: backlink.source.node_key } : undefined,
    });
  }, [navigateToProject]);

  const hasRequestedProject = useMemo(
    () => (workProjectId ? projects.some((project) => project.project_id === workProjectId) : false),
    [workProjectId, projects],
  );
  const editableProjects = useMemo(
    () => projects.filter((project) => projectCanEditForUser(project, sessionUserId)),
    [projects, sessionUserId],
  );
  const orderedEditableProjects = useMemo(
    () =>
      [...editableProjects].sort((left, right) => {
        const leftPosition = left.position ?? Number.MAX_SAFE_INTEGER;
        const rightPosition = right.position ?? Number.MAX_SAFE_INTEGER;
        if (leftPosition !== rightPosition) {
          return leftPosition - rightPosition;
        }
        return (left.sort_order ?? Number.MAX_SAFE_INTEGER) - (right.sort_order ?? Number.MAX_SAFE_INTEGER);
      }),
    [editableProjects],
  );
  const readOnlyProjects = useMemo(
    () => projects.filter((project) => !projectCanEditForUser(project, sessionUserId)),
    [projects, sessionUserId],
  );
  const activeProjectCanEdit = useMemo(
    () => projectCanEditForUser(activeProject, sessionUserId),
    [activeProject, sessionUserId],
  );
  const canWriteProject = typeof project.membership_role === 'string' && project.membership_role.toLowerCase() !== 'viewer';
  const activeEditableProjectIndex = useMemo(
    () => orderedEditableProjects.findIndex((project) => project.project_id === activeProject?.project_id),
    [activeProject?.project_id, orderedEditableProjects],
  );
  const pinnedProjects = useMemo(() => projects.filter((project) => project.pinned), [projects]);
  const openedFromPinned = searchParams.get('pinned') === '1';

  const {
    projectMembers: projectMemberList,
    inviteEmail,
    isSubmittingInvite,
    projectMemberMutationError,
    projectMemberMutationNotice,
    clearProjectMemberFeedback,
    onInviteEmailChange,
    onCreateProjectMember,
  } = useProjectMembers({
    accessToken,
    projectId: project.space_id,
    projectMembers,
    refreshProjectData,
  });
  const {
    onCreateProject,
    onDeleteProject,
    onMoveProject,
    onToggleProjectMember,
    onTogglePinned,
    onUpdateProjectFromWorkView,
    projectMutationError,
    setProjectMutationError,
  } = useProjectMutations({
    accessToken,
    projectId: project.space_id,
    projectName: project.name,
    projects,
    refreshProjectData,
    setProjects,
    sessionUserId,
    setTimeline,
  });
  const { refreshTimeline, timelineClusters, timelineFilters, toggleTimelineFilter } = useTimelineRuntime({
    accessToken,
    projectId: project.space_id,
    timeline,
    setTimeline,
  });
  const remindersRuntime = useRemindersRuntime(accessToken, {
    autoload: activeTab === 'work' && Boolean(activeProject?.project_id),
    subscribeToHomeRefresh: activeTab === 'work' && Boolean(activeProject?.project_id),
    subscribeToLive: activeTab === 'work' && Boolean(activeProject?.project_id),
    scope: 'project',
    projectId: project.space_id,
    sourceProjectId: activeTab === 'work' ? activeProject?.project_id ?? null : null,
    sourceViewId: activeTab === 'work' ? focusedWorkViewId || null : null,
  });
  const {
    openRecordInspector,
    recordInspectorOverlayProps,
  } = useProjectSpaceInspectorRuntime({
    accessToken,
    project,
    projects,
    activeTab,
    activeProjectId,
    sessionUserId,
    refreshViewsAndRecords,
    setTimeline,
    ensureProjectAssetRoot,
    refreshTrackedProjectFiles: refreshTrackedSpaceFiles,
    prefersReducedMotion,
    navigate,
    onOpenBacklink,
  });
  const onOpenRecord = useCallback((recordId: string) => {
    void openRecordInspector(recordId);
  }, [openRecordInspector]);
  const { createAndOpenCaptureRecord, quickCaptureInFlightRef } = useQuickCapture({
    accessToken,
    projectId: project.space_id,
    projectName: project.name,
    activeTab,
    activeProject,
    activeProjectCanEdit,
    collections,
    focusedWorkViewId,
    openRecordInspector,
    refreshViewsAndRecords,
    setProjectMutationError,
  });

  useWorkRouteAndInspectorQueryEffects({
    activeProject,
    activeTab,
    hasRequestedProject,
    navigate,
    openRecordInspector,
    requestedProjectId: workProjectId,
    projectId: project.space_id,
    searchParams,
    setSearchParams,
  });

  useQuickCaptureQueryIntentEffect({
    createAndOpenCaptureRecord,
    quickCaptureInFlightRef,
    searchParams,
    setSearchParams,
  });

  const onDeleteProjectWithNavigation = useCallback(async (project: HubProjectSummary) => {
    const nextPath = await onDeleteProject(project, activeProject?.project_id ?? null);
    if (nextPath) {
      navigate(nextPath, {
        state: withHubMotionState(undefined, {
          hubProjectName: project.name,
        }),
      });
    }
  }, [activeProject?.project_id, navigate, onDeleteProject, project.name]);

  const {
    collabSession,
    collabSessionError,
    commentTriggerRef,
    docBootstrapLexicalState,
    docBootstrapReady,
    docCommentComposerOpen,
    docCommentError,
    docCommentText,
    docComments,
    onAddDocComment,
    onDocCommentDialogOpenChange,
    onDocEditorChange,
    onInsertDocMention,
    onJumpToDocComment,
    onResolveDocComment,
    onUploadDocAsset,
    orphanedDocComments,
    pendingDocAssetEmbed,
    pendingDocFocusNodeKey,
    pendingDocMentionInsert,
    pendingViewEmbedInsert,
    queueViewEmbed,
    selectedDocNodeKey,
    setDocCommentText,
    setPendingDocAssetEmbed,
    setPendingDocFocusNodeKey,
    setPendingDocMentionInsert,
    setPendingViewEmbedInsert,
    setSelectedDocNodeKey,
    setShowResolvedDocComments,
    showResolvedDocComments,
    uploadingDocAsset,
  } = useWorkspaceDocRuntime({
    accessToken,
    activeProjectDocId,
    projectId: project.space_id,
    activeProjectId: activeProject?.project_id || null,
    activeTab,
    ensureProjectAssetRoot,
    refreshTrackedProjectFiles: refreshTrackedSpaceFiles,
    refreshTimeline,
  });

  const onInsertViewEmbed = useCallback(() => {
    if (!selectedEmbedViewId) {
      return;
    }
    queueViewEmbed(selectedEmbedViewId);
  }, [queueViewEmbed, selectedEmbedViewId]);
  const onCloseFocusedView = useCallback(() => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete('view_id');
      return next;
    }, { replace: true });
  }, [setSearchParams]);
  const onOpenEmbeddedView = useCallback((viewId: string) => {
    const targetView = views.find((view) => view.view_id === viewId);
    if (!activeProject || !targetView) {
      if (activeProject) {
        navigateToProject({
          projectId: activeProject.project_id,
          projectName: activeProject.name,
          projectSource: 'click',
        });
      }
      return;
    }
    if (targetView.type === 'kanban') {
      navigate(`${buildProjectOverviewHref(project.space_id)}?view=kanban&kanban_view_id=${encodeURIComponent(viewId)}`, {
        state: withHubMotionState(undefined, {
          hubProjectName: project.name,
        }),
      });
      return;
    }
    if (targetView.type === 'calendar') {
      navigate(`${buildProjectOverviewHref(project.space_id)}?view=calendar`, {
        state: withHubMotionState(undefined, {
          hubProjectName: project.name,
        }),
      });
      return;
    }
    if (targetView.type === 'timeline') {
      navigate(`${buildProjectOverviewHref(project.space_id)}?view=timeline`, {
        state: withHubMotionState(undefined, {
          hubProjectName: project.name,
        }),
      });
      return;
    }
    navigateToProject({
      projectId: activeProject.project_id,
      projectName: activeProject.name,
      projectSource: 'click',
      query: `view_id=${encodeURIComponent(viewId)}`,
    });
  }, [activeProject, navigate, navigateToProject, project.name, project.space_id, views]);

  useFocusNodeQueryEffect({
    activeProjectDocId,
    locationPathname: location.pathname,
    locationState: location.state,
    navigate,
    searchParams,
    setPendingDocFocusNodeKey,
  });

  const widgetsEnabled = useMemo(
    () => (activeProject ? readLayoutBool(activeProject.layout_config, 'widgets_enabled', true) : true),
    [activeProject],
  );
  const workspaceEnabled = useMemo(
    () => (activeProject ? readLayoutBool(activeProject.layout_config, 'workspace_enabled', true) : true),
    [activeProject],
  );
  const handleToggleActiveProjectRegion = useCallback(
    (region: 'widgets_enabled' | 'workspace_enabled') => {
      if (!activeProject || !activeProjectCanEdit) {
        return;
      }

      const nextWidgetsEnabled = region === 'widgets_enabled' ? !widgetsEnabled : widgetsEnabled;
      const nextWorkspaceEnabled = region === 'workspace_enabled' ? !workspaceEnabled : workspaceEnabled;
      if (!nextWidgetsEnabled && !nextWorkspaceEnabled) {
        setProjectMutationError('A project must keep at least one region enabled.');
        return;
      }

      void onUpdateProjectFromWorkView(activeProject.project_id, {
        layout_config: {
          ...activeProject.layout_config,
          widgets_enabled: nextWidgetsEnabled,
          workspace_enabled: nextWorkspaceEnabled,
        },
      });
    },
    [
      activeProject,
      activeProjectCanEdit,
      widgetsEnabled,
      onUpdateProjectFromWorkView,
      setProjectMutationError,
      workspaceEnabled,
    ],
  );
  const projectTaskCollectionIds = useMemo(
    () => collectProjectTaskCollectionIds(activeProject?.layout_config, views),
    [activeProject?.layout_config, views],
  );
  const projectTaskItems = useMemo(
    () =>
      adaptTaskSummaries(
        tasksOverviewRows.filter((task) => {
          if (!activeProjectId) {
            return false;
          }
          return task.source_project?.project_id === activeProjectId;
        }),
      ),
    [activeProjectId, tasksOverviewRows],
  );
  const activeProjectTaskCollectionId = useMemo(
    () => tasksOverviewRows.find((task) => task.source_project?.project_id === activeProjectId)?.collection_id ?? null,
    [activeProjectId, tasksOverviewRows],
  );
  const taskCollectionId = projectTaskCollectionIds[0] || activeProjectTaskCollectionId;
  const {
    tableContract,
    kanbanContract,
    calendarContract,
    filesContract,
    scratchPadContract,
    tasksContract,
    timelineContract,
    remindersContract,
  } = useWorkViewWidgetRuntime({
    activeProjectId: activeProject?.project_id ?? null,
    activeProjectName: activeProject?.name ?? null,
    activeProjectCanEdit,
    accessToken,
    canWriteProject,
    projectId: project.space_id,
    projectName: project.name,
    setRecordsError,
    tableViews,
    tableViewRuntimeDataById,
    onCreateTableRecord,
    onUpdateTableRecord,
    onDeleteTableRecords,
    onBulkUpdateTableRecords,
    kanbanViews,
    kanbanRuntimeDataByViewId,
    creatingKanbanViewByWidgetId,
    onMoveKanbanRecord,
    onCreateKanbanRecord,
    onConfigureKanbanGrouping,
    onUpdateKanbanRecord,
    onDeleteKanbanRecord,
    onEnsureKanbanView,
    calendarEvents,
    calendarLoading,
    calendarMode,
    refreshCalendar,
    setCalendarMode,
    projectFiles,
    spaceFiles,
    onUploadProjectFiles,
    onUploadSpaceFiles,
    onOpenProjectFile,
    projectTaskItems,
    projectTasksLoading,
    taskCollectionId,
    loadProjectTaskPage,
    timelineClusters,
    timelineFilters,
    toggleTimelineFilter,
    refreshProjectData,
    openRecordInspector,
    reminders: remindersRuntime.reminders,
    remindersLoading: remindersRuntime.loading,
    remindersError: remindersRuntime.error,
    onDismissReminder: remindersRuntime.dismiss,
    onCreateReminder: remindersRuntime.create,
  });
  const focusedKanbanRuntime = focusedWorkView ? kanbanRuntimeDataByViewId[focusedWorkView.view_id] ?? null : null;
  const projectLayoutId = !prefersReducedMotion ? `project-${project.space_id}` : undefined;
  const workLayoutId = !prefersReducedMotion && activeProject ? `project-${activeProject.project_id}` : undefined;

  return {
    projectLayoutId,
    navigatorProps: {
      projectId: project.space_id,
      projectName: project.name,
      activeTab,
      currentProjectId: activeProject?.project_id ?? workProjectId,
      activeProject,
      openedFromPinned,
      pinnedProjects,
      onNavigateOverview: () => {
        navigate(buildProjectOverviewHref(project.space_id), {
          state: withHubMotionState(undefined, {
            hubProjectName: project.name,
            ...(activeTab === 'work' ? { hubAnnouncement: `Back to ${project.name}` } : {}),
          }),
        });
      },
      onNavigateWork: () => {
        if (!activeProject?.project_id) {
          navigate(buildProjectWorkHref(project.space_id), {
            state: withHubMotionState(undefined, {
              hubProjectName: project.name,
            }),
          });
          return;
        }
        navigateToProject({
          projectId: activeProject.project_id,
          projectName: activeProject.name,
          projectSource: 'click',
        });
      },
      onNavigatePinnedProject: (project) => {
        navigateToProject({
          projectId: project.project_id,
          projectName: project.name,
          projectSource: 'click',
          query: 'pinned=1',
        });
      },
    },
    overviewProps: {
      projectName: project.name,
      projectId: project.space_id,
      isPersonalProject: project.is_personal,
      projectMemberList,
      accessToken,
      overviewView,
      onSelectOverviewView: setOverviewView,
      timelineClusters,
      timelineFilters,
      onTimelineFilterToggle: toggleTimelineFilter,
      onOpenRecord,
      calendarEvents,
      calendarLoading,
      calendarMode,
      onCalendarScopeChange: setCalendarMode,
      tasks: tasksOverviewRows,
      tasksLoading: projectTasksLoading,
      tasksError: projectTasksError,
      onRefreshTasks: () => {
        void loadProjectTaskPage();
      },
      inviteEmail,
      inviteSubmitting: isSubmittingInvite,
      inviteError: projectMemberMutationError,
      inviteNotice: projectMemberMutationNotice,
      onInviteEmailChange,
      onInviteSubmit: () => {
        void onCreateProjectMember();
      },
      onDismissInviteFeedback: clearProjectMemberFeedback,
    },
    workProps: {
      projectId,
      hasRequestedProject,
      activeProject,
      activeProjectCanEdit,
      widgetsEnabled,
      workLayoutId,
      recordsError,
      projectChromeProps: {
        projectId: project.space_id,
        activeProject,
        activeProjectCanEdit,
        canWriteProject,
        openedFromPinned,
        orderedEditableProjects,
        readOnlyProjects,
        projectMemberList,
        sessionUserId,
        activeEditableProjectIndex,
        widgetsEnabled,
        workspaceEnabled,
        projectMutationError,
        filesContract,
        scratchPadContract,
        onNavigateToProject: navigateToProject,
        onCreateProject,
        onMoveProject,
        onTogglePinned,
        onToggleProjectMember,
        onDeleteProject: onDeleteProjectWithNavigation,
        onUpdateProject: onUpdateProjectFromWorkView,
        onToggleActiveProjectRegion: handleToggleActiveProjectRegion,
      },
      focusedViewProps: {
        focusedWorkView,
        focusedWorkViewError,
        focusedWorkViewLoading,
        focusedWorkViewData,
        focusedKanbanRuntime,
        activeProjectCanEdit,
        activeProjectId: activeProject?.project_id ?? null,
        onCloseFocusedView,
        onOpenRecord,
        onCreateKanbanRecord,
        onConfigureKanbanGrouping,
        onDeleteKanbanRecord,
        onMoveKanbanRecord,
        onUpdateKanbanRecord,
      },
      workViewProps: {
        onUpdateProject: onUpdateProjectFromWorkView,
        onOpenRecord,
        tableContract,
        kanbanContract,
        calendarContract,
        tasksContract,
        timelineContract,
        remindersContract,
      },
      workspaceDocProps: {
        accessToken,
        projectId: project.space_id,
        projectMembers,
        sessionUserId,
        activeProject,
        activeProjectCanEdit,
        workspaceEnabled,
        activeProjectDocId,
        docBootstrapReady,
        docBootstrapLexicalState,
        collabSession,
        collabSessionError,
        onDocEditorChange,
        selectedDocNodeKey,
        setSelectedDocNodeKey,
        pendingDocFocusNodeKey,
        setPendingDocFocusNodeKey,
        pendingDocMentionInsert,
        setPendingDocMentionInsert,
        pendingViewEmbedInsert,
        setPendingViewEmbedInsert,
        pendingDocAssetEmbed,
        setPendingDocAssetEmbed,
        onInsertDocMention,
        views,
        selectedEmbedViewId,
        setSelectedEmbedViewId,
        onInsertViewEmbed,
        onOpenRecord,
        onOpenEmbeddedView,
        uploadingDocAsset,
        onUploadDocAsset,
        docCommentComposerOpen,
        commentTriggerRef,
        onDocCommentDialogOpenChange,
        docCommentError,
        docCommentText,
        setDocCommentText,
        onAddDocComment,
        docComments,
        orphanedDocComments,
        onResolveDocComment,
        onJumpToDocComment,
        showResolvedDocComments,
        setShowResolvedDocComments,
      },
    },
    recordInspectorOverlayProps,
  };
};
