import { queryView } from '../../services/hub/views';
import type { HubCollectionField, HubRecordSummary, HubView } from '../../services/hub/types';

export const KANBAN_UNASSIGNED_ID = '__unassigned__';
export const KANBAN_OWNED_VIEW_CONFIG_KEY = 'owned_by_module_instance_id';
const MAX_VIEW_QUERY_PAGES = 250;

export interface TableSchema {
  collection_id: string;
  name: string;
  fields: HubCollectionField[];
}

export interface TableViewRuntimeState {
  schema: TableSchema | null;
  records: HubRecordSummary[];
  loading: boolean;
  error?: string;
}

export interface KanbanRuntimeState {
  collectionId: string | null;
  groups: Array<{ id: string; label: string; records: HubRecordSummary[] }>;
  groupOptions: Array<{ id: string; label: string }>;
  groupingConfigured: boolean;
  groupingMessage: string;
  groupFieldId: string | null;
  viewConfig: Record<string, unknown>;
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

export type ProjectTimelineItem = {
  timeline_event_id: string;
  event_type: string;
  primary_entity_type: string;
  primary_entity_id: string;
  summary_json: Record<string, unknown>;
  created_at: string;
};

export type ViewQueryResult = Awaited<ReturnType<typeof queryView>>;

export const EMPTY_KANBAN_RUNTIME: KanbanRuntimeState = {
  collectionId: null,
  groups: [],
  groupOptions: [],
  groupingConfigured: false,
  groupingMessage: 'No kanban view found yet.',
  groupFieldId: null,
  viewConfig: {},
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

export const isKanbanGroupableField = (field: HubCollectionField): boolean => field.type === 'select';

export const readOwnedKanbanModuleInstanceId = (config: Record<string, unknown> | null | undefined): string | null => {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return null;
  }
  const value = config[KANBAN_OWNED_VIEW_CONFIG_KEY];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
};

export const isStandaloneKanbanView = (view: Pick<HubView, 'type' | 'config'>): boolean =>
  view.type === 'kanban' && Boolean(readOwnedKanbanModuleInstanceId(view.config));

const readGroupableFields = (
  schema: { fields: HubCollectionField[] } | null | undefined,
): Array<{ field_id: string; name: string }> =>
  (schema?.fields ?? [])
    .filter((field) => isKanbanGroupableField(field))
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

export const buildKanbanRuntime = (query: ViewQueryResult): KanbanRuntimeState => {
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
      groups: [],
      groupOptions: [],
      groupingConfigured: false,
      groupingMessage: groupableFields.length > 0
        ? 'Choose a single-select field to turn this collection into a kanban board.'
        : 'This collection has no single-select fields available for kanban grouping.',
      groupFieldId: null,
      viewConfig: config,
      groupableFields,
      metadataFieldIds,
      wipLimits,
    };
  }

  const groupField = query.schema?.fields.find((field) => field.field_id === groupFieldId);
  if (!groupField || !isKanbanGroupableField(groupField)) {
    return {
      collectionId: query.view.collection_id ?? query.schema?.collection_id ?? null,
      groups: [],
      groupOptions: [],
      groupingConfigured: false,
      groupingMessage: groupableFields.length > 0
        ? 'The configured grouping field is no longer available. Choose another single-select field.'
        : 'This collection has no single-select fields available for kanban grouping.',
      groupFieldId: null,
      viewConfig: config,
      groupableFields,
      metadataFieldIds,
      wipLimits,
    };
  }
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
    viewConfig: config,
    groupableFields,
    metadataFieldIds,
    wipLimits,
  };
};

export async function loadCompleteViewQuery(accessToken: string, viewId: string): Promise<ViewQueryResult | null> {
  let cursor: string | null = null;
  let pageCount = 0;
  let latestResult: ViewQueryResult | null = null;
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
