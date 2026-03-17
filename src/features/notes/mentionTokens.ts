export interface ParsedMention {
  target_entity_type: 'user' | 'record';
  target_entity_id: string;
  label: string;
}

const mentionPattern = /@\[((?:\\.|[^\]])*)\]\(((?:\\.|[^)])+)\)/g;

const escapeMentionPart = (value: string, delimiters: string[]): string => {
  const charsToEscape = new Set(['\\', ...delimiters]);
  let result = '';
  for (const char of String(value || '')) {
    result += charsToEscape.has(char) ? `\\${char}` : char;
  }
  return result;
};

const unescapeMentionPart = (value: string): string => {
  let result = '';
  let escaped = false;
  for (const char of String(value || '')) {
    if (escaped) {
      result += char;
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    result += char;
  }
  if (escaped) {
    result += '\\';
  }
  return result;
};

export const extractMentionsFromText = (text: string): ParsedMention[] => {
  const source = typeof text === 'string' ? text : '';
  const found = new Map<string, ParsedMention>();
  let match = mentionPattern.exec(source);

  while (match) {
    const label = unescapeMentionPart(String(match[1] || '').trim());
    const rawRef = unescapeMentionPart(String(match[2] || '').trim());
    const typedMatch = rawRef.match(/^(user|record):(.+)$/);
    const targetEntityType = typedMatch ? typedMatch[1] : 'user';
    const targetEntityId = typedMatch ? String(typedMatch[2] || '').trim() : rawRef;

    if ((targetEntityType === 'user' || targetEntityType === 'record') && targetEntityId) {
      const key = `${targetEntityType}:${targetEntityId}`;
      found.set(key, {
        target_entity_type: targetEntityType,
        target_entity_id: targetEntityId,
        label,
      });
    }

    match = mentionPattern.exec(source);
  }

  return [...found.values()];
};

export const appendMentionToken = (currentText: string, token: string): string => {
  const source = typeof currentText === 'string' ? currentText : '';
  return `${source}${source.endsWith(' ') || source.length === 0 ? '' : ' '}${token} `;
};

export const mentionToken = (target: { entity_type: 'user' | 'record'; entity_id: string; label: string }): string =>
  `@[${escapeMentionPart(target.label, [']'])}](${target.entity_type}:${escapeMentionPart(target.entity_id, [')'])})`;
