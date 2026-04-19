import { useCallback, useMemo, useRef, useState, type ComponentProps } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { HubBacklink, HubPaneSummary, HubProject, HubProjectMember } from '../../../../services/hub/types';
import { buildProjectOverviewHref, buildProjectToolsHref, buildProjectWorkHref } from '../../../../lib/hubRoutes';
import { useAutomationRuntime } from '../../../../hooks/useAutomationRuntime';
import { useCalendarRuntime } from '../../../../hooks/useCalendarRuntime';
import { usePaneMutations } from '../../../../hooks/usePaneMutations';
import { useProjectMembers } from '../../../../hooks/useProjectMembers';
import { useProjectFilesRuntime } from '../../../../hooks/useProjectFilesRuntime';
import { useProjectTasksRuntime } from '../../../../hooks/useProjectTasksRuntime';
import { useProjectViewsRuntime } from '../../../../hooks/useProjectViewsRuntime';
import { useQuickCapture } from '../../../../hooks/useQuickCapture';
import { useRecordInspector } from '../../../../hooks/useRecordInspector';
import { useRemindersRuntime } from '../../../../hooks/useRemindersRuntime';
import { useTimelineRuntime } from '../../../../hooks/useTimelineRuntime';
import { useWorkspaceDocRuntime } from '../../../../hooks/useWorkspaceDocRuntime';
import { withHubMotionState } from '../../../../lib/hubMotionState';
import { adaptTaskSummaries } from '../../../../components/project-space/taskAdapter';
import type { PaneLateralSource } from '../../../../components/motion/hubMotion';
import { useFocusNodeQueryEffect } from '../../hooks/useFocusNodeQueryEffect';
import { useQuickCaptureQueryIntentEffect } from '../../hooks/useQuickCaptureQueryIntentEffect';
import { useWorkViewModuleRuntime } from '../../hooks/useWorkViewModuleRuntime';
import { useWorkRouteAndInspectorQueryEffects } from '../../hooks/useWorkRouteAndInspectorQueryEffects';
import { getActiveInspectorFocusTarget, readElementRect, resolveInspectorFocusTarget } from '../domFocus';
import { toBase64 } from '../encoding';
import { useProjectSpaceOverviewState } from './useProjectSpaceOverviewState';
import { collectPaneTaskCollectionIds, paneCanEditForUser, readLayoutBool, relationFieldTargetCollectionId } from '../paneModel';
import { ProjectSpaceInspectorOverlay } from '../ProjectSpaceInspectorOverlay';
import { ProjectSpaceOverviewSurface } from '../ProjectSpaceOverviewSurface';
import { ProjectSpaceToolsSurface } from '../ProjectSpaceToolsSurface';
import { ProjectSpaceWorkSurface } from '../ProjectSpaceWorkSurface';
import type { TimelineEvent, TopLevelProjectTab } from '../types';

export interface UseProjectSpacePageRuntimeParams {
  activeTab: TopLevelProjectTab;
  project: HubProject;
  panes: HubPaneSummary[];
  setPanes: React.Dispatch<React.SetStateAction<HubPaneSummary[]>>;
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
  currentPaneId: string | undefined;
  activePane: HubPaneSummary | null;
  openedFromPinned: boolean;
  pinnedPanes: HubPaneSummary[];
  onNavigateOverview: () => void;
  onNavigateWork: () => void;
  onNavigatePinnedPane: (pane: HubPaneSummary) => void;
  onNavigateTools: () => void;
}

export interface UseProjectSpacePageRuntimeResult {
  projectLayoutId: string | undefined;
  navigatorProps: ProjectSpaceNavigatorProps;
  overviewProps: ComponentProps<typeof ProjectSpaceOverviewSurface>;
  workProps: ComponentProps<typeof ProjectSpaceWorkSurface>;
  toolsProps: ComponentProps<typeof ProjectSpaceToolsSurface>;
  inspectorProps: ComponentProps<typeof ProjectSpaceInspectorOverlay>;
}

export const useProjectSpacePageRuntime = ({
  activeTab,
  project,
  panes,
  setPanes,
  projectMembers,
  accessToken,
  sessionUserId,
  refreshProjectData,
  timeline,
  setTimeline,
  prefersReducedMotion,
}: UseProjectSpacePageRuntimeParams): UseProjectSpacePageRuntimeResult => {
  const { paneId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { overviewView, setOverviewView } = useProjectSpaceOverviewState({
    activeTab,
    searchParams,
    setSearchParams,
  });
  const [inspectorTriggerRect, setInspectorTriggerRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const inspectorTriggerRef = useRef<HTMLElement | null>(null);

  const { calendarEvents, calendarLoading, calendarMode, refreshCalendar, setCalendarMode } = useCalendarRuntime({
    accessToken,
    projectId: project.project_id,
    initialMode: 'all',
  });
  const { loadProjectTaskPage, projectTasksError, projectTasksLoading, tasksOverviewRows } = useProjectTasksRuntime({
    accessToken,
    projectId: project.project_id,
    activeTab,
    overviewView,
  });

  const activePane = useMemo(
    () => panes.find((pane) => pane.pane_id === paneId) || panes[0] || null,
    [paneId, panes],
  );
  const {
    assetEntries,
    assetRoots,
    assetWarning,
    ensureProjectAssetRoot,
    newAssetRootPath,
    onAddAssetRoot,
    onLoadAssets,
    onOpenPaneFile,
    onUploadPaneFiles,
    onUploadProjectFiles,
    paneFiles,
    projectFiles,
    refreshTrackedProjectFiles,
    setNewAssetRootPath,
  } = useProjectFilesRuntime({
    accessToken,
    projectId: project.project_id,
    projectName: project.name,
    activePane: activePane ? { pane_id: activePane.pane_id, name: activePane.name } : null,
    onError: (message) => setRecordsError(message),
  });

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
  const pinnedPanes = useMemo(() => panes.filter((pane) => pane.pinned), [panes]);
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
    projectId: project.project_id,
    projectMembers,
    refreshProjectData,
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
  const {
    collections,
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
    closeInspector,
    inspectorBacklinks,
    inspectorBacklinksError,
    inspectorBacklinksLoading,
    inspectorCommentText,
    inspectorError,
    inspectorLoading,
    inspectorMutationPane,
    inspectorMutationPaneCanEdit,
    inspectorRecord,
    inspectorRecordId,
    inspectorRelationFields,
    onAddRecordComment,
    onAddRelation,
    onAttachFile,
    onDetachInspectorAttachment,
    onInsertRecordCommentMention,
    onMoveInspectorAttachment,
    onRemoveRelation,
    onRenameInspectorAttachment,
    onSaveRecordField,
    openInspector,
    relationMutationError,
    removingRelationId,
    savingValues,
    selectedAttachmentId,
    setInspectorCommentText,
    setSelectedAttachmentId,
    uploadingAttachment,
  } = useRecordInspector({
    accessToken,
    projectId: project.project_id,
    panes,
    activeTab,
    activePaneId: activePane?.pane_id || null,
    sessionUserId,
    refreshViewsAndRecords,
    setTimeline,
    ensureProjectAssetRoot,
    refreshTrackedProjectFiles,
    paneCanEditForUser,
    relationFieldTargetCollectionId,
    toBase64,
  });
  const {
    automationRules,
    automationRuns,
    onCreateAutomationRule,
    onDeleteAutomationRule,
    onToggleAutomationRule,
    onUpdateAutomationRule,
  } = useAutomationRuntime({
    accessToken,
    projectId: project.project_id,
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

  const activePaneId = activePane?.pane_id || null;
  const activePaneDocId = activePane?.doc_id || null;
  const openInspectorWithFocusRestore = useCallback(
    async (recordId: string, options?: { mutationPaneId?: string | null }) => {
      inspectorTriggerRef.current = getActiveInspectorFocusTarget();
      setInspectorTriggerRect(readElementRect(inspectorTriggerRef.current));
      await openInspector(recordId, options);
    },
    [openInspector],
  );
  const closeInspectorWithFocusRestore = useCallback(() => {
    inspectorTriggerRef.current = resolveInspectorFocusTarget(inspectorTriggerRef.current);
    closeInspector();
  }, [closeInspector]);
  const { createAndOpenCaptureRecord, quickCaptureInFlightRef } = useQuickCapture({
    accessToken,
    projectId: project.project_id,
    activeTab,
    activePane,
    activePaneCanEdit,
    collections,
    focusedWorkViewId,
    openInspector: openInspectorWithFocusRestore,
    refreshViewsAndRecords,
    setPaneMutationError,
  });

  useWorkRouteAndInspectorQueryEffects({
    activePane,
    activeTab,
    hasRequestedPane,
    navigate,
    openInspectorWithFocusRestore,
    paneId,
    projectId: project.project_id,
    searchParams,
    setSearchParams,
  });

  useQuickCaptureQueryIntentEffect({
    createAndOpenCaptureRecord,
    quickCaptureInFlightRef,
    searchParams,
    setSearchParams,
  });

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
    const nextHrefBase = buildProjectWorkHref(project.project_id, nextPaneId);
    const nextHref = query ? `${nextHrefBase}?${query}` : nextHrefBase;
    navigate(nextHref, {
      state: buildPaneNavigationState({
        paneName,
        paneSource,
        extraState,
      }),
    });
  }, [buildPaneNavigationState, navigate, project.project_id]);

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

  const onDeletePaneWithNavigation = useCallback(async (pane: HubPaneSummary) => {
    const nextPath = await onDeletePane(pane, activePane?.pane_id ?? null);
    if (nextPath) {
      navigate(nextPath, {
        state: withHubMotionState(undefined, {
          hubProjectName: project.name,
        }),
      });
    }
  }, [activePane?.pane_id, navigate, onDeletePane, project.name]);

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
    if (targetView.type === 'kanban') {
      navigate(`${buildProjectOverviewHref(project.project_id)}?view=kanban&kanban_view_id=${encodeURIComponent(viewId)}`, {
        state: withHubMotionState(undefined, {
          hubProjectName: project.name,
        }),
      });
      return;
    }
    if (targetView.type === 'calendar') {
      navigate(`${buildProjectOverviewHref(project.project_id)}?view=calendar`, {
        state: withHubMotionState(undefined, {
          hubProjectName: project.name,
        }),
      });
      return;
    }
    if (targetView.type === 'timeline') {
      navigate(`${buildProjectOverviewHref(project.project_id)}?view=timeline`, {
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
  }, [activePane, navigate, navigateToPane, project.name, project.project_id, views]);

  useFocusNodeQueryEffect({
    activePaneDocId,
    locationPathname: location.pathname,
    locationState: location.state,
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
      adaptTaskSummaries(
        tasksOverviewRows.filter((task) => {
          if (!activePaneId) {
            return false;
          }
          return task.source_pane?.pane_id === activePaneId;
        }),
      ),
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
    openInspectorWithFocusRestore,
    reminders: remindersRuntime.reminders,
    remindersLoading: remindersRuntime.loading,
    remindersError: remindersRuntime.error,
    onDismissReminder: remindersRuntime.dismiss,
    onCreateReminder: remindersRuntime.create,
  });

  const availableRecordTypes = useMemo(() => {
    const names = collections.map((collection) => collection.name.trim()).filter((name) => name.length > 0);
    return names.length > 0 ? names : ['record'];
  }, [collections]);
  const focusedKanbanRuntime = focusedWorkView ? kanbanRuntimeDataByViewId[focusedWorkView.view_id] ?? null : null;
  const projectLayoutId = !prefersReducedMotion ? `project-${project.project_id}` : undefined;
  const workLayoutId = !prefersReducedMotion && activePane ? `pane-${activePane.pane_id}` : undefined;

  return {
    projectLayoutId,
    navigatorProps: {
      projectId: project.project_id,
      projectName: project.name,
      activeTab,
      currentPaneId: paneId,
      activePane,
      openedFromPinned,
      pinnedPanes,
      onNavigateOverview: () => {
        navigate(buildProjectOverviewHref(project.project_id), {
          state: withHubMotionState(undefined, {
            hubProjectName: project.name,
            ...(activeTab === 'work' ? { hubAnnouncement: `Back to ${project.name}` } : {}),
          }),
        });
      },
      onNavigateWork: () => {
        if (!activePane?.pane_id) {
          navigate(buildProjectWorkHref(project.project_id), {
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
        });
      },
      onNavigatePinnedPane: (pane) => {
        navigateToPane({
          paneId: pane.pane_id,
          paneName: pane.name,
          paneSource: 'click',
          query: 'pinned=1',
        });
      },
      onNavigateTools: () => {
        navigate(buildProjectToolsHref(project.project_id), {
          state: withHubMotionState(undefined, {
            hubProjectName: project.name,
          }),
        });
      },
    },
    overviewProps: {
      projectName: project.name,
      projectId: project.project_id,
      isPersonalProject: project.is_personal,
      projectMemberList,
      accessToken,
      overviewView,
      onSelectOverviewView: setOverviewView,
      timelineClusters,
      timelineFilters,
      onTimelineFilterToggle: toggleTimelineFilter,
      onOpenRecord: (recordId) => {
        void openInspectorWithFocusRestore(recordId);
      },
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
      paneId,
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
        projectMemberList,
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
        onOpenRecord: (recordId) => {
          void openInspectorWithFocusRestore(recordId);
        },
        onCreateKanbanRecord,
        onConfigureKanbanGrouping,
        onDeleteKanbanRecord,
        onMoveKanbanRecord,
        onUpdateKanbanRecord,
      },
      workViewProps: {
        onUpdatePane: onUpdatePaneFromWorkView,
        onOpenRecord: (recordId) => {
          void openInspectorWithFocusRestore(recordId);
        },
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
        onOpenRecord: (recordId) => {
          void openInspectorWithFocusRestore(recordId);
        },
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
    toolsProps: {
      assetRoots,
      assetEntries,
      assetWarning,
      newAssetRootPath,
      onNewAssetRootPathChange: setNewAssetRootPath,
      onAddAssetRoot,
      onLoadAssets,
      automationRules,
      automationRuns,
      availableRecordTypes,
      onCreateAutomationRule,
      onUpdateAutomationRule,
      onDeleteAutomationRule,
      onToggleAutomationRule,
    },
    inspectorProps: {
      accessToken,
      project,
      panes,
      inspectorTriggerRect,
      inspectorTriggerRef,
      prefersReducedMotion,
      inspectorLoading,
      inspectorError,
      inspectorRecord,
      inspectorRecordId,
      inspectorMutationPane,
      inspectorMutationPaneCanEdit,
      inspectorRelationFields,
      inspectorBacklinks,
      inspectorBacklinksLoading,
      inspectorBacklinksError,
      inspectorCommentText,
      relationMutationError,
      removingRelationId,
      savingValues,
      selectedAttachmentId,
      uploadingAttachment,
      setSelectedAttachmentId,
      setInspectorCommentText,
      closeInspectorWithFocusRestore,
      navigate,
      onSaveRecordField,
      onRenameInspectorAttachment,
      onMoveInspectorAttachment,
      onDetachInspectorAttachment,
      onAttachFile,
      onAddRelation,
      onRemoveRelation,
      onInsertRecordCommentMention,
      onAddRecordComment,
      onOpenBacklink,
    },
  };
};
