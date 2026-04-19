import { RecordInspectorSchemaFields } from './RecordInspectorSchemaFields';
import { RecordInspectorSharedSections } from './RecordInspectorSharedSections';
import type { ReactElement } from 'react';
import type { RecordInspectorBodyProps } from './recordInspectorTypes';

const formatDateTime = (value: string | null): string | null => {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toLocaleString() : value;
};

export const EventRecordInspector = ({
  inspectorRecord,
  inspectorMutationPane,
  inspectorMutationPaneCanEdit,
  savingValues,
  onSaveRecordField,
  onOpenSourcePane,
  ...sharedSectionProps
}: RecordInspectorBodyProps): ReactElement => {
  const eventState = inspectorRecord.capabilities.event_state;

  return (
    <div className="mt-4 space-y-4">
      <section className="rounded-panel border border-border-muted p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Event</p>
        <h3 className="mt-1 text-sm font-semibold text-primary">{inspectorRecord.title}</h3>
        <p className="mt-1 text-xs text-muted">Collection: {inspectorRecord.schema?.name || inspectorRecord.collection_id}</p>
        {eventState ? (
          <div className="mt-2 space-y-1 text-xs text-muted">
            <p>Starts: {formatDateTime(eventState.start_dt)}</p>
            <p>Ends: {formatDateTime(eventState.end_dt)}</p>
            <p>Location: {eventState.location || 'None'}</p>
            <p>Timezone: {eventState.timezone}</p>
          </div>
        ) : null}
        {inspectorRecord.source_pane?.pane_id ? (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
            <span>Origin: {inspectorRecord.source_pane.pane_name || inspectorRecord.source_pane.pane_id}</span>
            <button
              type="button"
              className="rounded-panel border border-border-muted px-2 py-1 text-xs font-semibold text-primary"
              onClick={() => onOpenSourcePane?.()}
            >
              Open source pane
            </button>
          </div>
        ) : null}
        {!inspectorMutationPaneCanEdit ? (
          <p className="mt-2 text-xs text-muted">
            {inspectorMutationPane?.pane_id
              ? `Opened in read-only pane ${inspectorMutationPane.name || inspectorMutationPane.pane_id}.`
              : 'Opened outside a pane edit context.'}{' '}
            You can review this event and add comments, but only pane editors can change fields, attachments, or relations.
          </p>
        ) : null}
        <RecordInspectorSchemaFields
          fields={inspectorRecord.schema?.fields}
          values={inspectorRecord.values}
          canEdit={inspectorMutationPaneCanEdit}
          onSaveRecordField={onSaveRecordField}
        />
        {savingValues ? <p className="mt-2 text-xs text-muted">Saving...</p> : null}
      </section>

      <RecordInspectorSharedSections
        {...sharedSectionProps}
        inspectorRecord={inspectorRecord}
        inspectorMutationPaneCanEdit={inspectorMutationPaneCanEdit}
      />
    </div>
  );
};
