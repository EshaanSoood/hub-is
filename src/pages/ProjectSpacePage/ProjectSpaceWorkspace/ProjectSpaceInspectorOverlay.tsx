import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../../components/project-space/ProjectSpaceDialogPrimitives';
import { BacklinksPanel } from '../../../components/project-space/BacklinksPanel';
import { FileInspectorActionBar } from '../../../components/project-space/FileInspectorActionBar';
import { MentionPicker } from '../../../components/project-space/MentionPicker';
import { RelationsSection } from '../../../components/project-space/RelationsSection';
import { Icon, InlineNotice } from '../../../components/primitives';
import { buildPaneContextHref, buildProjectWorkHref } from '../../../lib/hubRoutes';
import { withHubMotionState } from '../../../lib/hubMotionState';
import { dialogLayoutIds } from '../../../styles/motion';
import { motion } from 'framer-motion';
import type { ComponentProps, FormEvent, ReactElement, RefObject } from 'react';
import type { HubBacklink, HubPaneSummary, HubProject } from '../../../services/hub/types';
import type { HubRecordDetail } from '../../../shared/api-types/records';
import { readPlainComment } from './commentModel';

type RelationsSectionProps = ComponentProps<typeof RelationsSection>;
type MentionPickerProps = ComponentProps<typeof MentionPicker>;

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
  onInsertRecordCommentMention: MentionPickerProps['onSelect'];
  onAddRecordComment: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onOpenBacklink: (backlink: HubBacklink) => void;
}

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
    {!prefersReducedMotion && inspectorTriggerRect ? (
      <motion.div
        layoutId={dialogLayoutIds.recordInspector}
        aria-hidden="true"
        className="pointer-events-none fixed z-[299] opacity-0"
        style={{
          top: inspectorTriggerRect.top,
          left: inspectorTriggerRect.left,
          width: inspectorTriggerRect.width,
          height: inspectorTriggerRect.height,
        }}
      />
    ) : null}

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
                      defaultValue={String(inspectorRecord.values[field.field_id] || '')}
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

            <section className="rounded-panel border border-border-muted p-3">
              <h3 className="text-sm font-semibold text-primary">Attachments</h3>
              {inspectorRecord.attachments.length > 0 ? (
                <div className="mt-2 space-y-2">
                  <div className="flex flex-wrap gap-1">
                    {inspectorRecord.attachments.map((attachment) => {
                      const selected = selectedAttachmentId === attachment.attachment_id;
                      return (
                        <button
                          key={attachment.attachment_id}
                          type="button"
                          onClick={() => setSelectedAttachmentId(attachment.attachment_id)}
                          aria-pressed={selected}
                          className={`rounded-control border px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
                            selected
                              ? 'border-primary text-text bg-primary/10'
                              : 'border-border-muted text-muted bg-transparent'
                          }`}
                        >
                          {attachment.name}
                        </button>
                      );
                    })}
                  </div>

                  {selectedAttachmentId ? (
                    <FileInspectorActionBar
                      fileName={
                        inspectorRecord.attachments.find((attachment) => attachment.attachment_id === selectedAttachmentId)?.name ||
                        'Attachment'
                      }
                      downloadUrl={
                        inspectorRecord.attachments.find((attachment) => attachment.attachment_id === selectedAttachmentId)?.proxy_url || ''
                      }
                      shareableLink={
                        inspectorRecord.attachments.find((attachment) => attachment.attachment_id === selectedAttachmentId)?.proxy_url || ''
                      }
                      panes={panes.map((pane) => ({ id: pane.pane_id, name: pane.name }))}
                      readOnly={!inspectorMutationPaneCanEdit}
                      onRename={(nextName) => {
                        void onRenameInspectorAttachment(selectedAttachmentId, nextName);
                      }}
                      onMove={(paneIdToMove) => {
                        void onMoveInspectorAttachment(selectedAttachmentId, paneIdToMove);
                      }}
                      onRemove={() => {
                        void onDetachInspectorAttachment(selectedAttachmentId);
                      }}
                    />
                  ) : null}

                  <ul className="space-y-1">
                    {inspectorRecord.attachments.map((attachment) => (
                      <li key={attachment.attachment_id} className="text-sm text-muted">
                        {attachment.name} ({attachment.mime_type})
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted">No attachments yet.</p>
              )}
              {inspectorMutationPaneCanEdit ? (
                <form className="mt-2 flex flex-wrap items-center gap-2" onSubmit={(event) => {
                  void onAttachFile(event);
                }}>
                  <input name="attachment-file" type="file" className="text-xs text-muted" aria-label="Attach file" />
                  <button
                    type="submit"
                    disabled={uploadingAttachment}
                    className="inline-flex items-center gap-1 rounded-panel border border-border-muted px-2 py-1 text-xs font-semibold text-primary disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Icon name="upload" className="text-[12px]" />
                    {uploadingAttachment ? 'Uploading...' : 'Attach'}
                  </button>
                </form>
              ) : (
                <p className="mt-2 text-xs text-muted">Attachments are read-only in this pane.</p>
              )}
            </section>

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

            <section className="rounded-panel border border-border-muted p-3">
              <h3 className="text-sm font-semibold text-primary">Comments + Mentions</h3>
              <ul className="mt-2 space-y-2">
                {inspectorRecord.comments.map((comment) => (
                  <li key={comment.comment_id} className="rounded-panel border border-border-muted p-2">
                    <p className="text-sm text-text">{readPlainComment(comment.body_json)}</p>
                    <p className="text-xs text-muted">{comment.status}</p>
                  </li>
                ))}
              </ul>

              <form className="mt-2 space-y-2" onSubmit={(event) => {
                void onAddRecordComment(event);
              }}>
                <textarea
                  value={inspectorCommentText}
                  onChange={(event) => setInspectorCommentText(event.target.value)}
                  className="w-full rounded-panel border border-border-muted bg-surface px-3 py-2 text-sm text-text"
                  rows={3}
                  placeholder="Type comment. Use mention picker for users/records."
                  aria-label="Record comment"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <MentionPicker
                    accessToken={accessToken}
                    projectId={project.project_id}
                    onSelect={onInsertRecordCommentMention}
                    buttonLabel="@ Mention"
                    ariaLabel="Add mention to record comment"
                  />
                  <button
                    type="submit"
                    className="rounded-panel border border-border-muted px-3 py-1.5 text-sm font-semibold text-primary"
                  >
                    Add comment
                  </button>
                </div>
              </form>
            </section>

            <BacklinksPanel
              backlinks={inspectorBacklinks as ComponentProps<typeof BacklinksPanel>['backlinks']}
              loading={inspectorBacklinksLoading}
              error={inspectorBacklinksError}
              onOpenBacklink={onOpenBacklink}
            />

            <section className="rounded-panel border border-border-muted p-3">
              <h3 className="text-sm font-semibold text-primary">Activity</h3>
              <ul className="mt-2 space-y-1">
                {inspectorRecord.activity.map((entry) => (
                  <li key={entry.timeline_event_id} className="text-xs text-muted">
                    {entry.event_type} · {new Date(entry.created_at).toLocaleString()}
                  </li>
                ))}
              </ul>
            </section>
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
