import { useCallback, useEffect, useMemo, type ComponentProps, type Dispatch, type SetStateAction } from 'react';
import { useLocation, useNavigate, useSearchParams, type NavigateFunction, type NavigateOptions, type To } from 'react-router-dom';

import type { PaneLateralSource } from '../../../components/motion/hubMotion';
import { adaptTaskSummaries } from '../../../components/project-space/taskAdapter';
import { WorkView } from '../../../components/project-space/WorkView';
import { useCalendarRuntime } from '../../../hooks/useCalendarRuntime';
import { usePaneMutations } from '../../../hooks/usePaneMutations';
import { useProjectFilesRuntime } from '../../../hooks/useProjectFilesRuntime';
import { useProjectTasksRuntime } from '../../../hooks/useProjectTasksRuntime';
import { useProjectViewsRuntime } from '../../../hooks/useProjectViewsRuntime';
import { useRemindersRuntime } from '../../../hooks/useRemindersRuntime';
import { useTimelineRuntime } from '../../../hooks/useTimelineRuntime';
import { useWorkspaceDocRuntime } from '../../../hooks/useWorkspaceDocRuntime';
import { withHubMotionState } from '../../../lib/hubMotionState';
import { useFocusNodeQueryEffect } from '../../../pages/ProjectSpacePage/hooks/useFocusNodeQueryEffect';
import { useWorkViewModuleRuntime } from '../../../pages/ProjectSpacePage/hooks/useWorkViewModuleRuntime';
import { useProjectSpaceInspectorRuntime } from '../../../pages/ProjectSpacePage/ProjectSpaceWorkspace/hooks/useProjectSpaceInspectorRuntime';
import {
  collectPaneTaskCollectionIds,
  paneCanEditForUser,
  readLayoutBool,
} from '../../../pages/ProjectSpacePage/ProjectSpaceWorkspace/paneModel';
import type { TimelineEvent } from '../../../pages/ProjectSpacePage/ProjectSpaceWorkspace/types';
import type { HubBacklink, HubPaneSummary, HubProject } from '../../../services/hub/types';
import { buildRoomProjectHref } from '../navigation';

interface UseRoomProjectWorkRuntimeParams {
  accessToken: string;
  roomId: string;
  roomName: string;
  roomArchived: boolean;
  pane: HubPaneSummary;
  roomProjectPanes: HubPaneSummary[];
  project: HubProject;
  sessionUserId: string;
  refreshProjectData: () => Promise<void>;
  setPanes: Dispatch<SetStateAction<HubPaneSummary[]>>;
  timeline: TimelineEvent[];
  setTimeline: Dispatch<SetStateAction<TimelineEvent[]>>;
}

const readTimelineSourcePaneId = (item: TimelineEvent): string | null => {
  const sourcePaneId = item.summary_json?.source_pane_id;
  return typeof sourcePaneId === 'string' && sourcePaneId.trim() ? sourcePaneId : null;
};

export const useRoomProjectWorkRuntime = ({
  accessToken,
  roomId,
  roomName,
  roomArchived,
  pane,
  roomProjectPanes,
  project,
  sessionUserId,
  refreshProjectData,
  setPanes,
  timeline,
  setTimeline,
}: UseRoomProjectWorkRuntimeParams) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activePane = pane;
  const activePaneId = activePane.pane_id;
  const activePaneDocId = activePane.doc_id ?? null;
  const activePaneCanEdit = !roomArchived && paneCanEditForUser(activePane, sessionUserId);
  const modulesEnabled = readLayoutBool(activePane.layout_config, 'modules_enabled', true);
  const workspaceEnabled = readLayoutBool(activePane.layout_config, 'workspace_enabled', true);

  const navigateToRoomPane = useCallback(({
    paneId,
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
    const baseHref = buildRoomProjectHref(roomId, paneId);
    const nextHref = query ? `${baseHref}?${query}` : baseHref;
    navigate(nextHref, {
      state: withHubMotionState(extraState, {
        hubProjectName: roomName,
        hubPaneName: paneName ?? undefined,
        hubPaneSource: paneSource,
      }),
    });
  }, [navigate, roomId, roomName]);

  const mapProjectHrefToRoomHref = useCallback((to: string): string => {
    const [pathname, query = ''] = to.split('?');
    const activePaneHref = buildRoomProjectHref(roomId, activePaneId);
    const activePaneWithQuery = query ? `${activePaneHref}?${query}` : activePaneHref;
    const projectPrefix = `/projects/${encodeURIComponent(project.project_id)}`;
    if (pathname === `${projectPrefix}/overview`) {
      return activePaneWithQuery;
    }
    const workPanePrefix = `${projectPrefix}/work/`;
    if (pathname.startsWith(workPanePrefix)) {
      const encodedPaneId = pathname.slice(workPanePrefix.length);
      if (!encodedPaneId || encodedPaneId.includes('/')) {
        return to;
      }
      let decodedPaneId;
      try {
        decodedPaneId = decodeURIComponent(encodedPaneId);
      } catch {
        return to;
      }
      if (roomProjectPanes.some((roomPane) => roomPane.pane_id === decodedPaneId)) {
        const nextHref = buildRoomProjectHref(roomId, decodedPaneId);
        return query ? `${nextHref}?${query}` : nextHref;
      }
    }
    if (pathname === `${projectPrefix}/work`) {
      return activePaneWithQuery;
    }
    return to;
  }, [activePaneId, project.project_id, roomId, roomProjectPanes]);

  const navigateWithinRoom = useMemo<NavigateFunction>(
    () =>
      ((to: To | number, options?: NavigateOptions) => {
        if (typeof to === 'number') {
          navigate(to);
          return;
        }

        if (typeof to === 'string') {
          navigate(mapProjectHrefToRoomHref(to), options);
          return;
        }

        const pathname = typeof to.pathname === 'string' ? to.pathname : '';
        const search = typeof to.search === 'string' ? to.search : '';
        const mappedHref = mapProjectHrefToRoomHref(`${pathname}${search}`);
        const [mappedPathname, mappedSearch = ''] = mappedHref.split('?');
        navigate({
          ...to,
          pathname: mappedPathname,
          search: mappedSearch ? `?${mappedSearch}` : '',
        }, options);
      }) as NavigateFunction,
    [mapProjectHrefToRoomHref, navigate],
  );

  const {
    calendarEvents,
    calendarLoading,
    calendarMode,
    refreshCalendar,
    setCalendarMode,
  } = useCalendarRuntime({
    accessToken,
    projectId: project.project_id,
  });
  const filteredCalendarEvents = useMemo(
    () => calendarEvents.filter((event) => event.source_pane?.pane_id === activePaneId),
    [activePaneId, calendarEvents],
  );
  const {
    loadProjectTaskPage,
    projectTasksError,
    projectTasksLoading,
    tasksOverviewRows,
  } = useProjectTasksRuntime({
    accessToken,
    projectId: project.project_id,
    activeTab: 'work',
    overviewView: 'tasks',
  });
  const {
    views,
    kanbanRuntimeDataByViewId,
    kanbanViews,
    creatingKanbanViewByModuleId,
    focusedWorkView,
    focusedWorkViewData,
    focusedWorkViewError,
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
    projectName: project.name,
    activeTab: 'work',
    panes: roomProjectPanes,
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
    activePane: { pane_id: activePane.pane_id, name: activePane.name },
    onError: (message) => setRecordsError(message),
  });
  const {
    paneMutationError,
    onUpdatePaneFromWorkView,
  } = usePaneMutations({
    accessToken,
    projectId: project.project_id,
    projectName: project.name,
    panes: roomProjectPanes,
    refreshProjectData,
    setPanes,
    sessionUserId,
    setTimeline,
  });
  const filteredTimeline = useMemo(
    () => timeline.filter((item) => readTimelineSourcePaneId(item) === activePaneId),
    [activePaneId, timeline],
  );
  const {
    refreshTimeline,
    timelineClusters,
    timelineFilters,
    toggleTimelineFilter,
  } = useTimelineRuntime({
    accessToken,
    projectId: project.project_id,
    timeline: filteredTimeline,
    setTimeline,
  });
  const remindersRuntime = useRemindersRuntime(accessToken, {
    autoload: true,
    subscribeToHomeRefresh: true,
    subscribeToLive: true,
    scope: 'project',
    projectId: project.project_id,
    paneId: activePaneId,
    sourceViewId: focusedWorkView?.view_id ?? null,
  });
  const onOpenBacklink = useCallback((backlink: HubBacklink) => {
    if (!backlink.source.pane_id || !roomProjectPanes.some((roomPane) => roomPane.pane_id === backlink.source.pane_id)) {
      return;
    }
    navigateToRoomPane({
      paneId: backlink.source.pane_id,
      paneName: backlink.source.pane_name,
      paneSource: 'click',
      extraState: backlink.source.node_key ? { focusNodeKey: backlink.source.node_key } : undefined,
    });
  }, [navigateToRoomPane, roomProjectPanes]);
  const {
    openRecordInspector,
    recordInspectorOverlayProps,
  } = useProjectSpaceInspectorRuntime({
    accessToken,
    project,
    panes: roomProjectPanes,
    activeTab: 'work',
    activePaneId,
    sessionUserId,
    refreshViewsAndRecords,
    setTimeline,
    ensureProjectAssetRoot,
    refreshTrackedProjectFiles,
    prefersReducedMotion: false,
    navigate: navigateWithinRoom,
    onOpenBacklink,
  });

  useEffect(() => {
    const recordId = searchParams.get('record_id');
    if (!recordId) {
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
  }, [openRecordInspector, searchParams, setSearchParams]);

  const workspaceDoc = useWorkspaceDocRuntime({
    accessToken,
    activePaneDocId,
    projectId: project.project_id,
    activePaneId,
    activeTab: 'work',
    ensureProjectAssetRoot,
    refreshTrackedProjectFiles,
    refreshTimeline,
  });

  useFocusNodeQueryEffect({
    activePaneDocId,
    locationPathname: location.pathname,
    locationState: location.state,
    navigate,
    searchParams,
    setPendingDocFocusNodeKey: workspaceDoc.setPendingDocFocusNodeKey,
  });

  const paneTaskItems = useMemo(
    () => adaptTaskSummaries(tasksOverviewRows.filter((task) => task.source_pane?.pane_id === activePaneId)),
    [activePaneId, tasksOverviewRows],
  );
  const paneTaskCollectionIds = useMemo(
    () => collectPaneTaskCollectionIds(activePane.layout_config, views),
    [activePane.layout_config, views],
  );
  const activePaneTaskCollectionId = useMemo(
    () => tasksOverviewRows.find((task) => task.source_pane?.pane_id === activePaneId)?.collection_id ?? null,
    [activePaneId, tasksOverviewRows],
  );
  const taskCollectionId = paneTaskCollectionIds[0] || activePaneTaskCollectionId;
  const canWriteProject = !roomArchived && typeof project.membership_role === 'string' && project.membership_role.toLowerCase() !== 'viewer';
  const moduleContracts = useWorkViewModuleRuntime({
    activePaneId,
    activePaneName: activePane.name,
    activePaneCanEdit,
    accessToken,
    canWriteProject,
    projectId: project.project_id,
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
    creatingKanbanViewByModuleId,
    onMoveKanbanRecord,
    onCreateKanbanRecord,
    onConfigureKanbanGrouping,
    onUpdateKanbanRecord,
    onDeleteKanbanRecord,
    onEnsureKanbanView,
    calendarEvents: filteredCalendarEvents,
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

  const onCloseFocusedView = useCallback(() => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete('view_id');
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const onOpenEmbeddedView = useCallback((viewId: string) => {
    const targetView = views.find((view) => view.view_id === viewId);
    if (!targetView) {
      return;
    }
    if (targetView.type !== 'table' && targetView.type !== 'kanban') {
      return;
    }
    navigateToRoomPane({
      paneId: activePaneId,
      paneName: activePane.name,
      paneSource: 'click',
      query: `view_id=${encodeURIComponent(viewId)}`,
    });
  }, [activePane.name, activePaneId, navigateToRoomPane, views]);

  const onInsertViewEmbed = useCallback(() => {
    if (!selectedEmbedViewId) {
      return;
    }
    workspaceDoc.queueViewEmbed(selectedEmbedViewId);
  }, [selectedEmbedViewId, workspaceDoc]);

  return {
    activePane,
    activePaneCanEdit,
    modulesEnabled,
    onCloseFocusedView,
    onOpenEmbeddedView,
    onOpenRecord: (recordId: string) => {
      void openRecordInspector(recordId);
    },
    paneMutationError,
    projectTasksError,
    projectTasksLoading,
    recordInspectorOverlayProps,
    recordsError,
    selectedEmbedViewId,
    setSelectedEmbedViewId,
    views,
    workspaceDoc,
    workspaceEnabled,
    workViewProps: {
      pane: activePane,
      canEditPane: activePaneCanEdit,
      modulesEnabled,
      showWorkspaceDocPlaceholder: false,
      onUpdatePane: onUpdatePaneFromWorkView,
      tableContract: moduleContracts.tableContract,
      kanbanContract: moduleContracts.kanbanContract,
      calendarContract: moduleContracts.calendarContract,
      filesContract: moduleContracts.filesContract,
      quickThoughtsContract: moduleContracts.quickThoughtsContract,
      tasksContract: moduleContracts.tasksContract,
      timelineContract: moduleContracts.timelineContract,
      remindersContract: moduleContracts.remindersContract,
      onOpenRecord: (recordId: string) => {
        void openRecordInspector(recordId);
      },
    } satisfies ComponentProps<typeof WorkView>,
    focusedViewProps: {
      focusedWorkView,
      focusedWorkViewError,
      focusedWorkViewLoading,
      focusedWorkViewData,
      focusedKanbanRuntime: focusedWorkView ? kanbanRuntimeDataByViewId[focusedWorkView.view_id] ?? null : null,
      activePaneCanEdit,
      activePaneId,
      onCloseFocusedView,
      onOpenRecord: (recordId: string) => {
        void openRecordInspector(recordId);
      },
      onCreateKanbanRecord,
      onConfigureKanbanGrouping,
      onDeleteKanbanRecord,
      onMoveKanbanRecord,
      onUpdateKanbanRecord,
    },
    onInsertViewEmbed,
  };
};
