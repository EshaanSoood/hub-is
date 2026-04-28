import { useCallback, useEffect, useMemo, type ComponentProps } from 'react';
import type { NavigateFunction, SetURLSearchParams } from 'react-router-dom';
import type { HubBacklink, HubProjectSummary, HubProject, HubProjectMember, HubTaskSummary } from '../../services/hub/types';
import { useProjectDocsRuntime } from '../../hooks/useProjectDocsRuntime';
import { useProjectMutations } from '../../hooks/useProjectMutations';
import { useProjectFilesRuntime } from '../../hooks/useProjectFilesRuntime';
import { useProjectViewsRuntime } from '../../hooks/useProjectViewsRuntime';
import { useRemindersRuntime } from '../../hooks/useRemindersRuntime';
import { useTimelineRuntime } from '../../hooks/useTimelineRuntime';
import { useWorkspaceDocRuntime } from '../../hooks/useWorkspaceDocRuntime';
import { withHubMotionState } from '../../lib/hubMotionState';
import { adaptTaskSummaries } from '../../components/project-space/taskAdapter';
import { CalendarWidgetSkin } from '../../components/project-space/CalendarWidgetSkin';
import { useFocusNodeQueryEffect } from '../../pages/ProjectSpacePage/hooks/useFocusNodeQueryEffect';
import { useWorkViewWidgetRuntime } from '../../pages/ProjectSpacePage/hooks/useWorkViewWidgetRuntime';
import { useProjectSpaceInspectorRuntime } from '../../pages/ProjectSpacePage/ProjectSpaceWorkspace/hooks/useProjectSpaceInspectorRuntime';
import { projectCanEditForUser, readLayoutBool, collectProjectTaskCollectionIds } from '../../pages/ProjectSpacePage/ProjectSpaceWorkspace/projectModel';
import { buildHomeTabHref, type HomeTabId } from './navigation';
import { ProjectSpaceInspectorOverlay } from '../../pages/ProjectSpacePage/ProjectSpaceWorkspace/ProjectSpaceInspectorOverlay';
import { ProjectSpaceWorkSurface } from '../../pages/ProjectSpacePage/ProjectSpaceWorkspace/ProjectSpaceWorkSurface';
import type { TimelineEvent } from '../../pages/ProjectSpacePage/ProjectSpaceWorkspace/types';
import type { ProjectLateralSource } from '../../components/motion/hubMotion';

interface UseHomeProjectWorkRuntimeParams {
  accessToken: string;
  activeTab: HomeTabId;
  calendarEvents: ComponentProps<typeof CalendarWidgetSkin>['events'];
  calendarLoading: boolean;
  calendarMode: 'relevant' | 'all';
  loadProjectTaskPage: () => Promise<void>;
  locationPathname: string;
  locationState: unknown;
  navigate: NavigateFunction;
  projectId: string | null;
  projects: HubProjectSummary[];
  prefersReducedMotion: boolean;
  project: HubProject;
  projectMembers: HubProjectMember[];
  projectTasksLoading: boolean;
  refreshCalendar: () => Promise<void>;
  refreshProjectData: () => Promise<void>;
  searchParams: URLSearchParams;
  sessionUserId: string;
  setProjects: React.Dispatch<React.SetStateAction<HubProjectSummary[]>>;
  setSearchParams: SetURLSearchParams;
  setTimeline: React.Dispatch<React.SetStateAction<TimelineEvent[]>>;
  setCalendarMode: React.Dispatch<React.SetStateAction<'relevant' | 'all'>>;
  tasksOverviewRows: HubTaskSummary[];
  timeline: TimelineEvent[];
}

interface HomeProjectWorkRuntime {
  inspectorOverlayProps: ComponentProps<typeof ProjectSpaceInspectorOverlay>;
  workSurfaceProps: ComponentProps<typeof ProjectSpaceWorkSurface>;
}

const parseHomeWorkQuery = (query?: string): { extraParams: Record<string, string>; pinned: boolean } => {
  const params = new URLSearchParams(query ?? '');
  const pinned = params.get('pinned') === '1';
  params.delete('pinned');
  return {
    extraParams: Object.fromEntries(params.entries()),
    pinned,
  };
};

export const useHomeProjectWorkRuntime = ({
  accessToken,
  activeTab,
  calendarEvents,
  calendarLoading,
  calendarMode,
  loadProjectTaskPage,
  locationPathname,
  locationState,
  navigate,
  projectId,
  projects,
  prefersReducedMotion,
  project,
  projectMembers,
  projectTasksLoading,
  refreshCalendar,
  refreshProjectData,
  searchParams,
  sessionUserId,
  setProjects,
  setSearchParams,
  setTimeline,
  setCalendarMode,
  tasksOverviewRows,
  timeline,
}: UseHomeProjectWorkRuntimeParams): HomeProjectWorkRuntime => {
  const activeProject = useMemo(
    () => (projectId ? projects.find((project) => project.project_id === projectId) || null : projects[0] || null),
    [projectId, projects],
  );
  const hasRequestedProject = useMemo(
    () => (projectId ? projects.some((project) => project.project_id === projectId) : false),
    [projectId, projects],
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
  const openedFromPinned = searchParams.get('pinned') === '1';
  const activeProjectId = activeProject?.project_id ?? null;
  const {
    activeProjectDocId,
    onSelectProjectDoc,
    onCreateProjectDoc,
    onUpdateProjectDoc,
    onDeleteProjectDoc,
  } = useProjectDocsRuntime({
    accessToken,
    activeProject,
    setProjects,
  });

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
    const { extraParams, pinned } = parseHomeWorkQuery(query);
    navigate(buildHomeTabHref('work', {
      projectId: nextProjectId,
      pinned,
      extraParams,
    }), {
      state: buildProjectNavigationState({
        projectName,
        projectSource,
        extraState,
      }),
    });
  }, [buildProjectNavigationState, navigate]);

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

  const {
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

  useEffect(() => {
    if (activeTab !== 'work') {
      return;
    }
    if (activeProject && ((!projectId) || (activeProject.project_id !== projectId && hasRequestedProject))) {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.set('tab', 'work');
        next.set('project', activeProject.project_id);
        return next;
      }, { replace: true });
    }
  }, [activeProject, activeTab, hasRequestedProject, projectId, setSearchParams]);

  useEffect(() => {
    const recordId = searchParams.get('record_id');
    if (activeTab !== 'work' || !recordId || !activeProject || (projectId && !hasRequestedProject)) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        await openRecordInspector(recordId);
      } catch {
        // The inspector runtime owns the visible error state; still clear the stale deep link.
      } finally {
        if (!cancelled) {
          setSearchParams((current) => {
            const next = new URLSearchParams(current);
            next.delete('record_id');
            return next;
          }, { replace: true });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeProject, activeTab, hasRequestedProject, openRecordInspector, projectId, searchParams, setSearchParams]);

  const onDeleteProjectWithNavigation = useCallback(async (project: HubProjectSummary) => {
    const nextPath = await onDeleteProject(project, activeProject?.project_id ?? null);
    if (nextPath) {
      const remaining = projects.filter((entry) => entry.project_id !== project.project_id);
      const fallbackProject = remaining[0] ?? null;
      navigate(buildHomeTabHref(fallbackProject ? 'work' : 'overview', fallbackProject ? { projectId: fallbackProject.project_id } : undefined), {
        state: withHubMotionState(undefined, {
          hubProjectName: project.name,
        }),
      });
    }
  }, [activeProject?.project_id, navigate, onDeleteProject, projects, project.name]);

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
    if (targetView.type === 'calendar') {
      navigate(buildHomeTabHref('overview', { content: 'project', overview: 'calendar' }), {
        state: withHubMotionState(undefined, {
          hubProjectName: project.name,
        }),
      });
      return;
    }
    if (targetView.type === 'timeline') {
      navigate(buildHomeTabHref('overview', { content: 'project', overview: 'timeline' }), {
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
  }, [activeProject, navigate, navigateToProject, project.name, views]);

  useFocusNodeQueryEffect({
    activeProjectDocId,
    locationPathname,
    locationState,
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
      adaptTaskSummaries(tasksOverviewRows.filter((task) => {
        if (!activeProjectId) {
          return false;
        }
        return task.source_project?.project_id === activeProjectId;
      })),
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
  const workLayoutId = !prefersReducedMotion && activeProject ? `project-${activeProject.project_id}` : undefined;

  return {
    inspectorOverlayProps: recordInspectorOverlayProps,
    workSurfaceProps: {
      projectId: projectId ?? undefined,
      hasRequestedProject,
      activeProject,
      activeProjectCanEdit,
      widgetsEnabled,
      workLayoutId,
      recordsError,
      projectChromeProps: {
        projectId: project.space_id,
        activeProject,
        activeProjectDocId,
        activeProjectCanEdit,
        canWriteProject,
        openedFromPinned,
        orderedEditableProjects,
        readOnlyProjects,
        projectMemberList: projectMembers,
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
        onSelectProjectDoc,
        onCreateProjectDoc,
        onUpdateProjectDoc,
        onDeleteProjectDoc,
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
        onDocCommentDialogOpenChange: onDocCommentDialogOpenChange,
        docCommentError,
        docCommentText,
        setDocCommentText,
        onAddDocComment,
        docComments,
        orphanedDocComments,
        onResolveDocComment,
        showResolvedDocComments,
        setShowResolvedDocComments,
        onJumpToDocComment,
      },
    },
  };
};
