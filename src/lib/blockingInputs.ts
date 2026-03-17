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
  { key: 'VITE_OPENPROJECT_BASE_URL', reason: 'OpenProject base URL' },
  { key: 'VITE_OPENPROJECT_TOKEN', reason: 'OpenProject API token' },
  { key: 'VITE_GITHUB_REPOSITORY', reason: 'GitHub repository owner/name' },
  { key: 'VITE_GITHUB_TOKEN', reason: 'GitHub token' },
  { key: 'VITE_N8N_WAKE_WEBHOOK_URL', reason: 'n8n wake workflow webhook URL' },
  { key: 'VITE_N8N_SLEEP_WEBHOOK_URL', reason: 'n8n sleep workflow webhook URL' },
];

const valueByKey: Record<string, string> = {
  VITE_KEYCLOAK_URL: env.keycloakUrl,
  VITE_KEYCLOAK_REALM: env.keycloakRealm,
  VITE_KEYCLOAK_CLIENT_ID: env.keycloakClientId,
  VITE_NTFY_TOPIC_URL: env.ntfyTopicUrl,
  VITE_OPENPROJECT_BASE_URL: env.openProjectBaseUrl,
  VITE_OPENPROJECT_TOKEN: env.openProjectToken,
  VITE_GITHUB_REPOSITORY: env.githubRepo,
  VITE_GITHUB_TOKEN: env.githubToken,
  VITE_N8N_WAKE_WEBHOOK_URL: env.n8nWakeWebhook,
  VITE_N8N_SLEEP_WEBHOOK_URL: env.n8nSleepWebhook,
};

export const getBlockingInputs = (): BlockingInput[] => {
  if (env.useMocks) {
    return [];
  }

  return requiredWhenLive.filter((input) => !valueByKey[input.key]);
};
