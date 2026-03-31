import { useCallback, useEffect, useMemo, useRef } from 'react';
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
import { HocuspocusProvider } from '@hocuspocus/provider';
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
import { editorStateToLexicalSnapshot, normalizeLexicalState } from './lexicalState';
import { notesLexicalTheme } from './lexicalTheme';
import { MediaAutoEmbedPlugin } from './MediaAutoEmbedPlugin';
import { MediaEmbedNode } from './nodes/MediaEmbedNode';
import { $createViewRefNode, ViewRefNode } from './nodes/ViewRefNode';
import { ViewEmbedProvider, type ViewEmbedRuntime } from './viewEmbedContext';

const uint8ArrayToBase64 = (value: Uint8Array): string => {
  let binary = '';
  for (let index = 0; index < value.length; index += 1) {
    binary += String.fromCharCode(value[index]);
  }
  return window.btoa(binary);
};

export interface NoteCollaborationSession {
  roomId: string;
  serverUrl: string;
  getAccessToken: () => Promise<string> | string;
}

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
  onDocumentChange,
}: {
  collaborationRoomId: string | null;
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

    const doc = yjsDocMap.get(collaborationRoomId);
    if (!doc) {
      return null;
    }

    return uint8ArrayToBase64(encodeStateAsUpdate(doc));
  }, [collaborationRoomId, yjsDocMap]);

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

class LexicalHocuspocusProvider extends HocuspocusProvider {
  constructor(configuration: ConstructorParameters<typeof HocuspocusProvider>[0]) {
    super(configuration);
    super.on('synced', ({ state }: { state: boolean }) => {
      this.emit('sync', state);
    });
  }

  override async connect(): Promise<void> {
    await super.connect();
  }
}

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
  const normalizedInitialEditorState = useMemo(
    () => JSON.stringify(normalizeLexicalState(initialLexicalState)),
    [initialLexicalState],
  );
  const collaborationRoomId = collaborationSession?.roomId ?? null;
  const collaborationEnabled =
    collaborationSession !== null &&
    collaborationSession.roomId.trim().length > 0 &&
    collaborationSession.serverUrl.trim().length > 0;

  const initialConfig = useMemo(
    () => ({
      namespace: `hub-note-${noteId}`,
      theme: notesLexicalTheme,
      editorState: collaborationEnabled ? null : normalizedInitialEditorState,
      editable,
      nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode, LinkNode, AutoLinkNode, CodeNode, ViewRefNode, MediaEmbedNode],
      onError: (error: Error) => {
        throw error;
      },
    }),
    [collaborationEnabled, editable, normalizedInitialEditorState, noteId],
  );

  const providerFactory = useCallback(
    (id: string, yjsDocMap: Map<string, Doc>): Provider => {
      if (!collaborationEnabled || !collaborationSession) {
        throw new Error('Collaboration session is unavailable.');
      }

      let doc = yjsDocMap.get(id);
      if (!doc) {
        doc = new Doc();
        yjsDocMap.set(id, doc);
      }

      return new LexicalHocuspocusProvider({
        document: doc,
        name: id,
        token: async () => await collaborationSession.getAccessToken(),
        url: collaborationSession.serverUrl,
      }) as unknown as Provider;
    },
    [collaborationEnabled, collaborationSession],
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
              id={collaborationSession.roomId}
              providerFactory={providerFactory}
              shouldBootstrap={true}
              initialEditorState={normalizedInitialEditorState}
              username={userName}
            />
          ) : null}
          <PersistencePlugin collaborationRoomId={collaborationRoomId} onDocumentChange={onDocumentChange} />
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
