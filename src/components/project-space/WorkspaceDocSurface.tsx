import {
  Suspense,
  lazy,
  type ComponentProps,
  type Dispatch,
  type FormEvent,
  type ReactElement,
  type RefObject,
  type SetStateAction,
} from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { HubPaneSummary, HubProjectMember, HubView } from '../../services/hub/types';
import { dialogLayoutIds } from '../../styles/motion';
import { Icon, InlineNotice } from '../primitives';
import { CommentComposer } from './CommentComposer';
import { CommentRail } from './CommentRail';
import { MentionPicker } from './MentionPicker';
import { ModuleLoadingState } from './ModuleFeedback';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ProjectSpaceDialogPrimitives';
import { useWorkspaceDocAssetFlow } from './useWorkspaceDocAssetFlow';

const CollaborativeLexicalEditor = lazy(async () => {
  const module = await import('../../features/notes/CollaborativeLexicalEditor');
  return { default: module.CollaborativeLexicalEditor };
});

type CollaborativeLexicalEditorProps = ComponentProps<typeof CollaborativeLexicalEditor>;
type CommentRailProps = ComponentProps<typeof CommentRail>;

export interface WorkspaceDocSurfaceProps {
  accessToken: string;
  projectId: string;
  projectMembers: HubProjectMember[];
  sessionUserId: string;
  activePane: HubPaneSummary | null;
  activePaneCanEdit: boolean;
  workspaceEnabled: boolean;
  activePaneDocId: string | null;
  docBootstrapReady: boolean;
  docBootstrapLexicalState: CollaborativeLexicalEditorProps['initialLexicalState'];
  collabSession: CollaborativeLexicalEditorProps['collaborationSession'];
  collabSessionError: string | null;
  onDocEditorChange: CollaborativeLexicalEditorProps['onDocumentChange'];
  selectedDocNodeKey: string | null;
  setSelectedDocNodeKey: (nextNodeKey: string | null) => void;
  pendingDocFocusNodeKey: string | null;
  setPendingDocFocusNodeKey: (nextNodeKey: string | null) => void;
  pendingDocMentionInsert: CollaborativeLexicalEditorProps['pendingMentionInsert'];
  setPendingDocMentionInsert: (value: null) => void;
  pendingViewEmbedInsert: CollaborativeLexicalEditorProps['pendingViewEmbedInsert'];
  setPendingViewEmbedInsert: (value: null) => void;
  pendingDocAssetEmbed: CollaborativeLexicalEditorProps['pendingAssetEmbed'];
  setPendingDocAssetEmbed: (value: null) => void;
  onInsertDocMention: ComponentProps<typeof MentionPicker>['onSelect'];
  views: HubView[];
  selectedEmbedViewId: string;
  setSelectedEmbedViewId: (value: string) => void;
  onInsertViewEmbed: () => void;
  onOpenRecord: (recordId: string) => void;
  onOpenEmbeddedView: (viewId: string) => void;
  uploadingDocAsset: boolean;
  onUploadDocAsset: (event: FormEvent<HTMLFormElement>) => void;
  docCommentComposerOpen: boolean;
  commentTriggerRef: RefObject<HTMLButtonElement | null>;
  onDocCommentDialogOpenChange: (open: boolean) => void;
  docCommentError: string | null;
  docCommentText: string;
  setDocCommentText: (nextValue: string) => void;
  onAddDocComment: () => void;
  docComments: CommentRailProps['comments'];
  orphanedDocComments: CommentRailProps['orphanedComments'];
  onResolveDocComment: CommentRailProps['onToggleStatus'];
  onJumpToDocComment: CommentRailProps['onJumpToComment'];
  showResolvedDocComments: boolean;
  setShowResolvedDocComments: Dispatch<SetStateAction<boolean>>;
}

export const WorkspaceDocSurface = ({
  accessToken,
  projectId,
  projectMembers,
  sessionUserId,
  activePane,
  activePaneCanEdit,
  workspaceEnabled,
  activePaneDocId,
  docBootstrapReady,
  docBootstrapLexicalState,
  collabSession,
  collabSessionError,
  onDocEditorChange,
  selectedDocNodeKey,
  setSelectedDocNodeKey,
  pendingDocFocusNodeKey,
  setPendingDocFocusNodeKey,
  pendingDocMentionInsert,
  setPendingDocMentionInsert,
  pendingViewEmbedInsert,
  setPendingViewEmbedInsert,
  pendingDocAssetEmbed,
  setPendingDocAssetEmbed,
  onInsertDocMention,
  views,
  selectedEmbedViewId,
  setSelectedEmbedViewId,
  onInsertViewEmbed,
  onOpenRecord,
  onOpenEmbeddedView,
  uploadingDocAsset,
  onUploadDocAsset,
  docCommentComposerOpen,
  commentTriggerRef,
  onDocCommentDialogOpenChange,
  docCommentError,
  docCommentText,
  setDocCommentText,
  onAddDocComment,
  docComments,
  orphanedDocComments,
  onResolveDocComment,
  onJumpToDocComment,
  showResolvedDocComments,
  setShowResolvedDocComments,
}: WorkspaceDocSurfaceProps): ReactElement | null => {
  const prefersReducedMotion = useReducedMotion();
  const mountedDocId = docBootstrapReady ? activePaneDocId : null;
  const {
    docAssetFormRef,
    docAssetInputRef,
    uploadDisabled,
    onDocAssetInputChange,
    onDocAssetUploadClick,
    onDocAssetFormSubmit,
  } = useWorkspaceDocAssetFlow({
    uploadingDocAsset,
    onUploadDocAsset,
  });

  if (!activePane) {
    return null;
  }

  if (!workspaceEnabled) {
    return (
      <section className="rounded-panel border border-subtle bg-elevated p-4">
        <h3 className="heading-3 text-primary">Workspace Doc</h3>
        <p className="mt-2 text-sm text-muted">This project is set to modules-only mode. The workspace doc is hidden here.</p>
      </section>
    );
  }

  return (
    <>
      <section className="rounded-panel border border-subtle bg-elevated p-4">
        <h3 className="heading-3 text-primary">Workspace Doc</h3>
        {mountedDocId ? (
          <>
            <div className="relative">
              <Suspense fallback={<ModuleLoadingState label="Loading collaborative editor" rows={8} />}>
                <CollaborativeLexicalEditor
                  key={mountedDocId}
                  noteId={mountedDocId}
                  initialLexicalState={docBootstrapLexicalState}
                  collaborationSession={collabSession}
                  userName={projectMembers.find((member) => member.user_id === sessionUserId)?.display_name || 'Current user'}
                  editable={activePaneCanEdit}
                  onDocumentChange={onDocEditorChange}
                  onSelectedNodeChange={setSelectedDocNodeKey}
                  focusNodeKey={pendingDocFocusNodeKey}
                  onNodeFocused={() => setPendingDocFocusNodeKey(null)}
                  pendingMentionInsert={pendingDocMentionInsert}
                  onMentionInserted={(insertId) => {
                    if (pendingDocMentionInsert?.insert_id === insertId) {
                      setPendingDocMentionInsert(null);
                    }
                  }}
                  pendingViewEmbedInsert={pendingViewEmbedInsert}
                  onViewEmbedInserted={(insertId) => {
                    if (pendingViewEmbedInsert?.insert_id === insertId) {
                      setPendingViewEmbedInsert(null);
                    }
                  }}
                  pendingAssetEmbed={pendingDocAssetEmbed}
                  onAssetEmbedApplied={(embedId) => {
                    if (pendingDocAssetEmbed?.embed_id === embedId) {
                      setPendingDocAssetEmbed(null);
                    }
                  }}
                  viewEmbedRuntime={{
                    accessToken,
                    onOpenRecord,
                    onOpenView: onOpenEmbeddedView,
                  }}
                />
              </Suspense>
            </div>
            {collabSessionError ? (
              <InlineNotice variant="danger" className="mt-2" title="Collaboration unavailable">
                {collabSessionError}
              </InlineNotice>
            ) : null}
            {activePaneCanEdit ? (
              <>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <MentionPicker
                    accessToken={accessToken}
                    projectId={projectId}
                    onSelect={onInsertDocMention}
                    buttonLabel="Insert mention"
                    ariaLabel="Insert mention into doc"
                  />
                  <label className="text-xs text-muted" htmlFor="embed-view-picker">
                    View
                  </label>
                  <select
                    id="embed-view-picker"
                    value={selectedEmbedViewId}
                    onChange={(event) => setSelectedEmbedViewId(event.target.value)}
                    className="rounded-panel border border-border-muted bg-surface px-2 py-1 text-xs text-text"
                    aria-label="View embed picker"
                  >
                    <option value="">Select a view</option>
                    {views.map((view) => (
                      <option key={view.view_id} value={view.view_id}>
                        {view.name} ({view.type})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={onInsertViewEmbed}
                    disabled={!selectedEmbedViewId}
                    className="rounded-panel border border-border-muted px-2 py-1 text-xs font-semibold text-primary disabled:opacity-60"
                    aria-label="Insert selected view embed"
                  >
                    Insert view block
                  </button>
                </div>
                <form ref={docAssetFormRef} className="mt-3 flex flex-wrap items-center gap-2" onSubmit={onDocAssetFormSubmit}>
                  <input
                    ref={docAssetInputRef}
                    name="doc-asset-file"
                    type="file"
                    className="hidden"
                    aria-hidden="true"
                    tabIndex={-1}
                    disabled={uploadDisabled}
                    onChange={onDocAssetInputChange}
                  />
                  <button
                    type="button"
                    onClick={onDocAssetUploadClick}
                    disabled={uploadDisabled}
                    className="inline-flex items-center gap-1 rounded-panel border border-border-muted px-2 py-1 text-xs font-semibold text-primary disabled:cursor-not-allowed disabled:opacity-60"
                    aria-label="Upload doc asset"
                  >
                    <Icon name="upload" className="h-3 w-3" />
                    {uploadingDocAsset ? 'Uploading...' : 'Upload + embed'}
                  </button>
                </form>
              </>
            ) : (
              <p className="mt-3 text-xs text-muted">Read-only doc mode. You can review the project and leave comments below.</p>
            )}
          </>
        ) : docBootstrapReady ? (
          <p className="mt-2 text-sm text-muted">Project doc unavailable.</p>
        ) : (
          <ModuleLoadingState label="Loading workspace doc" rows={8} />
        )}
      </section>

      {mountedDocId ? (
        <>
          <div className="rounded-panel border border-subtle bg-elevated p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted">
                Selected block: <span className="font-semibold text-primary">{selectedDocNodeKey || 'none'}</span>
              </p>
              <motion.button
                layoutId={!prefersReducedMotion && docCommentComposerOpen ? dialogLayoutIds.commentOnBlock : undefined}
                ref={commentTriggerRef}
                type="button"
                className="rounded-panel border border-border-muted px-3 py-1.5 text-xs font-semibold text-primary disabled:opacity-60"
                onClick={() => onDocCommentDialogOpenChange(true)}
                disabled={!selectedDocNodeKey}
                aria-label="Comment on block"
              >
                Comment on block
              </motion.button>
            </div>
          </div>

          <CommentRail
            comments={docComments}
            orphanedComments={orphanedDocComments}
            onToggleStatus={(commentId, status) => {
              void onResolveDocComment(commentId, status);
            }}
            onJumpToComment={onJumpToDocComment}
            showResolved={showResolvedDocComments}
            onToggleShowResolved={() => setShowResolvedDocComments((current) => !current)}
          />

          <Dialog open={docCommentComposerOpen} onOpenChange={onDocCommentDialogOpenChange}>
            <DialogContent open={docCommentComposerOpen} animated layoutId={dialogLayoutIds.commentOnBlock}>
              <DialogHeader>
                <DialogTitle>Comment on block</DialogTitle>
                <DialogDescription className="sr-only">
                  Add a node-anchored comment for block {selectedDocNodeKey || 'unknown'}.
                </DialogDescription>
              </DialogHeader>
              {docCommentError ? (
                <InlineNotice variant="danger" title="Doc comment failed">
                  {docCommentError}
                </InlineNotice>
              ) : null}
              <CommentComposer
                accessToken={accessToken}
                projectId={projectId}
                value={docCommentText}
                onChange={setDocCommentText}
                onSubmit={() => {
                  void onAddDocComment();
                }}
                onCancel={() => onDocCommentDialogOpenChange(false)}
                disabled={!selectedDocNodeKey || !docCommentText.trim()}
                submitLabel="Add node comment"
                placeholder="Comment on selected block"
                nodeKeyLabel={selectedDocNodeKey}
              />
            </DialogContent>
          </Dialog>
        </>
      ) : null}
    </>
  );
};
