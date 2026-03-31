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
};

type PendingWorkspaceDocSnapshot = {
  docId: string;
  lexicalState: Record<string, unknown>;
  snapshotPayload: WorkspaceDocSnapshotPayload;
  hash: string;
  snapshotVersion: number;
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
): WorkspaceDocSnapshotPayload => ({
  lexical_state: lexicalState,
  plain_text: plainText,
  node_keys: extractNodeKeysFromLexicalState(lexicalState),
});

const normalizeWorkspaceDocSnapshotPayload = (payload: unknown): WorkspaceDocSnapshotPayload => {
  const record = payload && typeof payload === 'object' && !Array.isArray(payload) ? (payload as Record<string, unknown>) : {};
  const lexicalState = normalizeLexicalState(record.lexical_state);
  const plainText = typeof record.plain_text === 'string' ? record.plain_text : lexicalStateToPlainText(lexicalState);
  const nodeKeys = Array.isArray(record.node_keys)
    ? record.node_keys.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    : extractNodeKeysFromLexicalState(lexicalState);

  return {
    lexical_state: lexicalState,
    plain_text: plainText,
    node_keys: nodeKeys,
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
  const [docBootstrapReady, setDocBootstrapReady] = useState(activePaneDocId === null);
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
  const queuedDocSnapshotRef = useRef<PendingWorkspaceDocSnapshot | null>(null);
  const activePaneDocIdRef = useRef<string | null>(activePaneDocId);
  const docSnapshotSavePromiseRef = useRef<Promise<void> | null>(null);
  const latestDocCommentsRequestRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    activePaneDocIdRef.current = activePaneDocId;
  }, [activePaneDocId]);

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

  const saveQueuedDocSnapshot = useCallback(
    async (entry: PendingWorkspaceDocSnapshot, retryOnConflict = true): Promise<void> => {
      try {
        const result = await saveDocSnapshot(accessToken, entry.docId, {
          snapshot_version: entry.snapshotVersion,
          snapshot_payload: entry.snapshotPayload,
        });

        if (activePaneDocIdRef.current === entry.docId) {
          lastDocSnapshotHashRef.current = entry.hash;
          docSnapshotVersionRef.current = result.snapshot_version;
        }

        const queuedEntry = queuedDocSnapshotRef.current;
        if (queuedEntry?.docId === entry.docId) {
          queuedDocSnapshotRef.current = {
            ...queuedEntry,
            snapshotVersion: result.snapshot_version,
          };
        }
      } catch (error) {
        if (retryOnConflict && error instanceof HubRequestError && error.status === 409) {
          try {
            const latestDoc = await getDocSnapshot(accessToken, entry.docId);
            const latestSnapshotPayload = normalizeWorkspaceDocSnapshotPayload(latestDoc.snapshot_payload);
            const latestSnapshotHash = hashWorkspaceDocSnapshotPayload(latestSnapshotPayload);
            const latestLocalEntry =
              queuedDocSnapshotRef.current?.docId === entry.docId ? queuedDocSnapshotRef.current : entry;

            if (activePaneDocIdRef.current === entry.docId) {
              docSnapshotVersionRef.current = latestDoc.snapshot_version;
              lastDocSnapshotHashRef.current = latestSnapshotHash;
            }

            if (latestLocalEntry.hash === latestSnapshotHash) {
              if (queuedDocSnapshotRef.current?.docId === entry.docId && queuedDocSnapshotRef.current.hash === latestLocalEntry.hash) {
                queuedDocSnapshotRef.current = null;
              }
              return;
            }

            if (queuedDocSnapshotRef.current?.docId === entry.docId && queuedDocSnapshotRef.current.hash === latestLocalEntry.hash) {
              queuedDocSnapshotRef.current = null;
            }

            await saveQueuedDocSnapshot(
              {
                ...latestLocalEntry,
                snapshotVersion: latestDoc.snapshot_version,
              },
              false,
            );
            return;
          } catch (conflictRecoveryError) {
            const queuedEntry = queuedDocSnapshotRef.current;
            if (!queuedEntry || queuedEntry.docId !== entry.docId || queuedEntry.hash !== entry.hash) {
              queuedDocSnapshotRef.current = entry;
            }
            throw conflictRecoveryError;
          }
        }

        const queuedEntry = queuedDocSnapshotRef.current;
        if (!queuedEntry || queuedEntry.docId !== entry.docId || queuedEntry.hash !== entry.hash) {
          queuedDocSnapshotRef.current = entry;
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
        console.warn('[workspace-doc] failed to materialize doc mentions', error);
      }
    },
    [accessToken, projectId],
  );

  const flushPendingDocSnapshot = useCallback(
    (targetDocId?: string | null) => {
      clearDocSnapshotSaveTimer();
      if (docSnapshotSavePromiseRef.current) {
        return;
      }

      const entry = queuedDocSnapshotRef.current;
      if (!entry || (targetDocId && entry.docId !== targetDocId)) {
        return;
      }

      queuedDocSnapshotRef.current = null;
      const savePromise = saveQueuedDocSnapshot(entry)
        .catch(() => {
          // best-effort doc metadata persistence and mention materialization
        })
        .finally(() => {
          if (docSnapshotSavePromiseRef.current === savePromise) {
            docSnapshotSavePromiseRef.current = null;
          }

          const nextEntry = queuedDocSnapshotRef.current;
          if (nextEntry) {
            flushPendingDocSnapshot(nextEntry.docId);
          }
        });

      docSnapshotSavePromiseRef.current = savePromise;
    },
    [clearDocSnapshotSaveTimer, saveQueuedDocSnapshot],
  );

  useEffect(() => {
    lastDocSnapshotHashRef.current = '';
    queuedDocSnapshotRef.current = null;
    docSnapshotVersionRef.current = 0;
    setSelectedDocNodeKey(null);
    setPendingDocFocusNodeKey(null);
    setDocCommentComposerOpen(false);
    setDocCommentError(null);
    setDocBootstrapLexicalState(emptyLexicalState());
    setDocBootstrapReady(activePaneDocId === null);
    setCollabSession(null);
    setCollabSessionError(null);
    clearDocSnapshotSaveTimer();
  }, [activePaneDocId, clearDocSnapshotSaveTimer, flushPendingDocSnapshot]);

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
    let cancelled = false;
    if (!activePaneDocId) {
      setDocBootstrapLexicalState(emptyLexicalState());
      setDocBootstrapReady(true);
      return;
    }

    const loadBootstrapSnapshot = async () => {
      try {
        const doc = await getDocSnapshot(accessToken, activePaneDocId);
        if (cancelled) {
          return;
        }

        const snapshotPayload = normalizeWorkspaceDocSnapshotPayload(doc.snapshot_payload);
        docSnapshotVersionRef.current = doc.snapshot_version;
        lastDocSnapshotHashRef.current = hashWorkspaceDocSnapshotPayload(snapshotPayload);
        setDocBootstrapLexicalState(snapshotPayload.lexical_state);
      } catch (error) {
        if (!cancelled) {
          console.warn('[workspace-doc] failed to load bootstrap snapshot', error);
          setDocBootstrapLexicalState(emptyLexicalState());
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
  }, [accessToken, activePaneDocId]);

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
    (payload: { lexicalState: Record<string, unknown>; plainText: string }) => {
      if (!activePaneDocId) {
        return;
      }

      const snapshotPayload = buildWorkspaceDocSnapshotPayload(payload.lexicalState, payload.plainText);
      const nextHash = hashWorkspaceDocSnapshotPayload(snapshotPayload);
      if (nextHash === lastDocSnapshotHashRef.current) {
        return;
      }

      queuedDocSnapshotRef.current = {
        docId: activePaneDocId,
        lexicalState: payload.lexicalState,
        snapshotPayload,
        hash: nextHash,
        snapshotVersion: docSnapshotVersionRef.current,
      };

      clearDocSnapshotSaveTimer();
      docSnapshotSaveTimerRef.current = window.setTimeout(() => {
        flushPendingDocSnapshot(activePaneDocId);
      }, DOC_SNAPSHOT_SAVE_DEBOUNCE_MS);
    },
    [activePaneDocId, clearDocSnapshotSaveTimer, flushPendingDocSnapshot],
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
