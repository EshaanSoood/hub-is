import { useCallback, useMemo, useRef, useState, type ComponentProps, type Dispatch, type SetStateAction } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import type { HubBacklink, HubPaneSummary, HubProject } from '../../../../services/hub/types';
import { useRecordInspector } from '../../../../hooks/useRecordInspector';
import { ProjectSpaceInspectorOverlay } from '../ProjectSpaceInspectorOverlay';
import { getActiveInspectorFocusTarget, readElementRect, resolveInspectorFocusTarget } from '../domFocus';
import { toBase64 } from '../encoding';
import { paneCanEditForUser, relationFieldTargetCollectionId } from '../paneModel';
import type { TimelineEvent, TopLevelProjectTab } from '../types';

interface UseProjectSpaceInspectorRuntimeParams {
  accessToken: string;
  project: HubProject;
  panes: HubPaneSummary[];
  activeTab: TopLevelProjectTab;
  activePaneId: string | null;
  sessionUserId: string;
  refreshViewsAndRecords: () => Promise<void>;
  setTimeline: Dispatch<SetStateAction<TimelineEvent[]>>;
  ensureProjectAssetRoot: () => Promise<string>;
  refreshTrackedProjectFiles: () => Promise<void>;
  prefersReducedMotion: boolean;
  navigate: NavigateFunction;
  onOpenBacklink: (backlink: HubBacklink) => void;
}

interface UseProjectSpaceInspectorRuntimeResult {
  openRecordInspector: (recordId: string, options?: { mutationPaneId?: string | null }) => Promise<void>;
  recordInspectorOverlayProps: ComponentProps<typeof ProjectSpaceInspectorOverlay>;
}

export const useProjectSpaceInspectorRuntime = ({
  accessToken,
  project,
  panes,
  activeTab,
  activePaneId,
  sessionUserId,
  refreshViewsAndRecords,
  setTimeline,
  ensureProjectAssetRoot,
  refreshTrackedProjectFiles,
  prefersReducedMotion,
  navigate,
  onOpenBacklink,
}: UseProjectSpaceInspectorRuntimeParams): UseProjectSpaceInspectorRuntimeResult => {
  const [inspectorTriggerRect, setInspectorTriggerRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const inspectorTriggerRef = useRef<HTMLElement | null>(null);
  const {
    closeInspector,
    inspectorBacklinks,
    inspectorBacklinksError,
    inspectorBacklinksLoading,
    inspectorCommentText,
    inspectorError,
    inspectorLoading,
    inspectorMutationPane,
    inspectorMutationPaneCanEdit,
    inspectorRecord,
    inspectorRecordId,
    inspectorRelationFields,
    onAddRecordComment,
    onAddRelation,
    onAttachFile,
    onDetachInspectorAttachment,
    onInsertRecordCommentMention,
    onMoveInspectorAttachment,
    onRemoveRelation,
    onRenameInspectorAttachment,
    onSaveRecordField,
    openInspector,
    relationMutationError,
    removingRelationId,
    savingValues,
    selectedAttachmentId,
    setInspectorCommentText,
    setSelectedAttachmentId,
    uploadingAttachment,
  } = useRecordInspector({
    accessToken,
    projectId: project.project_id,
    panes,
    activeTab,
    activePaneId,
    sessionUserId,
    refreshViewsAndRecords,
    setTimeline,
    ensureProjectAssetRoot,
    refreshTrackedProjectFiles,
    paneCanEditForUser,
    relationFieldTargetCollectionId,
    toBase64,
  });

  const openRecordInspector = useCallback(
    async (recordId: string, options?: { mutationPaneId?: string | null }) => {
      inspectorTriggerRef.current = getActiveInspectorFocusTarget();
      setInspectorTriggerRect(readElementRect(inspectorTriggerRef.current));
      await openInspector(recordId, options);
    },
    [openInspector],
  );

  const closeRecordInspectorWithFocusRestore = useCallback(() => {
    inspectorTriggerRef.current = resolveInspectorFocusTarget(inspectorTriggerRef.current);
    closeInspector();
  }, [closeInspector]);

  return {
    openRecordInspector,
    recordInspectorOverlayProps: useMemo(() => ({
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
      closeInspectorWithFocusRestore: closeRecordInspectorWithFocusRestore,
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
    }), [
      accessToken,
      closeRecordInspectorWithFocusRestore,
      inspectorBacklinks,
      inspectorBacklinksError,
      inspectorBacklinksLoading,
      inspectorCommentText,
      inspectorError,
      inspectorLoading,
      inspectorMutationPane,
      inspectorMutationPaneCanEdit,
      inspectorRecord,
      inspectorRecordId,
      inspectorRelationFields,
      inspectorTriggerRect,
      navigate,
      onAddRecordComment,
      onAddRelation,
      onAttachFile,
      onDetachInspectorAttachment,
      onInsertRecordCommentMention,
      onMoveInspectorAttachment,
      onOpenBacklink,
      onRemoveRelation,
      onRenameInspectorAttachment,
      onSaveRecordField,
      panes,
      prefersReducedMotion,
      project,
      relationMutationError,
      removingRelationId,
      savingValues,
      selectedAttachmentId,
      setInspectorCommentText,
      setSelectedAttachmentId,
      uploadingAttachment,
    ]),
  };
};
