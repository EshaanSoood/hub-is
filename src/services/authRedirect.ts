const KEYCLOAK_CALLBACK_QUERY_KEYS = [
  'code',
  'state',
  'session_state',
  'iss',
  'error',
  'error_description',
  'error_uri',
];

const KEYCLOAK_CALLBACK_SENTINEL_QUERY_KEYS = [
  'code',
  'error',
  'session_state',
  'iss',
  'error_description',
  'error_uri',
];

interface RedirectLocationLike {
  origin: string;
  pathname: string;
  search: string;
  hash: string;
}

export const buildCurrentAuthRedirectUri = (location: RedirectLocationLike): string => {
  const redirectUri = new URL(`${location.pathname}${location.search}${location.hash}`, location.origin);
  const hasAuthCallbackSentinel = KEYCLOAK_CALLBACK_SENTINEL_QUERY_KEYS.some((key) => redirectUri.searchParams.has(key));
  if (!hasAuthCallbackSentinel) {
    return redirectUri.toString();
  }
  for (const key of KEYCLOAK_CALLBACK_QUERY_KEYS) {
    redirectUri.searchParams.delete(key);
  }
  return redirectUri.toString();
};

export const replaceAuthCallbackUrlIfNeeded = (
  history: Pick<History, 'replaceState' | 'state'>,
  location: RedirectLocationLike,
): boolean => {
  const cleanedUrl = buildCurrentAuthRedirectUri(location);
  const currentUrl = new URL(`${location.pathname}${location.search}${location.hash}`, location.origin).toString();
  if (cleanedUrl === currentUrl) {
    return false;
  }
  history.replaceState(history.state, '', cleanedUrl);
  return true;
};
