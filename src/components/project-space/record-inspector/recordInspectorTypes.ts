import type { FormEvent } from 'react';
import type { RelationFieldOption } from '../RelationPicker';
import type { HubBacklink, HubProjectSummary } from '../../../services/hub/types';
import type { HubRecordDetail } from '../../../shared/api-types/records';
import type { RecordInspectorCommentsSectionProps } from './RecordInspectorCommentsSection';

export interface RecordInspectorSectionProps {
  accessToken: string;
  projectId: string;
  projects: HubProjectSummary[];
  inspectorRecord: HubRecordDetail;
  inspectorRelationFields: RelationFieldOption[];
  inspectorBacklinks: HubBacklink[];
  inspectorBacklinksLoading: boolean;
  inspectorBacklinksError: string | null;
  inspectorCommentText: string;
  relationMutationError: string | null;
  removingRelationId: string | null;
  selectedAttachmentId: string | null;
  uploadingAttachment: boolean;
  setSelectedAttachmentId: (attachmentId: string | null) => void;
  setInspectorCommentText: (nextValue: string) => void;
  onRenameInspectorAttachment: (attachmentId: string, nextName: string) => Promise<void>;
  onMoveInspectorAttachment: (attachmentId: string, projectIdToMove: string) => Promise<void>;
  onDetachInspectorAttachment: (attachmentId: string) => Promise<void>;
  onAttachFile: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onAddRelation: (payload: { to_record_id: string; via_field_id: string }) => Promise<void>;
  onRemoveRelation: (relationId: string) => Promise<void>;
  onInsertRecordCommentMention: RecordInspectorCommentsSectionProps['onInsertRecordCommentMention'];
  onAddRecordComment: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onOpenBacklink: (backlink: HubBacklink) => void;
  inspectorMutationProjectCanEdit: boolean;
}

export interface RecordInspectorBodyProps extends RecordInspectorSectionProps {
  inspectorMutationProject: HubProjectSummary | null;
  savingValues: boolean;
  onSaveRecordField: (fieldId: string, value: unknown) => Promise<void>;
  onOpenSourceProject: (() => void) | null;
}
