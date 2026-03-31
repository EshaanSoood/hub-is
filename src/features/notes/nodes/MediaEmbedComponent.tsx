import { useCallback, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useLexicalEditable } from '@lexical/react/useLexicalEditable';
import { $createParagraphNode, $createTextNode, $getNodeByKey, type NodeKey } from 'lexical';
import type { MediaEmbedProvider } from '../../../lib/mediaEmbed';
import { $isMediaEmbedNode } from './MediaEmbedNode';

interface MediaEmbedComponentProps {
  nodeKey: NodeKey;
  provider: MediaEmbedProvider;
  embedUrl: string;
  originalUrl: string;
}

const mediaTitle = (provider: MediaEmbedProvider): string => {
  switch (provider) {
    case 'youtube':
      return 'YouTube video';
    case 'vimeo':
      return 'Vimeo video';
    case 'spotify':
      return 'Spotify player';
    case 'soundcloud':
      return 'SoundCloud player';
  }
};

const spotifyFrameClass = (originalUrl: string): string => {
  const match = originalUrl.match(/open\.spotify\.com\/(track|album|playlist|episode)\//i);
  return match?.[1]?.toLowerCase() === 'track' ? 'h-20' : 'h-80';
};

const wrapperSizeClass = (provider: MediaEmbedProvider, originalUrl: string): string => {
  switch (provider) {
    case 'youtube':
    case 'vimeo':
      return 'aspect-video';
    case 'spotify':
      return spotifyFrameClass(originalUrl);
    case 'soundcloud':
      return 'h-40';
  }
};

export const MediaEmbedComponent = ({
  nodeKey,
  provider,
  embedUrl,
  originalUrl,
}: MediaEmbedComponentProps) => {
  const [editor] = useLexicalComposerContext();
  const editable = useLexicalEditable();
  const title = mediaTitle(provider);

  const moveSelectionAroundEmbed = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (!['ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'].includes(event.key)) {
        return;
      }

      event.preventDefault();
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if (!$isMediaEmbedNode(node)) {
          return;
        }

        if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
          node.selectPrevious();
          return;
        }

        node.selectNext();
      });
      editor.focus();
    },
    [editor, nodeKey],
  );

  const onRestoreUrl = useCallback(() => {
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if (!$isMediaEmbedNode(node)) {
        return;
      }

      const paragraph = $createParagraphNode();
      paragraph.append($createTextNode(originalUrl));
      node.replace(paragraph);
      paragraph.selectEnd();
    });
    editor.focus();
  }, [editor, nodeKey, originalUrl]);

  return (
    <div
      className="group relative my-3"
      role="button"
      tabIndex={0}
      aria-label={title}
      aria-roledescription="embedded media"
      onKeyDown={moveSelectionAroundEmbed}
    >
      <div className={`w-full overflow-hidden rounded-panel border border-border-muted bg-elevated ${wrapperSizeClass(provider, originalUrl)}`}>
        <iframe
          src={embedUrl}
          title={title}
          className="h-full w-full border-0"
          allow="autoplay; encrypted-media"
          allowFullScreen
          loading="lazy"
        />
      </div>
      <div className="pointer-events-none absolute right-2 top-2 flex max-w-[calc(100%-1rem)] items-center gap-2 rounded-control border border-border-muted bg-surface-elevated/95 px-2 py-1 text-xs opacity-0 shadow-sm transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
        <a
          href={originalUrl}
          target="_blank"
          rel="noreferrer"
          className="max-w-52 truncate text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          {originalUrl}
        </a>
        {editable ? (
          <button
            type="button"
            onClick={onRestoreUrl}
            aria-label={`Restore ${title} to plain URL`}
            className="shrink-0 rounded-control px-2 py-1 text-text transition hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            Restore URL
          </button>
        ) : null}
      </div>
    </div>
  );
};
