import type { JSX } from 'react';
import {
  $applyNodeReplacement,
  DecoratorNode,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from 'lexical';
import { ViewEmbedBlock } from '../../../components/project-space/ViewEmbedBlock';

export type SerializedViewRefNode = Spread<
  {
    type: 'view-ref';
    version: 1;
    view_id: string;
    sizing: 'compact' | 'expanded';
  },
  SerializedLexicalNode
>;

export class ViewRefNode extends DecoratorNode<JSX.Element> {
  __viewId: string;
  __sizing: 'compact' | 'expanded';

  static getType(): string {
    return 'view-ref';
  }

  static clone(node: ViewRefNode): ViewRefNode {
    return new ViewRefNode(node.__viewId, node.__sizing, node.__key);
  }

  static importJSON(serializedNode: SerializedViewRefNode): ViewRefNode {
    return new ViewRefNode(serializedNode.view_id, serializedNode.sizing || 'compact');
  }

  constructor(viewId: string, sizing: 'compact' | 'expanded' = 'compact', key?: NodeKey) {
    super(key);
    this.__viewId = viewId;
    this.__sizing = sizing;
  }

  exportJSON(): SerializedViewRefNode {
    return {
      ...super.exportJSON(),
      type: 'view-ref',
      version: 1,
      view_id: this.__viewId,
      sizing: this.__sizing,
    };
  }

  createDOM(): HTMLElement {
    const element = document.createElement('div');
    element.className = 'my-2';
    return element;
  }

  updateDOM(): false {
    return false;
  }

  isInline(): false {
    return false;
  }

  decorate(): JSX.Element {
    return <ViewEmbedBlock viewId={this.__viewId} sizing={this.__sizing} />;
  }
}

export const $createViewRefNode = (viewId: string, sizing: 'compact' | 'expanded' = 'compact'): ViewRefNode =>
  $applyNodeReplacement(new ViewRefNode(viewId, sizing));

export const $isViewRefNode = (node: LexicalNode | null | undefined): node is ViewRefNode => node instanceof ViewRefNode;
