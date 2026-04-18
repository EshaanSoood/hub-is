import { FormEvent, Suspense, lazy, useCallback, useMemo, useRef, useState, type ReactElement } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  type HubBacklink,
  type HubPaneSummary,
  type HubProject,
  type HubProjectMember,
  type HubView,
} from '../../services/hub/types';
import {
  buildPaneContextHref,
  buildProjectOverviewHref,
  buildProjectToolsHref,
  buildProjectWorkHref,
} from '../../lib/hubRoutes';
import { useAutomationRuntime } from '../../hooks/useAutomationRuntime';
import { useCalendarRuntime } from '../../hooks/useCalendarRuntime';
import { usePaneMutations } from '../../hooks/usePaneMutations';
import { useProjectMembers } from '../../hooks/useProjectMembers';
import { useProjectFilesRuntime } from '../../hooks/useProjectFilesRuntime';
import { useProjectTasksRuntime } from '../../hooks/useProjectTasksRuntime';
import { useProjectViewsRuntime } from '../../hooks/useProjectViewsRuntime';
import { useQuickCapture } from '../../hooks/useQuickCapture';
import { useRecordInspector } from '../../hooks/useRecordInspector';
import { useRemindersRuntime } from '../../hooks/useRemindersRuntime';
import { useTimelineRuntime } from '../../hooks/useTimelineRuntime';
import { useWorkspaceDocRuntime } from '../../hooks/useWorkspaceDocRuntime';
import { isStandaloneKanbanView } from '../../hooks/projectViewsRuntime/shared';
import { useFocusNodeQueryEffect } from './hooks/useFocusNodeQueryEffect';
import { useOverviewViewFromSearchParams } from './hooks/useOverviewViewFromSearchParams';
import { useOverviewViewQuerySyncEffect } from './hooks/useOverviewViewQuerySyncEffect';
import { usePaneControlEffects } from './hooks/usePaneControlEffects';
import { useQuickCaptureQueryIntentEffect } from './hooks/useQuickCaptureQueryIntentEffect';
import { useWorkViewModuleRuntime } from './hooks/useWorkViewModuleRuntime';
import { useWorkRouteAndInspectorQueryEffects } from './hooks/useWorkRouteAndInspectorQueryEffects';
import { AccessDeniedView } from '../../components/auth/AccessDeniedView';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../components/project-space/ProjectSpaceDialogPrimitives';
import { Icon, IconButton, InlineNotice } from '../../components/primitives';
import { BacklinksPanel } from '../../components/project-space/BacklinksPanel';
import { CommentComposer } from '../../components/project-space/CommentComposer';
import { CommentRail } from '../../components/project-space/CommentRail';
import { MentionPicker } from '../../components/project-space/MentionPicker';
import { ModuleLoadingState } from '../../components/project-space/ModuleFeedback';
import { OverviewView } from '../../components/project-space/OverviewView';
import { PaneSwitcher } from '../../components/project-space/PaneSwitcher';
import { RelationsSection } from '../../components/project-space/RelationsSection';
import { AutomationBuilder } from '../../components/project-space/AutomationBuilder';
import { FileInspectorActionBar } from '../../components/project-space/FileInspectorActionBar';
import { WorkView } from '../../components/project-space/WorkView';
import { adaptTaskSummaries } from '../../components/project-space/taskAdapter';
import type { PaneLateralSource } from '../../components/motion/hubMotion';
import { withHubMotionState } from '../../lib/hubMotionState';
import { dialogLayoutIds } from '../../styles/motion';

// Layout contract references:
// components/project-space/TopNavTabs
// components/project-space/OverviewView
// components/project-space/ToolsView
// TODO(phase8-tech-debt): Split inspector dialog and workspace-doc runtime/UI into dedicated components.
// Targets: Dialog/DialogContent/DialogHeader/DialogTitle, FileInspectorActionBar, CommentComposer,
// CommentRail, MentionPicker, and useWorkspaceDocRuntime-related rendering.

const KanbanModuleSkin = lazy(async () => {
  const module = await import('../../components/project-space/KanbanModuleSkin');
  return { default: module.KanbanModuleSkin };
});

const TableModuleSkin = lazy(async () => {
  const module = await import('../../components/project-space/TableModuleSkin');
  return { default: module.TableModuleSkin };
});

const CollaborativeLexicalEditor = lazy(async () => {
  const module = await import('../../features/notes/CollaborativeLexicalEditor');
  return { default: module.CollaborativeLexicalEditor };
});

export type TopLevelProjectTab = 'overview' | 'work' | 'tools';
type OverviewSubView = 'timeline' | 'calendar' | 'tasks' | 'kanban';

interface TimelineEvent {
  timeline_event_id: string;
  event_type: string;
  primary_entity_type: string;
  primary_entity_id: string;
  summary_json: Record<string, unknown>;
  created_at: string;
}

const readPlainComment = (bodyJson: Record<string, unknown>): string => {
  const text = bodyJson.text;
  if (typeof text === 'string') {
    return text;
  }
  const content = bodyJson.content;
  if (typeof content === 'string') {
    return content;
  }
  return JSON.stringify(bodyJson);
};

const paneCanEditForUser = (pane: HubPaneSummary | null | undefined, userId: string): boolean => {
  // User-level pane permissions are not enforced yet; current gating is pane.can_edit.
  void userId;
  return pane?.can_edit === true;
};

function readOverviewView(searchParams: URLSearchParams): OverviewSubView {
  const value = searchParams.get('view');
  if (value === 'calendar' || value === 'tasks' || value === 'kanban') {
    return value;
  }
  return 'timeline';
}

const collectPaneTaskCollectionIds = (
  layoutConfig: Record<string, unknown> | null | undefined,
  availableViews: HubView[],
): string[] => {
  if (!layoutConfig || typeof layoutConfig !== 'object' || Array.isArray(layoutConfig)) {
    return [];
  }

  const rawModules = Array.isArray(layoutConfig.modules) ? layoutConfig.modules : [];
  const viewById = new Map(availableViews.map((view) => [view.view_id, view]));
  const defaultViewByType = new Map<string, HubView>();
  for (const view of availableViews) {
    if (view.type === 'kanban' && isStandaloneKanbanView(view)) {
      continue;
    }
    if (!defaultViewByType.has(view.type)) {
      defaultViewByType.set(view.type, view);
    }
  }

  const collectionIds: string[] = [];
  for (const candidate of rawModules) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      continue;
    }

    const moduleConfig = candidate as { module_type?: unknown; binding?: { view_id?: unknown } | null };
    const moduleType = typeof moduleConfig.module_type === 'string' ? moduleConfig.module_type : '';
    if (moduleType !== 'table' && moduleType !== 'kanban') {
      continue;
    }

    const requestedViewId =
      moduleConfig.binding && typeof moduleConfig.binding === 'object' && !Array.isArray(moduleConfig.binding)
        && typeof moduleConfig.binding.view_id === 'string'
        ? moduleConfig.binding.view_id
        : '';
    const resolvedView = (requestedViewId ? viewById.get(requestedViewId) : null) ?? defaultViewByType.get(moduleType) ?? null;
    if (!resolvedView || (moduleType === 'kanban' && isStandaloneKanbanView(resolvedView)) || collectionIds.includes(resolvedView.collection_id)) {
      continue;
    }
    collectionIds.push(resolvedView.collection_id);
  }

  return collectionIds;
};

const relationFieldTargetCollectionId = (config: Record<string, unknown>): string | null => {
  const directTarget = config.target_collection_id;
  if (typeof directTarget === 'string' && directTarget.trim()) {
    return directTarget.trim();
  }
  const camelTarget = config.targetCollectionId;
  if (typeof camelTarget === 'string' && camelTarget.trim()) {
    return camelTarget.trim();
  }
  const target = config.target;
  if (target && typeof target === 'object' && !Array.isArray(target)) {
    const targetRecord = target as Record<string, unknown>;
    const nestedSnake = targetRecord.collection_id;
    if (typeof nestedSnake === 'string' && nestedSnake.trim()) {
      return nestedSnake.trim();
    }
    const nestedCamel = targetRecord.collectionId;
    if (typeof nestedCamel === 'string' && nestedCamel.trim()) {
      return nestedCamel.trim();
    }
  }
  return null;
};

const toBase64 = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const chunkSize = 8192;
  const chunks: string[] = [];
  for (let index = 0; index < bytes.length; index += chunkSize) {
    chunks.push(String.fromCharCode(...bytes.subarray(index, index + chunkSize)));
  }
  return window.btoa(chunks.join(''));
};

const readLayoutBool = (config: Record<string, unknown> | null | undefined, key: string, fallback: boolean): boolean => {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return fallback;
  }
  const value = config[key];
  return typeof value === 'boolean' ? value : fallback;
};

const resolveInspectorFocusTarget = (candidate: HTMLElement | null): HTMLElement | null => {
  if (candidate && candidate.isConnected) {
    return candidate;
  }
  const mainContent = document.getElementById('main-content');
  if (mainContent instanceof HTMLElement) {
    if (!mainContent.hasAttribute('tabindex')) {
      mainContent.setAttribute('tabindex', '-1');
    }
    return mainContent;
  }
  return null;
};

const getActiveInspectorFocusTarget = (): HTMLElement | null => {
  if (document.activeElement instanceof HTMLElement && document.activeElement !== document.body) {
    return document.activeElement;
  }
  return resolveInspectorFocusTarget(null);
};

const readElementRect = (element: HTMLElement | null): { top: number; left: number; width: number; height: number } | null => {
  if (!element || !element.isConnected) {
    return null;
  }
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
};

export const ProjectSpaceWorkspace = ({
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
}: {
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
}): ReactElement => {
  const { paneId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();

  const [overviewView, setOverviewView] = useState<OverviewSubView>(() => readOverviewView(searchParams));

  const [creatingPaneName, setCreatingPaneName] = useState('');
  const [showCreatePaneControl, setShowCreatePaneControl] = useState(false);
  const [showPaneSwitcher, setShowPaneSwitcher] = useState(searchParams.get('pinned') !== '1');
  const [showOtherPanes, setShowOtherPanes] = useState(false);
  const [otherPaneQuery, setOtherPaneQuery] = useState('');
  const [paneSettingsOpen, setPaneSettingsOpen] = useState(false);
  const [inspectorTriggerRect, setInspectorTriggerRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const inspectorTriggerRef = useRef<HTMLElement | null>(null);
  const paneSettingsTriggerRef = useRef<HTMLButtonElement | null>(null);
  const paneSettingsNameInputRef = useRef<HTMLInputElement | null>(null);
  const createPaneNameInputRef = useRef<HTMLInputElement | null>(null);
  const docAssetFormRef = useRef<HTMLFormElement | null>(null);
  const docAssetInputRef = useRef<HTMLInputElement | null>(null);

  const { calendarEvents, calendarLoading, calendarMode, refreshCalendar, setCalendarMode } = useCalendarRuntime({
    accessToken,
    projectId: project.project_id,
    initialMode: 'all',
  });
  const {
    loadProjectTaskPage,
    projectTasksError,
    projectTasksLoading,
    tasksOverviewRows,
  } = useProjectTasksRuntime({
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
  const filteredReadOnlyPanes = useMemo(() => {
    const query = otherPaneQuery.trim().toLowerCase();
    if (!query) {
      return readOnlyPanes;
    }
    return readOnlyPanes.filter((pane) => pane.name.toLowerCase().includes(query));
  }, [otherPaneQuery, readOnlyPanes]);
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
  const previousOpenedFromPinnedRef = useRef(openedFromPinned);
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

  usePaneControlEffects({
    openedFromPinned,
    previousOpenedFromPinnedRef,
    setShowPaneSwitcher,
    showCreatePaneControl,
    createPaneNameInputRef,
  });

  useOverviewViewFromSearchParams({
    searchParams,
    readOverviewView,
    setOverviewView,
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

  const onOpenBacklink = (backlink: HubBacklink) => {
    if (!backlink.source.pane_id) {
      return;
    }
    navigateToPane({
      paneId: backlink.source.pane_id,
      paneName: backlink.source.pane_name,
      paneSource: 'click',
      extraState: backlink.source.node_key ? { focusNodeKey: backlink.source.node_key } : undefined,
    });
  };

  const onCreatePaneSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextPane = await onCreatePane(creatingPaneName);
    if (!nextPane) {
      return;
    }

    setCreatingPaneName('');
    setShowCreatePaneControl(false);
    navigateToPane({
      paneId: nextPane.pane_id,
      paneName: nextPane.name,
      paneSource: 'click',
    });
  };

  const onDeletePaneWithNavigation = async (pane: HubPaneSummary) => {
    const nextPath = await onDeletePane(pane, activePane?.pane_id ?? null);
    if (nextPath) {
      navigate(nextPath, {
        state: withHubMotionState(undefined, {
          hubProjectName: project.name,
        }),
      });
    }
  };

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

  const commitActivePaneSettingsName = useCallback(() => {
    if (!activePane || !activePaneCanEdit) {
      return;
    }
    const nextName = paneSettingsNameInputRef.current?.value.trim();
    if (nextName && nextName !== activePane.name) {
      void onUpdatePaneFromWorkView(activePane.pane_id, { name: nextName });
    }
  }, [activePane, activePaneCanEdit, onUpdatePaneFromWorkView]);

  const handlePaneSettingsOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        commitActivePaneSettingsName();
      }
      setPaneSettingsOpen(nextOpen);
    },
    [commitActivePaneSettingsName],
  );

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

  useOverviewViewQuerySyncEffect({
    activeTab,
    overviewView,
    searchParams,
    setSearchParams,
  });
  const taskCollectionId = paneTaskCollectionIds[0] || tasksOverviewRows[0]?.collection_id || null;
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
  const overviewCollaborators = useMemo(
    () =>
      projectMemberList.map((member) => {
        const role: 'owner' | 'editor' | 'viewer' =
          member.role === 'owner' || member.role === 'editor' || member.role === 'viewer' ? member.role : 'viewer';
        return {
          id: member.user_id,
          name: member.display_name,
          role,
        };
      }),
    [projectMemberList],
  );
  const overviewClients = useMemo(() => [], []);
  const projectLayoutId = !prefersReducedMotion ? `project-${project.project_id}` : undefined;
  const workLayoutId = !prefersReducedMotion && activePane ? `pane-${activePane.pane_id}` : undefined;

  const paneNavigator = (
    <div className="rounded-panel border border-subtle bg-elevated p-3">
      <div className="mb-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">Project Space</p>
        <h1
          className="mt-1 text-base font-bold text-text"
          title={project.name}
          style={{
            display: '-webkit-box',
            overflow: 'hidden',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: 2,
          }}
        >
          {project.name}
        </h1>
      </div>
      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Project space tabs">
        <button
          type="button"
          onClick={() => navigate(buildProjectOverviewHref(project.project_id), {
            state: withHubMotionState(undefined, {
              hubProjectName: project.name,
              ...(activeTab === 'work' ? { hubAnnouncement: `Back to ${project.name}` } : {}),
            }),
          })}
          className={`rounded-panel px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
            activeTab === 'overview' ? 'bg-primary text-on-primary' : 'border border-border-muted text-primary'
          }`}
          role="tab"
          aria-selected={activeTab === 'overview'}
          aria-current={activeTab === 'overview' ? 'page' : undefined}
        >
          Overview
        </button>
        <button
          type="button"
          onClick={() => {
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
          }}
          className={`rounded-panel px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
            activeTab === 'work' && !openedFromPinned ? 'bg-primary text-on-primary' : 'border border-border-muted text-primary'
          }`}
          role="tab"
          aria-selected={activeTab === 'work' && !openedFromPinned}
          aria-current={activeTab === 'work' && !openedFromPinned ? 'page' : undefined}
        >
          Work
        </button>

        {pinnedPanes.map((pane) => {
          const selected = paneId === pane.pane_id && openedFromPinned;
          return (
            <button
              key={pane.pane_id}
              type="button"
              onClick={() => {
                navigateToPane({
                  paneId: pane.pane_id,
                  paneName: pane.name,
                  paneSource: 'click',
                  query: 'pinned=1',
                });
              }}
              className={`cursor-pointer rounded-panel border px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
                selected
                  ? 'border-primary bg-primary text-on-primary'
                  : 'border-border-muted bg-surface text-primary hover:border-primary hover:bg-primary/10'
              }`}
              role="tab"
              aria-selected={selected}
              aria-current={selected ? 'page' : undefined}
              aria-label={`Open pinned pane ${pane.name}`}
            >
              <span className="flex flex-col items-center leading-tight">
                <span>{pane.name}</span>
                <span className={selected ? 'mt-1 h-1 w-1 rounded-full bg-on-primary' : 'mt-1 h-1 w-1 rounded-full bg-muted'} aria-hidden="true" />
              </span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => navigate(buildProjectToolsHref(project.project_id), {
            state: withHubMotionState(undefined, {
              hubProjectName: project.name,
            }),
          })}
          className={`rounded-panel px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
            activeTab === 'tools' ? 'bg-primary text-on-primary' : 'border border-border-muted text-primary'
          }`}
          role="tab"
          aria-selected={activeTab === 'tools'}
          aria-current={activeTab === 'tools' ? 'page' : undefined}
        >
          Tools
        </button>
      </div>
    </div>
  );

  return (
    <motion.div layoutId={projectLayoutId} className="space-y-4">
      {paneNavigator}

      {activeTab === 'overview' ? (
        <OverviewView
          projectName={project.name}
          projectSummary="Track the timeline, calendar, and task flow for this project."
          collaborators={overviewCollaborators}
          clients={overviewClients}
          activeView={overviewView}
          onSelectView={setOverviewView}
          timelineClusters={timelineClusters}
          timelineFilters={timelineFilters}
          onTimelineFilterToggle={toggleTimelineFilter}
          onOpenTimelineRecord={(recordId) => {
            void openInspectorWithFocusRestore(recordId);
          }}
          accessToken={accessToken}
          projectId={project.project_id}
          calendarEvents={calendarEvents}
          calendarLoading={calendarLoading}
          calendarScope={calendarMode}
          onCalendarScopeChange={setCalendarMode}
          onOpenCalendarRecord={(recordId) => {
            void openInspectorWithFocusRestore(recordId);
          }}
          tasks={tasksOverviewRows}
          tasksLoading={projectTasksLoading}
          tasksError={projectTasksError}
          onRefreshTasks={() => {
            void loadProjectTaskPage();
          }}
          projectMembers={projectMemberList}
          canInviteMembers={!project.is_personal}
          inviteEmail={inviteEmail}
          inviteSubmitting={isSubmittingInvite}
          inviteError={projectMemberMutationError}
          inviteNotice={projectMemberMutationNotice}
          onInviteEmailChange={onInviteEmailChange}
          onInviteSubmit={() => {
            void onCreateProjectMember();
          }}
          onDismissInviteFeedback={clearProjectMemberFeedback}
        />
      ) : null}

      {activeTab === 'work' ? (
        <section className="space-y-4">
          <div className="rounded-panel border border-subtle bg-elevated p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="heading-3 text-primary">Work Panes</h2>
              <div className="flex flex-wrap gap-2">
                {openedFromPinned ? (
                  <button
                    type="button"
                    className="rounded-control border border-border-muted px-2 py-1 text-xs font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                    onClick={() => setShowPaneSwitcher((current) => !current)}
                    aria-label={showPaneSwitcher ? 'Hide pane switcher' : 'Show pane switcher'}
                  >
                    {showPaneSwitcher ? 'Hide pane switcher' : 'Show pane switcher'}
                  </button>
                ) : null}
                {readOnlyPanes.length > 0 ? (
                  <button
                    type="button"
                    className="rounded-control border border-border-muted px-2 py-1 text-xs font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                    onClick={() => setShowOtherPanes((current) => !current)}
                  >
                    {showOtherPanes ? 'Hide other panes' : `Other panes (${readOnlyPanes.length})`}
                  </button>
                ) : null}
              </div>
            </div>

            <div className="mt-3 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                {showPaneSwitcher ? (
                  <div className="min-w-0 flex-1 overflow-x-auto">
                    <PaneSwitcher
                      panes={orderedEditablePanes.map((pane, index) => ({
                        id: pane.pane_id,
                        label: pane.name,
                        shortcutNumber: index + 1,
                      }))}
                      activePaneId={activePane?.pane_id ?? null}
                      onPaneChange={(nextPaneId, source) => {
                        const nextPane = orderedEditablePanes.find((pane) => pane.pane_id === nextPaneId) || null;
                        navigateToPane({
                          paneId: nextPaneId,
                          paneName: nextPane?.name,
                          paneSource: source,
                        });
                      }}
                      onMovePane={(paneIdToMove, direction) => {
                        const pane = panes.find((entry) => entry.pane_id === paneIdToMove);
                        if (pane) {
                          void onMovePane(pane, direction);
                        }
                      }}
                    />
                  </div>
                ) : openedFromPinned ? (
                  <p className="text-xs text-muted">Pane switcher hidden. Use the focusable toggle above to reveal it.</p>
                ) : null}
                {canWriteProject ? (
                  <IconButton
                    type="button"
                    size="sm"
                    variant={showCreatePaneControl ? 'secondary' : 'ghost'}
                    aria-label={showCreatePaneControl ? 'Collapse create pane' : 'Create pane'}
                    aria-expanded={showCreatePaneControl}
                    onClick={() => setShowCreatePaneControl((current) => !current)}
                  >
                    <Icon name="plus" className="text-[14px]" />
                  </IconButton>
                ) : null}
                <motion.div
                  layoutId={!prefersReducedMotion && paneSettingsOpen ? dialogLayoutIds.paneSettings : undefined}
                  className="inline-flex"
                >
                  <IconButton
                    ref={paneSettingsTriggerRef}
                    type="button"
                    size="sm"
                    variant={paneSettingsOpen ? 'secondary' : 'ghost'}
                    aria-label="Pane settings"
                    aria-expanded={paneSettingsOpen}
                    onClick={() => setPaneSettingsOpen(true)}
                    disabled={!activePane}
                  >
                    <Icon name="settings" className="text-[14px]" />
                  </IconButton>
                </motion.div>
              </div>

              {showCreatePaneControl && canWriteProject ? (
                <form className="flex flex-wrap items-center gap-2" onSubmit={onCreatePaneSubmit}>
                  <input
                    ref={createPaneNameInputRef}
                    value={creatingPaneName}
                    onChange={(event) => setCreatingPaneName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') {
                        event.preventDefault();
                        setShowCreatePaneControl(false);
                      }
                    }}
                    className="rounded-panel border border-border-muted bg-surface px-3 py-1.5 text-sm text-text"
                    placeholder="New pane name"
                    aria-label="New pane name"
                  />
                  <button type="submit" className="rounded-panel border border-border-muted px-3 py-1.5 text-sm font-semibold text-primary">
                    Create pane
                  </button>
                </form>
              ) : null}

              {showOtherPanes ? (
                <div className="rounded-panel border border-border-muted bg-surface p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Other panes</h3>
                    <input
                      value={otherPaneQuery}
                      onChange={(event) => setOtherPaneQuery(event.target.value)}
                      className="rounded-panel border border-border-muted bg-surface-elevated px-2 py-1 text-xs text-text"
                      placeholder="Search panes"
                      aria-label="Search read-only panes"
                    />
                  </div>
                  <div className="mt-3 space-y-2">
                    {filteredReadOnlyPanes.length === 0 ? (
                      <p className="text-sm text-muted">No matching read-only panes.</p>
                    ) : (
                      filteredReadOnlyPanes.map((pane) => (
                        <button
                          key={pane.pane_id}
                          type="button"
                          onClick={() => {
                            navigateToPane({
                              paneId: pane.pane_id,
                              paneName: pane.name,
                              paneSource: 'click',
                            });
                          }}
                          className="flex w-full items-center justify-between rounded-panel border border-border-muted px-3 py-2 text-left"
                        >
                          <span className="text-sm font-medium text-text">{pane.name}</span>
                          <span className="text-xs text-muted">Read only</span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              ) : null}
            </div>
            {paneMutationError ? (
              <InlineNotice variant="danger" className="mt-2" title="Pane update failed">
                {paneMutationError}
              </InlineNotice>
            ) : null}

            {activePane ? (
              <Dialog open={paneSettingsOpen} onOpenChange={handlePaneSettingsOpenChange}>
                <DialogContent
                  open={paneSettingsOpen}
                  animated
                  layoutId={dialogLayoutIds.paneSettings}
                  onCloseAutoFocus={(event) => {
                    event.preventDefault();
                    paneSettingsTriggerRef.current?.focus();
                  }}
                >
                  <DialogHeader>
                    <DialogTitle>Pane Settings</DialogTitle>
                    <DialogDescription className="sr-only">
                      Manage settings for pane {activePane.name}.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="mt-4 space-y-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold uppercase tracking-wide text-muted" htmlFor="pane-settings-name">
                        Pane name
                      </label>
                      <input
                        key={activePane.pane_id}
                        ref={paneSettingsNameInputRef}
                        id="pane-settings-name"
                        defaultValue={activePane.name}
                        autoFocus
                        disabled={!activePaneCanEdit}
                        className="w-full rounded-panel border border-border-muted bg-surface px-3 py-2 text-sm text-text"
                        aria-label="Pane name"
                        onBlur={() => commitActivePaneSettingsName()}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            commitActivePaneSettingsName();
                          }
                        }}
                      />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Link
                        to={buildProjectWorkHref(project.project_id, activePane.pane_id)}
                        onClick={() => handlePaneSettingsOpenChange(false)}
                        className="rounded-panel border border-border-muted px-3 py-1.5 text-sm font-semibold text-primary"
                      >
                        Open pane route
                      </Link>
                      <button
                        type="button"
                        className="rounded-panel border border-border-muted px-3 py-1.5 text-sm font-semibold text-primary disabled:opacity-60"
                        onClick={() => {
                          void onTogglePinned(activePane);
                        }}
                        disabled={!activePaneCanEdit}
                      >
                        {activePane.pinned ? 'Unpin' : 'Pin'}
                      </button>
                      <button
                        type="button"
                        className="rounded-panel border border-border-muted px-3 py-1.5 text-sm font-semibold text-primary disabled:opacity-60"
                        onClick={() => {
                          void onMovePane(activePane, 'up');
                        }}
                        disabled={!activePaneCanEdit || activeEditablePaneIndex <= 0}
                      >
                        Move up
                      </button>
                      <button
                        type="button"
                        className="rounded-panel border border-border-muted px-3 py-1.5 text-sm font-semibold text-primary disabled:opacity-60"
                        onClick={() => {
                          void onMovePane(activePane, 'down');
                        }}
                        disabled={!activePaneCanEdit || activeEditablePaneIndex < 0 || activeEditablePaneIndex >= orderedEditablePanes.length - 1}
                      >
                        Move down
                      </button>
                      {orderedEditablePanes.length > 1 ? (
                        <button
                          type="button"
                          className="rounded-panel border border-danger px-3 py-1.5 text-sm font-semibold text-danger disabled:opacity-60"
                          onClick={() => {
                            setPaneSettingsOpen(false);
                            void onDeletePaneWithNavigation(activePane);
                          }}
                          disabled={!activePaneCanEdit}
                        >
                          Delete pane
                        </button>
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Regions</p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="rounded-panel border border-border-muted px-3 py-1.5 text-sm font-semibold text-primary disabled:opacity-60"
                          onClick={() => handleToggleActivePaneRegion('modules_enabled')}
                          disabled={!activePaneCanEdit}
                        >
                          {modulesEnabled ? 'Hide modules' : 'Show modules'}
                        </button>
                        <button
                          type="button"
                          className="rounded-panel border border-border-muted px-3 py-1.5 text-sm font-semibold text-primary disabled:opacity-60"
                          onClick={() => handleToggleActivePaneRegion('workspace_enabled')}
                          disabled={!activePaneCanEdit}
                        >
                          {workspaceEnabled ? 'Hide workspace doc' : 'Show workspace doc'}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Pane members</p>
                      <div className="flex flex-wrap gap-2">
                        {projectMemberList
                          .filter((member) => String(member.role).toLowerCase() !== 'owner'
                            || activePane.members.some((entry) => entry.user_id === member.user_id))
                          .map((member) => {
                            const selected = activePane.members.some((entry) => entry.user_id === member.user_id);
                            return (
                              <label
                                key={member.user_id}
                                className={`rounded-panel border px-2 py-1 text-xs ${
                                  selected ? 'border-primary text-primary' : 'border-border-muted text-muted'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  className="mr-1"
                                  checked={selected}
                                  onChange={() => {
                                    void onTogglePaneMember(activePane, member.user_id);
                                  }}
                                  disabled={!activePaneCanEdit || member.user_id === sessionUserId}
                                />
                                {member.display_name}
                              </label>
                            );
                          })}
                      </div>
                    </div>

                    {!activePaneCanEdit ? <p className="text-xs text-muted">Read-only pane.</p> : null}
                  </div>
                </DialogContent>
              </Dialog>
            ) : null}
          </div>

          {paneId && !hasRequestedPane ? (
            <AccessDeniedView message="Pane not found in this project." />
          ) : (
            <>
              {focusedWorkView ? (
                <section className="rounded-panel border border-subtle bg-elevated p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="heading-3 text-primary">Focused View: {focusedWorkView.name}</h3>
                      <p className="text-sm text-muted">Opened from an embedded doc view.</p>
                    </div>
                    <button
                      type="button"
                      className="rounded-panel border border-border-muted px-2 py-1 text-xs font-semibold text-primary"
                      onClick={() => {
                        setSearchParams((current) => {
                          const next = new URLSearchParams(current);
                          next.delete('view_id');
                          return next;
                        }, { replace: true });
                      }}
                    >
                      Close focused view
                    </button>
                  </div>

                  {focusedWorkView.type === 'kanban' ? (
                    <div className="mt-3">
                      <Suspense fallback={<ModuleLoadingState label="Loading kanban module" rows={5} />}>
                        <KanbanModuleSkin
                          groups={kanbanRuntimeDataByViewId[focusedWorkView.view_id]?.groups || []}
                          groupOptions={kanbanRuntimeDataByViewId[focusedWorkView.view_id]?.groupOptions || []}
                          loading={kanbanRuntimeDataByViewId[focusedWorkView.view_id]?.loading ?? false}
                          groupingConfigured={kanbanRuntimeDataByViewId[focusedWorkView.view_id]?.groupingConfigured ?? false}
                          readOnly={!activePaneCanEdit}
                          groupingMessage={kanbanRuntimeDataByViewId[focusedWorkView.view_id]?.groupingMessage}
                          groupableFields={kanbanRuntimeDataByViewId[focusedWorkView.view_id]?.groupableFields}
                          metadataFieldIds={kanbanRuntimeDataByViewId[focusedWorkView.view_id]?.metadataFieldIds}
                          wipLimits={kanbanRuntimeDataByViewId[focusedWorkView.view_id]?.wipLimits}
                          onOpenRecord={(recordId) => {
                            void openInspectorWithFocusRestore(recordId);
                          }}
                          onCreateRecord={
                            activePaneCanEdit
                              ? async (payload) => {
                                  await onCreateKanbanRecord(focusedWorkView.view_id, payload, activePane?.pane_id ?? null);
                                }
                              : undefined
                          }
                          onConfigureGrouping={
                            activePaneCanEdit
                              ? async (fieldId) => {
                                  await onConfigureKanbanGrouping(focusedWorkView.view_id, fieldId, activePane?.pane_id ?? null);
                                }
                              : undefined
                          }
                          onDeleteRecord={
                            activePaneCanEdit
                              ? async (recordId) => {
                                  await onDeleteKanbanRecord(recordId, activePane?.pane_id ?? null);
                                }
                              : undefined
                          }
                          onMoveRecord={(recordId, nextGroup) => {
                            if (activePaneCanEdit) {
                              void onMoveKanbanRecord(focusedWorkView.view_id, recordId, nextGroup, activePane?.pane_id ?? null);
                            }
                          }}
                          onUpdateRecord={
                            activePaneCanEdit
                              ? async (recordId, fields) => {
                                  await onUpdateKanbanRecord(focusedWorkView.view_id, recordId, fields, activePane?.pane_id ?? null);
                                }
                              : undefined
                          }
                        />
                      </Suspense>
                    </div>
                  ) : (
                    <div className="mt-3">
                      {focusedWorkViewError ? <InlineNotice variant="danger" title="Focused view unavailable">{focusedWorkViewError}</InlineNotice> : null}
                      <Suspense fallback={<ModuleLoadingState label="Loading table module" rows={6} />}>
                        <TableModuleSkin
                          schema={focusedWorkViewData?.schema || null}
                          records={focusedWorkViewData?.records || []}
                          loading={focusedWorkViewLoading}
                          onOpenRecord={(recordId) => {
                            void openInspectorWithFocusRestore(recordId);
                          }}
                        />
                      </Suspense>
                    </div>
                  )}
                </section>
              ) : null}

              <WorkView
                layoutId={workLayoutId}
                pane={activePane ?? null}
                canEditPane={activePaneCanEdit}
                modulesEnabled={modulesEnabled}
                showWorkspaceDocPlaceholder={false}
                onUpdatePane={onUpdatePaneFromWorkView}
                onOpenRecord={(recordId) => {
                  void openInspectorWithFocusRestore(recordId);
                }}
                tableContract={tableContract}
                kanbanContract={kanbanContract}
                calendarContract={calendarContract}
                filesContract={filesContract}
                quickThoughtsContract={quickThoughtsContract}
                tasksContract={tasksContract}
                timelineContract={timelineContract}
                remindersContract={remindersContract}
              />
              {activePane && workspaceEnabled ? (
                <>
                  {recordsError ? (
                    <InlineNotice variant="danger" title="Views and records unavailable">
                      {recordsError}
                    </InlineNotice>
                  ) : null}

                  <section className="rounded-panel border border-subtle bg-elevated p-4">
                <h3 className="heading-3 text-primary">Workspace Doc</h3>
                {docBootstrapReady && activePaneDocId ? (
                  <>
                    <Suspense fallback={<ModuleLoadingState label="Loading collaborative editor" rows={8} />}>
                      <CollaborativeLexicalEditor
                        key={activePaneDocId}
                        noteId={activePaneDocId}
                        initialLexicalState={docBootstrapLexicalState}
                        collaborationSession={collabSession}
                        userName={projectMembers.find((member) => member.user_id === sessionUserId)?.display_name || 'Current user'}
                        editable={activePaneCanEdit}
                        onDocumentChange={onDocEditorChange}
                        onSelectedNodeChange={setSelectedDocNodeKey}
                        focusNodeKey={pendingDocFocusNodeKey}
                        onNodeFocused={() => setPendingDocFocusNodeKey(null)}
                        pendingMentionInsert={pendingDocMentionInsert}
                        onMentionInserted={(insertId) => {
                          if (pendingDocMentionInsert?.insert_id === insertId) {
                            setPendingDocMentionInsert(null);
                          }
                        }}
                        pendingViewEmbedInsert={pendingViewEmbedInsert}
                        onViewEmbedInserted={(insertId) => {
                          if (pendingViewEmbedInsert?.insert_id === insertId) {
                            setPendingViewEmbedInsert(null);
                          }
                        }}
                        pendingAssetEmbed={pendingDocAssetEmbed}
                        onAssetEmbedApplied={(embedId) => {
                          if (pendingDocAssetEmbed?.embed_id === embedId) {
                            setPendingDocAssetEmbed(null);
                          }
                        }}
                        viewEmbedRuntime={{
                          accessToken,
                          onOpenRecord: (recordId) => {
                            void openInspectorWithFocusRestore(recordId);
                          },
                          onOpenView: (viewId) => {
                            const targetView = views.find((view) => view.view_id === viewId);
                            if (!targetView) {
                              navigateToPane({
                                paneId: activePane.pane_id,
                                paneName: activePane.name,
                                paneSource: 'click',
                              });
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
                          },
                        }}
                      />
                    </Suspense>
                    {collabSessionError ? (
                      <InlineNotice variant="danger" className="mt-2" title="Collaboration unavailable">
                        {collabSessionError}
                      </InlineNotice>
                    ) : null}
                    {activePaneCanEdit ? (
                      <>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <MentionPicker
                            accessToken={accessToken}
                            projectId={project.project_id}
                            onSelect={onInsertDocMention}
                            buttonLabel="Insert mention"
                            ariaLabel="Insert mention into doc"
                          />
                          <label className="text-xs text-muted" htmlFor="embed-view-picker">
                            View
                          </label>
                          <select
                            id="embed-view-picker"
                            value={selectedEmbedViewId}
                            onChange={(event) => setSelectedEmbedViewId(event.target.value)}
                            className="rounded-panel border border-border-muted bg-surface px-2 py-1 text-xs text-text"
                            aria-label="View embed picker"
                          >
                            <option value="">Select a view</option>
                            {views.map((view) => (
                              <option key={view.view_id} value={view.view_id}>
                                {view.name} ({view.type})
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={onInsertViewEmbed}
                            disabled={!selectedEmbedViewId}
                            className="rounded-panel border border-border-muted px-2 py-1 text-xs font-semibold text-primary disabled:opacity-60"
                            aria-label="Insert selected view embed"
                          >
                            Insert view block
                          </button>
                        </div>
                        <form ref={docAssetFormRef} className="mt-3 flex flex-wrap items-center gap-2" onSubmit={onUploadDocAsset}>
                          <input
                            ref={docAssetInputRef}
                            name="doc-asset-file"
                            type="file"
                            className="hidden"
                            aria-hidden="true"
                            tabIndex={-1}
                            disabled={uploadingDocAsset}
                            onChange={(event) => {
                              if (!event.currentTarget.files?.length) {
                                return;
                              }
                              docAssetFormRef.current?.requestSubmit();
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => docAssetInputRef.current?.click()}
                            disabled={uploadingDocAsset}
                            className="inline-flex items-center gap-1 rounded-panel border border-border-muted px-2 py-1 text-xs font-semibold text-primary disabled:cursor-not-allowed disabled:opacity-60"
                            aria-label="Upload doc asset"
                          >
                            <Icon name="upload" className="text-[12px]" />
                            {uploadingDocAsset ? 'Uploading...' : 'Upload + embed'}
                          </button>
                        </form>
                      </>
                    ) : (
                      <p className="mt-3 text-xs text-muted">Read-only doc mode. You can review the pane and leave comments below.</p>
                    )}
                  </>
                ) : docBootstrapReady ? (
                  <p className="mt-2 text-sm text-muted">Pane doc unavailable.</p>
                ) : (
                  <ModuleLoadingState label="Loading workspace doc" rows={8} />
                )}
                  </section>

                  <div className="rounded-panel border border-subtle bg-elevated p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-muted">
                    Selected block: <span className="font-semibold text-primary">{selectedDocNodeKey || 'none'}</span>
                  </p>
                  <motion.button
                    layoutId={!prefersReducedMotion && docCommentComposerOpen ? dialogLayoutIds.commentOnBlock : undefined}
                    ref={commentTriggerRef}
                    type="button"
                    className="rounded-panel border border-border-muted px-3 py-1.5 text-xs font-semibold text-primary disabled:opacity-60"
                    onClick={() => onDocCommentDialogOpenChange(true)}
                    disabled={!selectedDocNodeKey}
                    aria-label="Comment on block"
                  >
                    Comment on block
                  </motion.button>
                </div>
                  </div>

                  <CommentRail
                comments={docComments}
                orphanedComments={orphanedDocComments}
                onToggleStatus={(commentId, status) => {
                  void onResolveDocComment(commentId, status);
                }}
                onJumpToComment={onJumpToDocComment}
                showResolved={showResolvedDocComments}
                onToggleShowResolved={() => setShowResolvedDocComments((current) => !current)}
                  />

                  <Dialog open={docCommentComposerOpen} onOpenChange={onDocCommentDialogOpenChange}>
                <DialogContent open={docCommentComposerOpen} animated layoutId={dialogLayoutIds.commentOnBlock}>
                  <DialogHeader>
                    <DialogTitle>Comment on block</DialogTitle>
                    <DialogDescription className="sr-only">
                      Add a node-anchored comment for block {selectedDocNodeKey || 'unknown'}.
                    </DialogDescription>
                  </DialogHeader>
                  {docCommentError ? (
                    <InlineNotice variant="danger" title="Doc comment failed">
                      {docCommentError}
                    </InlineNotice>
                  ) : null}
                  <CommentComposer
                    accessToken={accessToken}
                    projectId={project.project_id}
                    value={docCommentText}
                    onChange={setDocCommentText}
                    onSubmit={() => {
                      void onAddDocComment();
                    }}
                    onCancel={() => onDocCommentDialogOpenChange(false)}
                    disabled={!selectedDocNodeKey || !docCommentText.trim()}
                    submitLabel="Add node comment"
                    placeholder="Comment on selected block"
                    nodeKeyLabel={selectedDocNodeKey}
                  />
                </DialogContent>
              </Dialog>
                </>
              ) : activePane ? (
                <section className="rounded-panel border border-subtle bg-elevated p-4">
                  <h3 className="heading-3 text-primary">Workspace Doc</h3>
                  <p className="mt-2 text-sm text-muted">This pane is set to modules-only mode. The workspace doc is hidden here.</p>
                </section>
              ) : null}
            </>
          )}
        </section>
      ) : null}

      {activeTab === 'tools' ? (
        <section className="space-y-4">
          <article className="rounded-panel border border-subtle bg-elevated p-4">
            <h2 className="heading-3 text-primary">Asset Library Roots</h2>
            <form className="mt-2 flex flex-wrap gap-2" onSubmit={onAddAssetRoot}>
              <input
                value={newAssetRootPath}
                onChange={(event) => setNewAssetRootPath(event.target.value)}
                className="rounded-panel border border-border-muted bg-surface px-3 py-1.5 text-sm text-text"
                placeholder="/Projects/Hub"
                aria-label="Asset root path"
              />
              <button type="submit" className="rounded-panel border border-border-muted px-3 py-1.5 text-sm font-semibold text-primary">
                Add root
              </button>
            </form>
            <ul className="mt-3 space-y-2">
              {assetRoots.map((root) => (
                <li key={root.asset_root_id} className="rounded-panel border border-border-muted p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-text">{root.root_path}</p>
                    <button
                      type="button"
                      className="rounded-panel border border-border-muted px-2 py-1 text-xs font-semibold text-primary"
                      onClick={() => void onLoadAssets(root.asset_root_id)}
                    >
                      List assets
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            {assetWarning ? (
              <InlineNotice variant="warning" className="mt-2" title="Asset warning">
                {assetWarning}
              </InlineNotice>
            ) : null}
            {assetEntries.length > 0 ? (
              <ul className="mt-2 space-y-1">
                {assetEntries.map((entry) => (
                  <li key={entry.path} className="text-sm text-muted">
                    {entry.name}
                  </li>
                ))}
              </ul>
            ) : null}
          </article>

          <AutomationBuilder
            rules={automationRules}
            runs={automationRuns}
            availableRecordTypes={availableRecordTypes}
            onCreateRule={onCreateAutomationRule}
            onUpdateRule={onUpdateAutomationRule}
            onDeleteRule={onDeleteAutomationRule}
            onToggleRule={onToggleAutomationRule}
          />
        </section>
      ) : null}

      {!prefersReducedMotion && inspectorTriggerRect ? (
        <motion.div
          layoutId={dialogLayoutIds.recordInspector}
          aria-hidden="true"
          className="pointer-events-none fixed z-[299] opacity-0"
          style={{
            top: inspectorTriggerRect.top,
            left: inspectorTriggerRect.left,
            width: inspectorTriggerRect.width,
            height: inspectorTriggerRect.height,
          }}
        />
      ) : null}

      <Dialog open={Boolean(inspectorRecordId)} onOpenChange={(open) => (!open ? closeInspectorWithFocusRestore() : undefined)}>
        <DialogContent
          open={Boolean(inspectorRecordId)}
          animated
          layoutId={dialogLayoutIds.recordInspector}
          motionVariant="fold-sheet"
          className="dialog-panel-sheet-size !left-0 !top-0 h-screen !translate-x-0 !translate-y-0 overflow-y-auto rounded-none sm:!rounded-none border-r border-border-muted"
          onCloseAutoFocus={(event) => {
            if (inspectorTriggerRef.current) {
              event.preventDefault();
              inspectorTriggerRef.current.focus();
            }
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <DialogHeader className="min-w-0 flex-1">
              <DialogTitle>Record Inspector</DialogTitle>
              <DialogDescription className="sr-only">
                Quick dismissible inspector. Press Escape or close to return focus to the invoking control.
              </DialogDescription>
            </DialogHeader>
            <DialogClose
              aria-label="Close inspector"
              className="inline-flex h-9 w-9 items-center justify-center rounded-panel border border-border-muted text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              <Icon name="close" className="h-4 w-4" />
            </DialogClose>
          </div>

          {inspectorLoading ? <p className="mt-3 text-sm text-muted">Loading record...</p> : null}
          {inspectorError ? (
            <InlineNotice variant="danger" className="mt-3" title="Record inspector error">
              {inspectorError}
            </InlineNotice>
          ) : null}

          {inspectorRecord ? (
            <div className="mt-4 space-y-4">
              <section className="rounded-panel border border-border-muted p-3">
                <h3 className="text-sm font-semibold text-primary">{inspectorRecord.title}</h3>
                <p className="mt-1 text-xs text-muted">Collection: {inspectorRecord.schema?.name || inspectorRecord.collection_id}</p>
                {inspectorRecord.source_pane?.pane_id ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                    <span>Origin: {inspectorRecord.source_pane.pane_name || inspectorRecord.source_pane.pane_id}</span>
                    <button
                      type="button"
                      className="rounded-panel border border-border-muted px-2 py-1 text-xs font-semibold text-primary"
                      onClick={() => {
                        const targetHref = buildPaneContextHref({
                          projectId: project.project_id,
                          sourcePane: inspectorRecord.source_pane,
                          fallbackHref: buildProjectWorkHref(project.project_id),
                        });
                        navigate(targetHref, {
                          state: withHubMotionState(undefined, {
                            hubProjectName: project.name,
                            hubPaneName: inspectorRecord.source_pane?.pane_name || inspectorRecord.source_pane?.pane_id || undefined,
                            hubPaneSource: 'click',
                          }),
                        });
                      }}
                    >
                      Open source pane
                    </button>
                  </div>
                ) : null}
                {!inspectorMutationPaneCanEdit ? (
                  <p className="mt-2 text-xs text-muted">
                    {inspectorMutationPane?.pane_id
                      ? `Opened in read-only pane ${inspectorMutationPane.name || inspectorMutationPane.pane_id}.`
                      : 'Opened outside a pane edit context.'}{' '}
                    You can review this record and add comments, but only pane editors can change fields, attachments, or relations.
                  </p>
                ) : null}
                <div className="mt-2 space-y-2">
                  {inspectorRecord.schema?.fields.map((field) => (
                    <label key={field.field_id} className="flex flex-col gap-1 text-xs text-muted">
                      {field.name}
                      <input
                        defaultValue={String(inspectorRecord.values[field.field_id] || '')}
                        disabled={!inspectorMutationPaneCanEdit}
                        className="rounded-panel border border-border-muted bg-surface px-2 py-1 text-sm text-text"
                        onBlur={(event) => {
                          if (inspectorMutationPaneCanEdit) {
                            void onSaveRecordField(field.field_id, event.target.value);
                          }
                        }}
                      />
                    </label>
                  ))}
                </div>
                {savingValues ? <p className="mt-2 text-xs text-muted">Saving...</p> : null}
              </section>

              <section className="rounded-panel border border-border-muted p-3">
                <h3 className="text-sm font-semibold text-primary">Attachments</h3>
                {inspectorRecord.attachments.length > 0 ? (
                  <div className="mt-2 space-y-2">
                    <div className="flex flex-wrap gap-1">
                      {inspectorRecord.attachments.map((attachment) => {
                        const selected = selectedAttachmentId === attachment.attachment_id;
                        return (
                          <button
                            key={attachment.attachment_id}
                            type="button"
                            onClick={() => setSelectedAttachmentId(attachment.attachment_id)}
                            aria-pressed={selected}
                            className={`rounded-control border px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
                              selected
                                ? 'border-primary text-text bg-primary/10'
                                : 'border-border-muted text-muted bg-transparent'
                            }`}
                          >
                            {attachment.name}
                          </button>
                        );
                      })}
                    </div>

                    {selectedAttachmentId ? (
                      <FileInspectorActionBar
                        fileName={
                          inspectorRecord.attachments.find((attachment) => attachment.attachment_id === selectedAttachmentId)?.name ||
                          'Attachment'
                        }
                        downloadUrl={
                          inspectorRecord.attachments.find((attachment) => attachment.attachment_id === selectedAttachmentId)?.proxy_url || ''
                        }
                        shareableLink={
                          inspectorRecord.attachments.find((attachment) => attachment.attachment_id === selectedAttachmentId)?.proxy_url || ''
                        }
                        panes={panes.map((pane) => ({ id: pane.pane_id, name: pane.name }))}
                        readOnly={!inspectorMutationPaneCanEdit}
                        onRename={(nextName) => {
                          void onRenameInspectorAttachment(selectedAttachmentId, nextName);
                        }}
                        onMove={(paneIdToMove) => {
                          void onMoveInspectorAttachment(selectedAttachmentId, paneIdToMove);
                        }}
                        onRemove={() => {
                          void onDetachInspectorAttachment(selectedAttachmentId);
                        }}
                      />
                    ) : null}

                    <ul className="space-y-1">
                      {inspectorRecord.attachments.map((attachment) => (
                        <li key={attachment.attachment_id} className="text-sm text-muted">
                          {attachment.name} ({attachment.mime_type})
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-muted">No attachments yet.</p>
                )}
                {inspectorMutationPaneCanEdit ? (
                  <form className="mt-2 flex flex-wrap items-center gap-2" onSubmit={onAttachFile}>
                    <input name="attachment-file" type="file" className="text-xs text-muted" aria-label="Attach file" />
                    <button
                      type="submit"
                      disabled={uploadingAttachment}
                      className="inline-flex items-center gap-1 rounded-panel border border-border-muted px-2 py-1 text-xs font-semibold text-primary disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Icon name="upload" className="text-[12px]" />
                      {uploadingAttachment ? 'Uploading...' : 'Attach'}
                    </button>
                  </form>
                ) : (
                  <p className="mt-2 text-xs text-muted">Attachments are read-only in this pane.</p>
                )}
              </section>

              <RelationsSection
                accessToken={accessToken}
                projectId={project.project_id}
                recordId={inspectorRecord.record_id}
                relationFields={inspectorRelationFields}
                outgoing={inspectorRecord.relations.outgoing}
                incoming={inspectorRecord.relations.incoming}
                removingRelationId={removingRelationId}
                mutationError={relationMutationError}
                readOnly={!inspectorMutationPaneCanEdit}
                onAddRelation={onAddRelation}
                onRemoveRelation={onRemoveRelation}
              />

              <section className="rounded-panel border border-border-muted p-3">
                <h3 className="text-sm font-semibold text-primary">Comments + Mentions</h3>
                <ul className="mt-2 space-y-2">
                  {inspectorRecord.comments.map((comment) => (
                    <li key={comment.comment_id} className="rounded-panel border border-border-muted p-2">
                      <p className="text-sm text-text">{readPlainComment(comment.body_json)}</p>
                      <p className="text-xs text-muted">{comment.status}</p>
                    </li>
                  ))}
                </ul>

                <form className="mt-2 space-y-2" onSubmit={onAddRecordComment}>
                  <textarea
                    value={inspectorCommentText}
                    onChange={(event) => setInspectorCommentText(event.target.value)}
                    className="w-full rounded-panel border border-border-muted bg-surface px-3 py-2 text-sm text-text"
                    rows={3}
                    placeholder="Type comment. Use mention picker for users/records."
                    aria-label="Record comment"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <MentionPicker
                      accessToken={accessToken}
                      projectId={project.project_id}
                      onSelect={onInsertRecordCommentMention}
                      buttonLabel="@ Mention"
                      ariaLabel="Add mention to record comment"
                    />
                    <button
                      type="submit"
                      className="rounded-panel border border-border-muted px-3 py-1.5 text-sm font-semibold text-primary"
                    >
                      Add comment
                    </button>
                  </div>
                </form>
              </section>

              <BacklinksPanel
                backlinks={inspectorBacklinks}
                loading={inspectorBacklinksLoading}
                error={inspectorBacklinksError}
                onOpenBacklink={onOpenBacklink}
              />

              <section className="rounded-panel border border-border-muted p-3">
                <h3 className="text-sm font-semibold text-primary">Activity</h3>
                <ul className="mt-2 space-y-1">
                  {inspectorRecord.activity.map((entry) => (
                    <li key={entry.timeline_event_id} className="text-xs text-muted">
                      {entry.event_type} · {new Date(entry.created_at).toLocaleString()}
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          ) : null}

          <div className="mt-4">
            <DialogClose className="rounded-panel border border-border-muted px-3 py-1.5 text-sm font-semibold text-primary">
              Close inspector
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};
