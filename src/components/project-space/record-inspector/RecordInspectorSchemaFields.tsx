import { buildFieldUpdateValue, getEditableFieldValue, getEditableInputType, readFieldOptions } from '../TableWidgetSkin/valueNormalization';
import type { HubRecordDetail } from '../../../shared/api-types/records';
import type { ReactElement } from 'react';

type RecordSchemaField = NonNullable<HubRecordDetail['schema']>['fields'][number];

interface RecordInspectorSchemaFieldsProps {
  recordId: string;
  fields: RecordSchemaField[] | undefined;
  values: HubRecordDetail['values'];
  canEdit: boolean;
  onSaveRecordField: (fieldId: string, value: unknown) => Promise<void>;
}

export const RecordInspectorSchemaFields = ({
  recordId,
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
      {fields.map((field) => {
        const fieldKey = `${recordId}:${field.field_id}`;
        const initialValue = getEditableFieldValue(field, values[field.field_id]);

        if (field.type === 'relation') {
          return (
            <label key={fieldKey} className="flex flex-col gap-1 text-xs text-muted">
              {field.name}
              <span className="rounded-panel border border-border-muted bg-surface-elevated px-2 py-1 text-sm text-muted">
                Manage relation fields in the Relations section.
              </span>
            </label>
          );
        }

        if (field.type === 'select') {
          const options = readFieldOptions(field.config);
          const selectOptions = initialValue && !options.some((option) => option.id === initialValue)
            ? [{ id: initialValue, label: initialValue }, ...options]
            : options;

          return (
            <label key={fieldKey} className="flex flex-col gap-1 text-xs text-muted">
              {field.name}
              <select
                defaultValue={initialValue}
                disabled={!canEdit}
                className="rounded-panel border border-border-muted bg-surface px-2 py-1 text-sm text-text"
                onBlur={(event) => {
                  if (!canEdit || event.target.value === initialValue) {
                    return;
                  }
                  void onSaveRecordField(field.field_id, buildFieldUpdateValue(field, event.target.value));
                }}
              >
                <option value="">No value</option>
                {selectOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          );
        }

        return (
          <label key={fieldKey} className="flex flex-col gap-1 text-xs text-muted">
            {field.name}
            <input
              type={getEditableInputType(field)}
              defaultValue={initialValue}
              disabled={!canEdit}
              className="rounded-panel border border-border-muted bg-surface px-2 py-1 text-sm text-text"
              onBlur={(event) => {
                if (!canEdit || event.target.value === initialValue) {
                  return;
                }
                void onSaveRecordField(field.field_id, buildFieldUpdateValue(field, event.target.value));
              }}
            />
          </label>
        );
      })}
    </div>
  );
};
