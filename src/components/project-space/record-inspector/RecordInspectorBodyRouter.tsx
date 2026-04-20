import { InlineNotice } from '../../primitives';
import { buildPaneContextHref, buildProjectWorkHref } from '../../../lib/hubRoutes';
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

export interface RecordInspectorBodyRouterProps extends Omit<RecordInspectorBodyProps, 'projectId' | 'inspectorRecord' | 'onOpenSourcePane'> {
  project: { project_id: string; name: string };
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
  const onOpenSourcePane = inspectorRecord?.source_pane?.pane_id
    ? () => {
        const targetHref = buildPaneContextHref({
          projectId: project.project_id,
          sourcePane: inspectorRecord.source_pane,
          fallbackHref: buildProjectWorkHref(project.project_id),
        });
        closeInspectorWithFocusRestore();
        navigate(targetHref, {
          state: withHubMotionState(undefined, {
            hubProjectName: project.name,
            hubPaneName: inspectorRecord.source_pane?.pane_name || inspectorRecord.source_pane?.pane_id || undefined,
            hubPaneSource: 'click',
          }),
        });
      }
    : null;

  const bodyProps: RecordInspectorBodyProps | null = inspectorRecord
    ? {
        ...props,
        projectId: project.project_id,
        inspectorRecord,
        onOpenSourcePane,
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
