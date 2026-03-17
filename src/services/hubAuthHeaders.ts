import { env } from '../lib/env';

export const HUB_DEV_AUTH_ACCESS_TOKEN = 'dev-auth-local-token';
const HUB_DEV_AUTH_HEADER = 'x-hub-dev-auth';

export const buildHubAuthHeaders = (accessToken: string, hasBody = false): Headers => {
  const headers = new Headers({
    Authorization: `Bearer ${accessToken}`,
  });

  if (hasBody) {
    headers.set('Content-Type', 'application/json');
  }
  if (env.hubDevAuthEnabled) {
    headers.set(HUB_DEV_AUTH_HEADER, '1');
  }

  return headers;
};
