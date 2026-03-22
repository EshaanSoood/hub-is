import { env } from '../lib/env';
import { authorizeHubLive } from './hub/transport';
import type { HubNotification } from './hub/types';

export interface HubLiveTaskChangedMessage {
  type: 'task.changed';
  task: {
    record_id: string;
    project_id: string | null;
    origin_kind: 'pane' | 'project' | 'personal';
  };
}

export interface HubLiveReminderChangedMessage {
  type: 'reminder.changed';
  reminder: {
    reminder_id: string;
    record_id: string;
    project_id: string | null;
    action: 'created' | 'dismissed';
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

const wsUrlWithTicket = (wsTicket: string): string => {
  const url = new URL(env.hubLiveWsUrl, typeof window === 'undefined' ? 'http://localhost' : window.location.origin);
  url.searchParams.set('ws_ticket', wsTicket);
  return url.toString();
};

const isTaskOriginKind = (value: unknown): value is HubLiveTaskChangedMessage['task']['origin_kind'] =>
  value === 'pane' || value === 'project' || value === 'personal';

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
      (typeof taskCandidate.project_id === 'string' || taskCandidate.project_id === null) &&
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
      (typeof reminderCandidate.project_id === 'string' || reminderCandidate.project_id === null) &&
      (reminderCandidate.action === 'created' || reminderCandidate.action === 'dismissed')
    );
  }
  if (candidate.type === 'notification.new') {
    const notification = candidate.notification;
    if (!isRecordObject(notification)) {
      return false;
    }
    return (
      typeof notification.notification_id === 'string' &&
      typeof notification.project_id === 'string' &&
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

export const subscribeHubLive = (
  accessToken: string,
  onMessage: (message: HubLiveMessage) => void,
): (() => void) => {
  let closed = false;
  let socket: WebSocket | null = null;
  let reconnectTimer: number | null = null;
  let connectGeneration = 0;

  const cleanupReconnect = () => {
    if (reconnectTimer !== null) {
      window.clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const scheduleReconnect = () => {
    if (closed || reconnectTimer !== null) {
      return;
    }
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = null;
      void connect();
    }, 1_500);
  };

  const connect = async () => {
    const generation = connectGeneration + 1;
    connectGeneration = generation;
    cleanupReconnect();
    try {
      const authorization = await authorizeHubLive(accessToken);
      if (closed || generation !== connectGeneration) {
        return;
      }

      const nextSocket = new WebSocket(wsUrlWithTicket(authorization.ws_ticket));
      socket = nextSocket;
      nextSocket.addEventListener('message', (event) => {
        try {
          const parsed = JSON.parse(String(event.data || '')) as unknown;
          if (!isHubLiveMessage(parsed)) {
            return;
          }
          onMessage(parsed);
        } catch {
          // ignore malformed frames
        }
      });
      nextSocket.addEventListener('error', () => {
        // close will handle reconnect
      });
      nextSocket.addEventListener('close', () => {
        if (socket === nextSocket) {
          socket = null;
        }
        scheduleReconnect();
      });
    } catch {
      scheduleReconnect();
    }
  };

  void connect();

  return () => {
    closed = true;
    connectGeneration += 1;
    cleanupReconnect();
    if (socket) {
      socket.close();
      socket = null;
    }
  };
};
