import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import {
  archiveRecord,
  createRecord,
  listTimeline,
  setRecordValues,
  updateRecord,
} from '../services/hub/records';
import { listCollectionFields, listCollections } from '../services/hub/collections';
import { listViews, queryView } from '../services/hub/views';
import type { HubCollection, HubCollectionField, HubPaneSummary, HubRecordSummary, HubView } from '../services/hub/types';
import { subscribeHubLive } from '../services/hubLive';

const KANBAN_UNASSIGNED_ID = '__unassigned__';
const MAX_VIEW_QUERY_PAGES = 250;

interface TableSchema {
  collection_id: string;
  name: string;
  fields: HubCollectionField[];
}

interface TableViewRuntimeState {
  schema: TableSchema | null;
  records: HubRecordSummary[];
  loading: boolean;
  error?: string;
}

interface KanbanRuntimeState {
  collectionId: string | null;
  groups: Array<{ id: string; label: string; records: HubRecordSummary[] }>;
  groupOptions: Array<{ id: string; label: string }>;
  groupingConfigured: boolean;
  groupingMessage: string;
  groupFieldId: string | null;
  groupableFields?: Array<{ field_id: string; name: string }>;
  metadataFieldIds?: {
    priority?: string | null;
    assignee?: string | null;
    dueDate?: string | null;
  };
  wipLimits?: Record<string, number>;
  loading?: boolean;
  error?: string;
}

type ProjectTimelineItem = {
  timeline_event_id: string;
  event_type: string;
  primary_entity_type: string;
  primary_entity_id: string;
  summary_json: Record<string, unknown>;
  created_at: string;
};

interface UseProjectViewsRuntimeParams {
  accessToken: string;
  projectId: string;
  activeTab: 'overview' | 'work' | 'tools';
  panes: HubPaneSummary[];
  sessionUserId: string;
  setTimeline: React.Dispatch<React.SetStateAction<ProjectTimelineItem[]>>;
  paneCanEditForUser: (pane: HubPaneSummary | null | undefined, userId: string) => boolean;
}

const EMPTY_KANBAN_RUNTIME: KanbanRuntimeState = {
  collectionId: null,
  groups: [],
  groupOptions: [],
  groupingConfigured: false,
  groupingMessage: 'No kanban view found yet.',
  groupFieldId: null,
  groupableFields: [],
  metadataFieldIds: {},
};

const readConfigString = (config: Record<string, unknown>, key: string): string | null => {
  const value = config[key];
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  return null;
};

const normalizeGroupValue = (raw: unknown): string => {
  if (typeof raw === 'string') {
    return raw.trim();
  }
  if (typeof raw === 'number' || typeof raw === 'boolean') {
    return String(raw);
  }
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const objectValue = raw as Record<string, unknown>;
    const candidates = [objectValue.id, objectValue.value, objectValue.key, objectValue.name, objectValue.label];
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim();
      }
    }
  }
  return '';
};

const readOptionValues = (fieldConfig: Record<string, unknown> | undefined): Array<{ id: string; label: string }> => {
  if (!fieldConfig) {
    return [];
  }
  const options = fieldConfig.options;
  if (!Array.isArray(options)) {
    return [];
  }
  const parsed = options
    .map((entry): { id: string; label: string } | null => {
      if (typeof entry === 'string') {
        const trimmed = entry.trim();
        if (!trimmed) {
          return null;
        }
        return { id: trimmed, label: trimmed };
      }
      if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
        const record = entry as Record<string, unknown>;
        const id = normalizeGroupValue(record.id ?? record.value ?? record.key ?? record.name ?? record.label);
        if (!id) {
          return null;
        }
        const labelCandidate = record.label ?? record.name ?? id;
        const label = typeof labelCandidate === 'string' && labelCandidate.trim() ? labelCandidate.trim() : id;
        return { id, label };
      }
      return null;
    })
    .filter((option): option is { id: string; label: string } => Boolean(option));

  const seen = new Set<string>();
  return parsed.filter((option) => {
    if (seen.has(option.id)) {
      return false;
    }
    seen.add(option.id);
    return true;
  });
};

const readGroupableFields = (
  schema: { fields: HubCollectionField[] } | null | undefined,
): Array<{ field_id: string; name: string }> =>
  (schema?.fields ?? [])
    .map((field) => ({ field_id: field.field_id, name: field.name.trim() }))
    .filter((field) => field.name.length > 0);

const readWipLimits = (config: Record<string, unknown>): Record<string, number> | undefined => {
  const raw = config.wip_limits;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return undefined;
  }

  const parsedEntries = Object.entries(raw).flatMap(([groupId, value]) => {
    const normalized =
      typeof value === 'number'
        ? value
        : typeof value === 'string' && value.trim()
          ? Number(value)
          : Number.NaN;
    if (!Number.isFinite(normalized) || normalized < 0) {
      return [];
    }
    return [[groupId, Math.floor(normalized)] as const];
  });

  return parsedEntries.length > 0 ? Object.fromEntries(parsedEntries) : undefined;
};

const buildKanbanRuntime = (query: Awaited<ReturnType<typeof queryView>>): KanbanRuntimeState => {
  const config = query.view.config;
  const groupableFields = readGroupableFields(query.schema);
  const groupFieldId = readConfigString(config, 'group_by_field_id');
  const metadataFieldIds = {
    priority: readConfigString(config, 'priority_field_id'),
    assignee: readConfigString(config, 'assignee_field_id'),
    dueDate: readConfigString(config, 'due_date_field_id'),
  };
  const wipLimits = readWipLimits(config);

  if (!groupFieldId) {
    return {
      collectionId: query.view.collection_id ?? query.schema?.collection_id ?? null,
      groups: [
        {
          id: KANBAN_UNASSIGNED_ID,
          label: 'Ungrouped',
          records: query.records,
        },
      ],
      groupOptions: [],
      groupingConfigured: false,
      groupingMessage: 'No grouping field configured. Rendering all cards in a single ungrouped column.',
      groupFieldId: null,
      groupableFields,
      metadataFieldIds,
      wipLimits,
    };
  }

  const groupField = query.schema?.fields.find((field) => field.field_id === groupFieldId);
  const configuredOptions = readOptionValues(groupField?.config);
  const optionLabelById = new Map(configuredOptions.map((option) => [option.id, option.label]));

  const buckets = new Map<string, HubRecordSummary[]>();
  for (const option of configuredOptions) {
    buckets.set(option.id, []);
  }
  const unassigned: HubRecordSummary[] = [];

  for (const record of query.records) {
    const bucketKey = normalizeGroupValue(record.fields[groupFieldId]);
    if (!bucketKey) {
      unassigned.push(record);
      continue;
    }
    if (!buckets.has(bucketKey)) {
      buckets.set(bucketKey, []);
      optionLabelById.set(bucketKey, bucketKey);
    }
    buckets.get(bucketKey)?.push(record);
  }

  const groupOptions = [...buckets.keys()].map((bucketId) => ({
    id: bucketId,
    label: optionLabelById.get(bucketId) || bucketId,
  }));

  const groups = groupOptions.map((option) => ({
    id: option.id,
    label: option.label,
    records: buckets.get(option.id) ?? [],
  }));

  groups.push({
    id: KANBAN_UNASSIGNED_ID,
    label: 'Unassigned',
    records: unassigned,
  });

  return {
    collectionId: query.view.collection_id ?? query.schema?.collection_id ?? null,
    groups,
    groupOptions,
    groupingConfigured: true,
    groupingMessage: '',
    groupFieldId,
    groupableFields,
    metadataFieldIds,
    wipLimits,
  };
};

async function loadCompleteViewQuery(accessToken: string, viewId: string): Promise<Awaited<ReturnType<typeof queryView>> | null> {
  let cursor: string | null = null;
  let pageCount = 0;
  let latestResult: Awaited<ReturnType<typeof queryView>> | null = null;
  const records: HubRecordSummary[] = [];

  do {
    if (pageCount >= MAX_VIEW_QUERY_PAGES) {
      throw new Error(`View ${viewId} exceeded ${MAX_VIEW_QUERY_PAGES} pages while loading records.`);
    }

    const result = await queryView(accessToken, {
      view_id: viewId,
      pagination: {
        cursor,
        limit: 200,
      },
    });
    latestResult = result;
    records.push(...result.records);
    cursor = result.next_cursor;
    pageCount += 1;
  } while (cursor);

  if (!latestResult) {
    return null;
  }

  return {
    ...latestResult,
    records,
    next_cursor: null,
  };
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
  const [searchParams] = useSearchParams();
  const [collections, setCollections] = useState<HubCollection[]>([]);
  const [views, setViews] = useState<HubView[]>([]);
  const [tableViewDataById, setTableViewDataById] = useState<Record<string, TableViewRuntimeState>>({});
  const [tableLoading, setTableLoading] = useState(false);
  const [kanbanRuntimeByViewId, setKanbanRuntimeByViewId] = useState<Record<string, KanbanRuntimeState>>({});
  const [kanbanLoading, setKanbanLoading] = useState(false);
  const [recordsError, setRecordsError] = useState<string | null>(null);
  const [selectedEmbedViewId, setSelectedEmbedViewId] = useState('');
  const [focusedWorkViewData, setFocusedWorkViewData] = useState<Awaited<ReturnType<typeof queryView>> | null>(null);
  const [focusedWorkViewLoading, setFocusedWorkViewLoading] = useState(false);
  const [focusedWorkViewError, setFocusedWorkViewError] = useState<string | null>(null);
  const liveRefreshViewsTimeoutRef = useRef<number | null>(null);

  const focusedWorkViewId = activeTab === 'work' ? searchParams.get('view_id') || '' : '';
  const focusedWorkView = useMemo(
    () => (focusedWorkViewId ? views.find((view) => view.view_id === focusedWorkViewId) || null : null),
    [focusedWorkViewId, views],
  );

  const refreshViewsAndRecords = useCallback(async () => {
    setRecordsError(null);
    setTableLoading(true);
    setKanbanLoading(true);
    let loadedViews = false;
    try {
      const nextCollections = await listCollections(accessToken, projectId);
      setCollections(nextCollections);

      // Intentional cache warm-up: field results are discarded.
      await Promise.all(nextCollections.map((collection) => listCollectionFields(accessToken, collection.collection_id)));

      const nextViews = await listViews(accessToken, projectId);
      setViews(nextViews);
      setSelectedEmbedViewId((current) => {
        if (current && nextViews.some((view) => view.view_id === current)) {
          return current;
        }
        return nextViews[0]?.view_id || '';
      });

      const nextTableViews = nextViews.filter((view) => view.type === 'table');
      const nextKanbanViews = nextViews.filter((view) => view.type === 'kanban');

      const [tableEntries, kanbanEntries] = await Promise.all([
        Promise.all(
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
        ),
        Promise.all(
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
        ),
      ]);

      setTableViewDataById(Object.fromEntries(tableEntries));
      setKanbanRuntimeByViewId(Object.fromEntries(kanbanEntries));
      loadedViews = true;
    } catch (error) {
      setTableViewDataById({});
      setKanbanRuntimeByViewId({});
      setRecordsError(error instanceof Error ? error.message : 'Failed to load collections, views, and records.');
    } finally {
      setTableLoading(false);
      setKanbanLoading(false);
    }

    if (!loadedViews) {
      return;
    }
  }, [accessToken, projectId]);

  useEffect(() => {
    void refreshViewsAndRecords();
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

  useEffect(() => {
    if (activeTab !== 'work' || !focusedWorkViewId || !focusedWorkView) {
      setFocusedWorkViewData(null);
      setFocusedWorkViewError(null);
      setFocusedWorkViewLoading(false);
      return;
    }
    if (focusedWorkView.type === 'kanban') {
      setFocusedWorkViewData(null);
      setFocusedWorkViewError(null);
      setFocusedWorkViewLoading(false);
      return;
    }

    const cachedTableView = tableViewDataById[focusedWorkViewId];
    if (focusedWorkView.type === 'table' && cachedTableView) {
      setFocusedWorkViewData({
        view: focusedWorkView,
        schema: cachedTableView.schema,
        records: cachedTableView.records,
        next_cursor: null,
      });
      setFocusedWorkViewError(cachedTableView.error ?? null);
      setFocusedWorkViewLoading(false);
      return;
    }

    let cancelled = false;
    setFocusedWorkViewLoading(true);
    setFocusedWorkViewError(null);
    void loadCompleteViewQuery(accessToken, focusedWorkViewId)
      .then((result) => {
        if (!cancelled) {
          setFocusedWorkViewData(result);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setFocusedWorkViewData(null);
          setFocusedWorkViewError(error instanceof Error ? error.message : 'Failed to load the selected view.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setFocusedWorkViewLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken, activeTab, focusedWorkView, focusedWorkViewId, tableViewDataById]);

  const onMoveKanbanRecord = useCallback(
    async (viewId: string, recordId: string, nextGroup: string, mutationPaneId: string | null) => {
      const mutationPane = mutationPaneId ? panes.find((pane) => pane.pane_id === mutationPaneId) || null : null;
      if (!mutationPane || !paneCanEditForUser(mutationPane, sessionUserId)) {
        setRecordsError('Open an editable pane before moving cards.');
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
        await refreshViewsAndRecords();
        const nextTimeline = await listTimeline(accessToken, projectId);
        setTimeline(nextTimeline);
      } catch (error) {
        setRecordsError(error instanceof Error ? error.message : 'Failed to move kanban card.');
      }
    },
    [accessToken, kanbanRuntimeByViewId, paneCanEditForUser, panes, projectId, refreshViewsAndRecords, sessionUserId, setTimeline],
  );

  const onCreateKanbanRecord = useCallback(
    async (
      viewId: string,
      payload: { title: string; groupFieldValue: string },
      mutationPaneId: string | null,
    ) => {
      const mutationPane = mutationPaneId ? panes.find((pane) => pane.pane_id === mutationPaneId) || null : null;
      if (!mutationPane || !paneCanEditForUser(mutationPane, sessionUserId)) {
        const message = 'Open an editable pane before creating cards.';
        setRecordsError(message);
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
        await refreshViewsAndRecords();
        const nextTimeline = await listTimeline(accessToken, projectId);
        setTimeline(nextTimeline);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to create kanban card.';
        setRecordsError(message);
        throw new Error(message);
      }
    },
    [accessToken, kanbanRuntimeByViewId, paneCanEditForUser, panes, projectId, refreshViewsAndRecords, sessionUserId, setTimeline],
  );

  const onUpdateKanbanRecord = useCallback(
    async (
      viewId: string,
      recordId: string,
      fields: Record<string, unknown>,
      mutationPaneId: string | null,
    ) => {
      const mutationPane = mutationPaneId ? panes.find((pane) => pane.pane_id === mutationPaneId) || null : null;
      if (!mutationPane || !paneCanEditForUser(mutationPane, sessionUserId)) {
        const message = 'Open an editable pane before editing cards.';
        setRecordsError(message);
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
          const reason = result.reason instanceof Error ? result.reason.message : `Failed to update ${updateOperations[index]?.label ?? 'card'}.`;
          return [reason];
        });

        let refreshError: string | null = null;
        try {
          await refreshViewsAndRecords();
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
    [accessToken, kanbanRuntimeByViewId, paneCanEditForUser, panes, projectId, refreshViewsAndRecords, sessionUserId, setTimeline],
  );

  const onDeleteKanbanRecord = useCallback(
    async (recordId: string, mutationPaneId: string | null) => {
      const mutationPane = mutationPaneId ? panes.find((pane) => pane.pane_id === mutationPaneId) || null : null;
      if (!mutationPane || !paneCanEditForUser(mutationPane, sessionUserId)) {
        const message = 'Open an editable pane before deleting cards.';
        setRecordsError(message);
        throw new Error(message);
      }

      try {
        await archiveRecord(accessToken, recordId);
        await refreshViewsAndRecords();
        const nextTimeline = await listTimeline(accessToken, projectId);
        setTimeline(nextTimeline);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to delete kanban card.';
        setRecordsError(message);
        throw new Error(message);
      }
    },
    [accessToken, paneCanEditForUser, panes, projectId, refreshViewsAndRecords, sessionUserId, setTimeline],
  );

  const onCreateTableRecord = useCallback(
    async (
      viewId: string,
      payload: { title: string; fields: Record<string, unknown> },
      mutationPaneId: string | null,
    ) => {
      const mutationPane = mutationPaneId ? panes.find((pane) => pane.pane_id === mutationPaneId) || null : null;
      if (!mutationPane || !paneCanEditForUser(mutationPane, sessionUserId)) {
        const message = 'Open an editable pane before creating records.';
        setRecordsError(message);
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
        await refreshViewsAndRecords();
        const nextTimeline = await listTimeline(accessToken, projectId);
        setTimeline(nextTimeline);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to create table record.';
        setRecordsError(message);
        throw new Error(message);
      }
    },
    [accessToken, paneCanEditForUser, panes, projectId, refreshViewsAndRecords, sessionUserId, setTimeline, tableViewDataById],
  );

  const onUpdateTableRecord = useCallback(
    async (
      _viewId: string,
      recordId: string,
      fields: Record<string, unknown>,
      mutationPaneId: string | null,
    ) => {
      const mutationPane = mutationPaneId ? panes.find((pane) => pane.pane_id === mutationPaneId) || null : null;
      if (!mutationPane || !paneCanEditForUser(mutationPane, sessionUserId)) {
        const message = 'Open an editable pane before editing records.';
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

        await Promise.all(updateOperations.map((operation) => operation.promise));
        await refreshViewsAndRecords();
        const nextTimeline = await listTimeline(accessToken, projectId);
        setTimeline(nextTimeline);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to update table record.';
        setRecordsError(message);
        throw new Error(message);
      }
    },
    [accessToken, paneCanEditForUser, panes, projectId, refreshViewsAndRecords, sessionUserId, setTimeline],
  );

  const onDeleteTableRecords = useCallback(
    async (
      _viewId: string,
      recordIds: string[],
      mutationPaneId: string | null,
    ) => {
      const mutationPane = mutationPaneId ? panes.find((pane) => pane.pane_id === mutationPaneId) || null : null;
      if (!mutationPane || !paneCanEditForUser(mutationPane, sessionUserId)) {
        const message = 'Open an editable pane before deleting records.';
        setRecordsError(message);
        throw new Error(message);
      }

      try {
        await Promise.all(
          recordIds.map((recordId) =>
            updateRecord(accessToken, recordId, { archived: true }, { mutation_context_pane_id: mutationPane.pane_id })),
        );
        await refreshViewsAndRecords();
        const nextTimeline = await listTimeline(accessToken, projectId);
        setTimeline(nextTimeline);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to delete table records.';
        setRecordsError(message);
        throw new Error(message);
      }
    },
    [accessToken, paneCanEditForUser, panes, projectId, refreshViewsAndRecords, sessionUserId, setTimeline],
  );

  const onBulkUpdateTableRecords = useCallback(
    async (
      _viewId: string,
      recordIds: string[],
      fields: Record<string, unknown>,
      mutationPaneId: string | null,
    ) => {
      const mutationPane = mutationPaneId ? panes.find((pane) => pane.pane_id === mutationPaneId) || null : null;
      if (!mutationPane || !paneCanEditForUser(mutationPane, sessionUserId)) {
        const message = 'Open an editable pane before bulk updating records.';
        setRecordsError(message);
        throw new Error(message);
      }

      try {
        await Promise.all(
          recordIds.map((recordId) =>
            setRecordValues(accessToken, recordId, fields, {
              mutation_context_pane_id: mutationPane.pane_id,
            })),
        );
        await refreshViewsAndRecords();
        const nextTimeline = await listTimeline(accessToken, projectId);
        setTimeline(nextTimeline);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to bulk update table records.';
        setRecordsError(message);
        throw new Error(message);
      }
    },
    [accessToken, paneCanEditForUser, panes, projectId, refreshViewsAndRecords, sessionUserId, setTimeline],
  );

  const tableViews = useMemo(
    () => views.filter((view) => view.type === 'table').map((view) => ({ view_id: view.view_id, name: view.name })),
    [views],
  );
  const kanbanViews = useMemo(
    () => views.filter((view) => view.type === 'kanban').map((view) => ({ view_id: view.view_id, name: view.name })),
    [views],
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
    collections,
    views,
    tableViewDataById,
    tableLoading,
    kanbanRuntimeByViewId,
    kanbanLoading,
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
    onUpdateKanbanRecord,
    onDeleteKanbanRecord,
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
