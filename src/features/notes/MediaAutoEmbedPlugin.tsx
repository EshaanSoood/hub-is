import { useEffect, useRef } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $createParagraphNode,
  $isParagraphNode,
  $nodesOfType,
  COMMAND_PRIORITY_LOW,
  PASTE_COMMAND,
  ParagraphNode,
} from 'lexical';
import { matchMediaEmbed } from '../../lib/mediaEmbed';
import { $createMediaEmbedNode } from './nodes/MediaEmbedNode';

const replaceStandaloneUrlParagraph = (paragraph: ParagraphNode, expectedUrl: string) => {
  const rawText = paragraph.getTextContent();
  const trimmedText = rawText.trim();
  if (rawText !== trimmedText || trimmedText !== expectedUrl) {
    return;
  }

  const match = matchMediaEmbed(trimmedText);
  if (!match) {
    return;
  }

  const nextSibling = paragraph.getNextSibling();
  const embedNode = $createMediaEmbedNode(match.provider, match.embedUrl, match.originalUrl);
  paragraph.replace(embedNode);
  if (nextSibling) {
    nextSibling.selectStart();
    return;
  }

  const spacer = $createParagraphNode();
  embedNode.insertAfter(spacer);
  spacer.selectStart();
};

export const MediaAutoEmbedPlugin = () => {
  const [editor] = useLexicalComposerContext();
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return editor.registerCommand(
      PASTE_COMMAND,
      (event) => {
        const pastedText = event instanceof ClipboardEvent ? event.clipboardData?.getData('text/plain') ?? '' : '';
        const normalizedText = pastedText.trim();
        if (!normalizedText || !matchMediaEmbed(normalizedText)) {
          return false;
        }

        if (timeoutRef.current !== null) {
          window.clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = window.setTimeout(() => {
          editor.update(() => {
            for (const paragraph of $nodesOfType(ParagraphNode)) {
              if ($isParagraphNode(paragraph)) {
                replaceStandaloneUrlParagraph(paragraph, normalizedText);
              }
            }
          });
          timeoutRef.current = null;
        }, 0);

        return false;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return null;
};
