import type { ComponentProps, FormEvent } from 'react';
import type { HubBacklink, HubPaneSummary } from '../../../services/hub/types';
import type { HubRecordDetail } from '../../../shared/api-types/records';
import type { RelationsSection } from '../RelationsSection';
import type { RecordInspectorCommentsSectionProps } from './RecordInspectorCommentsSection';

type RelationsSectionProps = ComponentProps<typeof RelationsSection>;

export interface RecordInspectorSectionProps {
  accessToken: string;
  projectId: string;
  panes: HubPaneSummary[];
  inspectorRecord: HubRecordDetail;
  inspectorRelationFields: unknown[];
  inspectorBacklinks: unknown[];
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
  onMoveInspectorAttachment: (attachmentId: string, paneIdToMove: string) => Promise<void>;
  onDetachInspectorAttachment: (attachmentId: string) => Promise<void>;
  onAttachFile: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onAddRelation: RelationsSectionProps['onAddRelation'];
  onRemoveRelation: (relationId: string) => Promise<void>;
  onInsertRecordCommentMention: RecordInspectorCommentsSectionProps['onInsertRecordCommentMention'];
  onAddRecordComment: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onOpenBacklink: (backlink: HubBacklink) => void;
  inspectorMutationPaneCanEdit: boolean;
}

export interface RecordInspectorBodyProps extends RecordInspectorSectionProps {
  inspectorMutationPane: HubPaneSummary | null;
  savingValues: boolean;
  onSaveRecordField: (fieldId: string, value: string) => Promise<void>;
  onOpenSourcePane: (() => void) | null;
}
