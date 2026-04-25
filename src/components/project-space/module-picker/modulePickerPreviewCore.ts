import type { HubRecordSummary } from '../../../services/hub/types';
import type { ContractModuleConfig } from '../ModuleGrid';
import type { KanbanModuleContract, TableModuleContract } from '../moduleContracts';
import type { ModulePickerSeedPayload, ModulePickerSelection } from './modulePickerTypes';
import { addMinutes, asArray, asRecord, asText, noop } from './modulePickerPreviewUtils';

export const buildPreviewModule = (selection: ModulePickerSelection): ContractModuleConfig => ({
  module_instance_id: `module-picker-preview-${selection.moduleType}`,
  module_type: selection.moduleType,
  size_tier: selection.sizeTier,
  lens: 'project',
  binding: { view_id: 'preview-view', source_mode: 'linked' },
});

export const tableContract = (seed: ModulePickerSeedPayload): TableModuleContract => {
  const rows = asArray(seed.rows);
  const seedFieldNames = asArray(seed.fields).map((field) => asText(field)).filter(Boolean);
  const titleColumnLabel = seedFieldNames[0] ?? 'Name';
  const fieldNames = seedFieldNames.length > 1 ? seedFieldNames.slice(1) : ['Status', 'Vibe'];
  const fields = fieldNames.map((name, index) => ({
    field_id: `preview-field-${index}`,
    collection_id: 'preview-table',
    name,
    type: 'text',
    config: {},
    sort_order: index,
  }));
  return {
    views: [{ view_id: 'preview-view', name: 'Preview Table' }],
    defaultViewId: 'preview-view',
    titleColumnLabel,
    dataByViewId: {
      'preview-view': {
        schema: { collection_id: 'preview-table', name: 'Preview Table', fields },
        loading: false,
        records: rows.map((row, index): HubRecordSummary => {
          const values = asArray(row);
          return {
            record_id: `preview-record-${index}`,
            collection_id: 'preview-table',
            title: asText(values[0], `Record ${index + 1}`),
            fields: { [fields[0].field_id]: values[1], [fields[1].field_id]: values[2] },
            updated_at: addMinutes(-index),
            source_pane: null,
          };
        }),
      },
    },
  };
};

export const kanbanContract = (seed: ModulePickerSeedPayload): KanbanModuleContract => {
  const columns = asArray(seed.columns).map(asRecord);
  return {
    views: [{ view_id: 'preview-view', name: 'Preview Board' }],
    defaultViewId: 'preview-view',
    dataByViewId: {
      'preview-view': {
        groupFieldId: 'preview-status',
        groupOptions: columns.map((column, index) => ({ id: `column-${index}`, label: asText(column.title) })),
        groups: columns.map((column, columnIndex) => ({
          id: `column-${columnIndex}`,
          label: asText(column.title),
          records: asArray(column.cards).map((title, cardIndex) => ({
            record_id: `preview-card-${columnIndex}-${cardIndex}`,
            collection_id: 'preview-kanban',
            title: asText(title),
            fields: { 'preview-status': `column-${columnIndex}` },
            updated_at: addMinutes(-(columnIndex + cardIndex)),
            source_pane: null,
          })),
        })),
        loading: false,
        groupingConfigured: true,
      },
    },
    onMoveRecord: noop,
  };
};
