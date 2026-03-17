import { type Dispatch, type FormEvent, type SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  addRelation,
  createComment,
  getRecordDetail,
  listBacklinks,
  listTimeline,
  removeRelation,
  setRecordValues,
  attachFile,
  detachFile,
} from '../services/hub/records';
import { uploadFile } from '../services/hub/files';
import type { HubBacklink, HubPaneSummary, HubRecordDetail } from '../services/hub/types';
import { appendMentionToken, extractMentionsFromText, mentionToken } from '../features/notes/mentionTokens';
import type { RelationFieldOption } from '../components/project-space/RelationPicker';

type ProjectTimelineItem = {
  timeline_event_id: string;
  event_type: string;
  primary_entity_type: string;
  primary_entity_id: string;
  summary_json: Record<string, unknown>;
  created_at: string;
};

interface UseRecordInspectorParams {
  accessToken: string;
  projectId: string;
  panes: HubPaneSummary[];
  activeTab: 'overview' | 'work' | 'tools';
  activePaneId: string | null;
  sessionUserId: string;
  refreshViewsAndRecords: () => Promise<void>;
  setTimeline: Dispatch<SetStateAction<ProjectTimelineItem[]>>;
  ensureProjectAssetRoot: () => Promise<string>;
  refreshTrackedProjectFiles: () => Promise<void>;
  paneCanEditForUser: (pane: HubPaneSummary | null | undefined, userId: string) => boolean;
  relationFieldTargetCollectionId: (config: Record<string, unknown>) => string | null;
  toBase64: (file: File) => Promise<string>;
}

export const useRecordInspector = ({
  accessToken,
  projectId,
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
}: UseRecordInspectorParams) => {
  const [inspectorRecordId, setInspectorRecordId] = useState<string | null>(null);
  const [inspectorMutationPaneId, setInspectorMutationPaneId] = useState<string | null>(null);
  const [inspectorRecord, setInspectorRecord] = useState<HubRecordDetail | null>(null);
  const [inspectorLoading, setInspectorLoading] = useState(false);
  const [inspectorError, setInspectorError] = useState<string | null>(null);
  const [inspectorCommentText, setInspectorCommentText] = useState('');
  const [inspectorBacklinks, setInspectorBacklinks] = useState<HubBacklink[]>([]);
  const [inspectorBacklinksLoading, setInspectorBacklinksLoading] = useState(false);
  const [inspectorBacklinksError, setInspectorBacklinksError] = useState<string | null>(null);
  const [relationMutationError, setRelationMutationError] = useState<string | null>(null);
  const [removingRelationId, setRemovingRelationId] = useState<string | null>(null);
  const [savingValues, setSavingValues] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [selectedAttachmentId, setSelectedAttachmentId] = useState<string | null>(null);

  const inspectorMutationPane = useMemo(
    () => (inspectorMutationPaneId ? panes.find((pane) => pane.pane_id === inspectorMutationPaneId) || null : null),
    [inspectorMutationPaneId, panes],
  );
  const inspectorMutationPaneCanEdit = useMemo(
    () => paneCanEditForUser(inspectorMutationPane, sessionUserId),
    [inspectorMutationPane, paneCanEditForUser, sessionUserId],
  );
  const inspectorRelationFields = useMemo<RelationFieldOption[]>(() => {
    if (!inspectorRecord?.schema?.fields) {
      return [];
    }
    return inspectorRecord.schema.fields
      .filter((field) => field.type === 'relation')
      .map((field) => ({
        field_id: field.field_id,
        name: field.name,
        target_collection_id: relationFieldTargetCollectionId(field.config),
      }));
  }, [inspectorRecord?.schema?.fields, relationFieldTargetCollectionId]);

  const inspectorRequestVersionRef = useRef(0);

  const openInspector = useCallback(
    async (recordId: string, options?: { mutationPaneId?: string | null }) => {
      const reqVer = ++inspectorRequestVersionRef.current;
      const mutationPaneId = options?.mutationPaneId ?? (activeTab === 'work' ? activePaneId || null : null);
      setInspectorRecordId(recordId);
      setInspectorMutationPaneId(mutationPaneId);
      setInspectorLoading(true);
      setInspectorError(null);
      setInspectorBacklinksLoading(true);
      setInspectorBacklinksError(null);
      setRelationMutationError(null);
      setRemovingRelationId(null);

      try {
        const record = await getRecordDetail(accessToken, recordId);
        if (inspectorRequestVersionRef.current !== reqVer) {
          return;
        }
        setInspectorRecord(record);
      } catch (error) {
        if (inspectorRequestVersionRef.current !== reqVer) {
          return;
        }
        setInspectorRecord(null);
        setInspectorError(error instanceof Error ? error.message : 'Failed to load record detail.');
        setInspectorBacklinks([]);
        setInspectorBacklinksError(null);
        setInspectorLoading(false);
        setInspectorBacklinksLoading(false);
        return;
      } finally {
        if (inspectorRequestVersionRef.current === reqVer) {
          setInspectorLoading(false);
        }
      }

      try {
        const backlinks = await listBacklinks(accessToken, projectId, 'record', recordId);
        if (inspectorRequestVersionRef.current !== reqVer) {
          return;
        }
        setInspectorBacklinks(backlinks);
        setInspectorBacklinksError(null);
      } catch (error) {
        if (inspectorRequestVersionRef.current !== reqVer) {
          return;
        }
        setInspectorBacklinks([]);
        setInspectorBacklinksError(error instanceof Error ? error.message : 'Failed to load backlinks.');
      } finally {
        if (inspectorRequestVersionRef.current === reqVer) {
          setInspectorBacklinksLoading(false);
        }
      }
    },
    [accessToken, activePaneId, activeTab, projectId],
  );

  const closeInspector = useCallback(() => {
    inspectorRequestVersionRef.current += 1;
    setInspectorRecordId(null);
    setInspectorMutationPaneId(null);
    setInspectorRecord(null);
    setInspectorCommentText('');
    setInspectorBacklinks([]);
    setInspectorBacklinksError(null);
    setRelationMutationError(null);
    setRemovingRelationId(null);
    setSelectedAttachmentId(null);
  }, []);

  useEffect(() => {
    if (!inspectorRecord || inspectorRecord.attachments.length === 0) {
      setSelectedAttachmentId(null);
      return;
    }
    setSelectedAttachmentId((current) => {
      if (current && inspectorRecord.attachments.some((attachment) => attachment.attachment_id === current)) {
        return current;
      }
      return inspectorRecord.attachments[0].attachment_id;
    });
  }, [inspectorRecord]);

  const onSaveRecordField = useCallback(
    async (fieldId: string, rawValue: string) => {
      if (!inspectorRecord) {
        return;
      }
      if (!inspectorMutationPaneCanEdit || !inspectorMutationPaneId) {
        setInspectorError('Read-only pane. Only pane editors can change record fields.');
        return;
      }

      setSavingValues(true);
      try {
        setInspectorError(null);
        await setRecordValues(
          accessToken,
          inspectorRecord.record_id,
          {
            [fieldId]: rawValue,
          },
          { mutation_context_pane_id: inspectorMutationPaneId },
        );
        const refreshed = await getRecordDetail(accessToken, inspectorRecord.record_id);
        setInspectorRecord(refreshed);
        await refreshViewsAndRecords();
        const nextTimeline = await listTimeline(accessToken, projectId);
        setTimeline(nextTimeline);
      } catch (error) {
        setInspectorError(error instanceof Error ? error.message : 'Failed to save field.');
      } finally {
        setSavingValues(false);
      }
    },
    [
      accessToken,
      inspectorMutationPaneCanEdit,
      inspectorMutationPaneId,
      inspectorRecord,
      projectId,
      refreshViewsAndRecords,
      setTimeline,
    ],
  );

  const onAddRecordComment = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!inspectorRecord) {
        return;
      }

      const text = inspectorCommentText.trim();
      if (!text) {
        return;
      }

      const mentions = extractMentionsFromText(text).map((mention) => ({
        target_entity_type: mention.target_entity_type,
        target_entity_id: mention.target_entity_id,
        context: {
          surface: 'record_inspector',
        },
      }));

      await createComment(accessToken, {
        project_id: projectId,
        target_entity_type: 'record',
        target_entity_id: inspectorRecord.record_id,
        body_json: {
          text,
        },
        mentions,
      });

      setInspectorCommentText('');
      const refreshed = await getRecordDetail(accessToken, inspectorRecord.record_id);
      setInspectorRecord(refreshed);
      const backlinks = await listBacklinks(accessToken, projectId, 'record', inspectorRecord.record_id);
      setInspectorBacklinks(backlinks);
    },
    [accessToken, inspectorCommentText, inspectorRecord, projectId],
  );

  const onAddRelation = useCallback(
    async (payload: { to_record_id: string; via_field_id: string }) => {
      if (!inspectorRecord) {
        return;
      }
      if (!inspectorMutationPaneCanEdit || !inspectorMutationPaneId) {
        setRelationMutationError('Read-only pane. Only pane editors can change relations.');
        return;
      }
      const requestVersion = inspectorRequestVersionRef.current;
      const recordId = inspectorRecord.record_id;
      setRelationMutationError(null);
      try {
        await addRelation(accessToken, recordId, {
          project_id: projectId,
          from_record_id: recordId,
          to_record_id: payload.to_record_id,
          via_field_id: payload.via_field_id,
          mutation_context_pane_id: inspectorMutationPaneId,
        });
        if (inspectorRequestVersionRef.current !== requestVersion) {
          return;
        }
        const refreshed = await getRecordDetail(accessToken, recordId);
        if (inspectorRequestVersionRef.current !== requestVersion) {
          return;
        }
        setInspectorRecord(refreshed);
        await refreshViewsAndRecords();
        if (inspectorRequestVersionRef.current !== requestVersion) {
          return;
        }
        const nextTimeline = await listTimeline(accessToken, projectId);
        if (inspectorRequestVersionRef.current !== requestVersion) {
          return;
        }
        setTimeline(nextTimeline);
      } catch (error) {
        if (inspectorRequestVersionRef.current !== requestVersion) {
          return;
        }
        const message = error instanceof Error ? error.message : 'Failed to add relation.';
        setRelationMutationError(message);
      }
    },
    [
      accessToken,
      inspectorMutationPaneCanEdit,
      inspectorMutationPaneId,
      inspectorRecord,
      projectId,
      refreshViewsAndRecords,
      setTimeline,
    ],
  );

  const onRemoveRelation = useCallback(
    async (relationId: string) => {
      if (!inspectorRecord) {
        return;
      }
      if (!inspectorMutationPaneCanEdit || !inspectorMutationPaneId) {
        setRelationMutationError('Read-only pane. Only pane editors can change relations.');
        return;
      }
      const requestVersion = inspectorRequestVersionRef.current;
      const recordId = inspectorRecord.record_id;
      setRelationMutationError(null);
      setRemovingRelationId(relationId);
      try {
        await removeRelation(accessToken, relationId, { mutation_context_pane_id: inspectorMutationPaneId });
        if (inspectorRequestVersionRef.current !== requestVersion) {
          return;
        }
        const refreshed = await getRecordDetail(accessToken, recordId);
        if (inspectorRequestVersionRef.current !== requestVersion) {
          return;
        }
        setInspectorRecord(refreshed);
        await refreshViewsAndRecords();
        if (inspectorRequestVersionRef.current !== requestVersion) {
          return;
        }
        const nextTimeline = await listTimeline(accessToken, projectId);
        if (inspectorRequestVersionRef.current !== requestVersion) {
          return;
        }
        setTimeline(nextTimeline);
      } catch (error) {
        if (inspectorRequestVersionRef.current !== requestVersion) {
          return;
        }
        setRelationMutationError(error instanceof Error ? error.message : 'Failed to remove relation.');
      } finally {
        if (inspectorRequestVersionRef.current === requestVersion) {
          setRemovingRelationId(null);
        }
      }
    },
    [
      accessToken,
      inspectorMutationPaneCanEdit,
      inspectorMutationPaneId,
      inspectorRecord,
      projectId,
      refreshViewsAndRecords,
      setTimeline,
    ],
  );

  const onAttachFile = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!inspectorRecord) {
        return;
      }
      if (!inspectorMutationPaneCanEdit || !inspectorMutationPaneId) {
        setInspectorError('Read-only pane. Only pane editors can manage attachments.');
        return;
      }
      const requestVersion = inspectorRequestVersionRef.current;
      const recordId = inspectorRecord.record_id;

      const form = event.currentTarget;
      const input = form.elements.namedItem('attachment-file') as HTMLInputElement | null;
      const file = input?.files?.[0];
      if (!file) {
        return;
      }

      setUploadingAttachment(true);
      try {
        const [base64, assetRootId] = await Promise.all([toBase64(file), ensureProjectAssetRoot()]);
        const uploaded = await uploadFile(accessToken, {
          project_id: projectId,
          asset_root_id: assetRootId,
          name: file.name,
          mime_type: file.type || 'application/octet-stream',
          content_base64: base64,
          path: 'Uploads',
          mutation_context_pane_id: inspectorMutationPaneId,
          metadata: {
            scope: 'project',
            attached_entity_type: 'record',
            attached_entity_id: recordId,
          },
        });
        if (inspectorRequestVersionRef.current !== requestVersion) {
          return;
        }

        await attachFile(accessToken, {
          project_id: projectId,
          entity_type: 'record',
          entity_id: recordId,
          provider: uploaded.file.provider,
          asset_root_id: uploaded.file.asset_root_id,
          asset_path: uploaded.file.asset_path,
          name: uploaded.file.name,
          mime_type: uploaded.file.mime_type,
          size_bytes: uploaded.file.size_bytes,
          mutation_context_pane_id: inspectorMutationPaneId,
          metadata: {},
        });
        if (inspectorRequestVersionRef.current !== requestVersion) {
          return;
        }

        const refreshed = await getRecordDetail(accessToken, recordId);
        if (inspectorRequestVersionRef.current !== requestVersion) {
          return;
        }
        setInspectorRecord(refreshed);
        await refreshTrackedProjectFiles();
        const nextTimeline = await listTimeline(accessToken, projectId);
        if (inspectorRequestVersionRef.current !== requestVersion) {
          return;
        }
        setTimeline(nextTimeline);
      } catch (error) {
        if (inspectorRequestVersionRef.current !== requestVersion) {
          return;
        }
        setInspectorError(error instanceof Error ? error.message : 'Failed to attach file.');
      } finally {
        setUploadingAttachment(false);
        form.reset();
      }
    },
    [
      accessToken,
      ensureProjectAssetRoot,
      inspectorMutationPaneCanEdit,
      inspectorMutationPaneId,
      inspectorRecord,
      projectId,
      refreshTrackedProjectFiles,
      setTimeline,
      toBase64,
    ],
  );

  const onDetachInspectorAttachment = useCallback(
    async (attachmentId: string) => {
      if (!inspectorRecord) {
        return;
      }
      if (!inspectorMutationPaneCanEdit || !inspectorMutationPaneId) {
        setInspectorError('Read-only pane. Only pane editors can manage attachments.');
        return;
      }
      const requestVersion = inspectorRequestVersionRef.current;
      const recordId = inspectorRecord.record_id;
      setInspectorError(null);
      try {
        await detachFile(accessToken, attachmentId, { mutation_context_pane_id: inspectorMutationPaneId });
        if (inspectorRequestVersionRef.current !== requestVersion) {
          return;
        }
        const refreshed = await getRecordDetail(accessToken, recordId);
        if (inspectorRequestVersionRef.current !== requestVersion) {
          return;
        }
        setInspectorRecord(refreshed);
        setSelectedAttachmentId((current) =>
          current === attachmentId ? refreshed.attachments[0]?.attachment_id || null : current,
        );
        const nextTimeline = await listTimeline(accessToken, projectId);
        if (inspectorRequestVersionRef.current !== requestVersion) {
          return;
        }
        setTimeline(nextTimeline);
      } catch (error) {
        if (inspectorRequestVersionRef.current !== requestVersion) {
          return;
        }
        setInspectorError(error instanceof Error ? error.message : 'Failed to remove attachment.');
      }
    },
    [accessToken, inspectorMutationPaneCanEdit, inspectorMutationPaneId, inspectorRecord, projectId, setTimeline],
  );

  const relinkInspectorAttachment = useCallback(
    async (
      attachmentId: string,
      options?: { name?: string; metadata?: Record<string, unknown> },
    ): Promise<void> => {
      if (!inspectorRecord) {
        return;
      }
      if (!inspectorMutationPaneCanEdit || !inspectorMutationPaneId) {
        setInspectorError('Read-only pane. Only pane editors can manage attachments.');
        return;
      }

      const attachment = inspectorRecord.attachments.find((entry) => entry.attachment_id === attachmentId);
      if (!attachment) {
        setInspectorError('Attachment no longer exists on this record.');
        return;
      }

      setInspectorError(null);
      const requestVersion = inspectorRequestVersionRef.current;
      const recordId = inspectorRecord.record_id;
      const attached = await attachFile(accessToken, {
        project_id: projectId,
        entity_type: 'record',
        entity_id: recordId,
        provider: attachment.provider,
        asset_root_id: attachment.asset_root_id,
        asset_path: attachment.asset_path,
        name: options?.name || attachment.name,
        mime_type: attachment.mime_type,
        size_bytes: attachment.size_bytes,
        mutation_context_pane_id: inspectorMutationPaneId,
        metadata: options?.metadata || attachment.metadata || {},
      });
      if (inspectorRequestVersionRef.current !== requestVersion) {
        try {
          await detachFile(accessToken, attached.attachment_id, { mutation_context_pane_id: inspectorMutationPaneId });
        } catch {
          // Best-effort rollback for stale inspector state.
        }
        return;
      }
      try {
        await detachFile(accessToken, attachmentId, { mutation_context_pane_id: inspectorMutationPaneId });
      } catch (error) {
        try {
          await detachFile(accessToken, attached.attachment_id, { mutation_context_pane_id: inspectorMutationPaneId });
        } catch {
          throw new Error('Failed to update attachment and roll back the replacement copy.');
        }
        throw error;
      }
      if (inspectorRequestVersionRef.current !== requestVersion) {
        return;
      }
      const refreshed = await getRecordDetail(accessToken, recordId);
      if (inspectorRequestVersionRef.current !== requestVersion) {
        return;
      }
      setInspectorRecord(refreshed);
      setSelectedAttachmentId(attached.attachment_id);
      const nextTimeline = await listTimeline(accessToken, projectId);
      if (inspectorRequestVersionRef.current !== requestVersion) {
        return;
      }
      setTimeline(nextTimeline);
    },
    [accessToken, inspectorMutationPaneCanEdit, inspectorMutationPaneId, inspectorRecord, projectId, setTimeline],
  );

  const onRenameInspectorAttachment = useCallback(
    async (attachmentId: string, nextName: string) => {
      const requestVersion = inspectorRequestVersionRef.current;
      const trimmed = nextName.trim();
      if (!trimmed || !inspectorRecord) {
        return;
      }
      if (!inspectorMutationPaneCanEdit || !inspectorMutationPaneId) {
        setInspectorError('Read-only pane. Only pane editors can manage attachments.');
        return;
      }
      const attachment = inspectorRecord.attachments.find((entry) => entry.attachment_id === attachmentId);
      if (!attachment || attachment.name === trimmed) {
        return;
      }
      try {
        await relinkInspectorAttachment(attachmentId, { name: trimmed });
      } catch (error) {
        if (inspectorRequestVersionRef.current !== requestVersion) {
          return;
        }
        setInspectorError(error instanceof Error ? error.message : 'Failed to rename attachment.');
      }
    },
    [inspectorMutationPaneCanEdit, inspectorMutationPaneId, inspectorRecord, relinkInspectorAttachment],
  );

  const onMoveInspectorAttachment = useCallback(
    async (attachmentId: string, paneIdToMove: string) => {
      const requestVersion = inspectorRequestVersionRef.current;
      if (!inspectorRecord) {
        return;
      }
      if (!inspectorMutationPaneCanEdit || !inspectorMutationPaneId) {
        setInspectorError('Read-only pane. Only pane editors can manage attachments.');
        return;
      }
      const attachment = inspectorRecord.attachments.find((entry) => entry.attachment_id === attachmentId);
      if (!attachment) {
        return;
      }
      const nextMetadata = {
        ...attachment.metadata,
        pane_id: paneIdToMove,
      };
      try {
        await relinkInspectorAttachment(attachmentId, {
          metadata: nextMetadata,
        });
      } catch (error) {
        if (inspectorRequestVersionRef.current !== requestVersion) {
          return;
        }
        setInspectorError(error instanceof Error ? error.message : 'Failed to move attachment.');
      }
    },
    [inspectorMutationPaneCanEdit, inspectorMutationPaneId, inspectorRecord, relinkInspectorAttachment],
  );

  const onInsertRecordCommentMention = useCallback((target: { entity_type: 'user' | 'record'; entity_ref: { entity_id: string }; label: string }) => {
    const token = mentionToken({
      entity_type: target.entity_type,
      entity_id: target.entity_ref.entity_id,
      label: target.label,
    });
    setInspectorCommentText((current) => appendMentionToken(current, token));
  }, []);

  return {
    closeInspector,
    inspectorBacklinks,
    inspectorBacklinksError,
    inspectorBacklinksLoading,
    inspectorCommentText,
    inspectorError,
    inspectorLoading,
    inspectorMutationPane,
    inspectorMutationPaneCanEdit,
    inspectorMutationPaneId,
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
  };
};
