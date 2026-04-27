/* global fetch */

import { WebsocketProvider } from 'y-websocket';
import WebSocket from 'ws';
import * as Y from 'yjs';

const hubBaseUrl = (process.env.HUB_BASE_URL || 'https://eshaansood.org').replace(/\/$/, '');
const collabWsUrl = (process.env.HUB_COLLAB_WS_URL || 'wss://collab.eshaansood.org').replace(/\/$/, '');
const memberToken = process.env.HUB_ACCESS_TOKEN || process.env.HUB_OWNER_ACCESS_TOKEN || '';
const noteAuthorToken = process.env.HUB_COLLAB_NOTE_AUTHOR_TOKEN || memberToken;
const collaboratorToken = process.env.HUB_COLLAB_ACCESS_TOKEN || '';
const nonMemberToken = process.env.HUB_NON_MEMBER_ACCESS_TOKEN || '';
const expiredToken = process.env.HUB_COLLAB_EXPIRED_TOKEN || '';
const seededNoteId = (process.env.HUB_COLLAB_NOTE_ID || '').trim();
const projectId = (process.env.HUB_COLLAB_PROJECT_ID || 'backend-pilot').trim();
const timeoutMsRaw = Number(process.env.HUB_COLLAB_TIMEOUT_MS || process.env.HUB_REQUEST_TIMEOUT_MS || '15000');
const timeoutMs = Number.isFinite(timeoutMsRaw) && timeoutMsRaw > 0 ? Math.floor(timeoutMsRaw) : 15000;

const fail = (message) => {
  console.error(message);
  process.exit(1);
};

const assert = (condition, message) => {
  if (!condition) {
    fail(message);
  }
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const withTimeout = async (promise, label, ms = timeoutMs) => {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out after ${String(ms)}ms`));
    }, ms);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId);
  }
};

const request = async (path, { method = 'GET', token = '', body } = {}) => {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(`${hubBaseUrl}${path}`, {
      method,
      signal: controller.signal,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const payload = await response.json().catch(() => ({}));
    return { status: response.status, payload };
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'AbortError';
    return {
      status: -1,
      payload: {},
      networkError: timedOut ? `request timed out after ${String(timeoutMs)}ms` : error instanceof Error ? error.message : 'unknown network error',
    };
  } finally {
    clearTimeout(timeoutHandle);
  }
};

const roomUrl = (room, params = {}) => {
  const url = new URL(collabWsUrl);
  const normalizedPath = url.pathname === '/' ? '' : url.pathname.replace(/\/$/, '');
  url.pathname = `${normalizedPath}/${encodeURIComponent(room)}`;
  Object.entries(params).forEach(([key, value]) => {
    if (typeof value === 'string' && value.length > 0) {
      url.searchParams.set(key, value);
    }
  });
  return url.toString();
};

const expectWsDenied = async (room, params, label) => {
  const ws = new WebSocket(roomUrl(room, params));

  const result = await withTimeout(
    new Promise((resolve) => {
      let opened = false;

      ws.once('open', () => {
        opened = true;
        ws.close();
        resolve({ opened, reason: 'opened' });
      });

      ws.once('error', (error) => {
        resolve({ opened, reason: error instanceof Error ? error.message : 'error' });
      });

      ws.once('close', (code, reason) => {
        resolve({
          opened,
          reason: `${String(code)}:${reason.toString('utf8') || 'closed'}`,
        });
      });
    }),
    `${label} websocket denial`,
  );

  assert(!result.opened, `${label} should have been denied, but connection opened.`);
};

const createNote = async (token, title) => {
  const response = await request(`/api/hub/spaces/${encodeURIComponent(projectId)}/notes`, {
    method: 'POST',
    token,
    body: {
      title,
      lexicalState: {
        root: {
          children: [
            {
              type: 'paragraph',
              version: 1,
              format: '',
              indent: 0,
              direction: null,
              children: [],
            },
          ],
          direction: null,
          format: '',
          indent: 0,
          type: 'root',
          version: 1,
        },
      },
    },
  });

  assert(response.status === 200 && response.payload?.note?.id, `Create note failed (${response.status}).`);
  return response.payload.note;
};

const createSession = async (token, noteId) => {
  const response = await request(
    `/api/hub/spaces/${encodeURIComponent(projectId)}/notes/${encodeURIComponent(noteId)}/collab/session`,
    {
      method: 'POST',
      token,
    },
  );

  assert(
    response.status === 200 && response.payload?.session?.token,
    `Collab session request failed for ${noteId} (${response.status}).`,
  );

  return response.payload.session;
};

const waitForStatus = (provider, expectedStatus) =>
  withTimeout(
    new Promise((resolve) => {
      const matches = () => {
        if (expectedStatus === 'connected') {
          return provider.wsconnected === true;
        }
        if (expectedStatus === 'disconnected') {
          return provider.wsconnected === false;
        }
        return false;
      };

      if (matches()) {
        resolve(undefined);
        return;
      }

      const handler = ({ status }) => {
        if (status === expectedStatus || matches()) {
          provider.off('status', handler);
          resolve(undefined);
        }
      };
      provider.on('status', handler);
    }),
    `provider status ${expectedStatus}`,
  );

const waitForSync = (provider) =>
  withTimeout(
    new Promise((resolve) => {
      if (provider.synced) {
        resolve(undefined);
        return;
      }

      const handler = (isSynced) => {
        if (isSynced) {
          provider.off('sync', handler);
          resolve(undefined);
        }
      };
      provider.on('sync', handler);
    }),
    'provider sync',
  );

const waitForDocText = (doc, expectedFragment) =>
  withTimeout(
    new Promise((resolve) => {
      const text = doc.getText('smoke');
      if (text.toString().includes(expectedFragment)) {
        resolve(undefined);
        return;
      }

      const handler = () => {
        if (text.toString().includes(expectedFragment)) {
          doc.off('update', handler);
          resolve(undefined);
        }
      };
      doc.on('update', handler);
    }),
    `doc text fragment ${expectedFragment}`,
  );

if (!memberToken) {
  fail('BLOCKING INPUTS REQUIRED: set HUB_ACCESS_TOKEN to run collab checks.');
}
if (!nonMemberToken) {
  fail('BLOCKING INPUTS REQUIRED: set HUB_NON_MEMBER_ACCESS_TOKEN to validate non-member denial.');
}
if (!expiredToken) {
  fail('BLOCKING INPUTS REQUIRED: set HUB_COLLAB_EXPIRED_TOKEN to validate expired-token denial.');
}

const nowTag = new Date().toISOString().replace(/[:.]/g, '-');
const noteA =
  seededNoteId.length > 0
    ? {
        id: seededNoteId,
      }
    : await createNote(noteAuthorToken, `collab.test.smoke-a ${nowTag}`);

if (seededNoteId.length > 0) {
  console.log(`Using seeded note id: ${seededNoteId}`);
}

const primarySession = await createSession(memberToken, noteA.id);
const secondSession = collaboratorToken
  ? await createSession(collaboratorToken, noteA.id)
  : await createSession(memberToken, noteA.id);

if (collaboratorToken) {
  console.log('Collaborator-member session mint passed.');
} else {
  console.log('Skipped explicit collaborator-member session check: HUB_COLLAB_ACCESS_TOKEN not provided.');
}

const wrongRoomSuffix = nowTag.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 64);
const wrongRoomId = `note_wrongroom-${wrongRoomSuffix}`;

await expectWsDenied(noteA.id, { projectId, noteId: noteA.id, roomId: noteA.id }, 'Missing token');
await expectWsDenied(
  wrongRoomId,
  {
    access_token: primarySession.token,
    projectId,
    noteId: wrongRoomId,
    roomId: wrongRoomId,
  },
  'Wrong-room token reuse',
);
await expectWsDenied(
  noteA.id,
  {
    access_token: primarySession.token,
    projectId: `${projectId}-mismatch`,
    noteId: noteA.id,
    roomId: noteA.id,
  },
  'Project-id mismatch token reuse',
);

await expectWsDenied(
  noteA.id,
  {
    access_token: expiredToken,
    projectId,
    noteId: noteA.id,
    roomId: noteA.id,
  },
  'Expired token reuse',
);

const nonMemberSessionAttempt = await request(
  `/api/hub/spaces/${encodeURIComponent(projectId)}/notes/${encodeURIComponent(noteA.id)}/collab/session`,
  {
    method: 'POST',
    token: nonMemberToken,
  },
);

assert(
  nonMemberSessionAttempt.status === 403,
  `Non-member collab session should be 403, got ${nonMemberSessionAttempt.status}.`,
);

const ownerDoc = new Y.Doc();
const peerDoc = new Y.Doc();

const ownerProvider = new WebsocketProvider(collabWsUrl, noteA.id, ownerDoc, {
  WebSocketPolyfill: WebSocket,
  disableBc: true,
  params: {
    access_token: primarySession.token,
    projectId,
    noteId: noteA.id,
    roomId: noteA.id,
  },
});

const peerProvider = new WebsocketProvider(collabWsUrl, noteA.id, peerDoc, {
  WebSocketPolyfill: WebSocket,
  disableBc: true,
  params: {
    access_token: secondSession.token,
    projectId,
    noteId: noteA.id,
    roomId: noteA.id,
  },
});

await Promise.all([waitForSync(ownerProvider), waitForSync(peerProvider)]);

await withTimeout(
  new Promise((resolve) => {
    const poll = () => {
      if (ownerProvider.awareness.getStates().size >= 2 && peerProvider.awareness.getStates().size >= 2) {
        resolve(undefined);
        return;
      }
      setTimeout(poll, 100);
    };
    poll();
  }),
  'presence count >= 2',
);

const ownerText = ownerDoc.getText('smoke');
const peerText = peerDoc.getText('smoke');

ownerText.insert(0, 'owner-edit|');
await waitForDocText(peerDoc, 'owner-edit|');

peerText.insert(peerText.length, 'peer-edit|');
await waitForDocText(ownerDoc, 'peer-edit|');

peerProvider.disconnect();
await waitForStatus(peerProvider, 'disconnected');
await wait(500);
peerProvider.connect();
await waitForStatus(peerProvider, 'connected');
await waitForSync(peerProvider);

ownerText.insert(ownerText.length, 'after-reconnect|');
await waitForDocText(peerDoc, 'after-reconnect|');

ownerProvider.disconnect();
peerProvider.disconnect();
ownerProvider.destroy();
peerProvider.destroy();
ownerDoc.destroy();
peerDoc.destroy();

console.log('Collab websocket live checks passed.');
