import { BacklinksPanel } from '../BacklinksPanel';
import { RecordInspectorActivitySection } from './RecordInspectorActivitySection';
import { RecordInspectorCommentsSection } from './RecordInspectorCommentsSection';
import type { ReactElement } from 'react';
import type { HubRecordDetail } from '../../../shared/api-types/records';
import type { RecordInspectorSectionProps } from './recordInspectorTypes';

type RecordInspectorDiscussionSectionsProps = Pick<
  RecordInspectorSectionProps,
  | 'accessToken'
  | 'projectId'
  | 'inspectorBacklinks'
  | 'inspectorBacklinksLoading'
  | 'inspectorBacklinksError'
  | 'inspectorCommentText'
  | 'setInspectorCommentText'
  | 'onInsertRecordCommentMention'
  | 'onAddRecordComment'
  | 'onOpenBacklink'
> & {
  inspectorRecord: HubRecordDetail;
};

export const RecordInspectorDiscussionSections = ({
  accessToken,
  projectId,
  inspectorBacklinks,
  inspectorBacklinksLoading,
  inspectorBacklinksError,
  inspectorCommentText,
  setInspectorCommentText,
  onInsertRecordCommentMention,
  onAddRecordComment,
  onOpenBacklink,
  inspectorRecord,
}: RecordInspectorDiscussionSectionsProps): ReactElement => (
  <>
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
      backlinks={inspectorBacklinks}
      loading={inspectorBacklinksLoading}
      error={inspectorBacklinksError}
      onOpenBacklink={onOpenBacklink}
    />

    <RecordInspectorActivitySection activity={inspectorRecord.activity} />
  </>
);
