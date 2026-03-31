import { useCallback, useEffect, useMemo, useRef } from 'react';
import { AutoLinkNode, LinkNode } from '@lexical/link';
import { ListItemNode, ListNode } from '@lexical/list';
import { TRANSFORMERS } from '@lexical/markdown';
import { CodeNode } from '@lexical/code';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { CollaborationPlugin } from '@lexical/react/LexicalCollaborationPlugin';
import { LexicalCollaboration } from '@lexical/react/LexicalCollaborationContext';
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
  SKIP_COLLAB_TAG,
} from 'lexical';
import { Doc, encodeStateAsUpdate } from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { editorStateToLexicalSnapshot, normalizeLexicalState } from './lexicalState';
import { notesLexicalTheme } from './lexicalTheme';
import { MediaAutoEmbedPlugin } from './MediaAutoEmbedPlugin';
import { MediaEmbedNode } from './nodes/MediaEmbedNode';
import { $createViewRefNode, ViewRefNode } from './nodes/ViewRefNode';
import { ViewEmbedProvider, type ViewEmbedRuntime } from './viewEmbedContext';

export type CollabConnectionStatus = 'connected' | 'connecting' | 'disconnected';

const uint8ArrayToBase64 = (value: Uint8Array): string => {
  let binary = '';
  for (let index = 0; index < value.length; index += 1) {
    binary += String.fromCharCode(value[index]);
  }
  return window.btoa(binary);
};

export interface NoteCollaborationSession {
  roomId: string;
  websocketUrl: string;
  wsTicket: string;
  expiresAt: string;
}

interface CollaborativeLexicalEditorProps {
  noteId: string;
  initialLexicalState: Record<string, unknown>;
  bootstrapYjsUpdateBase64?: string | null;
  collaborationSession: NoteCollaborationSession | null;
  userName: string;
  editable: boolean;
  onDocumentChange: (payload: { lexicalState: Record<string, unknown>; plainText: string; yjsUpdateBase64?: string | null }) => void;
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
  onConnectionStatusChange?: (status: CollabConnectionStatus) => void;
  onPresenceChange?: (activeEditors: number, names: string[]) => void;
}

const EditablePlugin = ({ editable }: { editable: boolean }) => {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    editor.setEditable(editable);
  }, [editor, editable]);

  return null;
};

const noteAwareNames = (provider: WebsocketProvider): string[] => {
  const values = Array.from(provider.awareness.getStates().values());
  const names = values
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return '';
      }

      const state = entry as Record<string, unknown>;
      const topLevelName = state.name;
      if (typeof topLevelName === 'string' && topLevelName.trim()) {
        return topLevelName.trim();
      }

      const user = state.user;
      if (!user || typeof user !== 'object') {
        return '';
      }

      const nestedName = (user as { name?: unknown }).name;
      return typeof nestedName === 'string' ? nestedName.trim() : '';
    })
    .filter(Boolean);

  return [...new Set(names)];
};

const getDocFromMap = (id: string, yjsDocMap: Map<string, Doc>): Doc => {
  let doc = yjsDocMap.get(id);

  if (doc === undefined) {
    doc = new Doc();
    yjsDocMap.set(id, doc);
  } else {
    doc.load();
  }

  return doc;
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
  onDocumentChange,
  getYjsUpdateBase64,
}: {
  onDocumentChange: (payload: { lexicalState: Record<string, unknown>; plainText: string; yjsUpdateBase64?: string | null }) => void;
  getYjsUpdateBase64?: (() => string | null) | null;
}) => {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState, dirtyElements, dirtyLeaves, tags }) => {
      if (tags.has(SKIP_COLLAB_TAG)) {
        return;
      }
      if (dirtyElements.size === 0 && dirtyLeaves.size === 0) {
        return;
      }
      const snapshot = editorStateToLexicalSnapshot(editorState);
      queueMicrotask(() => {
        onDocumentChange({
          ...snapshot,
          yjsUpdateBase64: getYjsUpdateBase64?.() || null,
        });
      });
    });
  }, [editor, getYjsUpdateBase64, onDocumentChange]);

  return null;
};

export const CollaborativeLexicalEditor = ({
  noteId,
  initialLexicalState,
  bootstrapYjsUpdateBase64,
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
  onConnectionStatusChange,
  onPresenceChange,
}: CollaborativeLexicalEditorProps) => {
  const collaborationRoomId = collaborationSession?.roomId ?? null;
  const collaborationWebsocketUrl = collaborationSession?.websocketUrl ?? null;
  const collaborationWsTicket = collaborationSession?.wsTicket ?? null;
  const collaborationDocRef = useRef<Doc | null>(null);
  const collaborationProviderRef = useRef<WebsocketProvider | null>(null);
  const collaborationProviderCleanupRef = useRef<(() => void) | null>(null);
  const normalizedInitialEditorState = useMemo(() => JSON.stringify(normalizeLexicalState(initialLexicalState)), [initialLexicalState]);
  const collabInitialEditorState = bootstrapYjsUpdateBase64 ? undefined : normalizedInitialEditorState;

  const initialConfig = useMemo(
    () => ({
      namespace: `hub-note-${noteId}`,
      theme: notesLexicalTheme,
      editorState: collaborationRoomId ? null : normalizedInitialEditorState,
      editable,
      nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode, LinkNode, AutoLinkNode, CodeNode, ViewRefNode, MediaEmbedNode],
      onError: (error: Error) => {
        throw error;
      },
    }),
    [collaborationRoomId, editable, normalizedInitialEditorState, noteId],
  );

  const providerFactory = useCallback(
    (id: string, yjsDocMap: Map<string, Doc>): Provider => {
      if (!collaborationRoomId || !collaborationWebsocketUrl || !collaborationWsTicket) {
        throw new Error('Collaboration session is unavailable.');
      }
      if (id !== collaborationRoomId) {
        throw new Error(`Unexpected collaboration room: ${id}`);
      }

      const doc = getDocFromMap(id, yjsDocMap);
      const provider = new WebsocketProvider(collaborationWebsocketUrl, id, doc, {
        connect: false,
        params: {
          ws_ticket: collaborationWsTicket,
        },
      });

      collaborationDocRef.current = doc;
      collaborationProviderCleanupRef.current?.();

      const applyPresence = () => {
        const names = noteAwareNames(provider);
        const editorCount = Math.max(provider.awareness.getStates().size, 1);
        onPresenceChange?.(editorCount, names);
      };

      const handleStatus = ({ status }: { status: CollabConnectionStatus }) => {
        onConnectionStatusChange?.(status);
      };

      const handleAwarenessChange = () => {
        applyPresence();
      };

      provider.on('status', handleStatus);
      provider.awareness.on('change', handleAwarenessChange);
      onConnectionStatusChange?.(provider.wsconnected ? 'connected' : provider.wsconnecting ? 'connecting' : 'disconnected');
      applyPresence();

      collaborationProviderRef.current = provider;
      collaborationProviderCleanupRef.current = () => {
        provider.off('status', handleStatus);
        provider.awareness.off('change', handleAwarenessChange);
        if (collaborationProviderRef.current === provider) {
          collaborationProviderRef.current = null;
        }
        onConnectionStatusChange?.('disconnected');
        onPresenceChange?.(0, []);
      };

      return provider as unknown as Provider;
    },
    [collaborationRoomId, collaborationWebsocketUrl, collaborationWsTicket, onConnectionStatusChange, onPresenceChange],
  );

  const getYjsUpdateBase64 = useCallback(() => {
    const doc = collaborationDocRef.current;
    return doc ? uint8ArrayToBase64(encodeStateAsUpdate(doc)) : null;
  }, []);

  useEffect(() => {
    if (collaborationRoomId) {
      return;
    }

    collaborationDocRef.current = null;
    collaborationProviderCleanupRef.current?.();
    collaborationProviderCleanupRef.current = null;
    onConnectionStatusChange?.('disconnected');
    onPresenceChange?.(0, []);
  }, [collaborationRoomId, onConnectionStatusChange, onPresenceChange]);

  useEffect(() => {
    return () => {
      collaborationProviderCleanupRef.current?.();
      collaborationProviderCleanupRef.current = null;
      collaborationDocRef.current = null;
      onConnectionStatusChange?.('disconnected');
      onPresenceChange?.(0, []);
    };
  }, [onConnectionStatusChange, onPresenceChange]);

  if (collaborationRoomId && (!collaborationWebsocketUrl || !collaborationWsTicket)) {
    return null;
  }

  const collaborationPlugin =
    collaborationRoomId && collaborationWebsocketUrl && collaborationWsTicket ? (
      <CollaborationPlugin
        id={collaborationRoomId}
        providerFactory={providerFactory}
        shouldBootstrap
        initialEditorState={collabInitialEditorState}
        awarenessData={{ name: userName }}
      />
    ) : null;

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
          {collaborationPlugin}
          <PersistencePlugin onDocumentChange={onDocumentChange} getYjsUpdateBase64={getYjsUpdateBase64} />
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
