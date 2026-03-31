import { useEffect, useMemo, useRef } from 'react';
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
import { Doc, XmlText, applyUpdate, encodeStateAsUpdate } from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { editorStateToLexicalSnapshot, normalizeLexicalState } from './lexicalState';
import { notesLexicalTheme } from './lexicalTheme';
import { MediaAutoEmbedPlugin } from './MediaAutoEmbedPlugin';
import { MediaEmbedNode } from './nodes/MediaEmbedNode';
import { $createViewRefNode, ViewRefNode } from './nodes/ViewRefNode';
import { ViewEmbedProvider, type ViewEmbedRuntime } from './viewEmbedContext';

export type CollabConnectionStatus = 'connected' | 'connecting' | 'disconnected';

const hasYjsDocumentState = (doc: Doc): boolean => doc.store.clients.size > 0;

const base64ToUint8Array = (value: string): Uint8Array => {
  const binary = window.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

const uint8ArrayToBase64 = (value: Uint8Array): string => {
  let binary = '';
  for (let index = 0; index < value.length; index += 1) {
    binary += String.fromCharCode(value[index]);
  }
  return window.btoa(binary);
};

type CollaborationResources = {
  doc: Doc;
  provider: WebsocketProvider;
};

export interface NoteCollaborationSession {
  roomId: string;
  websocketUrl: string;
  token: string;
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
  const collaborationResources = useMemo<CollaborationResources | null>(() => {
    if (!collaborationSession) {
      return null;
    }

    const doc = new Doc();
    doc.get('root', XmlText);

    if (bootstrapYjsUpdateBase64 && !hasYjsDocumentState(doc)) {
      try {
        applyUpdate(doc, base64ToUint8Array(bootstrapYjsUpdateBase64), 'rest-bootstrap');
      } catch (error) {
        console.warn('[workspace-doc] failed to apply Yjs bootstrap snapshot', error);
      }
    }

    return {
      doc,
      provider: new WebsocketProvider(collaborationSession.websocketUrl, collaborationSession.roomId, doc, {
        connect: false,
        params: {
          access_token: collaborationSession.token,
        },
      }),
    };
  }, [bootstrapYjsUpdateBase64, collaborationSession]);
  const normalizedInitialEditorState = useMemo(() => JSON.stringify(normalizeLexicalState(initialLexicalState)), [initialLexicalState]);

  const initialConfig = useMemo(
    () => ({
      namespace: `hub-note-${noteId}`,
      theme: notesLexicalTheme,
      editorState: collaborationSession ? null : normalizedInitialEditorState,
      editable,
      nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode, LinkNode, AutoLinkNode, CodeNode, ViewRefNode, MediaEmbedNode],
      onError: (error: Error) => {
        throw error;
      },
    }),
    [collaborationSession, editable, normalizedInitialEditorState, noteId],
  );

  const providerFactory = useMemo(() => {
    if (!collaborationSession || !collaborationResources) {
      return null;
    }

    return (id: string, yjsDocMap: Map<string, Doc>): Provider => {
      if (id !== collaborationSession.roomId) {
        throw new Error(`Unexpected collaboration room: ${id}`);
      }

      if (yjsDocMap.get(id) !== collaborationResources.doc) {
        yjsDocMap.set(id, collaborationResources.doc);
      }

      return collaborationResources.provider as unknown as Provider;
    };
  }, [collaborationResources, collaborationSession]);

  const getYjsUpdateBase64 = useMemo(() => {
    if (!collaborationResources) {
      return null;
    }

    return () => uint8ArrayToBase64(encodeStateAsUpdate(collaborationResources.doc));
  }, [collaborationResources]);

  useEffect(() => {
    if (!collaborationResources) {
      return;
    }

    return () => {
      collaborationResources.provider.destroy();
      collaborationResources.doc.destroy();
    };
  }, [collaborationResources]);

  useEffect(() => {
    if (!collaborationResources) {
      onConnectionStatusChange?.('disconnected');
      onPresenceChange?.(0, []);
      return;
    }

    const { provider } = collaborationResources;
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

    return () => {
      provider.off('status', handleStatus);
      provider.awareness.off('change', handleAwarenessChange);
      onConnectionStatusChange?.('disconnected');
      onPresenceChange?.(0, []);
    };
  }, [collaborationResources, onConnectionStatusChange, onPresenceChange]);

  if (collaborationSession && (!collaborationResources || !providerFactory)) {
    return null;
  }

  const collaborationPlugin =
    collaborationSession && providerFactory ? (
      <CollaborationPlugin
        id={collaborationSession.roomId}
        providerFactory={providerFactory}
        shouldBootstrap
        initialEditorState={normalizedInitialEditorState}
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
          {collaborationPlugin}
        </LexicalComposer>
      </LexicalCollaboration>
    </ViewEmbedProvider>
  );
};
