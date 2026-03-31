import type { Provider } from '@lexical/yjs';
import { HocuspocusProvider, WebSocketStatus } from '@hocuspocus/provider';
import { Doc } from 'yjs';

export interface NoteCollaborationSession {
  roomId: string;
  serverUrl: string;
  getAccessToken: () => Promise<string> | string;
}

export type CollaborationPhase = 'disabled' | 'connecting' | 'synced';
export type CollabCloseClassification = 'auth_rejection' | 'client_churn' | 'infra_termination' | 'unknown';

export interface CollabCloseDiagnostics {
  at: string;
  code: number | null;
  reason: string;
  classification: CollabCloseClassification;
  hadSynced: boolean;
  timeToCloseMs: number | null;
}

export interface CollabSessionSnapshot {
  roomId: string;
  refCount: number;
  phase: CollaborationPhase;
  healthySynced: boolean;
  hasReachedSync: boolean;
  lastAuthError: string | null;
  lastClose: CollabCloseDiagnostics | null;
  closeCount: number;
  syncCount: number;
}

type TimerHandle = number | ReturnType<typeof globalThis.setTimeout> | undefined;

type ProviderStatusEvent = {
  status?: string;
};

type ProviderCloseEvent = {
  event?: {
    code?: number;
    reason?: string;
  };
};

type ProviderAuthenticationFailedEvent = {
  reason?: string;
};

type ProviderSyncedEvent = {
  state?: boolean;
};

export interface ManagedCollabProvider {
  document: Doc;
  synced: boolean;
  hasUnsyncedChanges: boolean;
  connect: () => Promise<unknown> | void;
  destroy: () => void;
  disconnect: () => Promise<unknown> | void;
  on: (event: 'authenticated' | 'authenticationFailed' | 'close' | 'open' | 'status' | 'synced', listener: (payload: unknown) => void) => void;
  off: (event: 'authenticated' | 'authenticationFailed' | 'close' | 'open' | 'status' | 'synced', listener: (payload: unknown) => void) => void;
}

export interface CollabRoomSession {
  roomId: string;
  doc: Doc;
  provider: ManagedCollabProvider;
  acquire: () => () => void;
  bindLexicalDoc: (id: string, yjsDocMap: Map<string, Doc>) => Provider;
  getSnapshot: () => CollabSessionSnapshot;
  subscribe: (listener: () => void) => () => void;
}

interface CollabSessionManager {
  getSession: (session: NoteCollaborationSession) => CollabRoomSession;
}

interface ManagedSessionEntry extends CollabRoomSession {
  key: string;
  session: NoteCollaborationSession;
  createdAt: number;
  listeners: Set<() => void>;
  refCount: number;
  releaseTimer: TimerHandle | null;
  phase: CollaborationPhase;
  hasReachedSync: boolean;
  lastAuthError: string | null;
  lastClose: CollabCloseDiagnostics | null;
  closeCount: number;
  syncCount: number;
  lastConnectRequestedAt: number | null;
  lastOpenAt: number | null;
}

interface CreateCollabSessionManagerOptions {
  createProvider?: (args: {
    document: Doc;
    roomId: string;
    serverUrl: string;
    getAccessToken: () => Promise<string> | string;
  }) => ManagedCollabProvider;
  graceMs?: number;
  log?: (level: 'info' | 'warn', message: string, details: Record<string, unknown>) => void;
  timers?: {
    setTimeout: (callback: () => void, delay: number) => TimerHandle;
    clearTimeout: (timer: TimerHandle) => void;
  };
}

class ManagedLexicalHocuspocusProvider extends HocuspocusProvider {
  private connectPromise: Promise<unknown> | null = null;

  constructor(
    configuration: {
      autoConnect: boolean;
      document: Doc;
      name: string;
      token: string | (() => string) | (() => Promise<string>) | null;
      url: string;
    },
  ) {
    super(configuration as unknown as ConstructorParameters<typeof HocuspocusProvider>[0]);

    super.on('synced', ({ state }: { state: boolean }) => {
      this.emit('sync', state);
    });
  }

  connect(): Promise<unknown> {
    const websocketProvider = this.configuration.websocketProvider as { status?: string };
    if (this.connectPromise) {
      return this.connectPromise;
    }

    // Shared providers can receive overlapping connect() calls from our session
    // manager and Lexical's CollaborationPlugin. We intentionally treat
    // "connecting" and "connected" as idempotent here so Hocuspocus does not
    // run cleanupWebSocket() and close an in-flight socket before it opens.
    if (
      websocketProvider.status === WebSocketStatus.Connecting ||
      websocketProvider.status === WebSocketStatus.Connected
    ) {
      return Promise.resolve();
    }

    const connectionAttempt = super.connect();
    if (connectionAttempt && typeof connectionAttempt.then === 'function') {
      const trackedAttempt = Promise.resolve(connectionAttempt).finally(() => {
        if (this.connectPromise === trackedAttempt) {
          this.connectPromise = null;
        }
      });
      this.connectPromise = trackedAttempt;
      return trackedAttempt;
    }

    return Promise.resolve(connectionAttempt);
  }

  disconnect() {
    return undefined;
  }

  destroyNow() {
    this.connectPromise = null;
    return super.destroy();
  }
}

const defaultCreateProvider = ({
  document,
  roomId,
  serverUrl,
  getAccessToken,
}: {
  document: Doc;
  roomId: string;
  serverUrl: string;
  getAccessToken: () => Promise<string> | string;
}): ManagedCollabProvider =>
  new ManagedLexicalHocuspocusProvider({
    autoConnect: false,
    document,
    name: roomId,
    token: async () => await getAccessToken(),
    url: serverUrl,
  }) as ManagedCollabProvider;

const defaultLog = (level: 'info' | 'warn', message: string, details: Record<string, unknown>) => {
  const sink = level === 'warn' ? console.warn : console.info;
  sink(`[workspace-doc:collab] ${message}`, details);
};

const getSessionKey = (session: NoteCollaborationSession): string =>
  `${session.serverUrl.trim()}::${session.roomId.trim()}`;

const getDefaultGraceMs = (): number => {
  const candidate =
    typeof import.meta !== 'undefined' &&
    import.meta.env &&
    typeof import.meta.env.VITE_HUB_COLLAB_RECONNECT_GRACE_MS === 'string'
      ? import.meta.env.VITE_HUB_COLLAB_RECONNECT_GRACE_MS.trim()
      : '';
  const parsed = Number(candidate);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 15_000;
};

const classifyClose = (entry: ManagedSessionEntry, code: number | null): CollabCloseClassification => {
  if (entry.lastAuthError) {
    return 'auth_rejection';
  }

  if (!entry.hasReachedSync) {
    return 'client_churn';
  }

  if (code === 1006 || code === 1011 || code === 1012 || code === 1013 || code === 4408) {
    return 'infra_termination';
  }

  return 'unknown';
};

const getSnapshotForEntry = (entry: ManagedSessionEntry): CollabSessionSnapshot => ({
  roomId: entry.roomId,
  refCount: entry.refCount,
  phase: entry.phase,
  healthySynced: entry.phase === 'synced' && entry.provider.synced && !entry.provider.hasUnsyncedChanges && !entry.lastAuthError,
  hasReachedSync: entry.hasReachedSync,
  lastAuthError: entry.lastAuthError,
  lastClose: entry.lastClose,
  closeCount: entry.closeCount,
  syncCount: entry.syncCount,
});

export const createCollabSessionManager = ({
  createProvider = defaultCreateProvider,
  graceMs = getDefaultGraceMs(),
  log = defaultLog,
  timers = {
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
  },
}: CreateCollabSessionManagerOptions = {}): CollabSessionManager => {
  const sessions = new Map<string, ManagedSessionEntry>();

  const notify = (entry: ManagedSessionEntry) => {
    for (const listener of entry.listeners) {
      listener();
    }
  };

  const clearReleaseTimer = (entry: ManagedSessionEntry) => {
    if (entry.releaseTimer === null) {
      return;
    }
    timers.clearTimeout(entry.releaseTimer);
    entry.releaseTimer = null;
  };

  const destroyEntry = (entry: ManagedSessionEntry) => {
    clearReleaseTimer(entry);
    sessions.delete(entry.key);
    if (
      'destroyNow' in entry.provider &&
      typeof (entry.provider as ManagedCollabProvider & { destroyNow?: () => void }).destroyNow === 'function'
    ) {
      (entry.provider as ManagedLexicalHocuspocusProvider).destroyNow();
    } else {
      entry.provider.destroy();
    }
    log('info', 'session.destroyed', {
      roomId: entry.roomId,
      synced: entry.provider.synced,
      hadReachedSync: entry.hasReachedSync,
    });
  };

  const scheduleRelease = (entry: ManagedSessionEntry) => {
    clearReleaseTimer(entry);
    entry.releaseTimer = timers.setTimeout(() => {
      entry.releaseTimer = null;
      destroyEntry(entry);
    }, graceMs);
    log('info', 'session.release_scheduled', {
      roomId: entry.roomId,
      graceMs,
    });
  };

  const createEntry = (session: NoteCollaborationSession): ManagedSessionEntry => {
    const document = new Doc();
    const key = getSessionKey(session);
    const entry: ManagedSessionEntry = {
      key,
      roomId: session.roomId.trim(),
      doc: document,
      provider: null as unknown as ManagedCollabProvider,
      session,
      createdAt: Date.now(),
      listeners: new Set<() => void>(),
      refCount: 0,
      releaseTimer: null,
      phase: 'connecting' as CollaborationPhase,
      hasReachedSync: false,
      lastAuthError: null,
      lastClose: null,
      closeCount: 0,
      syncCount: 0,
      lastConnectRequestedAt: null,
      lastOpenAt: null,
      acquire: () => () => undefined,
      bindLexicalDoc: () => {
        throw new Error('Collaboration session is not initialized yet.');
      },
      getSnapshot: () => getSnapshotForEntry(entry),
      subscribe: () => () => undefined,
    };

    entry.provider = createProvider({
      document,
      roomId: entry.roomId,
      serverUrl: session.serverUrl.trim(),
      getAccessToken: () => entry.session.getAccessToken(),
    });

    entry.subscribe = (listener: () => void) => {
      entry.listeners.add(listener);
      return () => {
        entry.listeners.delete(listener);
      };
    };

    const handleAuthenticated = () => {
      entry.lastAuthError = null;
      notify(entry);
    };

    const handleAuthenticationFailed = (payload: unknown) => {
      const { reason } = (payload || {}) as ProviderAuthenticationFailedEvent;
      entry.lastAuthError = typeof reason === 'string' && reason.trim().length > 0 ? reason.trim() : 'authentication_failed';
      entry.phase = 'connecting';
      log('warn', 'session.auth_failed', {
        roomId: entry.roomId,
        reason: entry.lastAuthError,
      });
      notify(entry);
    };

    const handleOpen = () => {
      entry.lastOpenAt = Date.now();
      notify(entry);
    };

    const handleStatus = (payload: unknown) => {
      const { status } = (payload || {}) as ProviderStatusEvent;
      if (status === 'connecting') {
        entry.lastConnectRequestedAt = Date.now();
      }
      entry.phase = entry.provider.synced ? 'synced' : 'connecting';
      notify(entry);
    };

    const handleSynced = (payload: unknown) => {
      const { state } = (payload || {}) as ProviderSyncedEvent;
      if (state) {
        entry.phase = 'synced';
        entry.hasReachedSync = true;
        entry.syncCount += 1;
      } else {
        entry.phase = 'connecting';
      }
      notify(entry);
    };

    const handleClose = (payload: unknown) => {
      const { event } = (payload || {}) as ProviderCloseEvent;
      const closedAt = Date.now();
      const code = typeof event?.code === 'number' ? event.code : null;
      const reason = typeof event?.reason === 'string' ? event.reason : '';
      const startedAt = entry.lastOpenAt ?? entry.lastConnectRequestedAt ?? entry.createdAt;
      const classification = classifyClose(entry, code);
      entry.lastClose = {
        at: new Date(closedAt).toISOString(),
        code,
        reason,
        classification,
        hadSynced: entry.hasReachedSync,
        timeToCloseMs: startedAt ? Math.max(0, closedAt - startedAt) : null,
      };
      entry.closeCount += 1;
      entry.phase = 'connecting';
      log('warn', 'session.closed', {
        roomId: entry.roomId,
        classification,
        code,
        hadSynced: entry.hasReachedSync,
        reason,
        refCount: entry.refCount,
        timeToCloseMs: entry.lastClose.timeToCloseMs,
      });
      notify(entry);
    };

    entry.provider.on('authenticated', handleAuthenticated);
    entry.provider.on('authenticationFailed', handleAuthenticationFailed);
    entry.provider.on('close', handleClose);
    entry.provider.on('open', handleOpen);
    entry.provider.on('status', handleStatus);
    entry.provider.on('synced', handleSynced);

    entry.acquire = () => {
      entry.refCount += 1;
      clearReleaseTimer(entry);
      if (entry.refCount === 1) {
        entry.lastConnectRequestedAt = Date.now();
      }
      void entry.provider.connect();
      notify(entry);

      let released = false;
      return () => {
        if (released) {
          return;
        }
        released = true;
        entry.refCount = Math.max(0, entry.refCount - 1);
        notify(entry);
        if (entry.refCount === 0) {
          scheduleRelease(entry);
        }
      };
    };

    entry.bindLexicalDoc = (id: string, yjsDocMap: Map<string, Doc>): Provider => {
      const existingDoc = yjsDocMap.get(id);
      if (existingDoc && existingDoc !== entry.doc) {
        existingDoc.destroy();
      }
      yjsDocMap.set(id, entry.doc);
      return entry.provider as unknown as Provider;
    };

    return entry;
  };

  return {
    getSession(session: NoteCollaborationSession): CollabRoomSession {
      const key = getSessionKey(session);
      let entry = sessions.get(key);
      if (!entry) {
        entry = createEntry(session);
        sessions.set(key, entry);
      } else {
        entry.session = session;
      }

      return entry;
    },
  };
};

export const collabSessionManager = createCollabSessionManager();
