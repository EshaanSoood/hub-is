import { RecordInspectorSchemaFields } from './RecordInspectorSchemaFields';
import { RecordInspectorSharedSections } from './RecordInspectorSharedSections';
import type { ReactElement } from 'react';
import type { RecordInspectorBodyProps } from './recordInspectorTypes';

export const FileRecordInspector = ({
  inspectorRecord,
  inspectorMutationPane,
  inspectorMutationPaneCanEdit,
  savingValues,
  onSaveRecordField,
  onOpenSourcePane,
  ...sharedSectionProps
}: RecordInspectorBodyProps): ReactElement => {
  const leadAttachment = inspectorRecord.attachments[0] ?? null;

  return (
    <div className="mt-4 space-y-4">
      <section className="rounded-panel border border-border-muted p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">File</p>
        <h3 className="mt-1 text-sm font-semibold text-primary">{inspectorRecord.title}</h3>
        <p className="mt-1 text-xs text-muted">Collection: {inspectorRecord.schema?.name || inspectorRecord.collection_id}</p>
        <div className="mt-2 space-y-1 text-xs text-muted">
          <p>Linked files: {inspectorRecord.attachments.length}</p>
          {leadAttachment ? <p>Primary asset: {leadAttachment.name}</p> : null}
          {leadAttachment ? <p>MIME type: {leadAttachment.mime_type}</p> : null}
        </div>
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
            You can review this file record and add comments, but only pane editors can change fields, attachments, or relations.
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
