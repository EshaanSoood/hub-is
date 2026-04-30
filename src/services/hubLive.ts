import { authorizeHubLive } from './hub/transport.ts';
import type { HubLiveAuthorization, HubNotification } from './hub/types.ts';

export interface HubLiveTaskChangedMessage {
  type: 'task.changed';
  task: {
    record_id: string;
    space_id: string | null;
    origin_kind: 'project' | 'project' | 'personal';
  };
}

export interface HubLiveReminderChangedMessage {
  type: 'reminder.changed';
  reminder: {
    reminder_id: string;
    record_id: string;
    space_id: string | null;
    action: 'created' | 'dismissed' | 'updated';
  };
}

export interface HubLiveReadyMessage {
  type: 'ready';
  user_id: string;
}

export interface HubLiveNotificationNewMessage {
  type: 'notification.new';
  notification: HubNotification;
}

export type HubLiveMessage =
  | HubLiveReadyMessage
  | HubLiveTaskChangedMessage
  | HubLiveReminderChangedMessage
  | HubLiveNotificationNewMessage;

type HubLiveListener = (message: HubLiveMessage) => void;
type TimeoutHandle = ReturnType<typeof setTimeout> | number;
type TimerApi = {
  clearTimeout: (handle: TimeoutHandle) => void;
  setTimeout: (callback: () => void, delayMs: number) => TimeoutHandle;
};
type WebSocketEventName = 'close' | 'error' | 'message' | 'open';
type WebSocketLike = {
  addEventListener: (
    type: WebSocketEventName,
    listener: (event?: { data?: unknown }) => void,
  ) => void;
  close: () => void;
};
type CreateSocket = (url: string) => WebSocketLike;
type AuthorizeHubLiveFn = (accessToken: string) => Promise<HubLiveAuthorization>;

const HUB_LIVE_RECONNECT_DELAYS_MS = [1_500, 5_000, 15_000, 30_000] as const;

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

const hubLiveWsUrl = (): string => {
  const viteEnv: Record<string, unknown> =
    typeof import.meta === 'object' && import.meta && typeof import.meta.env === 'object' ? import.meta.env : {};
  const configured = typeof viteEnv.VITE_HUB_LIVE_WS_URL === 'string' ? viteEnv.VITE_HUB_LIVE_WS_URL.trim() : '';
  return configured || defaultHubLiveWsUrl();
};

const wsUrlWithTicket = (wsTicket: string): string => {
  const url = new URL(hubLiveWsUrl(), typeof window === 'undefined' ? 'http://localhost' : window.location.origin);
  url.searchParams.set('ws_ticket', wsTicket);
  return url.toString();
};

const isTaskOriginKind = (value: unknown): value is HubLiveTaskChangedMessage['task']['origin_kind'] =>
  value === 'project' || value === 'project' || value === 'personal';

const isRecordObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const isHubLiveMessage = (value: unknown): value is HubLiveMessage => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  if (candidate.type === 'ready') {
    return typeof candidate.user_id === 'string';
  }
  if (candidate.type === 'task.changed') {
    const task = candidate.task;
    if (!task || typeof task !== 'object') {
      return false;
    }
    const taskCandidate = task as Record<string, unknown>;
    return (
      typeof taskCandidate.record_id === 'string' &&
      (typeof taskCandidate.space_id === 'string' || taskCandidate.space_id === null) &&
      isTaskOriginKind(taskCandidate.origin_kind)
    );
  }
  if (candidate.type === 'reminder.changed') {
    const reminder = candidate.reminder;
    if (!reminder || typeof reminder !== 'object') {
      return false;
    }
    const reminderCandidate = reminder as Record<string, unknown>;
    return (
      typeof reminderCandidate.reminder_id === 'string' &&
      typeof reminderCandidate.record_id === 'string' &&
      (typeof reminderCandidate.space_id === 'string' || reminderCandidate.space_id === null) &&
      (reminderCandidate.action === 'created'
        || reminderCandidate.action === 'dismissed'
        || reminderCandidate.action === 'updated')
    );
  }
  if (candidate.type === 'notification.new') {
    const notification = candidate.notification;
    if (!isRecordObject(notification)) {
      return false;
    }
    return (
      typeof notification.notification_id === 'string' &&
      typeof notification.space_id === 'string' &&
      typeof notification.user_id === 'string' &&
      typeof notification.reason === 'string' &&
      typeof notification.entity_type === 'string' &&
      typeof notification.entity_id === 'string' &&
      isRecordObject(notification.payload) &&
      (typeof notification.read_at === 'string' || notification.read_at === null) &&
      typeof notification.created_at === 'string'
    );
  }
  return false;
};

export const getHubLiveReconnectDelayMs = (consecutiveFailures: number): number => {
  const normalizedFailures = Number.isFinite(consecutiveFailures) ? Math.max(1, Math.trunc(consecutiveFailures)) : 1;
  const index = Math.min(normalizedFailures - 1, HUB_LIVE_RECONNECT_DELAYS_MS.length - 1);
  return HUB_LIVE_RECONNECT_DELAYS_MS[index];
};

export const createHubLiveClient = ({
  authorize = authorizeHubLive,
  createSocket = (url) => new WebSocket(url),
  timers = {
    clearTimeout: (handle: TimeoutHandle) => window.clearTimeout(handle),
    setTimeout: (callback: () => void, delayMs: number) => window.setTimeout(callback, delayMs),
  },
}: {
  authorize?: AuthorizeHubLiveFn;
  createSocket?: CreateSocket;
  timers?: TimerApi;
} = {}) => {
  const listeners = new Set<HubLiveListener>();
  let accessToken: string | null = null;
  let socket: WebSocketLike | null = null;
  let reconnectTimer: TimeoutHandle | null = null;
  let connectPromise: Promise<void> | null = null;
  let connectGeneration = 0;
  let consecutiveFailures = 0;

  const hasSubscribers = () => listeners.size > 0 && Boolean(accessToken);

  const cleanupReconnect = () => {
    if (reconnectTimer !== null) {
      timers.clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const disconnectSocket = () => {
    if (!socket) {
      return;
    }
    const activeSocket = socket;
    socket = null;
    activeSocket.close();
  };

  const dispatchMessage = (message: HubLiveMessage) => {
    for (const listener of listeners) {
      try {
        listener(message);
      } catch {
        // Ignore consumer failures so one broken listener does not kill the shared socket.
      }
    }
  };

  const scheduleReconnect = () => {
    if (!hasSubscribers() || reconnectTimer !== null) {
      return;
    }
    reconnectTimer = timers.setTimeout(() => {
      reconnectTimer = null;
      void connect();
    }, getHubLiveReconnectDelayMs(consecutiveFailures));
  };

  const connect = () => {
    if (!hasSubscribers() || connectPromise) {
      return connectPromise ?? Promise.resolve();
    }

    const generation = connectGeneration + 1;
    connectGeneration = generation;
    cleanupReconnect();

    const currentAccessToken = accessToken;
    let activeConnect: Promise<void> | null = null;
    activeConnect = (async () => {
      try {
        const authorization = await authorize(currentAccessToken || '');
        if (!hasSubscribers() || generation !== connectGeneration || currentAccessToken !== accessToken) {
          return;
        }

        let socketOpened = false;
        const nextSocket = createSocket(wsUrlWithTicket(authorization.ws_ticket));
        socket = nextSocket;

        nextSocket.addEventListener('open', () => {
          if (generation !== connectGeneration || socket !== nextSocket) {
            return;
          }
          socketOpened = true;
          consecutiveFailures = 0;
        });

        nextSocket.addEventListener('message', (event) => {
          try {
            const parsed = JSON.parse(String(event?.data || '')) as unknown;
            if (!isHubLiveMessage(parsed)) {
              return;
            }
            dispatchMessage(parsed);
          } catch {
            // Ignore malformed frames.
          }
        });

        nextSocket.addEventListener('error', () => {
          // The socket close handler owns retries.
        });

        nextSocket.addEventListener('close', () => {
          if (socket === nextSocket) {
            socket = null;
          }
          if (!hasSubscribers() || generation !== connectGeneration) {
            return;
          }
          consecutiveFailures = socketOpened ? 1 : consecutiveFailures + 1;
          scheduleReconnect();
        });
      } catch {
        if (!hasSubscribers() || generation !== connectGeneration) {
          return;
        }
        consecutiveFailures += 1;
        scheduleReconnect();
      } finally {
        if (connectPromise === activeConnect) {
          connectPromise = null;
        }
        if (hasSubscribers() && !socket && reconnectTimer === null && generation !== connectGeneration) {
          void connect();
        }
      }
    })();

    connectPromise = activeConnect;
    return activeConnect;
  };

  const subscribe = (nextAccessToken: string, onMessage: HubLiveListener): (() => void) => {
    listeners.add(onMessage);
    const tokenChanged = accessToken !== nextAccessToken;
    accessToken = nextAccessToken;

    if (tokenChanged) {
      consecutiveFailures = 0;
      connectGeneration += 1;
      cleanupReconnect();
      disconnectSocket();
    }

    void connect();

    return () => {
      listeners.delete(onMessage);
      if (listeners.size > 0) {
        return;
      }
      accessToken = null;
      consecutiveFailures = 0;
      connectGeneration += 1;
      cleanupReconnect();
      disconnectSocket();
    };
  };

  return {
    subscribe,
  };
};

const hubLiveClient = createHubLiveClient();

export const subscribeHubLive = (
  accessToken: string,
  onMessage: (message: HubLiveMessage) => void,
): (() => void) => hubLiveClient.subscribe(accessToken, onMessage);
