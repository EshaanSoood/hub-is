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
import { HubRequestError } from '../services/hub/transport';
import type { HubMentionTarget } from '../services/hub/types';
import { env } from '../lib/env';
import { toBase64 } from '../lib/utils';
import { extractMentionsFromText, mentionToken } from '../features/notes/mentionTokens';
import { emptyLexicalState, lexicalStateToPlainText, normalizeLexicalState } from '../features/notes/lexicalState';

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

type WorkspaceDocSnapshotPayload = {
  lexical_state: Record<string, unknown>;
  plain_text: string;
  node_keys: string[];
  yjs_update_base64?: string;
};

type PendingWorkspaceDocSnapshot = {
  docId: string;
  lexicalState: Record<string, unknown>;
  snapshotPayload: WorkspaceDocSnapshotPayload;
  hash: string;
};

type DocSnapshotSaveState = {
  lastSavedHash: string;
  queuedEntry: PendingWorkspaceDocSnapshot | null;
  savePromise: Promise<void> | null;
  version: number;
};

const DOC_SNAPSHOT_SAVE_DEBOUNCE_MS = 600;

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

const buildWorkspaceDocSnapshotPayload = (
  lexicalState: Record<string, unknown>,
  plainText: string,
  yjsUpdateBase64?: string | null,
): WorkspaceDocSnapshotPayload => ({
  lexical_state: lexicalState,
  plain_text: plainText,
  node_keys: extractNodeKeysFromLexicalState(lexicalState),
  ...(yjsUpdateBase64 ? { yjs_update_base64: yjsUpdateBase64 } : {}),
});

const normalizeWorkspaceDocSnapshotPayload = (payload: unknown): WorkspaceDocSnapshotPayload => {
  const record = payload && typeof payload === 'object' && !Array.isArray(payload) ? (payload as Record<string, unknown>) : {};
  const lexicalState = normalizeLexicalState(record.lexical_state);
  const plainText = typeof record.plain_text === 'string' ? record.plain_text : lexicalStateToPlainText(lexicalState);
  const nodeKeys = Array.isArray(record.node_keys)
    ? record.node_keys.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    : extractNodeKeysFromLexicalState(lexicalState);
  const yjsUpdateBase64 =
    typeof record.yjs_update_base64 === 'string' && record.yjs_update_base64.trim().length > 0
      ? record.yjs_update_base64.trim()
      : undefined;

  return {
    lexical_state: lexicalState,
    plain_text: plainText,
    node_keys: nodeKeys,
    ...(yjsUpdateBase64 ? { yjs_update_base64: yjsUpdateBase64 } : {}),
  };
};

const hashWorkspaceDocSnapshotPayload = (payload: WorkspaceDocSnapshotPayload): string => JSON.stringify(payload);

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
  const [docBootstrapLexicalState, setDocBootstrapLexicalState] = useState<Record<string, unknown>>(() => emptyLexicalState());
  const [docBootstrapYjsUpdateBase64, setDocBootstrapYjsUpdateBase64] = useState<string | null>(null);
  const [docBootstrapReady, setDocBootstrapReady] = useState(activePaneDocId === null);
  const [collabSession, setCollabSession] = useState<{
    roomId: string;
    websocketUrl: string;
    wsTicket: string;
    expiresAt: string;
  } | null>(null);
  const [collabSessionError, setCollabSessionError] = useState<string | null>(null);

  const docSnapshotSaveTimerRef = useRef<number | null>(null);
  const docSnapshotSaveStatesRef = useRef<Map<string, DocSnapshotSaveState>>(new Map());
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

  const clearDocSnapshotSaveTimer = useCallback(() => {
    if (docSnapshotSaveTimerRef.current !== null) {
      window.clearTimeout(docSnapshotSaveTimerRef.current);
      docSnapshotSaveTimerRef.current = null;
    }
  }, []);

  const getDocSnapshotSaveState = useCallback((docId: string): DocSnapshotSaveState => {
    const existingState = docSnapshotSaveStatesRef.current.get(docId);
    if (existingState) {
      return existingState;
    }

    const nextState: DocSnapshotSaveState = {
      lastSavedHash: '',
      queuedEntry: null,
      savePromise: null,
      version: 0,
    };
    docSnapshotSaveStatesRef.current.set(docId, nextState);
    return nextState;
  }, []);

  const saveQueuedDocSnapshot = useCallback(
    async (entry: PendingWorkspaceDocSnapshot, retryOnConflict = true): Promise<void> => {
      const docSnapshotState = getDocSnapshotSaveState(entry.docId);

      try {
        const result = await saveDocSnapshot(accessToken, entry.docId, {
          snapshot_version: docSnapshotState.version,
          snapshot_payload: entry.snapshotPayload,
        });

        docSnapshotState.lastSavedHash = entry.hash;
        docSnapshotState.version = result.snapshot_version;
      } catch (error) {
        if (retryOnConflict && error instanceof HubRequestError && error.status === 409) {
          const latestDoc = await getDocSnapshot(accessToken, entry.docId);
          const latestSnapshotPayload = normalizeWorkspaceDocSnapshotPayload(latestDoc.snapshot_payload);
          const latestSnapshotHash = hashWorkspaceDocSnapshotPayload(latestSnapshotPayload);

          docSnapshotState.version = latestDoc.snapshot_version;
          docSnapshotState.lastSavedHash = latestSnapshotHash;

          if (latestSnapshotHash !== entry.hash) {
            await saveQueuedDocSnapshot(entry, false);
          }
          return;
        }

        const queuedEntry = docSnapshotState.queuedEntry;
        if (!queuedEntry || queuedEntry.docId !== entry.docId || queuedEntry.hash !== entry.hash) {
          docSnapshotState.queuedEntry = entry;
        }
        throw error;
      }

      try {
        await materializeMentions(accessToken, {
          project_id: projectId,
          source_entity_type: 'doc',
          source_entity_id: entry.docId,
          mentions: extractDocMentionsFromLexicalState(entry.lexicalState),
          replace_source: true,
        });
      } catch (error) {
        if (
          !(error instanceof TypeError && error.message === 'Failed to fetch') &&
          !(error instanceof DOMException && error.name === 'AbortError')
        ) {
          console.warn('[workspace-doc] failed to materialize doc mentions', error);
        }
      }
    },
    [accessToken, getDocSnapshotSaveState, projectId],
  );

  const flushPendingDocSnapshot = useCallback(
    (targetDocId?: string | null) => {
      clearDocSnapshotSaveTimer();
      if (!targetDocId) {
        return;
      }

      const docSnapshotState = getDocSnapshotSaveState(targetDocId);
      if (docSnapshotState.savePromise) {
        return;
      }

      const entry = docSnapshotState.queuedEntry;
      if (!entry) {
        return;
      }

      docSnapshotState.queuedEntry = null;
      const savePromise = saveQueuedDocSnapshot(entry)
        .catch(() => {
          // best-effort doc metadata persistence and mention materialization
        })
        .finally(() => {
          if (docSnapshotState.savePromise === savePromise) {
            docSnapshotState.savePromise = null;
          }

          const nextEntry = docSnapshotState.queuedEntry;
          if (nextEntry) {
            flushPendingDocSnapshot(nextEntry.docId);
          }
        });

      docSnapshotState.savePromise = savePromise;
    },
    [clearDocSnapshotSaveTimer, getDocSnapshotSaveState, saveQueuedDocSnapshot],
  );

  useEffect(() => {
    setSelectedDocNodeKey(null);
    setPendingDocFocusNodeKey(null);
    setDocCommentComposerOpen(false);
    setDocCommentError(null);
    setDocBootstrapLexicalState(emptyLexicalState());
    setDocBootstrapYjsUpdateBase64(null);
    setDocBootstrapReady(activePaneDocId === null);
    setCollabSession(null);
    setCollabSessionError(null);
    clearDocSnapshotSaveTimer();
  }, [activePaneDocId, clearDocSnapshotSaveTimer]);

  useEffect(() => {
    let cancelled = false;

    if (!activePaneDocId || activeTab !== 'work' || !docBootstrapReady) {
      setCollabSession(null);
      setCollabSessionError(null);
      return () => {
        cancelled = true;
      };
    }

    const loadCollabSession = async () => {
      try {
        const authorization = await authorizeCollabDoc(accessToken, activePaneDocId);
        if (cancelled) {
          return;
        }

        setCollabSession({
          roomId: activePaneDocId,
          websocketUrl: env.hubCollabWsUrl,
          wsTicket: authorization.ws_ticket,
          expiresAt: authorization.ticket_expires_at,
        });
        setCollabSessionError(null);
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.warn('[workspace-doc] failed to authorize collaboration session', error);
        setCollabSession(null);
        setCollabSessionError('Workspace doc collaboration is unavailable right now.');
      }
    };

    void loadCollabSession();

    return () => {
      cancelled = true;
    };
  }, [accessToken, activePaneDocId, activeTab, docBootstrapReady]);

  useEffect(() => {
    void refreshDocComments();
  }, [refreshDocComments]);

  useEffect(() => {
    let cancelled = false;
    if (!activePaneDocId) {
      setDocBootstrapLexicalState(emptyLexicalState());
      setDocBootstrapYjsUpdateBase64(null);
      setDocBootstrapReady(true);
      return;
    }

    if (activeTab !== 'work') {
      return () => {
        cancelled = true;
      };
    }

    setDocBootstrapReady(false);

    const loadBootstrapSnapshot = async () => {
      try {
        const doc = await getDocSnapshot(accessToken, activePaneDocId);
        if (cancelled) {
          return;
        }

        const snapshotPayload = normalizeWorkspaceDocSnapshotPayload(doc.snapshot_payload);
        const docSnapshotState = getDocSnapshotSaveState(activePaneDocId);
        docSnapshotState.version = doc.snapshot_version;
        docSnapshotState.lastSavedHash = hashWorkspaceDocSnapshotPayload(snapshotPayload);
        setDocBootstrapLexicalState(snapshotPayload.lexical_state);
        setDocBootstrapYjsUpdateBase64(snapshotPayload.yjs_update_base64 || null);
      } catch (error) {
        if (!cancelled) {
          console.warn('[workspace-doc] failed to load bootstrap snapshot', error);
          setDocBootstrapLexicalState(emptyLexicalState());
          setDocBootstrapYjsUpdateBase64(null);
        }
      } finally {
        if (!cancelled) {
          setDocBootstrapReady(true);
        }
      }
    };

    void loadBootstrapSnapshot();

    return () => {
      cancelled = true;
    };
  }, [accessToken, activePaneDocId, activeTab, getDocSnapshotSaveState]);

  useEffect(() => {
    if (!activePaneDocId) {
      return;
    }

    const syncPresence = async () => {
      try {
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
    };
  }, [accessToken, activePaneDocId, activePaneId, activeTab]);

  useEffect(() => {
    if (!activePaneDocId) {
      return;
    }

    return () => {
      flushPendingDocSnapshot(activePaneDocId);
    };
  }, [activePaneDocId, flushPendingDocSnapshot]);

  const onDocEditorChange = useCallback(
    (payload: { lexicalState: Record<string, unknown>; plainText: string; yjsUpdateBase64?: string | null }) => {
      if (!activePaneDocId) {
        return;
      }

      setDocBootstrapLexicalState(payload.lexicalState);
      setDocBootstrapYjsUpdateBase64(payload.yjsUpdateBase64 || null);

      const docSnapshotState = getDocSnapshotSaveState(activePaneDocId);
      const snapshotPayload = buildWorkspaceDocSnapshotPayload(payload.lexicalState, payload.plainText, payload.yjsUpdateBase64);
      const nextHash = hashWorkspaceDocSnapshotPayload(snapshotPayload);
      if (nextHash === docSnapshotState.lastSavedHash) {
        return;
      }

      docSnapshotState.queuedEntry = {
        docId: activePaneDocId,
        lexicalState: payload.lexicalState,
        snapshotPayload,
        hash: nextHash,
      };

      clearDocSnapshotSaveTimer();
      docSnapshotSaveTimerRef.current = window.setTimeout(() => {
        flushPendingDocSnapshot(activePaneDocId);
      }, DOC_SNAPSHOT_SAVE_DEBOUNCE_MS);
    },
    [activePaneDocId, clearDocSnapshotSaveTimer, flushPendingDocSnapshot, getDocSnapshotSaveState],
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
    docBootstrapLexicalState,
    docBootstrapYjsUpdateBase64,
    docBootstrapReady,
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
