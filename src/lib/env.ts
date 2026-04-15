const read = (key: string): string => {
  const value = import.meta.env[key];
  return typeof value === 'string' ? value.trim() : '';
};

const readNumber = (key: string, fallback: number): number => {
  const parsed = Number(read(key));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const defaultCollabWsUrl = (): string => {
  if (typeof window === 'undefined') {
    return 'wss://collab.eshaansood.org';
  }

  if (/\.eshaansood\.org$/i.test(window.location.hostname) || window.location.hostname === 'eshaansood.org') {
    return 'wss://collab.eshaansood.org';
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/api/hub/collab`;
};

const defaultHubLiveWsUrl = (): string => {
  if (typeof window === 'undefined') {
    return 'wss://api.eshaansood.org/api/hub/live';
  }

  if (/\.eshaansood\.org$/i.test(window.location.hostname) || window.location.hostname === 'eshaansood.org') {
    return 'wss://api.eshaansood.org/api/hub/live';
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/api/hub/live`;
};

export const env = {
  useMocks: read('VITE_USE_MOCKS').toLowerCase() === 'true',
  keycloakUrl: read('VITE_KEYCLOAK_URL'),
  keycloakRealm: read('VITE_KEYCLOAK_REALM'),
  keycloakClientId: read('VITE_KEYCLOAK_CLIENT_ID'),
  hubCollabWsUrl: read('VITE_HUB_COLLAB_WS_URL') || defaultCollabWsUrl(),
  hubLiveWsUrl: read('VITE_HUB_LIVE_WS_URL') || defaultHubLiveWsUrl(),
  hubCollabReconnectGraceMs: readNumber('VITE_HUB_COLLAB_RECONNECT_GRACE_MS', 15000),
  n8nWakeWebhook: read('VITE_N8N_WAKE_WEBHOOK_URL'),
  n8nSleepWebhook: read('VITE_N8N_SLEEP_WEBHOOK_URL'),
  postmarkSender: read('VITE_POSTMARK_FROM_EMAIL'),
  ntfyTopicUrl: read('VITE_NTFY_TOPIC_URL'),
};
