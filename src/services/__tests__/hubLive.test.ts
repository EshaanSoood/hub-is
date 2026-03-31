/// <reference types="node" />

import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import { createHubLiveClient, getHubLiveReconnectDelayMs } from '../hubLive.ts';

class FakeSocket {
  closed = false;

  listeners: Record<string, Array<(event?: { data?: unknown }) => void>> = {
    close: [],
    error: [],
    message: [],
    open: [],
  };

  addEventListener(type: 'close' | 'error' | 'message' | 'open', listener: (event?: { data?: unknown }) => void) {
    this.listeners[type].push(listener);
  }

  close() {
    this.closed = true;
  }

  emit(type: 'close' | 'error' | 'message' | 'open', event?: { data?: unknown }) {
    for (const listener of this.listeners[type]) {
      listener(event);
    }
  }
}

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('hubLive client', () => {
  test('shares one socket across subscribers and tears it down when the last subscriber leaves', async () => {
    const sockets: FakeSocket[] = [];
    let authorizeCalls = 0;
    const client = createHubLiveClient({
      authorize: async () => {
        authorizeCalls += 1;
        return {
          user_id: 'user-1',
          ws_ticket: `ticket-${authorizeCalls}`,
          ticket_issued_at: '2026-03-31T20:00:00Z',
          ticket_expires_at: '2026-03-31T20:02:00Z',
          ticket_expires_in_ms: 120_000,
        };
      },
      createSocket: () => {
        const socket = new FakeSocket();
        sockets.push(socket);
        return socket;
      },
      timers: {
        clearTimeout: () => {},
        setTimeout: () => {
          throw new Error('Reconnect timer should not run in this test.');
        },
      },
    });

    const receivedA: string[] = [];
    const receivedB: string[] = [];
    const unsubscribeA = client.subscribe('token-1', (message) => {
      receivedA.push(message.type);
    });
    const unsubscribeB = client.subscribe('token-1', (message) => {
      receivedB.push(message.type);
    });

    await flush();

    assert.equal(authorizeCalls, 1);
    assert.equal(sockets.length, 1);

    sockets[0].emit('open');
    sockets[0].emit('message', {
      data: JSON.stringify({ type: 'ready', user_id: 'user-1' }),
    });

    assert.deepEqual(receivedA, ['ready']);
    assert.deepEqual(receivedB, ['ready']);

    unsubscribeA();
    assert.equal(sockets[0].closed, false);

    unsubscribeB();
    assert.equal(sockets[0].closed, true);
  });

  test('uses bounded reconnect backoff', () => {
    assert.equal(getHubLiveReconnectDelayMs(1), 1_500);
    assert.equal(getHubLiveReconnectDelayMs(2), 5_000);
    assert.equal(getHubLiveReconnectDelayMs(3), 15_000);
    assert.equal(getHubLiveReconnectDelayMs(4), 30_000);
    assert.equal(getHubLiveReconnectDelayMs(9), 30_000);
  });
});
