import { useCallback, useMemo, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';

import { archiveRecord, createRecord, listTimeline, setRecordValues, updateRecord } from '../services/hub/records';
import type { HubPaneSummary, HubView } from '../services/hub/types';
import {
  EMPTY_KANBAN_RUNTIME,
  KANBAN_UNASSIGNED_ID,
  buildKanbanRuntime,
  loadCompleteViewQuery,
  type KanbanRuntimeState,
  type ProjectTimelineItem,
} from './projectViewsRuntime/shared';

interface UseProjectKanbanRuntimeParams {
  accessToken: string;
  projectId: string;
  panes: HubPaneSummary[];
  sessionUserId: string;
  setTimeline: Dispatch<SetStateAction<ProjectTimelineItem[]>>;
  paneCanEditForUser: (pane: HubPaneSummary | null | undefined, userId: string) => boolean;
  setRecordsError: Dispatch<SetStateAction<string | null>>;
  refreshViewsAndRecordsRef: MutableRefObject<() => Promise<void>>;
}

export const useProjectKanbanRuntime = ({
  accessToken,
  projectId,
  panes,
  sessionUserId,
  setTimeline,
  paneCanEditForUser,
  setRecordsError,
  refreshViewsAndRecordsRef,
}: UseProjectKanbanRuntimeParams) => {
  const [kanbanRuntimeByViewId, setKanbanRuntimeByViewId] = useState<Record<string, KanbanRuntimeState>>({});
  const [kanbanLoading, setKanbanLoading] = useState(false);

  const refreshKanbanRuntime = useCallback(
    async (nextViews: HubView[]) => {
      setKanbanLoading(true);
      try {
        const nextKanbanViews = nextViews.filter((view) => view.type === 'kanban');

        const kanbanEntries = await Promise.all(
          nextKanbanViews.map(async (view) => {
            try {
              const query = await loadCompleteViewQuery(accessToken, view.view_id);
              return [
                view.view_id,
                {
                  ...buildKanbanRuntime(query ?? { view, schema: null, records: [], next_cursor: null }),
                  loading: false,
                } satisfies KanbanRuntimeState,
              ] as const;
            } catch (error) {
              return [
                view.view_id,
                {
                  ...EMPTY_KANBAN_RUNTIME,
                  loading: false,
                  error: error instanceof Error ? error.message : `Failed to load kanban view ${view.name}.`,
                } satisfies KanbanRuntimeState,
              ] as const;
            }
          }),
        );

        setKanbanRuntimeByViewId(Object.fromEntries(kanbanEntries));
      } finally {
        setKanbanLoading(false);
      }
    },
    [accessToken],
  );

  const clearKanbanRuntime = useCallback(() => {
    setKanbanRuntimeByViewId({});
    setKanbanLoading(false);
  }, []);

  const resolveEditableMutationPane = useCallback(
    (mutationPaneId: string | null, message: string): HubPaneSummary | null => {
      const mutationPane = mutationPaneId ? panes.find((pane) => pane.pane_id === mutationPaneId) || null : null;
      if (!mutationPane || !paneCanEditForUser(mutationPane, sessionUserId)) {
        setRecordsError(message);
        return null;
      }
      return mutationPane;
    },
    [paneCanEditForUser, panes, sessionUserId, setRecordsError],
  );

  const onMoveKanbanRecord = useCallback(
    async (viewId: string, recordId: string, nextGroup: string, mutationPaneId: string | null) => {
      const mutationPane = resolveEditableMutationPane(mutationPaneId, 'Open an editable pane before moving cards.');
      if (!mutationPane) {
        return;
      }
      const groupFieldId = kanbanRuntimeByViewId[viewId]?.groupFieldId;
      if (!groupFieldId) {
        setRecordsError('Cannot move card: Kanban grouping is not configured.');
        return;
      }
      try {
        const nextGroupValue = nextGroup === KANBAN_UNASSIGNED_ID ? null : nextGroup || null;
        await setRecordValues(accessToken, recordId, {
          [groupFieldId]: nextGroupValue,
        }, { mutation_context_pane_id: mutationPane.pane_id });
        await refreshViewsAndRecordsRef.current();
        const nextTimeline = await listTimeline(accessToken, projectId);
        setTimeline(nextTimeline);
      } catch (error) {
        setRecordsError(error instanceof Error ? error.message : 'Failed to move kanban card.');
      }
    },
    [accessToken, kanbanRuntimeByViewId, projectId, refreshViewsAndRecordsRef, resolveEditableMutationPane, setRecordsError, setTimeline],
  );

  const onCreateKanbanRecord = useCallback(
    async (
      viewId: string,
      payload: { title: string; groupFieldValue: string },
      mutationPaneId: string | null,
    ) => {
      const mutationPane = resolveEditableMutationPane(mutationPaneId, 'Open an editable pane before creating cards.');
      if (!mutationPane) {
        const message = 'Open an editable pane before creating cards.';
        throw new Error(message);
      }

      const runtime = kanbanRuntimeByViewId[viewId];
      if (!runtime?.collectionId) {
        const message = 'Cannot create card: Kanban collection is unavailable.';
        setRecordsError(message);
        throw new Error(message);
      }

      try {
        await createRecord(accessToken, projectId, {
          collection_id: runtime.collectionId,
          title: payload.title,
          source_pane_id: mutationPane.pane_id,
          source_view_id: viewId,
          values: runtime.groupFieldId
            ? {
                [runtime.groupFieldId]: payload.groupFieldValue === KANBAN_UNASSIGNED_ID ? null : payload.groupFieldValue || null,
              }
            : undefined,
        });
        await refreshViewsAndRecordsRef.current();
        const nextTimeline = await listTimeline(accessToken, projectId);
        setTimeline(nextTimeline);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to create kanban card.';
        setRecordsError(message);
        throw new Error(message);
      }
    },
    [accessToken, kanbanRuntimeByViewId, projectId, refreshViewsAndRecordsRef, resolveEditableMutationPane, setRecordsError, setTimeline],
  );

  const onUpdateKanbanRecord = useCallback(
    async (
      viewId: string,
      recordId: string,
      fields: Record<string, unknown>,
      mutationPaneId: string | null,
    ) => {
      const mutationPane = resolveEditableMutationPane(mutationPaneId, 'Open an editable pane before editing cards.');
      if (!mutationPane) {
        const message = 'Open an editable pane before editing cards.';
        throw new Error(message);
      }

      const runtime = kanbanRuntimeByViewId[viewId];
      if (!runtime) {
        const message = 'Cannot update card: Kanban view is unavailable.';
        setRecordsError(message);
        throw new Error(message);
      }

      const { title, ...valueFields } = fields;

      try {
        const updateOperations: Array<{ label: string; promise: Promise<unknown> }> = [];

        if (typeof title === 'string') {
          updateOperations.push({
            label: 'title',
            promise: updateRecord(accessToken, recordId, { title }, { mutation_context_pane_id: mutationPane.pane_id }),
          });
        }

        if (Object.keys(valueFields).length > 0) {
          updateOperations.push({
            label: 'fields',
            promise: setRecordValues(accessToken, recordId, valueFields, {
              mutation_context_pane_id: mutationPane.pane_id,
            }),
          });
        }

        const results = updateOperations.length > 0
          ? await Promise.allSettled(updateOperations.map((operation) => operation.promise))
          : [];

        const failures = results.flatMap((result, index) => {
          if (result.status === 'fulfilled') {
            return [];
          }
          const reason =
            result.reason instanceof Error
              ? result.reason.message
              : `Failed to update ${updateOperations[index]?.label ?? 'card'}.`;
          return [reason];
        });

        let refreshError: string | null = null;
        try {
          await refreshViewsAndRecordsRef.current();
          const nextTimeline = await listTimeline(accessToken, projectId);
          setTimeline(nextTimeline);
        } catch (error) {
          refreshError = error instanceof Error ? error.message : 'Failed to refresh kanban data.';
        }

        if (refreshError) {
          failures.push(refreshError);
        }

        if (failures.length > 0) {
          const message = failures.length === 1 ? failures[0] : `Card update partially completed: ${failures.join(' ')}`;
          setRecordsError(message);
          throw new Error(message);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to update kanban card.';
        setRecordsError(message);
        throw new Error(message);
      }
    },
    [accessToken, kanbanRuntimeByViewId, projectId, refreshViewsAndRecordsRef, resolveEditableMutationPane, setRecordsError, setTimeline],
  );

  const onDeleteKanbanRecord = useCallback(
    async (recordId: string, mutationPaneId: string | null) => {
      const mutationPane = resolveEditableMutationPane(mutationPaneId, 'Open an editable pane before deleting cards.');
      if (!mutationPane) {
        const message = 'Open an editable pane before deleting cards.';
        throw new Error(message);
      }

      try {
        await archiveRecord(accessToken, recordId);
        await refreshViewsAndRecordsRef.current();
        const nextTimeline = await listTimeline(accessToken, projectId);
        setTimeline(nextTimeline);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to delete kanban card.';
        setRecordsError(message);
        throw new Error(message);
      }
    },
    [accessToken, projectId, refreshViewsAndRecordsRef, resolveEditableMutationPane, setRecordsError, setTimeline],
  );

  const kanbanRuntimeDataByViewId = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(kanbanRuntimeByViewId).map(([viewId, data]) => [
          viewId,
          {
            ...data,
            loading: kanbanLoading || Boolean(data.loading),
          },
        ]),
      ),
    [kanbanLoading, kanbanRuntimeByViewId],
  );

  return {
    kanbanRuntimeByViewId,
    kanbanLoading,
    refreshKanbanRuntime,
    clearKanbanRuntime,
    onMoveKanbanRecord,
    onCreateKanbanRecord,
    onUpdateKanbanRecord,
    onDeleteKanbanRecord,
    kanbanRuntimeDataByViewId,
  };
};
