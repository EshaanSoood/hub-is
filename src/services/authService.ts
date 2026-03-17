import { env } from '../lib/env';
import type { IntegrationOutcome } from '../types/domain';

export const buildKeycloakLoginUrl = (redirectUri: string): IntegrationOutcome<string> => {
  if (!env.keycloakUrl || !env.keycloakRealm || !env.keycloakClientId) {
    return {
      blockedReason:
        'Set VITE_KEYCLOAK_URL, VITE_KEYCLOAK_REALM, and VITE_KEYCLOAK_CLIENT_ID to enable Keycloak login.',
    };
  }

  const loginUrl = new URL(
    `/realms/${env.keycloakRealm}/protocol/openid-connect/auth`,
    env.keycloakUrl,
  );
  loginUrl.searchParams.set('client_id', env.keycloakClientId);
  loginUrl.searchParams.set('redirect_uri', redirectUri);
  loginUrl.searchParams.set('response_type', 'code');
  loginUrl.searchParams.set('scope', 'openid profile email');

  return { data: loginUrl.toString() };
};

export const buildKeycloakLogoutUrl = (redirectUri: string): IntegrationOutcome<string> => {
  if (!env.keycloakUrl || !env.keycloakRealm || !env.keycloakClientId) {
    return {
      blockedReason:
        'Set VITE_KEYCLOAK_URL, VITE_KEYCLOAK_REALM, and VITE_KEYCLOAK_CLIENT_ID to enable Keycloak logout.',
    };
  }

  const logoutUrl = new URL(
    `/realms/${env.keycloakRealm}/protocol/openid-connect/logout`,
    env.keycloakUrl,
  );
  logoutUrl.searchParams.set('client_id', env.keycloakClientId);
  logoutUrl.searchParams.set('post_logout_redirect_uri', redirectUri);

  return { data: logoutUrl.toString() };
};
