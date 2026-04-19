import { BacklinksPanel } from '../BacklinksPanel';
import { RelationsSection } from '../RelationsSection';
import { RecordInspectorActivitySection } from './RecordInspectorActivitySection';
import { RecordInspectorAttachmentsSection } from './RecordInspectorAttachmentsSection';
import { RecordInspectorCommentsSection } from './RecordInspectorCommentsSection';
import type { ComponentProps, ReactElement } from 'react';
import type { RecordInspectorSharedSectionsProps } from './recordInspectorTypes';

type RelationsSectionProps = ComponentProps<typeof RelationsSection>;

export const RecordInspectorSharedSections = ({
  accessToken,
  projectId,
  panes,
  inspectorRecord,
  inspectorRelationFields,
  inspectorBacklinks,
  inspectorBacklinksLoading,
  inspectorBacklinksError,
  inspectorCommentText,
  relationMutationError,
  removingRelationId,
  selectedAttachmentId,
  uploadingAttachment,
  setSelectedAttachmentId,
  setInspectorCommentText,
  onRenameInspectorAttachment,
  onMoveInspectorAttachment,
  onDetachInspectorAttachment,
  onAttachFile,
  onAddRelation,
  onRemoveRelation,
  onInsertRecordCommentMention,
  onAddRecordComment,
  onOpenBacklink,
  inspectorMutationPaneCanEdit,
}: RecordInspectorSharedSectionsProps): ReactElement => (
  <>
    <RecordInspectorAttachmentsSection
      attachments={inspectorRecord.attachments}
      panes={panes}
      selectedAttachmentId={selectedAttachmentId}
      inspectorMutationPaneCanEdit={inspectorMutationPaneCanEdit}
      uploadingAttachment={uploadingAttachment}
      setSelectedAttachmentId={setSelectedAttachmentId}
      onRenameAttachment={onRenameInspectorAttachment}
      onMoveAttachment={onMoveInspectorAttachment}
      onDetachAttachment={onDetachInspectorAttachment}
      onAttachFile={onAttachFile}
    />

    <RelationsSection
      accessToken={accessToken}
      projectId={projectId}
      recordId={inspectorRecord.record_id}
      relationFields={inspectorRelationFields as RelationsSectionProps['relationFields']}
      outgoing={inspectorRecord.relations.outgoing}
      incoming={inspectorRecord.relations.incoming}
      removingRelationId={removingRelationId}
      mutationError={relationMutationError}
      readOnly={!inspectorMutationPaneCanEdit}
      onAddRelation={onAddRelation}
      onRemoveRelation={onRemoveRelation}
    />

    <RecordInspectorCommentsSection
      accessToken={accessToken}
      projectId={projectId}
      comments={inspectorRecord.comments}
      inspectorCommentText={inspectorCommentText}
      setInspectorCommentText={setInspectorCommentText}
      onInsertRecordCommentMention={onInsertRecordCommentMention}
      onAddRecordComment={onAddRecordComment}
    />

    <BacklinksPanel
      backlinks={inspectorBacklinks as ComponentProps<typeof BacklinksPanel>['backlinks']}
      loading={inspectorBacklinksLoading}
      error={inspectorBacklinksError}
      onOpenBacklink={onOpenBacklink}
    />

    <RecordInspectorActivitySection activity={inspectorRecord.activity} />
  </>
);
