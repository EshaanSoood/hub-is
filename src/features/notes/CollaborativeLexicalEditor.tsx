import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AutoLinkNode, LinkNode } from '@lexical/link';
import { ListItemNode, ListNode } from '@lexical/list';
import { TRANSFORMERS } from '@lexical/markdown';
import { CodeNode } from '@lexical/code';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { CollaborationPlugin } from '@lexical/react/LexicalCollaborationPlugin';
import { LexicalCollaboration, useCollaborationContext } from '@lexical/react/LexicalCollaborationContext';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import type { Provider } from '@lexical/yjs';
import {
  $createParagraphNode,
  $createTextNode,
  $getNodeByKey,
  $getRoot,
  $getSelection,
  $insertNodes,
  $isRangeSelection,
  HISTORY_MERGE_TAG,
  SKIP_COLLAB_TAG,
} from 'lexical';
import { type Doc, encodeStateAsUpdate } from 'yjs';
import { editorStateToLexicalSnapshot, lexicalStateToPlainText, normalizeLexicalState } from './lexicalState';
import { notesLexicalTheme } from './lexicalTheme';
import { MediaAutoEmbedPlugin } from './MediaAutoEmbedPlugin';
import { MediaEmbedNode } from './nodes/MediaEmbedNode';
import { $createViewRefNode, ViewRefNode } from './nodes/ViewRefNode';
import { ViewEmbedProvider, type ViewEmbedRuntime } from './viewEmbedContext';
import {
  type CollaborationPhase,
  collabSessionManager,
  type CollabSessionSnapshot,
  type ManagedCollabProvider,
  type NoteCollaborationSession,
} from './collabSessionManager';

const COLLABORATION_BOOTSTRAP_FALLBACK_MS = 2_000;

const COLLABORATIVE_EDITOR_NODES = [
  HeadingNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  LinkNode,
  AutoLinkNode,
  CodeNode,
  ViewRefNode,
  MediaEmbedNode,
];

const uint8ArrayToBase64 = (value: Uint8Array): string => {
  let binary = '';
  for (let index = 0; index < value.length; index += 1) {
    binary += String.fromCharCode(value[index]);
  }
  return window.btoa(binary);
};

interface CollaborativeLexicalEditorProps {
  noteId: string;
  initialLexicalState: Record<string, unknown>;
  collaborationSession: NoteCollaborationSession | null;
  userName: string;
  editable: boolean;
  onDocumentChange: (payload: {
    lexicalState: Record<string, unknown>;
    plainText: string;
    yjsUpdateBase64?: string | null;
  }) => void;
  pendingAssetEmbed?: { embed_id: string; label: string; reference: string } | null;
  onAssetEmbedApplied?: (embedId: string) => void;
  pendingMentionInsert?: { insert_id: string; token: string } | null;
  onMentionInserted?: (insertId: string) => void;
  pendingViewEmbedInsert?: { insert_id: string; view_id: string; sizing?: 'compact' | 'expanded' } | null;
  onViewEmbedInserted?: (insertId: string) => void;
  focusNodeKey?: string | null;
  onNodeFocused?: (nodeKey: string) => void;
  viewEmbedRuntime?: ViewEmbedRuntime | null;
  onSelectedNodeChange?: (nodeKey: string | null) => void;
}

const shouldRestoreBootstrapSnapshot = (bootstrapPlainText: string, currentPlainText: string): boolean => {
  if (!bootstrapPlainText) {
    return false;
  }

  if (!currentPlainText) {
    return true;
  }

  return bootstrapPlainText.length > currentPlainText.length && bootstrapPlainText.startsWith(currentPlainText);
};

const restoreBootstrapSnapshot = ({
  editor,
  initialEditorState,
  initialPlainText,
}: {
  editor: ReturnType<typeof useLexicalComposerContext>[0];
  initialEditorState: string;
  initialPlainText: string;
}): boolean => {
  const currentSnapshot = editorStateToLexicalSnapshot(editor.getEditorState());
  if (!shouldRestoreBootstrapSnapshot(initialPlainText, currentSnapshot.plainText)) {
    return false;
  }

  const recoveredEditorState = editor.parseEditorState(initialEditorState);
  editor.setEditorState(recoveredEditorState, {
    tag: HISTORY_MERGE_TAG,
  });
  return true;
};

const useEditorBootstrap = (initialLexicalState: Record<string, unknown>) =>
  useMemo(() => {
    const normalizedState = normalizeLexicalState(initialLexicalState);
    return {
      plainText: lexicalStateToPlainText(normalizedState),
      serializedState: JSON.stringify(normalizedState),
    };
  }, [initialLexicalState]);

const useNoteCollaboration = (collaborationSession: NoteCollaborationSession | null) => {
  const roomId = collaborationSession?.roomId.trim() || '';
  const serverUrl = collaborationSession?.serverUrl.trim() || '';
  const collaborationEnabled = roomId.length > 0 && serverUrl.length > 0;
  const roomSession = useMemo(
    () => (collaborationEnabled && collaborationSession ? collabSessionManager.getSession(collaborationSession) : null),
    [collaborationEnabled, collaborationSession],
  );
  const [, setSnapshotVersion] = useState(0);
  const snapshot: CollabSessionSnapshot | null = roomSession?.getSnapshot() || null;

  useEffect(() => {
    if (!roomSession) {
      return undefined;
    }

    const unsubscribe = roomSession.subscribe(() => {
      setSnapshotVersion((version) => version + 1);
    });
    const release = roomSession.acquire();

    return () => {
      unsubscribe();
      release();
    };
  }, [roomSession]);

  const providerFactory = useCallback(
    (id: string, yjsDocMap: Map<string, Doc>): Provider => {
      if (!roomSession) {
        throw new Error('Collaboration session is unavailable.');
      }
      return roomSession.bindLexicalDoc(id, yjsDocMap);
    },
    [roomSession],
  );

  const getProvider = useCallback(() => roomSession?.provider || null, [roomSession]);
  const getSnapshot = useCallback(() => roomSession?.getSnapshot() || null, [roomSession]);

  return {
    collaborationEnabled,
    collaborationPhase: collaborationEnabled ? snapshot?.phase || 'connecting' : 'disabled',
    collaborationRoomId: collaborationEnabled ? roomId : null,
    getProvider,
    getSnapshot,
    providerFactory,
  };
};

const EditablePlugin = ({ editable }: { editable: boolean }) => {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    editor.setEditable(editable);
  }, [editor, editable]);

  return null;
};

const AssetEmbedInsertPlugin = ({
  pendingAssetEmbed,
  onAssetEmbedApplied,
}: {
  pendingAssetEmbed?: { embed_id: string; label: string; reference: string } | null;
  onAssetEmbedApplied?: (embedId: string) => void;
}) => {
  const [editor] = useLexicalComposerContext();
  const processedEmbedsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!editor.isEditable() || !pendingAssetEmbed || processedEmbedsRef.current.has(pendingAssetEmbed.embed_id)) {
      return;
    }

    processedEmbedsRef.current.add(pendingAssetEmbed.embed_id);
    editor.update(() => {
      const paragraph = $createParagraphNode();
      paragraph.append($createTextNode(`Asset: ${pendingAssetEmbed.label} (${pendingAssetEmbed.reference})`));
      $getRoot().append(paragraph);
    });
    onAssetEmbedApplied?.(pendingAssetEmbed.embed_id);
  }, [editor, onAssetEmbedApplied, pendingAssetEmbed]);

  return null;
};

const MentionInsertPlugin = ({
  pendingMentionInsert,
  onMentionInserted,
}: {
  pendingMentionInsert?: { insert_id: string; token: string } | null;
  onMentionInserted?: (insertId: string) => void;
}) => {
  const [editor] = useLexicalComposerContext();
  const processedMentionIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!editor.isEditable() || !pendingMentionInsert || processedMentionIdsRef.current.has(pendingMentionInsert.insert_id)) {
      return;
    }

    processedMentionIdsRef.current.add(pendingMentionInsert.insert_id);
    editor.update(() => {
      const selection = $getSelection();
      const tokenValue = `${pendingMentionInsert.token} `;
      if ($isRangeSelection(selection)) {
        selection.insertText(tokenValue);
        return;
      }
      const paragraph = $createParagraphNode();
      paragraph.append($createTextNode(tokenValue));
      $getRoot().append(paragraph);
    });

    onMentionInserted?.(pendingMentionInsert.insert_id);
  }, [editor, onMentionInserted, pendingMentionInsert]);

  return null;
};

const ViewEmbedInsertPlugin = ({
  pendingViewEmbedInsert,
  onViewEmbedInserted,
}: {
  pendingViewEmbedInsert?: { insert_id: string; view_id: string; sizing?: 'compact' | 'expanded' } | null;
  onViewEmbedInserted?: (insertId: string) => void;
}) => {
  const [editor] = useLexicalComposerContext();
  const processedViewEmbedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!editor.isEditable() || !pendingViewEmbedInsert || processedViewEmbedIdsRef.current.has(pendingViewEmbedInsert.insert_id)) {
      return;
    }

    processedViewEmbedIdsRef.current.add(pendingViewEmbedInsert.insert_id);
    editor.update(() => {
      const embedNode = $createViewRefNode(pendingViewEmbedInsert.view_id, pendingViewEmbedInsert.sizing || 'compact');
      const spacer = $createParagraphNode();
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        $insertNodes([embedNode, spacer]);
        return;
      }
      $getRoot().append(embedNode);
      $getRoot().append(spacer);
    });
    onViewEmbedInserted?.(pendingViewEmbedInsert.insert_id);
  }, [editor, onViewEmbedInserted, pendingViewEmbedInsert]);

  return null;
};

const FocusNodePlugin = ({
  focusNodeKey,
  onNodeFocused,
}: {
  focusNodeKey?: string | null;
  onNodeFocused?: (nodeKey: string) => void;
}) => {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (!focusNodeKey) {
      return;
    }

    let found = false;
    editor.update(() => {
      const node = $getNodeByKey(focusNodeKey);
      if (!node) {
        return;
      }
      found = true;
      if (typeof (node as unknown as { select?: () => void }).select === 'function') {
        (node as unknown as { select: () => void }).select();
      }
    });

    if (found) {
      editor.focus();
      const nodeElement = editor.getElementByKey(focusNodeKey);
      nodeElement?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      onNodeFocused?.(focusNodeKey);
    }
  }, [editor, focusNodeKey, onNodeFocused]);

  return null;
};

const SelectionTrackingPlugin = ({ onSelectedNodeChange }: { onSelectedNodeChange?: (nodeKey: string | null) => void }) => {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (!onSelectedNodeChange) {
      return undefined;
    }

    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          onSelectedNodeChange(selection.anchor.getNode().getKey() || null);
          return;
        }
        onSelectedNodeChange(null);
      });
    });
  }, [editor, onSelectedNodeChange]);

  return null;
};

const PersistencePlugin = ({
  collaborationRoomId,
  getCollabProvider,
  getCollabSnapshot,
  onDocumentChange,
}: {
  collaborationRoomId: string | null;
  getCollabProvider: () => ManagedCollabProvider | null;
  getCollabSnapshot: () => CollabSessionSnapshot | null;
  onDocumentChange: (payload: {
    lexicalState: Record<string, unknown>;
    plainText: string;
    yjsUpdateBase64?: string | null;
  }) => void;
}) => {
  const [editor] = useLexicalComposerContext();
  const { yjsDocMap } = useCollaborationContext();
  const saveTimerRef = useRef<number | null>(null);

  const getYjsUpdateBase64 = useCallback(() => {
    if (!collaborationRoomId) {
      return null;
    }

    const collabSnapshot = getCollabSnapshot();
    if (!collabSnapshot?.healthySynced) {
      return null;
    }

    const provider = getCollabProvider();
    if (!provider || !provider.synced || provider.hasUnsyncedChanges) {
      return null;
    }

    const doc = yjsDocMap.get(collaborationRoomId);
    if (!doc) {
      return null;
    }

    return uint8ArrayToBase64(encodeStateAsUpdate(doc));
  }, [collaborationRoomId, getCollabProvider, getCollabSnapshot, yjsDocMap]);

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState, dirtyElements, dirtyLeaves, tags }) => {
      if (tags.has(SKIP_COLLAB_TAG)) {
        return;
      }
      if (dirtyElements.size === 0 && dirtyLeaves.size === 0) {
        return;
      }

      const snapshot = editorStateToLexicalSnapshot(editorState);
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }

      saveTimerRef.current = window.setTimeout(() => {
        saveTimerRef.current = null;
        onDocumentChange({
          ...snapshot,
          yjsUpdateBase64: getYjsUpdateBase64(),
        });
      }, 0);
    });
  }, [editor, getYjsUpdateBase64, onDocumentChange]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  return null;
};

const BootstrapGuardPlugin = ({
  collaborationEnabled,
  collaborationPhase,
  initialEditorState,
  initialPlainText,
}: {
  collaborationEnabled: boolean;
  collaborationPhase: CollaborationPhase;
  initialEditorState: string;
  initialPlainText: string;
}) => {
  const [editor] = useLexicalComposerContext();
  const restoredRef = useRef(false);

  const restoreIfNeeded = useCallback(() => {
    if (restoredRef.current) {
      return;
    }

    const restored = restoreBootstrapSnapshot({
      editor,
      initialEditorState,
      initialPlainText,
    });
    if (restored) {
      restoredRef.current = true;
    }
  }, [editor, initialEditorState, initialPlainText]);

  useEffect(() => {
    if (!collaborationEnabled || collaborationPhase !== 'synced' || restoredRef.current) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      restoreIfNeeded();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [collaborationEnabled, collaborationPhase, restoreIfNeeded]);

  useEffect(() => {
    if (!collaborationEnabled || restoredRef.current) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      restoreIfNeeded();
    }, COLLABORATION_BOOTSTRAP_FALLBACK_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [collaborationEnabled, collaborationPhase, restoreIfNeeded]);

  return null;
};

export const CollaborativeLexicalEditor = ({
  noteId,
  initialLexicalState,
  collaborationSession,
  userName,
  editable,
  onDocumentChange,
  pendingAssetEmbed,
  onAssetEmbedApplied,
  pendingMentionInsert,
  onMentionInserted,
  pendingViewEmbedInsert,
  onViewEmbedInserted,
  focusNodeKey,
  onNodeFocused,
  viewEmbedRuntime,
  onSelectedNodeChange,
}: CollaborativeLexicalEditorProps) => {
  const bootstrap = useEditorBootstrap(initialLexicalState);
  const {
    collaborationEnabled,
    collaborationPhase,
    collaborationRoomId,
    getProvider,
    getSnapshot,
    providerFactory,
  } = useNoteCollaboration(collaborationSession);

  const initialConfig = useMemo(
    () => ({
      namespace: `hub-note-${noteId}`,
      theme: notesLexicalTheme,
      editorState: bootstrap.serializedState,
      editable,
      nodes: COLLABORATIVE_EDITOR_NODES,
      onError: (error: Error) => {
        throw error;
      },
    }),
    [bootstrap.serializedState, editable, noteId],
  );

  return (
    <ViewEmbedProvider value={viewEmbedRuntime || null}>
      <LexicalCollaboration>
        <LexicalComposer initialConfig={initialConfig}>
          <EditablePlugin editable={editable} />
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                className="hub-editor__content min-h-56 rounded-panel border border-border-muted bg-surface-elevated px-3 py-3 text-sm text-text focus-visible:outline-none"
                aria-label="Project note editor"
              />
            }
            placeholder={<div className="hub-editor__placeholder">Write project notes...</div>}
            ErrorBoundary={LexicalErrorBoundary}
          />
          {collaborationEnabled ? (
            <CollaborationPlugin
              id={collaborationRoomId || noteId}
              providerFactory={providerFactory}
              shouldBootstrap={false}
              initialEditorState={bootstrap.serializedState}
              username={userName}
            />
          ) : null}
          <PersistencePlugin
            collaborationRoomId={collaborationRoomId}
            getCollabProvider={getProvider}
            getCollabSnapshot={getSnapshot}
            onDocumentChange={onDocumentChange}
          />
          <BootstrapGuardPlugin
            collaborationEnabled={collaborationEnabled}
            collaborationPhase={collaborationPhase}
            initialEditorState={bootstrap.serializedState}
            initialPlainText={bootstrap.plainText}
          />
          <SelectionTrackingPlugin onSelectedNodeChange={onSelectedNodeChange} />
          <FocusNodePlugin focusNodeKey={focusNodeKey} onNodeFocused={onNodeFocused} />
          <AssetEmbedInsertPlugin pendingAssetEmbed={pendingAssetEmbed} onAssetEmbedApplied={onAssetEmbedApplied} />
          <MentionInsertPlugin pendingMentionInsert={pendingMentionInsert} onMentionInserted={onMentionInserted} />
          <ViewEmbedInsertPlugin pendingViewEmbedInsert={pendingViewEmbedInsert} onViewEmbedInserted={onViewEmbedInserted} />
          <MediaAutoEmbedPlugin />
          <ListPlugin />
          <LinkPlugin />
          <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
        </LexicalComposer>
      </LexicalCollaboration>
    </ViewEmbedProvider>
  );
};
