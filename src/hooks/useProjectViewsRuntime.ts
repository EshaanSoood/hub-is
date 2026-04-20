import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { subscribeHubLive } from '../services/hubLive';
import type { HubPaneSummary } from '../services/hub/types';
import { useProjectCollectionsRuntime } from './useProjectCollectionsRuntime';
import { useProjectFocusedViewLoader } from './useProjectFocusedViewLoader';
import { useProjectKanbanRuntime } from './useProjectKanbanRuntime';
import { useProjectTableRuntime } from './useProjectTableRuntime';
import { useProjectViewsRegistry } from './useProjectViewsRegistry';
import type { ProjectTimelineItem } from './projectViewsRuntime/shared';

interface UseProjectViewsRuntimeParams {
  accessToken: string;
  projectId: string;
  activeTab: 'overview' | 'work';
  panes: HubPaneSummary[];
  sessionUserId: string;
  setTimeline: React.Dispatch<React.SetStateAction<ProjectTimelineItem[]>>;
  paneCanEditForUser: (pane: HubPaneSummary | null | undefined, userId: string) => boolean;
}

export const useProjectViewsRuntime = ({
  accessToken,
  projectId,
  activeTab,
  panes,
  sessionUserId,
  setTimeline,
  paneCanEditForUser,
}: UseProjectViewsRuntimeParams) => {
  const [recordsError, setRecordsError] = useState<string | null>(null);
  const liveRefreshViewsTimeoutRef = useRef<number | null>(null);
  const refreshViewsAndRecordsRef = useRef<() => Promise<void>>(async () => {});

  const { collections, refreshCollections } = useProjectCollectionsRuntime({ accessToken, projectId });
  const {
    views,
    selectedEmbedViewId,
    setSelectedEmbedViewId,
    focusedWorkViewId,
    focusedWorkView,
    refreshViews,
  } = useProjectViewsRegistry({ accessToken, projectId, activeTab });
  const {
    tableViewDataById,
    tableLoading,
    refreshTableRuntime,
    clearTableRuntime,
    onCreateTableRecord,
    onUpdateTableRecord,
    onDeleteTableRecords,
    onBulkUpdateTableRecords,
    tableViewRuntimeDataById,
  } = useProjectTableRuntime({
    accessToken,
    projectId,
    panes,
    sessionUserId,
    setTimeline,
    paneCanEditForUser,
    setRecordsError,
    refreshViewsAndRecordsRef,
  });
  const {
    kanbanRuntimeByViewId,
    kanbanLoading,
    creatingKanbanViewByModuleId,
    refreshKanbanRuntime,
    clearKanbanRuntime,
    onMoveKanbanRecord,
    onCreateKanbanRecord,
    onConfigureKanbanGrouping,
    onUpdateKanbanRecord,
    onDeleteKanbanRecord,
    onEnsureKanbanView,
    kanbanRuntimeDataByViewId,
  } = useProjectKanbanRuntime({
    accessToken,
    projectId,
    panes,
    views,
    sessionUserId,
    setTimeline,
    paneCanEditForUser,
    setRecordsError,
    refreshViewsAndRecordsRef,
  });
  const { focusedWorkViewData, focusedWorkViewLoading, focusedWorkViewError } = useProjectFocusedViewLoader({
    accessToken,
    activeTab,
    focusedWorkViewId,
    focusedWorkView,
    tableViewDataById,
  });
  const tableViews = useMemo(
    () => views.filter((view) => view.type === 'table').map((view) => ({ view_id: view.view_id, name: view.name })),
    [views],
  );
  const kanbanViews = useMemo(
    () => views.filter((view) => view.type === 'kanban').map((view) => ({ view_id: view.view_id, name: view.name })),
    [views],
  );

  const refreshViewsAndRecords = useCallback(async () => {
    setRecordsError(null);
    try {
      await refreshCollections();
      const nextViews = await refreshViews();
      await Promise.all([refreshTableRuntime(nextViews), refreshKanbanRuntime(nextViews)]);
    } catch (error) {
      clearTableRuntime();
      clearKanbanRuntime();
      setRecordsError(error instanceof Error ? error.message : 'Failed to load collections, views, and records.');
    }
  }, [
    clearKanbanRuntime,
    clearTableRuntime,
    refreshCollections,
    refreshKanbanRuntime,
    refreshTableRuntime,
    refreshViews,
  ]);

  useEffect(() => {
    refreshViewsAndRecordsRef.current = refreshViewsAndRecords;
  }, [refreshViewsAndRecords]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) {
        return;
      }
      void refreshViewsAndRecords();
    });
    return () => {
      cancelled = true;
    };
  }, [refreshViewsAndRecords]);

  useEffect(() => {
    if (!accessToken) {
      if (liveRefreshViewsTimeoutRef.current !== null) {
        window.clearTimeout(liveRefreshViewsTimeoutRef.current);
        liveRefreshViewsTimeoutRef.current = null;
      }
      return;
    }

    const unsubscribe = subscribeHubLive(accessToken, (message) => {
      if (message.type !== 'task.changed' || message.task.project_id !== projectId) {
        return;
      }
      if (liveRefreshViewsTimeoutRef.current !== null) {
        window.clearTimeout(liveRefreshViewsTimeoutRef.current);
      }
      liveRefreshViewsTimeoutRef.current = window.setTimeout(() => {
        liveRefreshViewsTimeoutRef.current = null;
        void refreshViewsAndRecords();
      }, 500);
    });

    return () => {
      if (liveRefreshViewsTimeoutRef.current !== null) {
        window.clearTimeout(liveRefreshViewsTimeoutRef.current);
        liveRefreshViewsTimeoutRef.current = null;
      }
      unsubscribe();
    };
  }, [accessToken, projectId, refreshViewsAndRecords]);

  return {
    collections,
    views,
    tableViewDataById,
    tableLoading,
    kanbanRuntimeByViewId,
    kanbanLoading,
    creatingKanbanViewByModuleId,
    recordsError,
    setRecordsError,
    selectedEmbedViewId,
    setSelectedEmbedViewId,
    focusedWorkViewId,
    focusedWorkView,
    focusedWorkViewData,
    focusedWorkViewLoading,
    focusedWorkViewError,
    refreshViewsAndRecords,
    onMoveKanbanRecord,
    onCreateKanbanRecord,
    onConfigureKanbanGrouping,
    onUpdateKanbanRecord,
    onDeleteKanbanRecord,
    onEnsureKanbanView,
    onCreateTableRecord,
    onUpdateTableRecord,
    onDeleteTableRecords,
    onBulkUpdateTableRecords,
    tableViews,
    kanbanViews,
    tableViewRuntimeDataById,
    kanbanRuntimeDataByViewId,
  };
};
