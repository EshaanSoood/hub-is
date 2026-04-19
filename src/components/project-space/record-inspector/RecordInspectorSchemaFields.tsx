import type { HubRecordDetail } from '../../../shared/api-types/records';
import type { ReactElement } from 'react';

interface RecordInspectorSchemaFieldsProps {
  fields: NonNullable<HubRecordDetail['schema']>['fields'] | undefined;
  values: HubRecordDetail['values'];
  canEdit: boolean;
  onSaveRecordField: (fieldId: string, value: string) => Promise<void>;
}

export const RecordInspectorSchemaFields = ({
  fields,
  values,
  canEdit,
  onSaveRecordField,
}: RecordInspectorSchemaFieldsProps): ReactElement | null => {
  if (!fields || fields.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 space-y-2">
      {fields.map((field: NonNullable<HubRecordDetail['schema']>['fields'][number]) => (
        <label key={field.field_id} className="flex flex-col gap-1 text-xs text-muted">
          {field.name}
          <input
            defaultValue={String(values[field.field_id] ?? '')}
            disabled={!canEdit}
            className="rounded-panel border border-border-muted bg-surface px-2 py-1 text-sm text-text"
            onBlur={(event) => {
              if (canEdit) {
                void onSaveRecordField(field.field_id, event.target.value);
              }
            }}
          />
        </label>
      ))}
    </div>
  );
};
