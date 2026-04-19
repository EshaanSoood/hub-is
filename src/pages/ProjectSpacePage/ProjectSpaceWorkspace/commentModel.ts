export const readPlainComment = (bodyJson: Record<string, unknown>): string => {
  const text = bodyJson.text;
  if (typeof text === 'string') {
    return text;
  }
  const content = bodyJson.content;
  if (typeof content === 'string') {
    return content;
  }
  return JSON.stringify(bodyJson);
};
