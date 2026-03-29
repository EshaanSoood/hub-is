import { FormEvent, Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  type HubBacklink,
  type HubPaneSummary,
  type HubProject,
  type HubProjectMember,
} from '../services/hub/types';
import { useAuthz } from '../context/AuthzContext';
import { ModuleInsertProvider } from '../context/ModuleInsertContext';
import {
  buildPaneContextHref,
  buildProjectOverviewHref,
  buildProjectToolsHref,
  buildProjectWorkHref,
} from '../lib/hubRoutes';
import { useAutomationRuntime } from '../hooks/useAutomationRuntime';
import { useCalendarRuntime } from '../hooks/useCalendarRuntime';
import { usePaneMutations } from '../hooks/usePaneMutations';
import { useProjectBootstrap } from '../hooks/useProjectBootstrap';
import { useProjectMembers } from '../hooks/useProjectMembers';
import { useProjectFilesRuntime } from '../hooks/useProjectFilesRuntime';
import { useProjectTasksRuntime } from '../hooks/useProjectTasksRuntime';
import { useProjectViewsRuntime } from '../hooks/useProjectViewsRuntime';
import { useQuickCapture } from '../hooks/useQuickCapture';
import { useRecordInspector } from '../hooks/useRecordInspector';
import { useRemindersRuntime } from '../hooks/useRemindersRuntime';
import { useTimelineRuntime } from '../hooks/useTimelineRuntime';
import { useWorkspaceDocRuntime } from '../hooks/useWorkspaceDocRuntime';
import { archiveRecord, createEventFromNlp, createRecord, updateRecord } from '../services/hub/records';
import { AccessDeniedView } from '../components/auth/AccessDeniedView';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/project-space/ProjectSpaceDialogPrimitives';
import { Icon, InlineNotice } from '../components/primitives';
import { BacklinksPanel } from '../components/project-space/BacklinksPanel';
import { CommentComposer } from '../components/project-space/CommentComposer';
import { CommentRail } from '../components/project-space/CommentRail';
import { MentionPicker } from '../components/project-space/MentionPicker';
import { ModuleLoadingState } from '../components/project-space/ModuleFeedback';
import { OverviewView } from '../components/project-space/OverviewView';
import { PaneSwitcher } from '../components/project-space/PaneSwitcher';
import { RelationsSection } from '../components/project-space/RelationsSection';
import { AutomationBuilder } from '../components/project-space/AutomationBuilder';
import { FileInspectorActionBar } from '../components/project-space/FileInspectorActionBar';
import { WorkView, type WorkViewModuleRuntime } from '../components/project-space/WorkView';
import { adaptTaskSummaries } from '../components/project-space/taskAdapter';

// Layout contract references:
// components/project-space/TopNavTabs
// components/project-space/OverviewView
// components/project-space/ToolsView

const KanbanModuleSkin = lazy(async () => {
  const module = await import('../components/project-space/KanbanModuleSkin');
  return { default: module.KanbanModuleSkin };
});

const TableModuleSkin = lazy(async () => {
  const module = await import('../components/project-space/TableModuleSkin');
  return { default: module.TableModuleSkin };
});

const CollaborativeLexicalEditor = lazy(async () => {
  const module = await import('../features/notes/CollaborativeLexicalEditor');
  return { default: module.CollaborativeLexicalEditor };
});

const defaultLexicalState = {
  root: {
    children: [
      {
        children: [],
        direction: null,
        format: '',
        indent: 0,
        type: 'paragraph',
        version: 1,
      },
    ],
    direction: null,
    format: '',
    indent: 0,
    type: 'root',
    version: 1,
  },
};

type TopLevelProjectTab = 'overview' | 'work' | 'tools';
type OverviewView = 'timeline' | 'calendar' | 'tasks' | 'kanban';

interface ProjectSpacePageProps {
  activeTab: TopLevelProjectTab;
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

const readFocusNodeKeyFromLocationState = (state: unknown): string | null => {
  if (!state || typeof state !== 'object') {
    return null;
  }
  const focusNodeKey = (state as { focusNodeKey?: unknown }).focusNodeKey;
  if (typeof focusNodeKey !== 'string') {
    return null;
  }
  const trimmed = focusNodeKey.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const readFocusNodeKeyFromSearchParams = (params: URLSearchParams): string | null => {
  const value = params.get('focus_node_key');
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const paneCanEditForUser = (pane: HubPaneSummary | null | undefined, userId: string): boolean => {
  void userId;
  return pane?.can_edit === true;
};

function readOverviewView(searchParams: URLSearchParams): OverviewView {
  const value = searchParams.get('view');
  if (value === 'calendar' || value === 'tasks' || value === 'kanban') {
    return value;
  }
  return 'timeline';
}

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
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return window.btoa(binary);
};

const PENDING_CAPTURE_DRAFT_KEY = 'hub:pending-project-capture';

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

const ProjectSpaceWorkspace = ({
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
  timeline: Array<{
    timeline_event_id: string;
    event_type: string;
    primary_entity_type: string;
    primary_entity_id: string;
    summary_json: Record<string, unknown>;
    created_at: string;
  }>;
  setTimeline: React.Dispatch<
    React.SetStateAction<
      Array<{
        timeline_event_id: string;
        event_type: string;
        primary_entity_type: string;
        primary_entity_id: string;
        summary_json: Record<string, unknown>;
        created_at: string;
      }>
    >
  >;
}) => {
  const { paneId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [overviewView, setOverviewView] = useState<OverviewView>(() => readOverviewView(searchParams));

  const [creatingPaneName, setCreatingPaneName] = useState('');
  const [showPaneSwitcher, setShowPaneSwitcher] = useState(searchParams.get('pinned') !== '1');
  const [showOtherPanes, setShowOtherPanes] = useState(false);
  const [otherPaneQuery, setOtherPaneQuery] = useState('');
  const inspectorTriggerRef = useRef<HTMLElement | null>(null);

  const { calendarEvents, calendarLoading, calendarMode, refreshCalendar, setCalendarMode } = useCalendarRuntime({
    accessToken,
    projectId: project.project_id,
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

  const pinnedPanes = useMemo(() => panes.filter((pane) => pane.pinned), [panes]);
  const openedFromPinned = searchParams.get('pinned') === '1';
  const previousOpenedFromPinnedRef = useRef(openedFromPinned);
  const {
    projectMembers: projectMemberList,
  } = useProjectMembers({
    accessToken,
    projectId: project.project_id,
    membershipRole: project.membership_role,
    projectMembers,
    refreshProjectData,
  });
  const {
    onCreatePane,
    onDeletePane,
    onMovePane,
    onRenamePane,
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
    focusedWorkView,
    focusedWorkViewData,
    focusedWorkViewError,
    focusedWorkViewId,
    focusedWorkViewLoading,
    onMoveKanbanRecord,
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
    inspectorMutationPaneId,
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
  void inspectorMutationPaneId;
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
  const remindersRuntime = useRemindersRuntime(accessToken);

  useEffect(() => {
    if (previousOpenedFromPinnedRef.current !== openedFromPinned) {
      setShowPaneSwitcher(!openedFromPinned);
    }
    previousOpenedFromPinnedRef.current = openedFromPinned;
  }, [openedFromPinned]);

  useEffect(() => {
    setOverviewView(readOverviewView(searchParams));
  }, [searchParams]);

  const activePaneDocId = activePane?.doc_id || null;
  const openInspectorWithFocusRestore = useCallback(
    async (recordId: string, options?: { mutationPaneId?: string | null }) => {
      inspectorTriggerRef.current = getActiveInspectorFocusTarget();
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

  useEffect(() => {
    if (activeTab !== 'work') {
      return;
    }
    if (activePane && ((!paneId) || (activePane.pane_id !== paneId && hasRequestedPane))) {
      const nextPath = buildProjectWorkHref(project.project_id, activePane.pane_id);
      const query = searchParams.toString();
      navigate(query ? `${nextPath}?${query}` : nextPath, { replace: true });
    }
  }, [activePane, activeTab, hasRequestedPane, navigate, paneId, project.project_id, searchParams]);

  useEffect(() => {
    const recordId = searchParams.get('record_id');
    if (
      activeTab !== 'work' ||
      !recordId ||
      !activePane ||
      (paneId && !hasRequestedPane)
    ) {
      return;
    }

    let cancelled = false;
    void (async () => {
      await openInspectorWithFocusRestore(recordId);
      if (cancelled) {
        return;
      }
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('record_id');
      setSearchParams(nextParams, { replace: true });
    })();

    return () => {
      cancelled = true;
    };
  }, [activePane, activeTab, hasRequestedPane, openInspectorWithFocusRestore, paneId, searchParams, setSearchParams]);

  useEffect(() => {
    if (searchParams.get('capture') !== '1') {
      return;
    }
    if (quickCaptureInFlightRef.current) {
      return;
    }

    let cancelled = false;
    const intent = searchParams.get('intent');
    const pendingDraft =
      typeof window === 'undefined'
        ? null
        : (() => {
            try {
              const raw = window.sessionStorage.getItem(PENDING_CAPTURE_DRAFT_KEY);
              if (!raw) {
                return null;
              }
              const parsed = JSON.parse(raw) as { intent?: string | null; seedText?: string };
              if ((parsed.intent ?? null) !== intent) {
                return null;
              }
              return parsed;
            } catch {
              return null;
            }
          })();
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('capture');
    nextParams.delete('intent');

    const createAndOpenCapture = async () => {
      let didRun = false;
      try {
        didRun = await createAndOpenCaptureRecord(intent, pendingDraft?.seedText);
        if (cancelled || !didRun) {
          return;
        }
      } finally {
        if (!cancelled && didRun) {
          if (typeof window !== 'undefined') {
            window.sessionStorage.removeItem(PENDING_CAPTURE_DRAFT_KEY);
          }
          setSearchParams(nextParams, { replace: true });
        }
      }
    };

    void createAndOpenCapture();

    return () => {
      cancelled = true;
    };
  }, [createAndOpenCaptureRecord, quickCaptureInFlightRef, searchParams, setSearchParams]);

  const onOpenBacklink = (backlink: HubBacklink) => {
    if (!backlink.source.pane_id) {
      return;
    }
    navigate(buildProjectWorkHref(project.project_id, backlink.source.pane_id), {
      state: backlink.source.node_key ? { focusNodeKey: backlink.source.node_key } : null,
    });
  };

  const onCreatePaneSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextPane = await onCreatePane(creatingPaneName);
    if (!nextPane) {
      return;
    }

    setCreatingPaneName('');
    navigate(buildProjectWorkHref(project.project_id, nextPane.pane_id));
  };

  const onDeletePaneWithNavigation = async (pane: HubPaneSummary) => {
    const nextPath = await onDeletePane(pane, activePane?.pane_id ?? null);
    if (nextPath) {
      navigate(nextPath);
    }
  };

  const {
    collabSession,
    collabSessionError,
    commentTriggerRef,
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

  useEffect(() => {
    if (!activePaneDocId) {
      return;
    }
    const focusNodeKey = readFocusNodeKeyFromLocationState(location.state) || readFocusNodeKeyFromSearchParams(searchParams);
    if (!focusNodeKey) {
      return;
    }
    setPendingDocFocusNodeKey(focusNodeKey);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('focus_node_key');
    const query = nextParams.toString();
    navigate(query ? `${location.pathname}?${query}` : location.pathname, { replace: true, state: null });
  }, [activePaneDocId, location.pathname, location.state, navigate, searchParams, setPendingDocFocusNodeKey]);

  const modulesEnabled = useMemo(
    () => (activePane ? readLayoutBool(activePane.layout_config, 'modules_enabled', true) : true),
    [activePane],
  );
  const workspaceEnabled = useMemo(
    () => (activePane ? readLayoutBool(activePane.layout_config, 'workspace_enabled', true) : true),
    [activePane],
  );
  const paneTaskItems = useMemo(
    () =>
      adaptTaskSummaries(
        tasksOverviewRows.filter((task) => {
          if (!activePane?.pane_id) {
            return false;
          }
          return task.source_pane?.pane_id === activePane.pane_id;
        }),
      ),
    [activePane?.pane_id, tasksOverviewRows],
  );

  useEffect(() => {
    if (activeTab === 'overview') {
      const currentView = searchParams.get('view');
      const hasKanbanViewId = searchParams.has('kanban_view_id');
      if (currentView === overviewView && !hasKanbanViewId) {
        return;
      }
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.set('view', overviewView);
        next.delete('kanban_view_id');
        return next;
      }, { replace: true });
    }
  }, [activeTab, overviewView, searchParams, setSearchParams]);
  const workViewModuleRuntime = useMemo<WorkViewModuleRuntime>(
    () => ({
      table: {
        views: tableViews,
        defaultViewId: tableViews[0]?.view_id || null,
        dataByViewId: tableViewRuntimeDataById,
      },
      kanban: {
        views: kanbanViews,
        defaultViewId: kanbanViews[0]?.view_id || null,
        dataByViewId: kanbanRuntimeDataByViewId,
        onMoveRecord: (viewId, recordId, nextGroup) => {
          void onMoveKanbanRecord(viewId, recordId, nextGroup, activePane?.pane_id ?? null);
        },
      },
      calendar: {
        events: calendarEvents,
        loading: calendarLoading,
        scope: calendarMode,
        onScopeChange: setCalendarMode,
        onCreateEvent:
          activePaneCanEdit && canWriteProject
            ? async (payload) => {
                if (!accessToken) {
                  return;
                }
                await createEventFromNlp(accessToken, project.project_id, payload);
                await refreshCalendar();
              }
            : undefined,
        onRescheduleEvent:
          activePaneCanEdit && canWriteProject
            ? async (payload) => {
                if (!accessToken) {
                  return;
                }
                try {
                  await updateRecord(accessToken, payload.record_id, {
                    event_state: {
                      start_dt: payload.start_dt,
                      end_dt: payload.end_dt,
                      timezone: payload.timezone,
                    },
                  });
                  await refreshCalendar();
                } catch (error) {
                  const message = error instanceof Error ? error.message : 'Failed to reschedule event.';
                  console.error('onRescheduleEvent: failed to update record', error);
                  setRecordsError(message);
                }
              }
            : undefined,
      },
      files: {
        paneFiles,
        projectFiles,
        onUploadPaneFiles,
        onUploadProjectFiles,
        onOpenFile: onOpenPaneFile,
      },
      quickThoughts: {
        storageKeyBase: `hub:quick-thoughts:${project.project_id}`,
        legacyStorageKeyBase: `hub:capture:${project.project_id}`,
      },
      tasks: {
        items: paneTaskItems,
        loading: projectTasksLoading,
        onCreateTask: async (task) => {
          const collectionId = tasksOverviewRows[0]?.collection_id;
          if (!collectionId) {
            console.error('onCreateTask: no task collection found for this project');
            alert('No task collection found for this project. Create a task from a pane first.');
            return;
          }
          if (!accessToken) {
            return;
          }
          await createRecord(accessToken, project.project_id, {
            collection_id: collectionId,
            title: task.title,
            capability_types: ['task'],
            task_state: {
              status: 'todo',
              priority: task.priority,
              due_at: task.due_at,
            },
            parent_record_id: task.parent_record_id || null,
            source_pane_id: activePane?.pane_id,
          });
          await loadProjectTaskPage();
        },
        onUpdateTaskStatus: async (taskId, status) => {
          if (!accessToken) {
            return;
          }
          try {
            await updateRecord(accessToken, taskId, { task_state: { status } });
            await loadProjectTaskPage();
          } catch (err) {
            console.error('Failed to update task status:', err);
          }
        },
        onUpdateTaskPriority: async (taskId, priority) => {
          if (!accessToken) {
            return;
          }
          try {
            await updateRecord(accessToken, taskId, { task_state: { priority } });
            await loadProjectTaskPage();
          } catch (err) {
            console.error('Failed to update task priority:', err);
          }
        },
        onUpdateTaskDueDate: async (taskId, dueAt) => {
          if (!accessToken) {
            return;
          }
          try {
            await updateRecord(accessToken, taskId, { task_state: { due_at: dueAt } });
            await loadProjectTaskPage();
          } catch (err) {
            console.error('Failed to update task due date:', err);
          }
        },
        onDeleteTask: async (taskId) => {
          if (!accessToken) {
            return;
          }
          try {
            await archiveRecord(accessToken, taskId);
            await loadProjectTaskPage();
          } catch (err) {
            console.error('Failed to delete task:', err);
          }
        },
      },
      timeline: {
        clusters: timelineClusters,
        activeFilters: timelineFilters,
        loading: false,
        hasMore: false,
        onFilterToggle: toggleTimelineFilter,
        onLoadMore: () => {
          void refreshProjectData();
        },
        onItemClick: (recordId) => {
          void openInspectorWithFocusRestore(recordId);
        },
      },
      reminders: {
        items: remindersRuntime.reminders,
        loading: remindersRuntime.loading,
        error: remindersRuntime.error,
        onDismiss: remindersRuntime.dismiss,
        onCreate: remindersRuntime.create,
      },
    }),
    [
      calendarEvents,
      calendarLoading,
      calendarMode,
      refreshCalendar,
      setCalendarMode,
      kanbanRuntimeDataByViewId,
      kanbanViews,
      activePaneCanEdit,
      activePane?.pane_id,
      accessToken,
      canWriteProject,
      onMoveKanbanRecord,
      onOpenPaneFile,
      onUploadPaneFiles,
      onUploadProjectFiles,
      loadProjectTaskPage,
      paneFiles,
      paneTaskItems,
      projectTasksLoading,
      project.project_id,
      projectFiles,
      tableViewRuntimeDataById,
      tableViews,
      tasksOverviewRows,
      timelineClusters,
      timelineFilters,
      toggleTimelineFilter,
      refreshProjectData,
      openInspectorWithFocusRestore,
      remindersRuntime.create,
      remindersRuntime.dismiss,
      remindersRuntime.error,
      remindersRuntime.loading,
      remindersRuntime.reminders,
      setRecordsError,
    ],
  );

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
          onClick={() => navigate(buildProjectOverviewHref(project.project_id))}
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
          onClick={() => navigate(buildProjectWorkHref(project.project_id, activePane?.pane_id))}
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
              onClick={() => navigate(`${buildProjectWorkHref(project.project_id, pane.pane_id)}?pinned=1`)}
              className={`rounded-panel px-3 py-1.5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
                selected ? 'bg-primary text-on-primary' : 'border border-border-muted text-primary'
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
          onClick={() => navigate(buildProjectToolsHref(project.project_id))}
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
    <div className="space-y-4">
      {paneNavigator}

      {activeTab === 'overview' ? (
        <OverviewView
          projectName={project.name}
          projectSummary="Track the timeline, calendar, and task flow for this project."
          collaborators={overviewCollaborators}
          clients={overviewClients}
          activeView={overviewView}
          onSelectView={setOverviewView}
          accessToken={accessToken}
          projectId={project.project_id}
          tasks={tasksOverviewRows}
          tasksLoading={projectTasksLoading}
          tasksError={projectTasksError}
          onRefreshTasks={() => {
            void loadProjectTaskPage();
          }}
          projectMembers={projectMemberList}
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

            {showPaneSwitcher ? (
              <div className="mt-3 space-y-3">
                <PaneSwitcher
                  panes={editablePanes.map((pane, index) => ({
                    id: pane.pane_id,
                    label: pane.name,
                    shortcutNumber: index + 1,
                  }))}
                  activePaneId={activePane?.pane_id ?? null}
                  onPaneChange={(nextPaneId) => {
                    navigate(buildProjectWorkHref(project.project_id, nextPaneId));
                  }}
                  onMovePane={(paneIdToMove, direction) => {
                    const pane = panes.find((entry) => entry.pane_id === paneIdToMove);
                    if (pane) {
                      void onMovePane(pane, direction);
                    }
                  }}
                />

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
                            onClick={() => navigate(buildProjectWorkHref(project.project_id, pane.pane_id))}
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

                {canWriteProject ? (
                  <details className="rounded-panel border border-border-muted bg-surface p-3">
                    <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted">Editable pane management</summary>
                    <div className="mt-3 space-y-2">
                      {editablePanes.map((pane) => (
                        <article key={pane.pane_id} className="rounded-panel border border-border-muted p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => navigate(buildProjectWorkHref(project.project_id, pane.pane_id))}
                              className="font-semibold text-primary underline"
                            >
                              {pane.name}
                            </button>
                            <div className="flex flex-wrap gap-1">
                              <button
                                type="button"
                                className="rounded-panel border border-border-muted px-2 py-1 text-xs font-semibold text-primary"
                                onClick={() => void onMovePane(pane, 'up')}
                              >
                                Up
                              </button>
                              <button
                                type="button"
                                className="rounded-panel border border-border-muted px-2 py-1 text-xs font-semibold text-primary"
                                onClick={() => void onMovePane(pane, 'down')}
                              >
                                Down
                              </button>
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 rounded-panel border border-border-muted px-2 py-1 text-xs font-semibold text-primary"
                                onClick={() => void onTogglePinned(pane)}
                              >
                                <Icon name="pin" className="text-[12px]" />
                                {pane.pinned ? 'Unpin' : 'Pin'}
                              </button>
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 rounded-panel border border-border-muted px-2 py-1 text-xs font-semibold text-primary"
                                onClick={() => {
                                  const nextName = window.prompt('Rename pane', pane.name);
                                  if (nextName) {
                                    void onRenamePane(pane, nextName);
                                  }
                                }}
                              >
                                <Icon name="edit" className="text-[12px]" />
                                Rename
                              </button>
                              {editablePanes.length > 1 ? (
                                <button
                                  type="button"
                                  className="inline-flex items-center gap-1 rounded-panel border border-danger px-2 py-1 text-xs font-semibold text-danger"
                                  onClick={() => void onDeletePaneWithNavigation(pane)}
                                >
                                  <Icon name="trash" className="text-[12px]" />
                                  Delete
                                </button>
                              ) : null}
                            </div>
                          </div>

                          <div className="mt-2 flex flex-wrap gap-2">
                            {projectMemberList
                              .filter((member) => String(member.role).toLowerCase() !== 'owner'
                                || pane.members.some((entry) => entry.user_id === member.user_id))
                              .map((member) => {
                                const selected = pane.members.some((entry) => entry.user_id === member.user_id);
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
                                        void onTogglePaneMember(pane, member.user_id);
                                      }}
                                      disabled={member.user_id === sessionUserId}
                                    />
                                    {member.display_name}
                                  </label>
                                );
                              })}
                          </div>
                        </article>
                      ))}
                    </div>
                  </details>
                ) : null}
              </div>
            ) : openedFromPinned ? (
              <p className="mt-3 text-xs text-muted">Pane switcher hidden. Use the focusable toggle above to reveal it.</p>
            ) : null}

            {canWriteProject ? (
              <form className="mt-3 flex flex-wrap gap-2" onSubmit={onCreatePaneSubmit}>
                <input
                  value={creatingPaneName}
                  onChange={(event) => setCreatingPaneName(event.target.value)}
                  className="rounded-panel border border-border-muted bg-surface px-3 py-1.5 text-sm text-text"
                  placeholder="New pane name"
                  aria-label="New pane name"
                />
                <button type="submit" className="rounded-panel border border-border-muted px-3 py-1.5 text-sm font-semibold text-primary">
                  Create pane
                </button>
              </form>
            ) : null}
            {paneMutationError ? (
              <InlineNotice variant="danger" className="mt-2" title="Pane update failed">
                {paneMutationError}
              </InlineNotice>
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
                          metadataFieldIds={kanbanRuntimeDataByViewId[focusedWorkView.view_id]?.metadataFieldIds}
                          onOpenRecord={(recordId) => {
                            void openInspectorWithFocusRestore(recordId);
                          }}
                          onMoveRecord={(recordId, nextGroup) => {
                            if (activePaneCanEdit) {
                              void onMoveKanbanRecord(focusedWorkView.view_id, recordId, nextGroup, activePane?.pane_id ?? null);
                            }
                          }}
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
                pane={activePane ?? null}
                canEditPane={activePaneCanEdit}
                modulesEnabled={modulesEnabled}
                workspaceEnabled={workspaceEnabled}
                showWorkspaceDocPlaceholder={false}
                onSelectPane={(nextPaneId) => {
                  navigate(buildProjectWorkHref(project.project_id, nextPaneId));
                }}
                onUpdatePane={onUpdatePaneFromWorkView}
                onOpenRecord={(recordId) => {
                  void openInspectorWithFocusRestore(recordId);
                }}
                moduleRuntime={workViewModuleRuntime}
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
                {collabSession ? (
                  <>
                    <Suspense fallback={<ModuleLoadingState label="Loading collaborative editor" rows={8} />}>
                      <CollaborativeLexicalEditor
                        noteId={collabSession.roomId}
                        initialLexicalState={defaultLexicalState}
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
                              navigate(buildProjectWorkHref(project.project_id, activePane.pane_id));
                              return;
                            }
                            if (targetView.type === 'kanban') {
                              navigate(`${buildProjectOverviewHref(project.project_id)}?view=kanban&kanban_view_id=${encodeURIComponent(viewId)}`);
                              return;
                            }
                            if (targetView.type === 'calendar') {
                              navigate(`${buildProjectOverviewHref(project.project_id)}?view=calendar`);
                              return;
                            }
                            if (targetView.type === 'timeline') {
                              navigate(`${buildProjectOverviewHref(project.project_id)}?view=timeline`);
                              return;
                            }
                            navigate(`${buildProjectWorkHref(project.project_id, activePane.pane_id)}?view_id=${encodeURIComponent(viewId)}`);
                          },
                        }}
                      />
                    </Suspense>
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
                        <form className="mt-3 flex flex-wrap items-center gap-2" onSubmit={onUploadDocAsset}>
                          <input name="doc-asset-file" type="file" className="text-xs text-muted" aria-label="Upload doc asset" />
                          <button
                            type="submit"
                            disabled={uploadingDocAsset}
                            className="inline-flex items-center gap-1 rounded-panel border border-border-muted px-2 py-1 text-xs font-semibold text-primary disabled:cursor-not-allowed disabled:opacity-60"
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
                ) : collabSessionError ? (
                  <InlineNotice variant="danger" className="mt-2" title="Collaboration unavailable">
                    {collabSessionError}
                  </InlineNotice>
                ) : (
                  <p className="mt-2 text-sm text-muted">Pane doc unavailable.</p>
                )}
                  </section>

                  <div className="rounded-panel border border-subtle bg-elevated p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-muted">
                    Selected block: <span className="font-semibold text-primary">{selectedDocNodeKey || 'none'}</span>
                  </p>
                  <button
                    ref={commentTriggerRef}
                    type="button"
                    className="rounded-panel border border-border-muted px-3 py-1.5 text-xs font-semibold text-primary disabled:opacity-60"
                    onClick={() => onDocCommentDialogOpenChange(true)}
                    disabled={!selectedDocNodeKey}
                    aria-label="Comment on block"
                  >
                    Comment on block
                  </button>
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
                <DialogContent>
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

      <Dialog open={Boolean(inspectorRecordId)} onOpenChange={(open) => (!open ? closeInspectorWithFocusRestore() : undefined)}>
        <DialogContent
          className="!left-0 !top-0 h-screen w-full max-w-[min(42rem,92vw)] !translate-x-0 !translate-y-0 overflow-y-auto rounded-none sm:!rounded-none border-r border-border-muted"
          onCloseAutoFocus={(event) => {
            if (inspectorTriggerRef.current) {
              event.preventDefault();
              inspectorTriggerRef.current.focus();
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>Record Inspector</DialogTitle>
            <DialogDescription className="sr-only">
              Quick dismissible inspector. Press Escape or close to return focus to the invoking control.
            </DialogDescription>
          </DialogHeader>

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
                        navigate(
                          buildPaneContextHref({
                            projectId: project.project_id,
                            sourcePane: inspectorRecord.source_pane,
                            fallbackHref: buildProjectWorkHref(project.project_id),
                          }),
                        );
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
    </div>
  );
};

export const ProjectSpacePage = ({ activeTab }: ProjectSpacePageProps) => {
  const { projectId = '' } = useParams();
  const { accessToken, sessionSummary } = useAuthz();
  const { error, loading, panes, project, projectMembers, refreshProjectData, setPanes, setTimeline, timeline } =
    useProjectBootstrap({
      accessToken,
      projectId,
    });

  if (!projectId) {
    return <Navigate to="/projects" replace />;
  }

  if (!accessToken) {
    return (
      <InlineNotice variant="danger" title="Authentication required">
        Authentication token is missing. Re-authenticate and retry.
      </InlineNotice>
    );
  }

  if (loading) {
    return (
      <div className="rounded-panel border border-subtle bg-elevated p-4" role="status" aria-live="polite">
        <p className="text-sm text-muted">Loading project space...</p>
        <div className="mt-3 h-2 w-3/4 animate-pulse rounded-control bg-muted/30 motion-reduce:animate-none" aria-hidden="true" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <InlineNotice variant="danger" title="Project load failed">
        {error || 'Project not found.'}
        <p className="mt-2 text-sm text-muted">
          <Link to="/projects" className="font-semibold text-primary underline">
            Return to projects
          </Link>
        </p>
      </InlineNotice>
    );
  }

  return (
    <ModuleInsertProvider>
      <ProjectSpaceWorkspace
        activeTab={activeTab}
        project={project}
        panes={panes}
        setPanes={setPanes}
        projectMembers={projectMembers}
        accessToken={accessToken}
        sessionUserId={sessionSummary.userId}
        refreshProjectData={refreshProjectData}
        timeline={timeline}
        setTimeline={setTimeline}
      />
    </ModuleInsertProvider>
  );
};
