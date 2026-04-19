import { BacklinksPanel } from '../BacklinksPanel';
import { RelationsSection } from '../RelationsSection';
import { InlineNotice } from '../../primitives';
import { buildPaneContextHref, buildProjectWorkHref } from '../../../lib/hubRoutes';
import { withHubMotionState } from '../../../lib/hubMotionState';
import { RecordInspectorActivitySection } from './RecordInspectorActivitySection';
import { RecordInspectorAttachmentsSection } from './RecordInspectorAttachmentsSection';
import { RecordInspectorCommentsSection, type RecordInspectorCommentsSectionProps } from './RecordInspectorCommentsSection';
import type { ComponentProps, FormEvent, ReactElement } from 'react';
import type { HubBacklink, HubPaneSummary, HubProject } from '../../../services/hub/types';
import type { HubRecordDetail } from '../../../shared/api-types/records';

type RelationsSectionProps = ComponentProps<typeof RelationsSection>;

export interface RecordInspectorBodyRouterProps {
  accessToken: string;
  project: HubProject;
  panes: HubPaneSummary[];
  inspectorLoading: boolean;
  inspectorError: string | null;
  inspectorRecord: HubRecordDetail | null;
  inspectorMutationPane: HubPaneSummary | null;
  inspectorMutationPaneCanEdit: boolean;
  inspectorRelationFields: unknown[];
  inspectorBacklinks: unknown[];
  inspectorBacklinksLoading: boolean;
  inspectorBacklinksError: string | null;
  inspectorCommentText: string;
  relationMutationError: string | null;
  removingRelationId: string | null;
  savingValues: boolean;
  selectedAttachmentId: string | null;
  uploadingAttachment: boolean;
  setSelectedAttachmentId: (attachmentId: string | null) => void;
  setInspectorCommentText: (nextValue: string) => void;
  closeInspectorWithFocusRestore: () => void;
  navigate: (to: string, options?: { state?: unknown }) => void;
  onSaveRecordField: (fieldId: string, value: string) => Promise<void>;
  onRenameInspectorAttachment: (attachmentId: string, nextName: string) => Promise<void>;
  onMoveInspectorAttachment: (attachmentId: string, paneIdToMove: string) => Promise<void>;
  onDetachInspectorAttachment: (attachmentId: string) => Promise<void>;
  onAttachFile: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onAddRelation: RelationsSectionProps['onAddRelation'];
  onRemoveRelation: (relationId: string) => Promise<void>;
  onInsertRecordCommentMention: RecordInspectorCommentsSectionProps['onInsertRecordCommentMention'];
  onAddRecordComment: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onOpenBacklink: (backlink: HubBacklink) => void;
}

const GenericRecordInspectorBody = ({
  accessToken,
  project,
  panes,
  inspectorRecord,
  inspectorMutationPane,
  inspectorMutationPaneCanEdit,
  inspectorRelationFields,
  inspectorBacklinks,
  inspectorBacklinksLoading,
  inspectorBacklinksError,
  inspectorCommentText,
  relationMutationError,
  removingRelationId,
  savingValues,
  selectedAttachmentId,
  uploadingAttachment,
  setSelectedAttachmentId,
  setInspectorCommentText,
  closeInspectorWithFocusRestore,
  navigate,
  onSaveRecordField,
  onRenameInspectorAttachment,
  onMoveInspectorAttachment,
  onDetachInspectorAttachment,
  onAttachFile,
  onAddRelation,
  onRemoveRelation,
  onInsertRecordCommentMention,
  onAddRecordComment,
  onOpenBacklink,
}: Omit<RecordInspectorBodyRouterProps, 'inspectorLoading' | 'inspectorError'> & {
  inspectorRecord: HubRecordDetail;
}): ReactElement => (
  <div className="mt-4 space-y-4">
    <section className="rounded-panel border border-border-muted p-3">
      <h3 className="text-sm font-semibold text-primary">{inspectorRecord.title}</h3>
      <p className="mt-1 text-xs text-muted">Collection: {inspectorRecord.schema?.name || inspectorRecord.collection_id}</p>
      {inspectorRecord.source_pane?.pane_id ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
          <span>Origin: {inspectorRecord.source_pane.pane_name || inspectorRecord.source_pane.pane_id}</span>
          <button
            type="button"
            className="rounded-panel border border-border-muted px-2 py-1 text-xs font-semibold text-primary"
            onClick={() => {
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
            }}
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
          You can review this record and add comments, but only pane editors can change fields, attachments, or relations.
        </p>
      ) : null}
      <div className="mt-2 space-y-2">
        {inspectorRecord.schema?.fields.map((field) => (
          <label key={field.field_id} className="flex flex-col gap-1 text-xs text-muted">
            {field.name}
            <input
              defaultValue={String(inspectorRecord.values[field.field_id] ?? '')}
              disabled={!inspectorMutationPaneCanEdit}
              className="rounded-panel border border-border-muted bg-surface px-2 py-1 text-sm text-text"
              onBlur={(event) => {
                if (inspectorMutationPaneCanEdit) {
                  void onSaveRecordField(field.field_id, event.target.value);
                }
              }}
            />
          </label>
        ))}
      </div>
      {savingValues ? <p className="mt-2 text-xs text-muted">Saving...</p> : null}
    </section>

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
      projectId={project.project_id}
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
      projectId={project.project_id}
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
  </div>
);

export const RecordInspectorBodyRouter = ({
  inspectorLoading,
  inspectorError,
  inspectorRecord,
  ...props
}: RecordInspectorBodyRouterProps): ReactElement => (
  <>
    {inspectorLoading ? <p className="mt-3 text-sm text-muted">Loading record...</p> : null}
    {inspectorError ? (
      <InlineNotice variant="danger" className="mt-3" title="Record inspector error">
        {inspectorError}
      </InlineNotice>
    ) : null}
    {inspectorRecord ? <GenericRecordInspectorBody {...props} inspectorRecord={inspectorRecord} /> : null}
  </>
);
