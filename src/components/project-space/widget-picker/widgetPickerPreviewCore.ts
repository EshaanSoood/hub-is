import type { HubRecordSummary } from '../../../services/hub/types';
import type { ContractWidgetConfig } from '../WidgetGrid';
import type { KanbanWidgetContract, TableWidgetContract } from '../widgetContracts';
import type { WidgetPickerSeedPayload, WidgetPickerSelection } from './widgetPickerTypes';
import { addMinutes, asArray, asRecord, asText, noop } from './widgetPickerPreviewUtils';

export const buildPreviewWidget = (selection: WidgetPickerSelection): ContractWidgetConfig => ({
  widget_instance_id: `widget-picker-preview-${selection.widgetType}`,
  widget_type: selection.widgetType,
  size_tier: selection.sizeTier,
  lens: 'space',
  binding: { view_id: 'preview-view', source_mode: 'linked' },
});

export const tableContract = (seed: WidgetPickerSeedPayload): TableWidgetContract => {
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
          const fieldEntries = fields.reduce<Record<string, unknown>>((entries, field, fieldIndex) => {
            entries[field.field_id] = values[fieldIndex + 1];
            return entries;
          }, {});
          return {
            record_id: `preview-record-${index}`,
            collection_id: 'preview-table',
            title: asText(values[0], `Record ${index + 1}`),
            fields: fieldEntries,
            updated_at: addMinutes(-index),
            source_project: null,
          };
        }),
      },
    },
  };
};

export const kanbanContract = (seed: WidgetPickerSeedPayload): KanbanWidgetContract => {
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
            source_project: null,
          })),
        })),
        loading: false,
        groupingConfigured: true,
      },
    },
    onMoveRecord: noop,
  };
};
