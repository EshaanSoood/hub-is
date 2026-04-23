import { InlineNotice } from '../../../components/primitives';
import { ProjectSpaceFocusedViewSection } from '../../../pages/ProjectSpacePage/ProjectSpaceWorkspace/ProjectSpaceFocusedViewSection';
import { ProjectSpaceInspectorOverlay } from '../../../pages/ProjectSpacePage/ProjectSpaceWorkspace/ProjectSpaceInspectorOverlay';
import { WorkView } from '../../../components/project-space/WorkView';
import { WorkspaceDocSurface } from '../../../components/project-space/WorkspaceDocSurface';
import type { HubPaneSummary, HubProject, HubProjectMember } from '../../../services/hub/types';
import type { TimelineEvent } from '../../../pages/ProjectSpacePage/ProjectSpaceWorkspace/types';
import { RoomMigrationDialog } from './RoomMigrationDialog';
import { useRoomProjectWorkRuntime } from './useRoomProjectWorkRuntime';

interface RoomProjectSurfaceProps {
  accessToken: string;
  canMigrateToSpace: boolean;
  isArchived: boolean;
  roomId: string;
  roomName: string;
  pane: HubPaneSummary;
  project: HubProject;
  projectMembers: HubProjectMember[];
  roomProjectPanes: HubPaneSummary[];
  sessionUserId: string;
  refreshProjectData: () => Promise<void>;
  setPanes: React.Dispatch<React.SetStateAction<HubPaneSummary[]>>;
  timeline: TimelineEvent[];
  setTimeline: React.Dispatch<React.SetStateAction<TimelineEvent[]>>;
}

export const RoomProjectSurface = ({
  accessToken,
  canMigrateToSpace,
  isArchived,
  roomId,
  roomName,
  pane,
  project,
  projectMembers,
  roomProjectPanes,
  sessionUserId,
  refreshProjectData,
  setPanes,
  timeline,
  setTimeline,
}: RoomProjectSurfaceProps) => {
  const runtime = useRoomProjectWorkRuntime({
    accessToken,
    roomId,
    roomName,
    roomArchived: isArchived,
    pane,
    roomProjectPanes,
    project,
    sessionUserId,
    refreshProjectData,
    setPanes,
    timeline,
    setTimeline,
  });

  return (
    <section className="space-y-4">
      {canMigrateToSpace && !isArchived ? (
        <div className="flex justify-end">
          <RoomMigrationDialog
            accessToken={accessToken}
            roomId={roomId}
            pane={pane}
            parentSpaceId={project.project_id}
            parentSpaceName={project.name}
            onMigrated={refreshProjectData}
          />
        </div>
      ) : null}

      {isArchived ? (
        <InlineNotice variant="warning" title="Archived room">
          This room is read-only. Documents, tasks, and files in these projects can still be viewed.
        </InlineNotice>
      ) : null}

      <ProjectSpaceFocusedViewSection {...runtime.focusedViewProps} />

      <WorkView {...runtime.workViewProps} />

      {runtime.recordsError ? (
        <InlineNotice variant="danger" title="Views and records unavailable">
          {runtime.recordsError}
        </InlineNotice>
      ) : null}

      {runtime.projectTasksError ? (
        <InlineNotice variant="danger" title="Project tasks unavailable">
          {runtime.projectTasksError}
        </InlineNotice>
      ) : null}

      {runtime.paneMutationError ? (
        <InlineNotice variant="danger" title="Project update failed">
          {runtime.paneMutationError}
        </InlineNotice>
      ) : null}

      <WorkspaceDocSurface
        accessToken={accessToken}
        projectId={project.project_id}
        projectMembers={projectMembers}
        sessionUserId={sessionUserId}
        activePane={runtime.activePane}
        activePaneCanEdit={runtime.activePaneCanEdit}
        workspaceEnabled={runtime.workspaceEnabled}
        activePaneDocId={runtime.activePane.doc_id ?? null}
        docBootstrapReady={runtime.workspaceDoc.docBootstrapReady}
        docBootstrapLexicalState={runtime.workspaceDoc.docBootstrapLexicalState}
        collabSession={runtime.workspaceDoc.collabSession}
        collabSessionError={runtime.workspaceDoc.collabSessionError}
        onDocEditorChange={runtime.workspaceDoc.onDocEditorChange}
        selectedDocNodeKey={runtime.workspaceDoc.selectedDocNodeKey}
        setSelectedDocNodeKey={runtime.workspaceDoc.setSelectedDocNodeKey}
        pendingDocFocusNodeKey={runtime.workspaceDoc.pendingDocFocusNodeKey}
        setPendingDocFocusNodeKey={runtime.workspaceDoc.setPendingDocFocusNodeKey}
        pendingDocMentionInsert={runtime.workspaceDoc.pendingDocMentionInsert}
        setPendingDocMentionInsert={runtime.workspaceDoc.setPendingDocMentionInsert}
        pendingViewEmbedInsert={runtime.workspaceDoc.pendingViewEmbedInsert}
        setPendingViewEmbedInsert={runtime.workspaceDoc.setPendingViewEmbedInsert}
        pendingDocAssetEmbed={runtime.workspaceDoc.pendingDocAssetEmbed}
        setPendingDocAssetEmbed={runtime.workspaceDoc.setPendingDocAssetEmbed}
        onInsertDocMention={runtime.workspaceDoc.onInsertDocMention}
        views={runtime.views}
        selectedEmbedViewId={runtime.selectedEmbedViewId}
        setSelectedEmbedViewId={runtime.setSelectedEmbedViewId}
        onInsertViewEmbed={runtime.onInsertViewEmbed}
        onOpenRecord={runtime.onOpenRecord}
        onOpenEmbeddedView={runtime.onOpenEmbeddedView}
        uploadingDocAsset={runtime.workspaceDoc.uploadingDocAsset}
        onUploadDocAsset={runtime.workspaceDoc.onUploadDocAsset}
        docCommentComposerOpen={runtime.workspaceDoc.docCommentComposerOpen}
        commentTriggerRef={runtime.workspaceDoc.commentTriggerRef}
        onDocCommentDialogOpenChange={runtime.workspaceDoc.onDocCommentDialogOpenChange}
        docCommentError={runtime.workspaceDoc.docCommentError}
        docCommentText={runtime.workspaceDoc.docCommentText}
        setDocCommentText={runtime.workspaceDoc.setDocCommentText}
        onAddDocComment={runtime.workspaceDoc.onAddDocComment}
        docComments={runtime.workspaceDoc.docComments}
        orphanedDocComments={runtime.workspaceDoc.orphanedDocComments}
        onResolveDocComment={runtime.workspaceDoc.onResolveDocComment}
        onJumpToDocComment={runtime.workspaceDoc.onJumpToDocComment}
        showResolvedDocComments={runtime.workspaceDoc.showResolvedDocComments}
        setShowResolvedDocComments={runtime.workspaceDoc.setShowResolvedDocComments}
      />

      <ProjectSpaceInspectorOverlay {...runtime.recordInspectorOverlayProps} />
    </section>
  );
};
