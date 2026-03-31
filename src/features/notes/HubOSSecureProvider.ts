import { Observable } from 'lib0/observable';
import * as awarenessProtocol from 'y-protocols/awareness';
import type { Provider, ProviderAwareness } from '@lexical/yjs';
import type { Doc } from 'yjs';
import { WebsocketProvider } from 'y-websocket';

type ProviderStatus = 'connected' | 'connecting' | 'disconnected';
type ProviderEventName = 'reload' | 'status' | 'sync' | 'update';
type ProviderEventCallback =
  | ((doc: Doc) => void)
  | ((arg0: { status: string }) => void)
  | ((isSynced: boolean) => void)
  | ((arg0: unknown) => void);
type AwarenessUpdate = {
  added: number[];
  updated: number[];
  removed: number[];
};

const INITIAL_RECONNECT_DELAY_MS = 1_000;
const MAX_RECONNECT_DELAY_MS = 30_000;

export class HubOSSecureProvider extends Observable<ProviderEventName> implements Provider {
  readonly awareness: ProviderAwareness;

  private readonly doc: Doc;
  private readonly roomId: string;
  private readonly serverUrl: string;
  private readonly fetchTicket: () => Promise<string>;
  private readonly stableAwareness: awarenessProtocol.Awareness;

  private transport: WebsocketProvider | null = null;
  private detachTransportListeners: (() => void) | null = null;
  private reconnectTimer: number | null = null;
  private reconnectDelayMs = INITIAL_RECONNECT_DELAY_MS;
  private connectPromise: Promise<void> | null = null;
  private shouldConnect = false;
  private destroyed = false;
  private connectAttempt = 0;
  private lastStatus: ProviderStatus = 'disconnected';
  private readonly stableToTransportOrigin = Symbol('hubos-stable-awareness');
  private readonly transportToStableOrigin = Symbol('hubos-transport-awareness');

  constructor(doc: Doc, roomId: string, serverUrl: string, fetchTicket: () => Promise<string>) {
    super();
    this.doc = doc;
    this.roomId = roomId;
    this.serverUrl = serverUrl;
    this.fetchTicket = fetchTicket;
    this.stableAwareness = new awarenessProtocol.Awareness(doc);
    this.awareness = this.stableAwareness as unknown as ProviderAwareness;
  }

  override on(type: 'reload', cb: (doc: Doc) => void): void;
  override on(type: 'status', cb: (arg0: { status: string }) => void): void;
  override on(type: 'sync', cb: (isSynced: boolean) => void): void;
  override on(type: 'update', cb: (arg0: unknown) => void): void;
  override on(type: ProviderEventName, cb: ProviderEventCallback): void {
    super.on(type, cb);
  }

  override off(type: 'reload', cb: (doc: Doc) => void): void;
  override off(type: 'status', cb: (arg0: { status: string }) => void): void;
  override off(type: 'sync', cb: (isSynced: boolean) => void): void;
  override off(type: 'update', cb: (arg0: unknown) => void): void;
  override off(type: ProviderEventName, cb: ProviderEventCallback): void {
    super.off(type, cb);
  }

  async connect(): Promise<void> {
    if (this.destroyed) {
      return;
    }

    this.shouldConnect = true;
    this.clearReconnectTimer();

    if (this.transport || this.connectPromise) {
      return this.connectPromise ?? Promise.resolve();
    }

    const attempt = ++this.connectAttempt;
    const promise = this.openTransport(attempt).finally(() => {
      if (this.connectPromise === promise) {
        this.connectPromise = null;
      }
    });
    this.connectPromise = promise;
    return promise;
  }

  disconnect(): void {
    this.shouldConnect = false;
    this.connectAttempt += 1;
    this.clearReconnectTimer();

    const hadTransport = this.transport !== null;
    this.destroyTransport();
    this.clearRemoteAwarenessStates();

    if (!hadTransport) {
      this.emit('sync', [false]);
      this.emitStatus('disconnected');
    }
  }

  override destroy(): void {
    if (this.destroyed) {
      return;
    }

    this.destroyed = true;
    this.disconnect();
    this.stableAwareness.destroy();
    super.destroy();
  }

  private async openTransport(attempt: number): Promise<void> {
    if (this.destroyed || !this.shouldConnect) {
      return;
    }

    this.destroyTransport();
    this.emitStatus('connecting');

    let ticket: string;
    try {
      ticket = await this.fetchTicket();
    } catch {
      if (!this.isCurrentAttempt(attempt)) {
        return;
      }

      this.emitStatus('disconnected');
      this.scheduleReconnect();
      return;
    }

    if (!this.isCurrentAttempt(attempt)) {
      return;
    }

    const transportAwareness = new awarenessProtocol.Awareness(this.doc);
    this.syncAwarenessStates(this.stableAwareness, transportAwareness, this.stableToTransportOrigin);

    const transport = new WebsocketProvider(this.serverUrl, this.roomId, this.doc, {
      awareness: transportAwareness,
      connect: true,
      disableBc: true,
      params: {
        ws_ticket: ticket,
      },
    });

    this.transport = transport;
    this.detachTransportListeners = this.attachTransportListeners(transport, transportAwareness);
  }

  private attachTransportListeners(
    transport: WebsocketProvider,
    transportAwareness: awarenessProtocol.Awareness,
  ): () => void {
    const forwardStableAwareness = (changes: AwarenessUpdate, origin: unknown) => {
      if (origin === this.transportToStableOrigin) {
        return;
      }

      this.applyAwarenessChanges(this.stableAwareness, transportAwareness, changes, this.stableToTransportOrigin);
    };

    const forwardTransportAwareness = (changes: AwarenessUpdate, origin: unknown) => {
      if (origin === this.stableToTransportOrigin) {
        return;
      }

      this.applyAwarenessChanges(transportAwareness, this.stableAwareness, changes, this.transportToStableOrigin);
    };

    const handleSync = (isSynced: boolean) => {
      this.emit('sync', [isSynced]);
    };

    const handleStatus = ({ status }: { status: ProviderStatus }) => {
      this.emitStatus(status);
      if (status === 'connected') {
        this.reconnectDelayMs = INITIAL_RECONNECT_DELAY_MS;
        return;
      }

      if (status === 'disconnected') {
        if (this.transport === transport) {
          this.destroyTransport();
        }
        this.scheduleReconnect();
      }
    };

    this.stableAwareness.on('update', forwardStableAwareness);
    transportAwareness.on('update', forwardTransportAwareness);
    transport.on('sync', handleSync);
    transport.on('status', handleStatus);

    return () => {
      this.stableAwareness.off('update', forwardStableAwareness);
      transportAwareness.off('update', forwardTransportAwareness);
      transport.off('sync', handleSync);
      transport.off('status', handleStatus);
    };
  }

  private destroyTransport(): void {
    const transport = this.transport;
    const detachTransportListeners = this.detachTransportListeners;

    if (!transport) {
      return;
    }

    this.transport = null;
    this.detachTransportListeners = null;
    transport.destroy();
    detachTransportListeners?.();
  }

  private scheduleReconnect(): void {
    if (this.destroyed || !this.shouldConnect || this.reconnectTimer !== null) {
      return;
    }

    const delayMs = this.reconnectDelayMs;
    this.reconnectDelayMs = Math.min(this.reconnectDelayMs * 2, MAX_RECONNECT_DELAY_MS);
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, delayMs);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private emitStatus(status: ProviderStatus): void {
    if (this.lastStatus === status) {
      return;
    }

    this.lastStatus = status;
    this.emit('status', [{ status }]);
  }

  private clearRemoteAwarenessStates(): void {
    const remoteClientIds = Array.from(this.stableAwareness.getStates().keys()).filter((clientId) => clientId !== this.doc.clientID);
    if (remoteClientIds.length === 0) {
      return;
    }

    awarenessProtocol.removeAwarenessStates(this.stableAwareness, remoteClientIds, this.transportToStableOrigin);
  }

  private isCurrentAttempt(attempt: number): boolean {
    return !this.destroyed && this.shouldConnect && attempt === this.connectAttempt;
  }

  private syncAwarenessStates(
    source: awarenessProtocol.Awareness,
    target: awarenessProtocol.Awareness,
    origin: unknown,
  ): void {
    const clientIds = Array.from(source.getStates().keys());
    if (clientIds.length === 0) {
      return;
    }

    awarenessProtocol.applyAwarenessUpdate(target, awarenessProtocol.encodeAwarenessUpdate(source, clientIds), origin);
  }

  private applyAwarenessChanges(
    source: awarenessProtocol.Awareness,
    target: awarenessProtocol.Awareness,
    changes: AwarenessUpdate,
    origin: unknown,
  ): void {
    const clientIds = changes.added.concat(changes.updated, changes.removed);
    if (clientIds.length === 0) {
      return;
    }

    awarenessProtocol.applyAwarenessUpdate(target, awarenessProtocol.encodeAwarenessUpdate(source, clientIds), origin);
  }
}
