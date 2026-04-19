import { RecordInspectorSchemaFields } from './RecordInspectorSchemaFields';
import { RecordInspectorSharedSections } from './RecordInspectorSharedSections';
import { FileRecordSummary } from '../record-primitives/FileRecordSummary';
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
        <p className="mt-1 text-xs text-muted">Collection: {inspectorRecord.schema?.name || inspectorRecord.collection_id}</p>
        <div className="mt-3 rounded-panel border border-border-muted bg-surface-elevated p-3">
          <FileRecordSummary
            name={leadAttachment?.name || inspectorRecord.title}
            ext={leadAttachment?.name.split('.').pop() || 'file'}
            metaLabel={leadAttachment ? `${leadAttachment.mime_type} · ${inspectorRecord.attachments.length} linked file(s)` : `${inspectorRecord.attachments.length} linked file(s)`}
          />
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
