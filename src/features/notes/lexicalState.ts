import { $getRoot, type EditorState } from 'lexical';

export const emptyLexicalState = (): Record<string, unknown> => ({
  root: {
    children: [
      {
        type: 'paragraph',
        version: 1,
        format: '',
        indent: 0,
        direction: null,
        children: [],
      },
    ],
    direction: null,
    format: '',
    indent: 0,
    type: 'root',
    version: 1,
  },
});

export const normalizeLexicalState = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return emptyLexicalState();
  }

  return value as Record<string, unknown>;
};

export const editorStateToLexicalSnapshot = (
  editorState: EditorState,
): { lexicalState: Record<string, unknown>; plainText: string } => {
  const lexicalState = editorState.toJSON() as unknown as Record<string, unknown>;
  let plainText = '';

  editorState.read(() => {
    plainText = $getRoot().getTextContent().trim();
  });

  return {
    lexicalState,
    plainText,
  };
};

export const lexicalStateToPlainText = (state: Record<string, unknown>): string => {
  const root =
    (state?.root as
      | {
          children?: Array<{
            children?: Array<{ text?: string }>;
          }>;
        }
      | undefined) || undefined;

  if (!root?.children || !Array.isArray(root.children)) {
    return '';
  }

  return root.children
    .flatMap((node) => (Array.isArray(node.children) ? node.children : []))
    .map((node) => (typeof node.text === 'string' ? node.text : ''))
    .join('\n')
    .trim();
};
