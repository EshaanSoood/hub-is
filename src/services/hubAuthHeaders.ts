export const buildHubAuthHeaders = (accessToken: string, hasBody = false): Headers => {
  const headers = new Headers({
    Authorization: `Bearer ${accessToken}`,
  });

  if (hasBody) {
    headers.set('Content-Type', 'application/json');
  }

  return headers;
};
