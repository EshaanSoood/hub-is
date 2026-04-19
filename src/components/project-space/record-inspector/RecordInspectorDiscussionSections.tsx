import { BacklinksPanel } from '../BacklinksPanel';
import { RecordInspectorActivitySection } from './RecordInspectorActivitySection';
import { RecordInspectorCommentsSection } from './RecordInspectorCommentsSection';
import type { ComponentProps, ReactElement } from 'react';
import type { HubRecordDetail } from '../../../shared/api-types/records';
import type { RecordInspectorSharedSectionsProps } from './recordInspectorTypes';

type RecordInspectorDiscussionSectionsProps = Pick<
  RecordInspectorSharedSectionsProps,
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
      backlinks={inspectorBacklinks as ComponentProps<typeof BacklinksPanel>['backlinks']}
      loading={inspectorBacklinksLoading}
      error={inspectorBacklinksError}
      onOpenBacklink={onOpenBacklink}
    />

    <RecordInspectorActivitySection activity={inspectorRecord.activity} />
  </>
);
