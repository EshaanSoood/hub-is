import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import {
  authorizeCollabDoc,
  getDocSnapshot,
  postDocPresence,
  saveDocSnapshot,
} from '../services/hub/docs';
import {
  createDocAnchorComment,
  listComments,
  materializeMentions,
  setCommentStatus,
} from '../services/hub/records';
import { uploadFile } from '../services/hub/files';
import type { HubMentionTarget } from '../services/hub/types';
import { env } from '../lib/env';
import { toBase64 } from '../lib/utils';
import { extractMentionsFromText, mentionToken } from '../features/notes/mentionTokens';

type ProjectSpaceTab = 'overview' | 'work' | 'tools';

type DocComment = {
  comment_id: string;
  doc_id?: string;
  body_json: Record<string, unknown>;
  status: 'open' | 'resolved';
  author_user_id: string;
  created_at: string;
  anchor_payload?: {
    kind: 'node';
    nodeKey: string;
    context?: Record<string, unknown> | null;
  };
  orphaned?: boolean;
  is_orphaned?: boolean;
};

const collectLexicalNodeKeys = (candidate: unknown, output: Set<string>) => {
  if (!candidate || typeof candidate !== 'object') {
    return;
  }

  if (Array.isArray(candidate)) {
    for (const item of candidate) {
      collectLexicalNodeKeys(item, output);
    }
    return;
  }

  const record = candidate as Record<string, unknown>;
  if (typeof record.key === 'string' && record.key.trim()) {
    output.add(record.key.trim());
  }

  for (const value of Object.values(record)) {
    if (value && typeof value === 'object') {
      collectLexicalNodeKeys(value, output);
    }
  }
};

const extractNodeKeysFromLexicalState = (lexicalState: Record<string, unknown>): string[] => {
  const keys = new Set<string>();
  collectLexicalNodeKeys(lexicalState, keys);
  return [...keys];
};

const collectDocMentions = (
  candidate: unknown,
  output: Map<string, { target_entity_type: 'user' | 'record'; target_entity_id: string; context: Record<string, unknown> }>,
  inheritedNodeKey: string | null = null,
) => {
  if (!candidate || typeof candidate !== 'object') {
    return;
  }

  if (Array.isArray(candidate)) {
    for (const item of candidate) {
      collectDocMentions(item, output, inheritedNodeKey);
    }
    return;
  }

  const record = candidate as Record<string, unknown>;
  const nodeKey = typeof record.key === 'string' && record.key.trim() ? record.key.trim() : inheritedNodeKey;
  const text = typeof record.text === 'string' ? record.text : '';
  if (text) {
    const mentions = extractMentionsFromText(text);
    for (const mention of mentions) {
      const key = `${mention.target_entity_type}:${mention.target_entity_id}`;
      output.set(key, {
        target_entity_type: mention.target_entity_type,
        target_entity_id: mention.target_entity_id,
        context: {
          source: 'doc',
          nodeKey,
          snippet: text.slice(0, 160),
        },
      });
    }
  }

  for (const value of Object.values(record)) {
    if (value && typeof value === 'object') {
      collectDocMentions(value, output, nodeKey);
    }
  }
};

const extractDocMentionsFromLexicalState = (
  lexicalState: Record<string, unknown>,
): Array<{ target_entity_type: 'user' | 'record'; target_entity_id: string; context: Record<string, unknown> }> => {
  const output = new Map<
    string,
    { target_entity_type: 'user' | 'record'; target_entity_id: string; context: Record<string, unknown> }
  >();
  collectDocMentions(lexicalState, output);
  return [...output.values()];
};

interface UseWorkspaceDocRuntimeParams {
  accessToken: string;
  activePaneDocId: string | null;
  projectId: string;
  activePaneId: string | null;
  activeTab: ProjectSpaceTab;
  ensureProjectAssetRoot: () => Promise<string>;
  refreshTrackedProjectFiles: () => Promise<void>;
  refreshTimeline: () => Promise<void>;
}

export const useWorkspaceDocRuntime = ({
  accessToken,
  activePaneDocId,
  projectId,
  activePaneId,
  activeTab,
  ensureProjectAssetRoot,
  refreshTrackedProjectFiles,
  refreshTimeline,
}: UseWorkspaceDocRuntimeParams) => {
  const [docComments, setDocComments] = useState<DocComment[]>([]);
  const [orphanedDocComments, setOrphanedDocComments] = useState<DocComment[]>([]);
  const [showResolvedDocComments, setShowResolvedDocComments] = useState(false);
  const [docCommentComposerOpen, setDocCommentComposerOpen] = useState(false);
  const [docCommentText, setDocCommentText] = useState('');
  const [docCommentError, setDocCommentError] = useState<string | null>(null);
  const [selectedDocNodeKey, setSelectedDocNodeKey] = useState<string | null>(null);
  const commentTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [uploadingDocAsset, setUploadingDocAsset] = useState(false);
  const [pendingDocAssetEmbed, setPendingDocAssetEmbed] = useState<{ embed_id: string; label: string; reference: string } | null>(null);
  const [pendingDocMentionInsert, setPendingDocMentionInsert] = useState<{ insert_id: string; token: string } | null>(null);
  const [pendingViewEmbedInsert, setPendingViewEmbedInsert] = useState<{ insert_id: string; view_id: string } | null>(null);
  const [pendingDocFocusNodeKey, setPendingDocFocusNodeKey] = useState<string | null>(null);
  const [collabSession, setCollabSession] = useState<{
    roomId: string;
    websocketUrl: string;
    token: string;
    expiresAt: string;
  } | null>(null);
  const [collabSessionError, setCollabSessionError] = useState<string | null>(null);

  const docSnapshotSaveTimerRef = useRef<number | null>(null);
  const docSnapshotVersionRef = useRef(0);
  const lastDocSnapshotHashRef = useRef('');
  const inFlightDocSnapshotHashRef = useRef<string | null>(null);
  const latestDocCommentsRequestRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refreshDocComments = useCallback(async () => {
    if (!activePaneDocId) {
      setDocComments([]);
      setOrphanedDocComments([]);
      return;
    }
    const requestId = ++latestDocCommentsRequestRef.current;

    try {
      const response = await listComments(accessToken, {
        project_id: projectId,
        doc_id: activePaneDocId,
      });
      if (requestId !== latestDocCommentsRequestRef.current) {
        return;
      }

      setDocComments(
        response.comments.map((comment) => ({
          comment_id: comment.comment_id,
          doc_id: comment.doc_id,
          body_json: comment.body_json,
          status: comment.status,
          author_user_id: comment.author_user_id,
          created_at: comment.created_at,
          anchor_payload: comment.anchor_payload,
          orphaned: comment.orphaned,
          is_orphaned: comment.is_orphaned,
        })),
      );
      setOrphanedDocComments(
        response.orphaned_comments.map((comment) => ({
          comment_id: comment.comment_id,
          doc_id: comment.doc_id,
          body_json: comment.body_json,
          status: comment.status,
          author_user_id: comment.author_user_id,
          created_at: comment.created_at,
          anchor_payload: comment.anchor_payload,
          orphaned: comment.orphaned,
          is_orphaned: comment.is_orphaned,
        })),
      );
    } catch (error) {
      if (requestId !== latestDocCommentsRequestRef.current) {
        return;
      }
      console.warn('[workspace-doc] failed to refresh doc comments', error);
      setDocComments([]);
      setOrphanedDocComments([]);
    }
  }, [accessToken, activePaneDocId, projectId]);

  useEffect(() => {
    lastDocSnapshotHashRef.current = '';
    inFlightDocSnapshotHashRef.current = null;
    setSelectedDocNodeKey(null);
    setPendingDocFocusNodeKey(null);
    setDocCommentComposerOpen(false);
    setDocCommentError(null);
    setCollabSession(null);
    setCollabSessionError(null);
    if (docSnapshotSaveTimerRef.current !== null) {
      window.clearTimeout(docSnapshotSaveTimerRef.current);
      docSnapshotSaveTimerRef.current = null;
    }
  }, [activePaneDocId]);

  useEffect(() => {
    let cancelled = false;
    if (!activePaneDocId) {
      return () => {
        cancelled = true;
      };
    }

    const issueSession = async () => {
      setCollabSessionError(null);
      try {
        const authorization = await authorizeCollabDoc(accessToken, activePaneDocId);
        if (cancelled) {
          return;
        }
        setCollabSession({
          roomId: authorization.doc_id,
          websocketUrl: env.hubCollabWsUrl,
          token: authorization.ws_ticket,
          expiresAt: authorization.ticket_expires_at,
        });
      } catch (error) {
        if (cancelled) {
          return;
        }
        setCollabSession(null);
        setCollabSessionError(error instanceof Error ? error.message : 'Failed to authorize collaboration.');
      }
    };

    void issueSession();
    return () => {
      cancelled = true;
    };
  }, [accessToken, activePaneDocId]);

  useEffect(() => {
    void refreshDocComments();
  }, [refreshDocComments]);

  useEffect(() => {
    if (!activePaneDocId) {
      return;
    }

    const syncPresence = async () => {
      try {
        const doc = await getDocSnapshot(accessToken, activePaneDocId);
        docSnapshotVersionRef.current = doc.snapshot_version;
        await postDocPresence(accessToken, activePaneDocId, {
          surface: activeTab,
          pane_id: activePaneId,
        });
      } catch {
        // best-effort presence
      }
    };

    void syncPresence();
    const timer = window.setInterval(() => {
      void syncPresence();
    }, 15_000);

    return () => {
      window.clearInterval(timer);
      if (docSnapshotSaveTimerRef.current !== null) {
        window.clearTimeout(docSnapshotSaveTimerRef.current);
        docSnapshotSaveTimerRef.current = null;
      }
    };
  }, [accessToken, activePaneDocId, activePaneId, activeTab]);

  const onDocEditorChange = useCallback(
    (payload: { lexicalState: Record<string, unknown>; plainText: string }) => {
      if (!activePaneDocId) {
        return;
      }

      const nodeKeys = extractNodeKeysFromLexicalState(payload.lexicalState);
      const snapshotPayload = {
        lexical_state: payload.lexicalState,
        plain_text: payload.plainText,
        node_keys: nodeKeys,
      };
      const nextHash = JSON.stringify(snapshotPayload);
      if (nextHash === lastDocSnapshotHashRef.current || nextHash === inFlightDocSnapshotHashRef.current) {
        return;
      }
      inFlightDocSnapshotHashRef.current = nextHash;

      if (docSnapshotSaveTimerRef.current !== null) {
        window.clearTimeout(docSnapshotSaveTimerRef.current);
      }

      docSnapshotSaveTimerRef.current = window.setTimeout(() => {
        if (!mountedRef.current) {
          return;
        }
        const docMentions = extractDocMentionsFromLexicalState(payload.lexicalState);
        void saveDocSnapshot(accessToken, activePaneDocId, {
          snapshot_payload: snapshotPayload,
        })
          .then((result) => {
            lastDocSnapshotHashRef.current = nextHash;
            inFlightDocSnapshotHashRef.current = null;
            if (!mountedRef.current) {
              return;
            }
            docSnapshotVersionRef.current = result.snapshot_version;
            if (!mountedRef.current) {
              return;
            }
            return materializeMentions(accessToken, {
              project_id: projectId,
              source_entity_type: 'doc',
              source_entity_id: activePaneDocId,
              mentions: docMentions,
              replace_source: true,
            });
          })
          .catch(() => {
            inFlightDocSnapshotHashRef.current = null;
            // best-effort doc metadata persistence and mention materialization
          });
      }, 600);
    },
    [accessToken, activePaneDocId, projectId],
  );

  const onInsertDocMention = useCallback((target: HubMentionTarget) => {
    const token = mentionToken({
      entity_type: target.entity_type,
      entity_id: target.entity_ref.entity_id,
      label: target.label,
    });
    setPendingDocMentionInsert({
      insert_id: `mnt-${Date.now()}`,
      token,
    });
  }, []);

  const queueViewEmbed = useCallback((viewId: string) => {
    if (!viewId) {
      return;
    }
    setPendingViewEmbedInsert({
      insert_id: `view-${Date.now()}`,
      view_id: viewId,
    });
  }, []);

  const onJumpToDocComment = useCallback(
    (comment: {
      anchor_payload?: { kind: 'node'; nodeKey: string; context?: Record<string, unknown> | null };
      orphaned?: boolean;
      is_orphaned?: boolean;
    }) => {
      if (comment.orphaned || comment.is_orphaned) {
        return;
      }
      const nodeKey = comment.anchor_payload?.nodeKey || null;
      if (!nodeKey) {
        return;
      }
      setPendingDocFocusNodeKey(nodeKey);
    },
    [],
  );

  const onUploadDocAsset = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!activePaneDocId) {
        return;
      }
      const uploadDocId = activePaneDocId;

      const form = event.currentTarget;
      const input = form.elements.namedItem('doc-asset-file') as HTMLInputElement | null;
      const file = input?.files?.[0];
      if (!file) {
        return;
      }

      setUploadingDocAsset(true);
      try {
        const [base64, assetRootId] = await Promise.all([toBase64(file), ensureProjectAssetRoot()]);
        const uploaded = await uploadFile(accessToken, {
          project_id: projectId,
          asset_root_id: assetRootId,
          name: file.name,
          mime_type: file.type || 'application/octet-stream',
          content_base64: base64,
          path: 'Uploads',
          mutation_context_pane_id: activePaneId || undefined,
          metadata: {
            scope: 'doc_attachment',
            attached_entity_type: 'doc',
            attached_entity_id: uploadDocId,
          },
        });
        if (!mountedRef.current) {
          return;
        }

        setPendingDocAssetEmbed({
          embed_id: `embed-${Date.now()}`,
          label: uploaded.file.name,
          reference: uploaded.file.proxy_url,
        });
        await refreshTrackedProjectFiles();
        await refreshTimeline();
        form.reset();
      } catch (error) {
        console.warn('[workspace-doc] failed to upload doc asset', error);
      } finally {
        setUploadingDocAsset(false);
      }
    },
    [
      accessToken,
      activePaneDocId,
      activePaneId,
      ensureProjectAssetRoot,
      projectId,
      refreshTimeline,
      refreshTrackedProjectFiles,
    ],
  );

  const onAddDocComment = useCallback(async () => {
    if (!activePaneDocId || !selectedDocNodeKey) {
      return;
    }

    const text = docCommentText.trim();
    if (!text) {
      return;
    }

    const mentions = extractMentionsFromText(text).map((mention) => ({
      target_entity_type: mention.target_entity_type,
      target_entity_id: mention.target_entity_id,
      context: {
        surface: 'doc_comment',
        nodeKey: selectedDocNodeKey,
      },
    }));

    setDocCommentError(null);
    try {
      await createDocAnchorComment(accessToken, {
        project_id: projectId,
        doc_id: activePaneDocId,
        anchor_payload: {
          kind: 'node',
          nodeKey: selectedDocNodeKey,
          context: {
            surface: 'lexical-node',
          },
        },
        body_json: {
          text,
        },
        mentions,
      });

      setDocCommentText('');
      setDocCommentComposerOpen(false);
      commentTriggerRef.current?.focus();
      await refreshDocComments();
      await refreshTimeline();
    } catch (error) {
      console.warn('[workspace-doc] failed to add doc comment', error);
      setDocCommentError(error instanceof Error ? error.message : 'Failed to add doc comment.');
    }
  }, [accessToken, activePaneDocId, docCommentText, projectId, refreshDocComments, refreshTimeline, selectedDocNodeKey]);

  const onDocCommentDialogOpenChange = useCallback((open: boolean) => {
    setDocCommentComposerOpen(open);
    if (!open) {
      commentTriggerRef.current?.focus();
    }
  }, []);

  const onResolveDocComment = useCallback(
    async (commentId: string, nextStatus: 'open' | 'resolved') => {
      try {
        await setCommentStatus(accessToken, commentId, nextStatus);
        await refreshDocComments();
      } catch (error) {
        console.warn('[workspace-doc] failed to resolve doc comment', error);
      }
    },
    [accessToken, refreshDocComments],
  );

  return {
    collabSession,
    collabSessionError,
    commentTriggerRef,
    docCommentComposerOpen,
    docCommentError,
    docCommentText,
    docComments,
    onAddDocComment,
    onDocCommentDialogOpenChange,
    onDocEditorChange,
    onInsertDocMention,
    onJumpToDocComment,
    onResolveDocComment,
    onUploadDocAsset,
    orphanedDocComments,
    pendingDocAssetEmbed,
    pendingDocFocusNodeKey,
    pendingDocMentionInsert,
    pendingViewEmbedInsert,
    queueViewEmbed,
    selectedDocNodeKey,
    setDocCommentComposerOpen,
    setDocCommentText,
    setPendingDocFocusNodeKey,
    setPendingDocMentionInsert,
    setPendingViewEmbedInsert,
    setPendingDocAssetEmbed,
    setSelectedDocNodeKey,
    setShowResolvedDocComments,
    showResolvedDocComments,
    uploadingDocAsset,
  };
};
