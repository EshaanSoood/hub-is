export const readPlainComment = (bodyJson: unknown): string => {
  if (bodyJson == null) {
    return '';
  }

  if (typeof bodyJson !== 'object') {
    return String(bodyJson);
  }

  const record = bodyJson as Record<string, unknown>;
  const text = record.text;
  if (typeof text === 'string') {
    return text;
  }
  const content = record.content;
  if (typeof content === 'string') {
    return content;
  }
  return JSON.stringify(record);
};
