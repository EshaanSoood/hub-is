import { useCallback, useMemo, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';

import { createCollection, createCollectionField } from '../services/hub/collections';
import { archiveRecord, createRecord, listTimeline, setRecordValues, updateRecord } from '../services/hub/records';
import { createView, listViews, updateView } from '../services/hub/views';
import type { HubPaneSummary, HubView } from '../services/hub/types';
import {
  EMPTY_KANBAN_RUNTIME,
  KANBAN_OWNED_VIEW_CONFIG_KEY,
  KANBAN_UNASSIGNED_ID,
  buildKanbanRuntime,
  loadCompleteViewQuery,
  readOwnedKanbanModuleInstanceId,
  type KanbanRuntimeState,
  type ProjectTimelineItem,
} from './projectViewsRuntime/shared';

interface UseProjectKanbanRuntimeParams {
  accessToken: string;
  projectId: string;
  panes: HubPaneSummary[];
  views: HubView[];
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
  views,
  sessionUserId,
  setTimeline,
  paneCanEditForUser,
  setRecordsError,
  refreshViewsAndRecordsRef,
}: UseProjectKanbanRuntimeParams) => {
  const [kanbanRuntimeByViewId, setKanbanRuntimeByViewId] = useState<Record<string, KanbanRuntimeState>>({});
  const [kanbanLoading, setKanbanLoading] = useState(false);
  const [creatingKanbanViewByModuleId, setCreatingKanbanViewByModuleId] = useState<Record<string, boolean>>({});
  const ensureKanbanViewRef = useRef(new Map<string, Promise<string | null>>());

  const setCreatingKanbanView = useCallback((moduleInstanceId: string, creating: boolean) => {
    setCreatingKanbanViewByModuleId((current) => {
      if (creating) {
        return { ...current, [moduleInstanceId]: true };
      }
      if (!current[moduleInstanceId]) {
        return current;
      }
      const next = { ...current };
      delete next[moduleInstanceId];
      return next;
    });
  }, []);

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
    setCreatingKanbanViewByModuleId({});
    ensureKanbanViewRef.current.clear();
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
      const mutationPane = resolveEditableMutationPane(mutationPaneId, 'Open an editable project before moving cards.');
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
      const mutationPane = resolveEditableMutationPane(mutationPaneId, 'Open an editable project before creating cards.');
      if (!mutationPane) {
        const message = 'Open an editable project before creating cards.';
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
      const mutationPane = resolveEditableMutationPane(mutationPaneId, 'Open an editable project before editing cards.');
      if (!mutationPane) {
        const message = 'Open an editable project before editing cards.';
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
      const mutationPane = resolveEditableMutationPane(mutationPaneId, 'Open an editable project before deleting cards.');
      if (!mutationPane) {
        const message = 'Open an editable project before deleting cards.';
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

  const onConfigureKanbanGrouping = useCallback(
    async (viewId: string, fieldId: string, mutationPaneId: string | null) => {
      const runtime = kanbanRuntimeByViewId[viewId];
      const existingView = views.find((view) => view.view_id === viewId) || null;
      if (!runtime && !existingView) {
        setRecordsError('Cannot configure kanban grouping: view is unavailable.');
        return;
      }
      const mutationPane = resolveEditableMutationPane(mutationPaneId, 'Open an editable project before configuring kanban grouping.');
      if (!mutationPane) {
        return;
      }

      try {
        await updateView(accessToken, viewId, {
          config: {
            ...(existingView?.config ?? runtime?.viewConfig ?? {}),
            group_by_field_id: fieldId,
          },
          mutation_context_pane_id: mutationPane.pane_id,
        });
        await refreshViewsAndRecordsRef.current();
      } catch (error) {
        setRecordsError(error instanceof Error ? error.message : 'Failed to configure kanban grouping.');
      }
    },
    [accessToken, kanbanRuntimeByViewId, refreshViewsAndRecordsRef, resolveEditableMutationPane, setRecordsError, views],
  );

  const onEnsureKanbanView = useCallback(
    async (moduleInstanceId: string, ownedViewId: string | null | undefined, mutationPaneId: string | null): Promise<string | null> => {
      const pending = ensureKanbanViewRef.current.get(moduleInstanceId);
      if (pending) {
        return pending;
      }
      const mutationPane = resolveEditableMutationPane(mutationPaneId, 'Open an editable project before creating a kanban board.');
      if (!mutationPane) {
        throw new Error('Open an editable project before creating a kanban board.');
      }

      const paneName = mutationPane.name.trim();
      const boardName = paneName ? `${paneName} Board` : 'Kanban Board';
      const findOwnedView = (candidateViews: HubView[]) => {
        if (ownedViewId) {
          const matchedById = candidateViews.find((view) => view.view_id === ownedViewId && view.type === 'kanban') || null;
          if (matchedById) {
            return matchedById;
          }
        }
        return candidateViews.find((view) => readOwnedKanbanModuleInstanceId(view.config) === moduleInstanceId) || null;
      };

      const ensurePromise = (async () => {
        setCreatingKanbanView(moduleInstanceId, true);
        try {
          const existingView = findOwnedView(views);
          if (existingView) {
            await refreshViewsAndRecordsRef.current();
            return existingView.view_id;
          }
          const latestViews = await listViews(accessToken, projectId);
          const latestExistingView = findOwnedView(latestViews);
          if (latestExistingView) {
            await refreshViewsAndRecordsRef.current();
            return latestExistingView.view_id;
          }

          const createdCollection = await createCollection(accessToken, projectId, {
            name: boardName,
          });

          const statusField = await createCollectionField(accessToken, createdCollection.collection_id, {
            name: 'Status',
            type: 'select',
            sort_order: 0,
            config: {
              required: true,
              options: [
                { value: 'backlog', label: 'Backlog' },
                { value: 'in_progress', label: 'In Progress' },
                { value: 'done', label: 'Done' },
              ],
            },
          });
          const priorityField = await createCollectionField(accessToken, createdCollection.collection_id, {
            name: 'Priority',
            type: 'select',
            sort_order: 1,
            config: {
              options: [
                { value: 'low', label: 'Low' },
                { value: 'medium', label: 'Medium' },
                { value: 'high', label: 'High' },
              ],
            },
          });
          const dueDateField = await createCollectionField(accessToken, createdCollection.collection_id, {
            name: 'Due date',
            type: 'date',
            sort_order: 2,
            config: {},
          });

          const createdView = await createView(accessToken, projectId, {
            collection_id: createdCollection.collection_id,
            type: 'kanban',
            name: boardName,
            config: {
              group_by_field_id: statusField.field_id,
              priority_field_id: priorityField.field_id,
              due_date_field_id: dueDateField.field_id,
              [KANBAN_OWNED_VIEW_CONFIG_KEY]: moduleInstanceId,
            },
            mutation_context_pane_id: mutationPane.pane_id,
          });
          await refreshViewsAndRecordsRef.current();
          return createdView.view_id;
        } finally {
          ensureKanbanViewRef.current.delete(moduleInstanceId);
          setCreatingKanbanView(moduleInstanceId, false);
        }
      })();

      ensureKanbanViewRef.current.set(moduleInstanceId, ensurePromise);
      return ensurePromise;
    },
    [accessToken, projectId, refreshViewsAndRecordsRef, resolveEditableMutationPane, setCreatingKanbanView, views],
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
  };
};
