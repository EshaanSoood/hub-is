import Keycloak from 'keycloak-js';
import { env } from './env';

export const isKeycloakConfigured =
  Boolean(env.keycloakUrl) && Boolean(env.keycloakRealm) && Boolean(env.keycloakClientId);

let keycloakInstance: Keycloak | null = null;

export const getKeycloak = (): Keycloak | null => {
  if (!isKeycloakConfigured) {
    return null;
  }

  if (!keycloakInstance) {
    keycloakInstance = new Keycloak({
      url: env.keycloakUrl,
      realm: env.keycloakRealm,
      clientId: env.keycloakClientId,
    });
  }

  return keycloakInstance;
};
