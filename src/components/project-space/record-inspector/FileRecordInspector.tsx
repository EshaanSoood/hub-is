import { RecordInspectorAttachmentsSection } from './RecordInspectorAttachmentsSection';
import { RecordInspectorDiscussionSections } from './RecordInspectorDiscussionSections';
import { RecordInspectorSchemaFields } from './RecordInspectorSchemaFields';
import { RelationsSection } from '../RelationsSection';
import { FileRecordSummary } from '../record-primitives/FileRecordSummary';
import type { ReactElement } from 'react';
import type { RecordInspectorBodyProps } from './recordInspectorTypes';

const readFileExtension = (name: string | null | undefined): string => {
  if (!name) {
    return 'file';
  }
  const extensionIndex = name.lastIndexOf('.');
  if (extensionIndex <= 0 || extensionIndex === name.length - 1) {
    return 'file';
  }
  return name.slice(extensionIndex + 1);
};

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
            ext={readFileExtension(leadAttachment?.name)}
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
              Open source project
            </button>
          </div>
        ) : null}
        {!inspectorMutationPaneCanEdit ? (
          <p className="mt-2 text-xs text-muted">
            {inspectorMutationPane?.pane_id
              ? `Opened in read-only project ${inspectorMutationPane.name || inspectorMutationPane.pane_id}.`
              : 'Opened outside a project edit context.'}{' '}
            You can review this file record and add comments, but only project editors can change fields, attachments, or relations.
          </p>
        ) : null}
        <RecordInspectorSchemaFields
          recordId={inspectorRecord.record_id}
          fields={inspectorRecord.schema?.fields}
          values={inspectorRecord.values}
          canEdit={inspectorMutationPaneCanEdit}
          onSaveRecordField={onSaveRecordField}
        />
        {savingValues ? <p className="mt-2 text-xs text-muted">Saving...</p> : null}
      </section>

      <RecordInspectorAttachmentsSection
        attachments={inspectorRecord.attachments}
        panes={sharedSectionProps.panes}
        selectedAttachmentId={sharedSectionProps.selectedAttachmentId}
        inspectorMutationPaneCanEdit={inspectorMutationPaneCanEdit}
        uploadingAttachment={sharedSectionProps.uploadingAttachment}
        setSelectedAttachmentId={sharedSectionProps.setSelectedAttachmentId}
        onRenameAttachment={sharedSectionProps.onRenameInspectorAttachment}
        onMoveAttachment={sharedSectionProps.onMoveInspectorAttachment}
        onDetachAttachment={sharedSectionProps.onDetachInspectorAttachment}
        onAttachFile={sharedSectionProps.onAttachFile}
      />

      <RelationsSection
        accessToken={sharedSectionProps.accessToken}
        projectId={sharedSectionProps.projectId}
        recordId={inspectorRecord.record_id}
        relationFields={sharedSectionProps.inspectorRelationFields}
        outgoing={inspectorRecord.relations.outgoing}
        incoming={inspectorRecord.relations.incoming}
        removingRelationId={sharedSectionProps.removingRelationId}
        mutationError={sharedSectionProps.relationMutationError}
        readOnly={!inspectorMutationPaneCanEdit}
        onAddRelation={sharedSectionProps.onAddRelation}
        onRemoveRelation={sharedSectionProps.onRemoveRelation}
      />

      <RecordInspectorDiscussionSections
        accessToken={sharedSectionProps.accessToken}
        projectId={sharedSectionProps.projectId}
        inspectorBacklinks={sharedSectionProps.inspectorBacklinks}
        inspectorBacklinksLoading={sharedSectionProps.inspectorBacklinksLoading}
        inspectorBacklinksError={sharedSectionProps.inspectorBacklinksError}
        inspectorCommentText={sharedSectionProps.inspectorCommentText}
        setInspectorCommentText={sharedSectionProps.setInspectorCommentText}
        onInsertRecordCommentMention={sharedSectionProps.onInsertRecordCommentMention}
        onAddRecordComment={sharedSectionProps.onAddRecordComment}
        onOpenBacklink={sharedSectionProps.onOpenBacklink}
        inspectorRecord={inspectorRecord}
      />
    </div>
  );
};
