/// <reference types="node" />

import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';
import { Doc } from 'yjs';
import {
  createCollabSessionManager,
  type ManagedCollabProvider,
  type NoteCollaborationSession,
} from '../collabSessionManager.ts';

type ProviderListener = (payload: unknown) => void;

class FakeProvider implements ManagedCollabProvider {
  document: Doc;
  synced = false;
  hasUnsyncedChanges = false;
  connectCalls = 0;
  destroyCalls = 0;
  disconnectCalls = 0;
  listeners: Record<'authenticated' | 'authenticationFailed' | 'close' | 'open' | 'status' | 'synced', ProviderListener[]> = {
    authenticated: [],
    authenticationFailed: [],
    close: [],
    open: [],
    status: [],
    synced: [],
  };

  constructor(document: Doc) {
    this.document = document;
  }

  connect() {
    this.connectCalls += 1;
  }

  destroy() {
    this.destroyCalls += 1;
  }

  disconnect() {
    this.disconnectCalls += 1;
  }

  on(event: keyof FakeProvider['listeners'], listener: ProviderListener) {
    this.listeners[event].push(listener);
  }

  off(event: keyof FakeProvider['listeners'], listener: ProviderListener) {
    this.listeners[event] = this.listeners[event].filter((candidate) => candidate !== listener);
  }

  emit(event: keyof FakeProvider['listeners'], payload: unknown = {}) {
    for (const listener of this.listeners[event]) {
      listener(payload);
    }
  }
}

const createFakeTimers = () => {
  let now = 0;
  let nextId = 1;
  const timers = new Map<number, { runAt: number; fn: () => void }>();

  return {
    clearTimeout(id: number | ReturnType<typeof globalThis.setTimeout> | undefined) {
      if (typeof id !== 'number') {
        return;
      }
      timers.delete(id);
    },
    setTimeout(fn: () => void, delay: number) {
      const id = nextId++;
      timers.set(id, {
        fn,
        runAt: now + delay,
      });
      return id;
    },
    tick(ms: number) {
      now += ms;
      const ready = [...timers.entries()]
        .filter(([, timer]) => timer.runAt <= now)
        .sort((left, right) => left[1].runAt - right[1].runAt);
      for (const [id, timer] of ready) {
        timers.delete(id);
        timer.fn();
      }
    },
  };
};

const sessionConfig: NoteCollaborationSession = {
  roomId: 'room-1',
  serverUrl: 'wss://collab.example.test',
  getAccessToken: () => 'token-1',
};

describe('collabSessionManager', () => {
  test('reuses a warm room session across release/acquire churn before grace expiry', () => {
    const fakeTimers = createFakeTimers();
    const providers: FakeProvider[] = [];
    const manager = createCollabSessionManager({
      graceMs: 15_000,
      createProvider: ({ document }) => {
        const provider = new FakeProvider(document);
        providers.push(provider);
        return provider;
      },
      log: () => {},
      timers: fakeTimers,
    });

    const firstSession = manager.getSession(sessionConfig);
    const releaseFirst = firstSession.acquire();
    assert.equal(providers.length, 1);
    assert.equal(providers[0].connectCalls, 1);

    releaseFirst();
    fakeTimers.tick(14_999);
    assert.equal(providers[0].destroyCalls, 0);

    const secondSession = manager.getSession(sessionConfig);
    assert.equal(secondSession.provider, firstSession.provider);
    const releaseSecond = secondSession.acquire();
    assert.equal(providers[0].destroyCalls, 0);
    assert.equal(providers[0].connectCalls, 2);

    fakeTimers.tick(1);
    assert.equal(providers[0].destroyCalls, 0);

    releaseSecond();
    fakeTimers.tick(15_000);
    assert.equal(providers[0].destroyCalls, 1);

    const thirdSession = manager.getSession(sessionConfig);
    assert.notEqual(thirdSession.provider, firstSession.provider);
  });

  test('records close diagnostics and classifies auth failures separately', () => {
    const manager = createCollabSessionManager({
      createProvider: ({ document }) => new FakeProvider(document),
      log: () => {},
    });

    const session = manager.getSession(sessionConfig);
    const provider = session.provider as FakeProvider;
    const release = session.acquire();

    provider.emit('authenticationFailed', { reason: 'invalid_token' });
    provider.emit('close', {
      event: {
        code: 4401,
        reason: 'Unauthorized',
      },
    });

    const snapshot = session.getSnapshot();
    assert.equal(snapshot.lastAuthError, 'invalid_token');
    assert.equal(snapshot.lastClose?.classification, 'auth_rejection');
    assert.equal(snapshot.phase, 'connecting');

    release();
  });
});
