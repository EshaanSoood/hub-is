import { useCallback, useMemo, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';

import { createRecord, listTimeline, setRecordValues, updateRecord } from '../services/hub/records';
import type { HubPaneSummary, HubView } from '../services/hub/types';
import { loadCompleteViewQuery, type ProjectTimelineItem, type TableViewRuntimeState } from './projectViewsRuntime/shared';

interface UseProjectTableRuntimeParams {
  accessToken: string;
  projectId: string;
  panes: HubPaneSummary[];
  sessionUserId: string;
  setTimeline: Dispatch<SetStateAction<ProjectTimelineItem[]>>;
  paneCanEditForUser: (pane: HubPaneSummary | null | undefined, userId: string) => boolean;
  setRecordsError: Dispatch<SetStateAction<string | null>>;
  refreshViewsAndRecordsRef: MutableRefObject<() => Promise<void>>;
}

export const useProjectTableRuntime = ({
  accessToken,
  projectId,
  panes,
  sessionUserId,
  setTimeline,
  paneCanEditForUser,
  setRecordsError,
  refreshViewsAndRecordsRef,
}: UseProjectTableRuntimeParams) => {
  const [tableViewDataById, setTableViewDataById] = useState<Record<string, TableViewRuntimeState>>({});
  const [tableLoading, setTableLoading] = useState(false);
  const refreshRequestIdRef = useRef(0);
  const refreshInFlightRef = useRef(0);

  const refreshTableRuntime = useCallback(
    async (nextViews: HubView[]) => {
      const requestId = ++refreshRequestIdRef.current;
      refreshInFlightRef.current += 1;
      setTableLoading(true);
      try {
        const nextTableViews = nextViews.filter((view) => view.type === 'table');
        const tableEntries = await Promise.all(
          nextTableViews.map(async (view) => {
            try {
              const query = await loadCompleteViewQuery(accessToken, view.view_id);
              return [
                view.view_id,
                {
                  schema: query?.schema || null,
                  records: query?.records || [],
                  loading: false,
                } satisfies TableViewRuntimeState,
              ] as const;
            } catch (error) {
              return [
                view.view_id,
                {
                  schema: null,
                  records: [],
                  loading: false,
                  error: error instanceof Error ? error.message : `Failed to load table view ${view.name}.`,
                } satisfies TableViewRuntimeState,
              ] as const;
            }
          }),
        );

        if (requestId === refreshRequestIdRef.current) {
          setTableViewDataById(Object.fromEntries(tableEntries));
        }
      } finally {
        refreshInFlightRef.current = Math.max(0, refreshInFlightRef.current - 1);
        if (refreshInFlightRef.current === 0) {
          setTableLoading(false);
        }
      }
    },
    [accessToken],
  );

  const clearTableRuntime = useCallback(() => {
    refreshRequestIdRef.current += 1;
    refreshInFlightRef.current = 0;
    setTableViewDataById({});
    setTableLoading(false);
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

  const onCreateTableRecord = useCallback(
    async (
      viewId: string,
      payload: { title: string; fields: Record<string, unknown> },
      mutationPaneId: string | null,
    ) => {
      setRecordsError(null);
      const mutationPane = resolveEditableMutationPane(mutationPaneId, 'Open an editable pane before creating records.');
      if (!mutationPane) {
        const message = 'Open an editable pane before creating records.';
        throw new Error(message);
      }

      const collectionId = tableViewDataById[viewId]?.schema?.collection_id ?? null;
      if (!collectionId) {
        const message = 'Cannot create record: Table collection is unavailable.';
        setRecordsError(message);
        throw new Error(message);
      }

      try {
        await createRecord(accessToken, projectId, {
          collection_id: collectionId,
          title: payload.title,
          source_pane_id: mutationPane.pane_id,
          source_view_id: viewId,
          values: payload.fields,
        });
        await refreshViewsAndRecordsRef.current();
        const nextTimeline = await listTimeline(accessToken, projectId);
        setTimeline(nextTimeline);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to create table record.';
        setRecordsError(message);
        throw new Error(message);
      }
    },
    [
      accessToken,
      projectId,
      refreshViewsAndRecordsRef,
      resolveEditableMutationPane,
      setRecordsError,
      setTimeline,
      tableViewDataById,
    ],
  );

  const onUpdateTableRecord = useCallback(
    async (
      _viewId: string,
      recordId: string,
      fields: Record<string, unknown>,
      mutationPaneId: string | null,
    ) => {
      setRecordsError(null);
      const mutationPane = resolveEditableMutationPane(mutationPaneId, 'Open an editable pane before editing records.');
      if (!mutationPane) {
        const message = 'Open an editable pane before editing records.';
        throw new Error(message);
      }

      const { title, ...valueFields } = fields;

      try {
        const updateOperations: Array<{ promise: Promise<unknown> }> = [];

        if (typeof title === 'string') {
          updateOperations.push({
            promise: updateRecord(accessToken, recordId, { title }, { mutation_context_pane_id: mutationPane.pane_id }),
          });
        }

        if (Object.keys(valueFields).length > 0) {
          updateOperations.push({
            promise: setRecordValues(accessToken, recordId, valueFields, {
              mutation_context_pane_id: mutationPane.pane_id,
            }),
          });
        }

        await Promise.all(updateOperations.map((operation) => operation.promise));
        await refreshViewsAndRecordsRef.current();
        const nextTimeline = await listTimeline(accessToken, projectId);
        setTimeline(nextTimeline);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to update table record.';
        setRecordsError(message);
        throw new Error(message);
      }
    },
    [accessToken, projectId, refreshViewsAndRecordsRef, resolveEditableMutationPane, setRecordsError, setTimeline],
  );

  const onDeleteTableRecords = useCallback(
    async (
      _viewId: string,
      recordIds: string[],
      mutationPaneId: string | null,
    ) => {
      setRecordsError(null);
      const mutationPane = resolveEditableMutationPane(mutationPaneId, 'Open an editable pane before deleting records.');
      if (!mutationPane) {
        const message = 'Open an editable pane before deleting records.';
        throw new Error(message);
      }

      try {
        await Promise.all(
          recordIds.map((recordId) =>
            updateRecord(accessToken, recordId, { archived: true }, { mutation_context_pane_id: mutationPane.pane_id })),
        );
        await refreshViewsAndRecordsRef.current();
        const nextTimeline = await listTimeline(accessToken, projectId);
        setTimeline(nextTimeline);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to delete table records.';
        setRecordsError(message);
        throw new Error(message);
      }
    },
    [accessToken, projectId, refreshViewsAndRecordsRef, resolveEditableMutationPane, setRecordsError, setTimeline],
  );

  const onBulkUpdateTableRecords = useCallback(
    async (
      _viewId: string,
      recordIds: string[],
      fields: Record<string, unknown>,
      mutationPaneId: string | null,
    ) => {
      setRecordsError(null);
      const mutationPane = resolveEditableMutationPane(
        mutationPaneId,
        'Open an editable pane before bulk updating records.',
      );
      if (!mutationPane) {
        const message = 'Open an editable pane before bulk updating records.';
        throw new Error(message);
      }

      try {
        await Promise.all(
          recordIds.map((recordId) =>
            setRecordValues(accessToken, recordId, fields, {
              mutation_context_pane_id: mutationPane.pane_id,
            })),
        );
        await refreshViewsAndRecordsRef.current();
        const nextTimeline = await listTimeline(accessToken, projectId);
        setTimeline(nextTimeline);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to bulk update table records.';
        setRecordsError(message);
        throw new Error(message);
      }
    },
    [accessToken, projectId, refreshViewsAndRecordsRef, resolveEditableMutationPane, setRecordsError, setTimeline],
  );

  const tableViewRuntimeDataById = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(tableViewDataById).map(([viewId, data]) => [
          viewId,
          {
            ...data,
            loading: tableLoading || data.loading,
          },
        ]),
      ),
    [tableLoading, tableViewDataById],
  );

  return {
    tableViewDataById,
    tableLoading,
    refreshTableRuntime,
    clearTableRuntime,
    onCreateTableRecord,
    onUpdateTableRecord,
    onDeleteTableRecords,
    onBulkUpdateTableRecords,
    tableViewRuntimeDataById,
  };
};
