import type { JSX } from 'react';
import {
  $applyNodeReplacement,
  DecoratorNode,
  type DOMExportOutput,
  type LexicalEditor,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from 'lexical';
import { resolveSerializedMediaEmbed, type MediaEmbedProvider } from '../../../lib/mediaEmbed';
import { MediaEmbedComponent } from './MediaEmbedComponent';

export type SerializedMediaEmbedNode = Spread<
  {
    type: 'media-embed';
    version: 1;
    provider: MediaEmbedProvider;
    embed_url: string;
    original_url: string;
  },
  SerializedLexicalNode
>;

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

const mediaFrameHeight = (provider: MediaEmbedProvider, originalUrl: string): string => {
  if (provider === 'youtube' || provider === 'vimeo') {
    return '360';
  }
  if (provider === 'spotify') {
    return /open\.spotify\.com\/track\//i.test(originalUrl) ? '80' : '320';
  }
  return '160';
};

const safeFallbackHref = (url: string): string | null => {
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return null;
    }
    return parsedUrl.toString();
  } catch {
    return null;
  }
};

export class MediaEmbedNode extends DecoratorNode<JSX.Element> {
  __provider: MediaEmbedProvider;
  __embedUrl: string;
  __originalUrl: string;

  static getType(): string {
    return 'media-embed';
  }

  static clone(node: MediaEmbedNode): MediaEmbedNode {
    return new MediaEmbedNode(node.__provider, node.__embedUrl, node.__originalUrl, node.__key);
  }

  static importJSON(serializedNode: SerializedMediaEmbedNode): MediaEmbedNode {
    const validatedEmbed = resolveSerializedMediaEmbed(
      serializedNode.provider,
      typeof serializedNode.embed_url === 'string' ? serializedNode.embed_url : '',
      typeof serializedNode.original_url === 'string' ? serializedNode.original_url : '',
    );
    if (validatedEmbed) {
      return new MediaEmbedNode(validatedEmbed.provider, validatedEmbed.embedUrl, validatedEmbed.originalUrl);
    }
    return new MediaEmbedNode('youtube', '', typeof serializedNode.original_url === 'string' ? serializedNode.original_url.trim() : '');
  }

  constructor(provider: MediaEmbedProvider, embedUrl: string, originalUrl: string, key?: NodeKey) {
    super(key);
    this.__provider = provider;
    this.__embedUrl = embedUrl;
    this.__originalUrl = originalUrl;
  }

  exportJSON(): SerializedMediaEmbedNode {
    return {
      ...super.exportJSON(),
      type: 'media-embed',
      version: 1,
      provider: this.__provider,
      embed_url: this.__embedUrl,
      original_url: this.__originalUrl,
    };
  }

  exportDOM(editor: LexicalEditor): DOMExportOutput {
    void editor;
    const validatedEmbed = resolveSerializedMediaEmbed(this.__provider, this.__embedUrl, this.__originalUrl);
    if (!validatedEmbed) {
      const fallbackText = this.__originalUrl.trim();
      const fallbackHref = fallbackText ? safeFallbackHref(fallbackText) : null;
      const element = fallbackHref ? document.createElement('a') : document.createElement('span');
      if (fallbackHref) {
        element.setAttribute('href', fallbackHref);
        element.setAttribute('rel', 'noopener noreferrer');
        element.setAttribute('target', '_blank');
        element.textContent = fallbackText;
      } else if (fallbackText) {
        element.textContent = fallbackText;
      } else {
        element.textContent = 'Embedded media unavailable';
      }
      return { element };
    }
    const element = document.createElement('iframe');
    element.setAttribute('src', validatedEmbed.embedUrl);
    element.setAttribute('title', mediaTitle(validatedEmbed.provider));
    element.setAttribute('loading', 'lazy');
    element.setAttribute('allow', 'autoplay; encrypted-media');
    element.setAttribute('sandbox', 'allow-scripts allow-same-origin');
    element.setAttribute('width', '100%');
    element.setAttribute('height', mediaFrameHeight(validatedEmbed.provider, validatedEmbed.originalUrl));
    element.setAttribute('frameborder', '0');
    element.setAttribute('allowfullscreen', 'true');
    return { element };
  }

  createDOM(): HTMLElement {
    const element = document.createElement('div');
    element.className = 'my-2';
    element.contentEditable = 'false';
    return element;
  }

  updateDOM(): false {
    return false;
  }

  isInline(): false {
    return false;
  }

  getTextContent(): string {
    return this.__originalUrl;
  }

  decorate(): JSX.Element {
    return (
      <MediaEmbedComponent
        nodeKey={this.__key}
        provider={this.__provider}
        embedUrl={this.__embedUrl}
        originalUrl={this.__originalUrl}
      />
    );
  }
}

export const $createMediaEmbedNode = (
  provider: MediaEmbedProvider,
  embedUrl: string,
  originalUrl: string,
): MediaEmbedNode => $applyNodeReplacement(new MediaEmbedNode(provider, embedUrl, originalUrl));

export const $isMediaEmbedNode = (node: LexicalNode | null | undefined): node is MediaEmbedNode => node instanceof MediaEmbedNode;
