import { env } from './env';

interface BlockingInput {
  key: string;
  reason: string;
}

const requiredWhenLive: BlockingInput[] = [
  { key: 'VITE_KEYCLOAK_URL', reason: 'Keycloak auth URL' },
  { key: 'VITE_KEYCLOAK_REALM', reason: 'Keycloak realm' },
  { key: 'VITE_KEYCLOAK_CLIENT_ID', reason: 'Keycloak client id' },
  { key: 'VITE_NTFY_TOPIC_URL', reason: 'ntfy topic endpoint' },
  { key: 'VITE_N8N_WAKE_WEBHOOK_URL', reason: 'n8n wake workflow webhook URL' },
  { key: 'VITE_N8N_SLEEP_WEBHOOK_URL', reason: 'n8n sleep workflow webhook URL' },
];

const valueByKey: Record<string, string> = {
  VITE_KEYCLOAK_URL: env.keycloakUrl,
  VITE_KEYCLOAK_REALM: env.keycloakRealm,
  VITE_KEYCLOAK_CLIENT_ID: env.keycloakClientId,
  VITE_NTFY_TOPIC_URL: env.ntfyTopicUrl,
  VITE_N8N_WAKE_WEBHOOK_URL: env.n8nWakeWebhook,
  VITE_N8N_SLEEP_WEBHOOK_URL: env.n8nSleepWebhook,
};

export const getBlockingInputs = (): BlockingInput[] => {
  if (env.useMocks) {
    return [];
  }

  return requiredWhenLive.filter((input) => !valueByKey[input.key]);
};
