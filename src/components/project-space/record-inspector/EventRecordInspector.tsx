import { RecordInspectorAttachmentsSection } from './RecordInspectorAttachmentsSection';
import { RecordInspectorDiscussionSections } from './RecordInspectorDiscussionSections';
import { RecordInspectorSchemaFields } from './RecordInspectorSchemaFields';
import { RelationsSection } from '../RelationsSection';
import { EventRecordSummary } from '../record-primitives/EventRecordSummary';
import type { ReactElement } from 'react';
import type { RecordInspectorBodyProps } from './recordInspectorTypes';

const formatDateTime = (value: string | null, timeZone?: string | null): string | null => {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString(undefined, timeZone ? { timeZone } : undefined);
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
        <p className="mt-1 text-xs text-muted">Collection: {inspectorRecord.schema?.name || inspectorRecord.collection_id}</p>
        <EventRecordSummary
          className="mt-3"
          title={inspectorRecord.title}
          timeLabel={
            eventState
              ? `${formatDateTime(eventState.start_dt, eventState.timezone) || 'No start'}${eventState.end_dt ? ` - ${formatDateTime(eventState.end_dt, eventState.timezone)}` : ''}`
              : null
          }
          detailLabel={null}
          location={eventState?.location || null}
          timezone={eventState?.timezone || null}
        />
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
            You can review this event and add comments, but only project editors can change fields, attachments, or relations.
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
