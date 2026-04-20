import { useCallback, useEffect, useMemo, type ComponentProps } from 'react';
import type { NavigateFunction, SetURLSearchParams } from 'react-router-dom';
import type { HubBacklink, HubPaneSummary, HubProject, HubProjectMember, HubTaskSummary } from '../../services/hub/types';
import { usePaneMutations } from '../../hooks/usePaneMutations';
import { useProjectFilesRuntime } from '../../hooks/useProjectFilesRuntime';
import { useProjectViewsRuntime } from '../../hooks/useProjectViewsRuntime';
import { useRemindersRuntime } from '../../hooks/useRemindersRuntime';
import { useTimelineRuntime } from '../../hooks/useTimelineRuntime';
import { useWorkspaceDocRuntime } from '../../hooks/useWorkspaceDocRuntime';
import { withHubMotionState } from '../../lib/hubMotionState';
import { adaptTaskSummaries } from '../../components/project-space/taskAdapter';
import { CalendarModuleSkin } from '../../components/project-space/CalendarModuleSkin';
import { useFocusNodeQueryEffect } from '../../pages/ProjectSpacePage/hooks/useFocusNodeQueryEffect';
import { useWorkViewModuleRuntime } from '../../pages/ProjectSpacePage/hooks/useWorkViewModuleRuntime';
import { useProjectSpaceInspectorRuntime } from '../../pages/ProjectSpacePage/ProjectSpaceWorkspace/hooks/useProjectSpaceInspectorRuntime';
import { paneCanEditForUser, readLayoutBool, collectPaneTaskCollectionIds } from '../../pages/ProjectSpacePage/ProjectSpaceWorkspace/paneModel';
import { buildHomeTabHref, type HomeTabId } from './navigation';
import { ProjectSpaceInspectorOverlay } from '../../pages/ProjectSpacePage/ProjectSpaceWorkspace/ProjectSpaceInspectorOverlay';
import { ProjectSpaceWorkSurface } from '../../pages/ProjectSpacePage/ProjectSpaceWorkspace/ProjectSpaceWorkSurface';
import type { TimelineEvent } from '../../pages/ProjectSpacePage/ProjectSpaceWorkspace/types';
import type { PaneLateralSource } from '../../components/motion/hubMotion';

interface UseHomeProjectWorkRuntimeParams {
  accessToken: string;
  activeTab: HomeTabId;
  calendarEvents: ComponentProps<typeof CalendarModuleSkin>['events'];
  calendarLoading: boolean;
  calendarMode: 'relevant' | 'all';
  loadProjectTaskPage: () => Promise<void>;
  locationPathname: string;
  locationState: unknown;
  navigate: NavigateFunction;
  paneId: string | null;
  panes: HubPaneSummary[];
  prefersReducedMotion: boolean;
  project: HubProject;
  projectMembers: HubProjectMember[];
  projectTasksLoading: boolean;
  refreshCalendar: () => Promise<void>;
  refreshProjectData: () => Promise<void>;
  searchParams: URLSearchParams;
  sessionUserId: string;
  setPanes: React.Dispatch<React.SetStateAction<HubPaneSummary[]>>;
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
  paneId,
  panes,
  prefersReducedMotion,
  project,
  projectMembers,
  projectTasksLoading,
  refreshCalendar,
  refreshProjectData,
  searchParams,
  sessionUserId,
  setPanes,
  setSearchParams,
  setTimeline,
  setCalendarMode,
  tasksOverviewRows,
  timeline,
}: UseHomeProjectWorkRuntimeParams): HomeProjectWorkRuntime => {
  const activePane = useMemo(
    () => (paneId ? panes.find((pane) => pane.pane_id === paneId) || null : panes[0] || null),
    [paneId, panes],
  );
  const hasRequestedPane = useMemo(
    () => (paneId ? panes.some((pane) => pane.pane_id === paneId) : false),
    [paneId, panes],
  );
  const editablePanes = useMemo(
    () => panes.filter((pane) => paneCanEditForUser(pane, sessionUserId)),
    [panes, sessionUserId],
  );
  const orderedEditablePanes = useMemo(
    () =>
      [...editablePanes].sort((left, right) => {
        const leftPosition = left.position ?? Number.MAX_SAFE_INTEGER;
        const rightPosition = right.position ?? Number.MAX_SAFE_INTEGER;
        if (leftPosition !== rightPosition) {
          return leftPosition - rightPosition;
        }
        return (left.sort_order ?? Number.MAX_SAFE_INTEGER) - (right.sort_order ?? Number.MAX_SAFE_INTEGER);
      }),
    [editablePanes],
  );
  const readOnlyPanes = useMemo(
    () => panes.filter((pane) => !paneCanEditForUser(pane, sessionUserId)),
    [panes, sessionUserId],
  );
  const activePaneCanEdit = useMemo(
    () => paneCanEditForUser(activePane, sessionUserId),
    [activePane, sessionUserId],
  );
  const canWriteProject = typeof project.membership_role === 'string' && project.membership_role.toLowerCase() !== 'viewer';
  const activeEditablePaneIndex = useMemo(
    () => orderedEditablePanes.findIndex((pane) => pane.pane_id === activePane?.pane_id),
    [activePane?.pane_id, orderedEditablePanes],
  );
  const openedFromPinned = searchParams.get('pinned') === '1';
  const activePaneId = activePane?.pane_id ?? null;
  const activePaneDocId = activePane?.doc_id ?? null;

  const buildPaneNavigationState = useCallback(({
    paneName,
    paneSource,
    extraState,
  }: {
    paneName?: string | null;
    paneSource?: PaneLateralSource;
    extraState?: unknown;
  }) => withHubMotionState(extraState, {
    hubProjectName: project.name,
    hubPaneName: paneName ?? undefined,
    hubPaneSource: paneSource,
  }), [project.name]);

  const navigateToPane = useCallback(({
    paneId: nextPaneId,
    paneName,
    paneSource,
    query,
    extraState,
  }: {
    paneId: string;
    paneName?: string | null;
    paneSource?: PaneLateralSource;
    query?: string;
    extraState?: unknown;
  }) => {
    const { extraParams, pinned } = parseHomeWorkQuery(query);
    navigate(buildHomeTabHref('work', {
      paneId: nextPaneId,
      pinned,
      extraParams,
    }), {
      state: buildPaneNavigationState({
        paneName,
        paneSource,
        extraState,
      }),
    });
  }, [buildPaneNavigationState, navigate]);

  const onOpenBacklink = useCallback((backlink: HubBacklink) => {
    if (!backlink.source.pane_id) {
      return;
    }
    navigateToPane({
      paneId: backlink.source.pane_id,
      paneName: backlink.source.pane_name,
      paneSource: 'click',
      extraState: backlink.source.node_key ? { focusNodeKey: backlink.source.node_key } : undefined,
    });
  }, [navigateToPane]);

  const {
    views,
    kanbanRuntimeDataByViewId,
    kanbanViews,
    creatingKanbanViewByModuleId,
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
    projectId: project.project_id,
    activeTab,
    panes,
    sessionUserId,
    setTimeline,
    paneCanEditForUser,
  });
  const {
    ensureProjectAssetRoot,
    onOpenPaneFile,
    onUploadPaneFiles,
    onUploadProjectFiles,
    paneFiles,
    projectFiles,
    refreshTrackedProjectFiles,
  } = useProjectFilesRuntime({
    accessToken,
    projectId: project.project_id,
    projectName: project.name,
    activePane: activePane ? { pane_id: activePane.pane_id, name: activePane.name } : null,
    onError: (message) => setRecordsError(message),
  });
  const {
    onCreatePane,
    onDeletePane,
    onMovePane,
    onTogglePaneMember,
    onTogglePinned,
    onUpdatePaneFromWorkView,
    paneMutationError,
    setPaneMutationError,
  } = usePaneMutations({
    accessToken,
    projectId: project.project_id,
    panes,
    refreshProjectData,
    setPanes,
    sessionUserId,
    setTimeline,
  });
  const { refreshTimeline, timelineClusters, timelineFilters, toggleTimelineFilter } = useTimelineRuntime({
    accessToken,
    projectId: project.project_id,
    timeline,
    setTimeline,
  });
  const remindersRuntime = useRemindersRuntime(accessToken, {
    autoload: activeTab === 'work' && Boolean(activePane?.pane_id),
    subscribeToHomeRefresh: activeTab === 'work' && Boolean(activePane?.pane_id),
    subscribeToLive: activeTab === 'work' && Boolean(activePane?.pane_id),
    scope: 'project',
    projectId: project.project_id,
    paneId: activeTab === 'work' ? activePane?.pane_id ?? null : null,
    sourceViewId: activeTab === 'work' ? focusedWorkViewId || null : null,
  });
  const {
    openRecordInspector,
    recordInspectorOverlayProps,
  } = useProjectSpaceInspectorRuntime({
    accessToken,
    project,
    panes,
    activeTab,
    activePaneId,
    sessionUserId,
    refreshViewsAndRecords,
    setTimeline,
    ensureProjectAssetRoot,
    refreshTrackedProjectFiles,
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
    if (activePane && ((!paneId) || (activePane.pane_id !== paneId && hasRequestedPane))) {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.set('tab', 'work');
        next.set('pane', activePane.pane_id);
        return next;
      }, { replace: true });
    }
  }, [activePane, activeTab, hasRequestedPane, paneId, setSearchParams]);

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
    })();
    return () => {
      cancelled = true;
    };
  }, [activePane, activeTab, hasRequestedPane, openRecordInspector, paneId, searchParams, setSearchParams]);

  const onDeletePaneWithNavigation = useCallback(async (pane: HubPaneSummary) => {
    const nextPath = await onDeletePane(pane, activePane?.pane_id ?? null);
    if (nextPath) {
      const remaining = panes.filter((entry) => entry.pane_id !== pane.pane_id);
      const fallbackPane = remaining[0] ?? null;
      navigate(buildHomeTabHref(fallbackPane ? 'work' : 'overview', fallbackPane ? { paneId: fallbackPane.pane_id } : undefined), {
        state: withHubMotionState(undefined, {
          hubProjectName: project.name,
        }),
      });
    }
  }, [activePane?.pane_id, navigate, onDeletePane, panes, project.name]);

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
    activePaneDocId,
    projectId: project.project_id,
    activePaneId: activePane?.pane_id || null,
    activeTab,
    ensureProjectAssetRoot,
    refreshTrackedProjectFiles,
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
    if (!activePane || !targetView) {
      if (activePane) {
        navigateToPane({
          paneId: activePane.pane_id,
          paneName: activePane.name,
          paneSource: 'click',
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
    navigateToPane({
      paneId: activePane.pane_id,
      paneName: activePane.name,
      paneSource: 'click',
      query: `view_id=${encodeURIComponent(viewId)}`,
    });
  }, [activePane, navigate, navigateToPane, project.name, views]);

  useFocusNodeQueryEffect({
    activePaneDocId,
    locationPathname,
    locationState,
    navigate,
    searchParams,
    setPendingDocFocusNodeKey,
  });

  const modulesEnabled = useMemo(
    () => (activePane ? readLayoutBool(activePane.layout_config, 'modules_enabled', true) : true),
    [activePane],
  );
  const workspaceEnabled = useMemo(
    () => (activePane ? readLayoutBool(activePane.layout_config, 'workspace_enabled', true) : true),
    [activePane],
  );
  const handleToggleActivePaneRegion = useCallback(
    (region: 'modules_enabled' | 'workspace_enabled') => {
      if (!activePane || !activePaneCanEdit) {
        return;
      }

      const nextModulesEnabled = region === 'modules_enabled' ? !modulesEnabled : modulesEnabled;
      const nextWorkspaceEnabled = region === 'workspace_enabled' ? !workspaceEnabled : workspaceEnabled;
      if (!nextModulesEnabled && !nextWorkspaceEnabled) {
        setPaneMutationError('A pane must keep at least one region enabled.');
        return;
      }

      void onUpdatePaneFromWorkView(activePane.pane_id, {
        layout_config: {
          ...activePane.layout_config,
          modules_enabled: nextModulesEnabled,
          workspace_enabled: nextWorkspaceEnabled,
        },
      });
    },
    [
      activePane,
      activePaneCanEdit,
      modulesEnabled,
      onUpdatePaneFromWorkView,
      setPaneMutationError,
      workspaceEnabled,
    ],
  );
  const paneTaskCollectionIds = useMemo(
    () => collectPaneTaskCollectionIds(activePane?.layout_config, views),
    [activePane?.layout_config, views],
  );
  const paneTaskItems = useMemo(
    () =>
      adaptTaskSummaries(tasksOverviewRows.filter((task) => {
        if (!activePaneId) {
          return false;
        }
        return task.source_pane?.pane_id === activePaneId;
      })),
    [activePaneId, tasksOverviewRows],
  );
  const activePaneTaskCollectionId = useMemo(
    () => tasksOverviewRows.find((task) => task.source_pane?.pane_id === activePaneId)?.collection_id ?? null,
    [activePaneId, tasksOverviewRows],
  );
  const taskCollectionId = paneTaskCollectionIds[0] || activePaneTaskCollectionId;
  const {
    tableContract,
    kanbanContract,
    calendarContract,
    filesContract,
    quickThoughtsContract,
    tasksContract,
    timelineContract,
    remindersContract,
  } = useWorkViewModuleRuntime({
    activePaneId: activePane?.pane_id ?? null,
    activePaneCanEdit,
    accessToken,
    canWriteProject,
    projectId: project.project_id,
    setRecordsError,
    tableViews,
    tableViewRuntimeDataById,
    onCreateTableRecord,
    onUpdateTableRecord,
    onDeleteTableRecords,
    onBulkUpdateTableRecords,
    kanbanViews,
    kanbanRuntimeDataByViewId,
    creatingKanbanViewByModuleId,
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
    paneFiles,
    projectFiles,
    onUploadPaneFiles,
    onUploadProjectFiles,
    onOpenPaneFile,
    paneTaskItems,
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
  const workLayoutId = !prefersReducedMotion && activePane ? `pane-${activePane.pane_id}` : undefined;

  return {
    inspectorOverlayProps: recordInspectorOverlayProps,
    workSurfaceProps: {
      paneId: paneId ?? undefined,
      hasRequestedPane,
      activePane,
      activePaneCanEdit,
      modulesEnabled,
      workLayoutId,
      recordsError,
      paneChromeProps: {
        projectId: project.project_id,
        activePane,
        activePaneCanEdit,
        canWriteProject,
        openedFromPinned,
        orderedEditablePanes,
        readOnlyPanes,
        projectMemberList: projectMembers,
        sessionUserId,
        activeEditablePaneIndex,
        modulesEnabled,
        workspaceEnabled,
        paneMutationError,
        onNavigateToPane: navigateToPane,
        onCreatePane,
        onMovePane,
        onTogglePinned,
        onTogglePaneMember,
        onDeletePane: onDeletePaneWithNavigation,
        onUpdatePane: onUpdatePaneFromWorkView,
        onToggleActivePaneRegion: handleToggleActivePaneRegion,
      },
      focusedViewProps: {
        focusedWorkView,
        focusedWorkViewError,
        focusedWorkViewLoading,
        focusedWorkViewData,
        focusedKanbanRuntime,
        activePaneCanEdit,
        activePaneId: activePane?.pane_id ?? null,
        onCloseFocusedView,
        onOpenRecord,
        onCreateKanbanRecord,
        onConfigureKanbanGrouping,
        onDeleteKanbanRecord,
        onMoveKanbanRecord,
        onUpdateKanbanRecord,
      },
      workViewProps: {
        onUpdatePane: onUpdatePaneFromWorkView,
        onOpenRecord,
        tableContract,
        kanbanContract,
        calendarContract,
        filesContract,
        quickThoughtsContract,
        tasksContract,
        timelineContract,
        remindersContract,
      },
      workspaceDocProps: {
        accessToken,
        projectId: project.project_id,
        projectMembers,
        sessionUserId,
        activePane,
        activePaneCanEdit,
        workspaceEnabled,
        activePaneDocId,
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
