import { InlineNotice } from '../../primitives';
import { buildProjectContextHref, buildProjectWorkHref } from '../../../lib/hubRoutes';
import { withHubMotionState } from '../../../lib/hubMotionState';
import type { ReactElement } from 'react';
import { EventRecordInspector } from './EventRecordInspector';
import { FileRecordInspector } from './FileRecordInspector';
import { GenericRecordInspector } from './GenericRecordInspector';
import { ReminderRecordInspector } from './ReminderRecordInspector';
import { TaskRecordInspector } from './TaskRecordInspector';
import { resolveRecordInspectorKind } from './recordInspectorKinds';
import type { RecordInspectorBodyProps } from './recordInspectorTypes';
import type { HubRecordDetail } from '../../../shared/api-types/records';

export interface RecordInspectorBodyRouterProps extends Omit<RecordInspectorBodyProps, 'projectId' | 'inspectorRecord' | 'onOpenSourceProject'> {
  project: { space_id: string; name: string };
  inspectorLoading: boolean;
  inspectorError: string | null;
  inspectorRecord: HubRecordDetail | null;
  navigate: (to: string, options?: { state?: unknown }) => void;
  closeInspectorWithFocusRestore: () => void;
}

export const RecordInspectorBodyRouter = ({
  inspectorLoading,
  inspectorError,
  inspectorRecord,
  project,
  navigate,
  closeInspectorWithFocusRestore,
  ...props
}: RecordInspectorBodyRouterProps): ReactElement => {
  const onOpenSourceProject = inspectorRecord?.source_project?.project_id
    ? () => {
        const targetHref = buildProjectContextHref({
          projectId: project.space_id,
          sourceProject: inspectorRecord.source_project,
          fallbackHref: buildProjectWorkHref(project.space_id),
        });
        closeInspectorWithFocusRestore();
        navigate(targetHref, {
          state: withHubMotionState(undefined, {
            hubProjectName: inspectorRecord.source_project?.project_name || inspectorRecord.source_project?.project_id || undefined,
            hubProjectSource: 'click',
          }),
        });
      }
    : null;

  const bodyProps: RecordInspectorBodyProps | null = inspectorRecord
    ? {
        ...props,
        projectId: project.space_id,
        inspectorRecord,
        onOpenSourceProject,
      }
    : null;

  let body: ReactElement | null = null;

  if (bodyProps) {
    const inspectorKind = resolveRecordInspectorKind(bodyProps.inspectorRecord);
    if (inspectorKind === 'event') {
      body = <EventRecordInspector {...bodyProps} />;
    } else if (inspectorKind === 'task') {
      body = <TaskRecordInspector {...bodyProps} />;
    } else if (inspectorKind === 'file') {
      body = <FileRecordInspector {...bodyProps} />;
    } else if (inspectorKind === 'reminder') {
      body = <ReminderRecordInspector {...bodyProps} />;
    } else {
      body = <GenericRecordInspector {...bodyProps} />;
    }
  }

  return (
    <>
      {inspectorLoading ? <p className="mt-3 text-sm text-muted">Loading record...</p> : null}
      {inspectorError ? (
        <InlineNotice variant="danger" className="mt-3" title="Record inspector error">
          {inspectorError}
        </InlineNotice>
      ) : null}
      {body}
    </>
  );
};
