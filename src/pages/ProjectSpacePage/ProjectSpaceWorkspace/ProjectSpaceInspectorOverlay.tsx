import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../../components/project-space/ProjectSpaceDialogPrimitives';
import { BacklinksPanel } from '../../../components/project-space/BacklinksPanel';
import { RelationsSection } from '../../../components/project-space/RelationsSection';
import { Icon, InlineNotice } from '../../../components/primitives';
import { buildPaneContextHref, buildProjectWorkHref } from '../../../lib/hubRoutes';
import { withHubMotionState } from '../../../lib/hubMotionState';
import { dialogLayoutIds } from '../../../styles/motion';
import { motion } from 'framer-motion';
import type { ComponentProps, ReactElement, RefObject } from 'react';
import type { HubBacklink, HubPaneSummary, HubProject } from '../../../services/hub/types';
import type { HubRecordDetail } from '../../../shared/api-types/records';
import { ProjectSpaceInspectorOverlayActivitySection } from './ProjectSpaceInspectorOverlayActivitySection';
import { ProjectSpaceInspectorOverlayAttachmentsSection } from './ProjectSpaceInspectorOverlayAttachmentsSection';
import { ProjectSpaceInspectorOverlayCommentsSection } from './ProjectSpaceInspectorOverlayCommentsSection';
import type { FormEvent } from 'react';

type RelationsSectionProps = ComponentProps<typeof RelationsSection>;

export interface ProjectSpaceInspectorOverlayProps {
  accessToken: string;
  project: HubProject;
  panes: HubPaneSummary[];
  inspectorTriggerRect: { top: number; left: number; width: number; height: number } | null;
  inspectorTriggerRef: RefObject<HTMLElement | null>;
  prefersReducedMotion: boolean;
  inspectorLoading: boolean;
  inspectorError: string | null;
  inspectorRecord: HubRecordDetail | null;
  inspectorRecordId: string | null;
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
  onInsertRecordCommentMention: ComponentProps<typeof ProjectSpaceInspectorOverlayCommentsSection>['onInsertRecordCommentMention'];
  onAddRecordComment: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onOpenBacklink: (backlink: HubBacklink) => void;
}

const InspectorPlaceholder = ({
  inspectorTriggerRect,
}: {
  inspectorTriggerRect: { top: number; left: number; width: number; height: number };
}): ReactElement => (
  <motion.div
    layoutId={dialogLayoutIds.recordInspector}
    aria-hidden="true"
    className="inspector-placeholder"
    initial={false}
    animate={{
      x: inspectorTriggerRect.left,
      y: inspectorTriggerRect.top,
      width: inspectorTriggerRect.width,
      height: inspectorTriggerRect.height,
    }}
  />
);

export const ProjectSpaceInspectorOverlay = ({
  accessToken,
  project,
  panes,
  inspectorTriggerRect,
  inspectorTriggerRef,
  prefersReducedMotion,
  inspectorLoading,
  inspectorError,
  inspectorRecord,
  inspectorRecordId,
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
}: ProjectSpaceInspectorOverlayProps): ReactElement => (
  <>
    {!prefersReducedMotion && inspectorTriggerRect ? <InspectorPlaceholder inspectorTriggerRect={inspectorTriggerRect} /> : null}

    <Dialog open={Boolean(inspectorRecordId)} onOpenChange={(open) => (!open ? closeInspectorWithFocusRestore() : undefined)}>
      <DialogContent
        open={Boolean(inspectorRecordId)}
        animated
        layoutId={dialogLayoutIds.recordInspector}
        motionVariant="fold-sheet"
        className="dialog-panel-sheet-size !left-0 !top-0 h-screen !translate-x-0 !translate-y-0 overflow-y-auto rounded-none sm:!rounded-none border-r border-border-muted"
        onCloseAutoFocus={(event) => {
          if (inspectorTriggerRef.current) {
            event.preventDefault();
            inspectorTriggerRef.current.focus();
          }
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <DialogHeader className="min-w-0 flex-1">
            <DialogTitle>Record Inspector</DialogTitle>
            <DialogDescription className="sr-only">
              Quick dismissible inspector. Press Escape or close to return focus to the invoking control.
            </DialogDescription>
          </DialogHeader>
          <DialogClose
            aria-label="Close inspector"
            className="inline-flex h-9 w-9 items-center justify-center rounded-panel border border-border-muted text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            <Icon name="close" className="h-4 w-4" />
          </DialogClose>
        </div>

        {inspectorLoading ? <p className="mt-3 text-sm text-muted">Loading record...</p> : null}
        {inspectorError ? (
          <InlineNotice variant="danger" className="mt-3" title="Record inspector error">
            {inspectorError}
          </InlineNotice>
        ) : null}

        {inspectorRecord ? (
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

            <ProjectSpaceInspectorOverlayAttachmentsSection
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

            <ProjectSpaceInspectorOverlayCommentsSection
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

            <ProjectSpaceInspectorOverlayActivitySection activity={inspectorRecord.activity} />
          </div>
        ) : null}

        <div className="mt-4">
          <DialogClose className="rounded-panel border border-border-muted px-3 py-1.5 text-sm font-semibold text-primary">
            Close inspector
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  </>
);
