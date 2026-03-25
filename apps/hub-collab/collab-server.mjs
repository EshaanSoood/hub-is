import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { URL } from 'node:url';
import WebSocket, { WebSocketServer } from 'ws';
import * as Y from 'yjs';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as syncProtocol from 'y-protocols/sync';
import * as decoding from 'lib0/decoding';
import * as encoding from 'lib0/encoding';
import { createJwksVerifier } from '../shared/jwksVerifier.mjs';

const PORT = Number(process.env.PORT || '1234');
const HOST = (process.env.HOST || '0.0.0.0').trim();
const HUB_API_URL = (process.env.HUB_API_URL || 'http://127.0.0.1:3001').trim().replace(/\/+$/, '');
const HUB_DB_PATH = process.env.HUB_DB_PATH || '/data/hub.sqlite';
const KEYCLOAK_ISSUER = (process.env.KEYCLOAK_ISSUER || '').trim();
const KEYCLOAK_AUDIENCE = (process.env.KEYCLOAK_AUDIENCE || '').trim();
const KEYCLOAK_JWKS_CACHE_MAX_AGE_MS = Number(process.env.KEYCLOAK_JWKS_CACHE_MAX_AGE_MS || '600000');
const HUB_COLLAB_ALLOWED_ORIGINS = (process.env.HUB_COLLAB_ALLOWED_ORIGINS || '').split(',').map((item) => item.trim()).filter(Boolean);
const HUB_COLLAB_REQUIRE_ORIGIN = process.env.HUB_COLLAB_REQUIRE_ORIGIN === 'true';
const HUB_COLLAB_MAX_CONNECTIONS = Number(process.env.HUB_COLLAB_MAX_CONNECTIONS || '250');
const HUB_COLLAB_MAX_DOCUMENTS = Number(process.env.HUB_COLLAB_MAX_DOCUMENTS || '500');
const DOC_SAVE_DEBOUNCE_MS = Number(process.env.HUB_COLLAB_SAVE_DEBOUNCE_MS || '750');
const HUB_API_FETCH_TIMEOUT_MS = Number(process.env.HUB_API_FETCH_TIMEOUT_MS || '8000');

const wsReadyStateConnecting = WebSocket.CONNECTING;
const wsReadyStateOpen = WebSocket.OPEN;

const docs = new Map();
const messageSync = 0;
const messageAwareness = 1;

const jwtVerifier = (() => {
  if (KEYCLOAK_ISSUER) {
    return createJwksVerifier({
      issuer: KEYCLOAK_ISSUER,
      audience: KEYCLOAK_AUDIENCE,
      jwksCacheMaxAgeMs: Number.isFinite(KEYCLOAK_JWKS_CACHE_MAX_AGE_MS) && KEYCLOAK_JWKS_CACHE_MAX_AGE_MS > 0
        ? Math.floor(KEYCLOAK_JWKS_CACHE_MAX_AGE_MS)
        : 600_000,
    });
  }

  throw new Error('KEYCLOAK_ISSUER must be configured.');
})();

const db = new DatabaseSync(HUB_DB_PATH, {
  readOnly: true,
});
db.exec('PRAGMA foreign_keys = ON;');

const userByKcSubStmt = db.prepare('SELECT user_id, display_name FROM users WHERE kc_sub = ? LIMIT 1');
const docAccessByIdStmt = db.prepare(`
  SELECT d.doc_id, d.pane_id, p.project_id
  FROM docs d
  JOIN panes p ON p.pane_id = d.pane_id
  WHERE d.doc_id = ?
  LIMIT 1
`);
const projectMembershipStmt = db.prepare('SELECT role FROM project_members WHERE project_id = ? AND user_id = ? LIMIT 1');
const paneEditorStmt = db.prepare('SELECT 1 AS ok FROM pane_members WHERE pane_id = ? AND user_id = ? LIMIT 1');

const nowIso = () => new Date().toISOString();
const asText = (value) => (typeof value === 'string' ? value.trim() : '');
const parseJson = (value, fallback = null) => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  if (typeof value === 'object') {
    return value;
  }
  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
};

const normalizeProjectRole = (role) => (asText(role) === 'owner' || asText(role) === 'admin' ? 'owner' : 'member');

const parseBearerToken = (headerValue) => {
  const value = asText(headerValue);
  if (!value) {
    return '';
  }
  const [scheme, token] = value.split(/\s+/);
  if (scheme.toLowerCase() !== 'bearer' || !token) {
    return '';
  }
  return token;
};

const parseTokenFromProtocols = (headerValue) => {
  const parts = String(headerValue || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length >= 2 && parts[0].toLowerCase() === 'bearer') {
    return parts[1];
  }
  return '';
};

const buildHubApiAuthHeaders = (token, { hasBody = false } = {}) => {
  const headers = {
    Authorization: `Bearer ${token}`,
  };
  if (hasBody) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
};

const fetchWithTimeout = async (url, options = {}, timeoutMs = HUB_API_FETCH_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
};

const log = (level, message, details = undefined) => {
  const payload = {
    ts: nowIso(),
    level,
    scope: 'hub-collab',
    message,
    ...(details && typeof details === 'object' ? details : {}),
  };
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(payload));
};

const ensureOriginAllowed = (origin) => {
  if (!origin && HUB_COLLAB_REQUIRE_ORIGIN) {
    throw new Error('origin_required');
  }
  if (!origin || HUB_COLLAB_ALLOWED_ORIGINS.length === 0) {
    return;
  }
  if (!HUB_COLLAB_ALLOWED_ORIGINS.includes(origin)) {
    throw new Error('origin_not_allowed');
  }
};

const sendWsMessage = (ws, message) => {
  if (ws.readyState === wsReadyStateConnecting) {
    ws.once('open', () => {
      sendWsMessage(ws, message);
    });
    return;
  }

  if (ws.readyState !== wsReadyStateOpen) {
    return;
  }

  try {
    ws.send(message, () => {});
  } catch {
    ws.close();
  }
};

const createDocState = (docId) => {
  const ydoc = new Y.Doc();
  ydoc.gc = true;
  ydoc.name = docId;

  const awareness = new awarenessProtocol.Awareness(ydoc);
  const clients = new Map();

  const state = {
    docId,
    ydoc,
    awareness,
    clients,
    loaded: false,
    loadPromise: null,
    saveTimer: null,
    snapshotVersion: 0,
    lastKnownToken: '',
    projectId: '',
    paneId: '',
  };

  ydoc.on('update', (update, origin) => {
    if (origin?.origin === 'initial-load') {
      return;
    }

    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageSync);
    syncProtocol.writeUpdate(encoder, update);
    const message = encoding.toUint8Array(encoder);

    for (const [clientWs] of state.clients) {
      sendWsMessage(clientWs, message);
    }

    schedulePersist(state);
  });

  awareness.on('update', ({ added, updated, removed }, origin) => {
    const connection = state.clients.get(origin);
    if (connection?.awarenessClientIds) {
      for (const clientId of added.concat(updated)) {
        connection.awarenessClientIds.add(clientId);
      }
      for (const clientId of removed) {
        connection.awarenessClientIds.delete(clientId);
      }
    }

    const changedClients = added.concat(updated, removed);
    if (changedClients.length === 0) {
      return;
    }

    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageAwareness);
    encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients));
    const message = encoding.toUint8Array(encoder);

    for (const [clientWs] of state.clients) {
      if (clientWs !== origin) {
        sendWsMessage(clientWs, message);
      }
    }
  });

  return state;
};

const getDocState = (docId) => {
  if (!docs.has(docId)) {
    if (docs.size >= HUB_COLLAB_MAX_DOCUMENTS) {
      throw new Error('max_documents_reached');
    }
    docs.set(docId, createDocState(docId));
  }
  return docs.get(docId);
};

const maybeCleanupDoc = async (state) => {
  if (state.clients.size > 0) {
    return;
  }

  if (state.saveTimer) {
    clearTimeout(state.saveTimer);
    state.saveTimer = null;
  }

  await persistDocSnapshot(state).catch(() => {
    // best effort
  });

  state.awareness.destroy();
  state.ydoc.destroy();
  docs.delete(state.docId);
};

const authorizeJwtConnection = async (token, docId) => {
  const verification = await jwtVerifier.verifyToken(token);
  const claims = verification.claims;
  const kcSub = asText(claims.sub);
  if (!kcSub) {
    throw new Error('token_sub_missing');
  }

  const user = userByKcSubStmt.get(kcSub);
  if (!user) {
    throw new Error('user_not_registered');
  }

  const doc = docAccessByIdStmt.get(docId);
  if (!doc) {
    throw new Error('doc_not_found');
  }

  const projectMembership = projectMembershipStmt.get(doc.project_id, user.user_id);
  if (!projectMembership) {
    throw new Error('project_membership_required');
  }

  const isOwner = normalizeProjectRole(projectMembership.role) === 'owner';
  const paneEditor = paneEditorStmt.get(doc.pane_id, user.user_id);
  const canEdit = isOwner || Boolean(paneEditor?.ok);
  if (!canEdit) {
    throw new Error('pane_write_required');
  }

  const displayName = asText(claims.name) || asText(claims.preferred_username) || user.display_name || 'Collaborator';

  return {
    doc_id: doc.doc_id,
    pane_id: doc.pane_id,
    project_id: doc.project_id,
    user_id: user.user_id,
    display_name: displayName,
    access_token: token,
    can_edit: canEdit,
  };
};
const authorizeConnection = async (token, docId) => {
  return authorizeJwtConnection(token, docId);
};

const authorizeWithWsTicket = async (wsTicket, docId) => {
  let response;
  try {
    response = await fetchWithTimeout(`${HUB_API_URL}/api/hub/collab/tickets/consume`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        doc_id: docId,
        ws_ticket: wsTicket,
      }),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('collab_ticket_consume_timeout');
    }
    throw error;
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.ok !== true || !payload?.data?.ticket) {
    throw new Error(payload?.error?.message || 'collab_ticket_invalid');
  }

  return payload.data.ticket;
};

const loadDocSnapshot = async (state, token) => {
  if (state.loaded) {
    return;
  }

  if (!state.loadPromise) {
    state.loadPromise = (async () => {
      try {
        let response;
        try {
          response = await fetchWithTimeout(`${HUB_API_URL}/api/hub/docs/${encodeURIComponent(state.docId)}`, {
            method: 'GET',
            headers: buildHubApiAuthHeaders(token),
          });
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') {
            throw new Error('doc_snapshot_load_timeout');
          }
          throw error;
        }

        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload?.ok !== true || !payload?.data?.doc) {
          throw new Error(payload?.error?.message || 'doc_snapshot_load_failed');
        }

        const docSnapshot = payload.data.doc;
        state.snapshotVersion = Number.isInteger(docSnapshot.snapshot_version) ? docSnapshot.snapshot_version : 0;
        const snapshotPayload = parseJson(docSnapshot.snapshot_payload, null);
        if (snapshotPayload?.yjs_update_base64) {
          const update = Buffer.from(String(snapshotPayload.yjs_update_base64), 'base64');
          Y.applyUpdate(state.ydoc, new Uint8Array(update), { origin: 'initial-load' });
        }

        state.loaded = true;
        state.lastKnownToken = token;
      } catch (error) {
        if (state.clients.size === 0 && docs.get(state.docId) === state) {
          if (state.saveTimer) {
            clearTimeout(state.saveTimer);
            state.saveTimer = null;
          }
          state.awareness.destroy();
          state.ydoc.destroy();
          docs.delete(state.docId);
        }
        throw error;
      } finally {
        state.loadPromise = null;
      }
    })();
  }

  await state.loadPromise;
};

const persistDocSnapshot = async (state) => {
  if (!state.lastKnownToken) {
    return;
  }

  const yjsUpdate = Buffer.from(Y.encodeStateAsUpdate(state.ydoc)).toString('base64');
  const nextVersion = state.snapshotVersion + 1;

  let response;
  try {
    response = await fetchWithTimeout(`${HUB_API_URL}/api/hub/docs/${encodeURIComponent(state.docId)}`, {
      method: 'PUT',
      headers: buildHubApiAuthHeaders(state.lastKnownToken, { hasBody: true }),
      body: JSON.stringify({
        snapshot_version: nextVersion,
        snapshot_payload: {
          yjs_update_base64: yjsUpdate,
        },
      }),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('doc_snapshot_save_timeout');
    }
    throw error;
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.ok !== true) {
    throw new Error(payload?.error?.message || 'doc_snapshot_save_failed');
  }

  state.snapshotVersion = nextVersion;
};

const schedulePersist = (state) => {
  if (state.saveTimer) {
    clearTimeout(state.saveTimer);
  }

  state.saveTimer = setTimeout(() => {
    state.saveTimer = null;
    persistDocSnapshot(state).catch((error) => {
      log('error', 'snapshot.persist.failed', {
        docId: state.docId,
        error: error instanceof Error ? error.message : 'unknown',
      });
    });
  }, DOC_SAVE_DEBOUNCE_MS);
};

const sendInitialSync = (state, ws) => {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, messageSync);
  syncProtocol.writeSyncStep1(encoder, state.ydoc);
  sendWsMessage(ws, encoding.toUint8Array(encoder));

  const awarenessStates = Array.from(state.awareness.getStates().keys());
  if (awarenessStates.length > 0) {
    const awarenessEncoder = encoding.createEncoder();
    encoding.writeVarUint(awarenessEncoder, messageAwareness);
    encoding.writeVarUint8Array(
      awarenessEncoder,
      awarenessProtocol.encodeAwarenessUpdate(state.awareness, awarenessStates),
    );
    sendWsMessage(ws, encoding.toUint8Array(awarenessEncoder));
  }
};

const handleSyncMessage = (state, ws, decoder, messageType) => {
  void messageType;
  const syncTypeHint = decoding.peekVarUint(decoder);
  if (syncTypeHint === syncProtocol.messageYjsUpdate && ws.canEdit === false) {
    return;
  }

  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, messageSync);

  const syncType = syncProtocol.readSyncMessage(decoder, encoder, state.ydoc, ws);
  if (syncType === syncProtocol.messageYjsUpdate) {
    schedulePersist(state);
  }

  if (encoding.length(encoder) > 1) {
    sendWsMessage(ws, encoding.toUint8Array(encoder));
  }
};

const handleAwarenessMessage = (state, ws, decoder) => {
  const update = decoding.readVarUint8Array(decoder);
  awarenessProtocol.applyAwarenessUpdate(state.awareness, update, ws);
};

const server = createServer((request, response) => {
  response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify({ ok: true, scope: 'hub-collab', timestamp: nowIso() }));
});

const wss = new WebSocketServer({ noServer: true, maxPayload: 50 * 1024 * 1024 });

wss.on('connection', async (ws, request, context) => {
  const { docId, token, projectId, paneId, userId, displayName, canEdit } = context;

  ws.docId = docId;
  ws.userId = userId;
  ws.canEdit = canEdit === true;

  let state;
  try {
    state = getDocState(docId);
  } catch (error) {
    ws.close(1013, error instanceof Error ? error.message : 'capacity_reached');
    return;
  }

  state.projectId = projectId;
  state.paneId = paneId;
  state.lastKnownToken = token;

  try {
    await loadDocSnapshot(state, token);
  } catch (error) {
    ws.close(1011, error instanceof Error ? error.message : 'snapshot_load_failed');
    return;
  }

  state.clients.set(ws, {
    userId,
    displayName,
    canEdit: ws.canEdit,
    connectedAt: nowIso(),
    awarenessClientIds: new Set(),
  });

  sendInitialSync(state, ws);

  ws.on('message', (data) => {
    let message;
    if (data instanceof Uint8Array) {
      message = data;
    } else if (Buffer.isBuffer(data)) {
      message = new Uint8Array(data);
    } else {
      message = new Uint8Array(Buffer.from(data));
    }

    const decoder = decoding.createDecoder(message);
    const messageType = decoding.readVarUint(decoder);

    if (messageType === messageSync) {
      handleSyncMessage(state, ws, decoder, messageType);
      return;
    }

    if (messageType === messageAwareness) {
      handleAwarenessMessage(state, ws, decoder);
    }
  });

  ws.on('close', () => {
    const clientMeta = state.clients.get(ws);
    if (clientMeta?.awarenessClientIds?.size) {
      awarenessProtocol.removeAwarenessStates(state.awareness, Array.from(clientMeta.awarenessClientIds), ws);
    }

    state.clients.delete(ws);

    maybeCleanupDoc(state).catch(() => {
      // no-op
    });
  });

  ws.on('error', () => {
    ws.close();
  });
});

server.on('upgrade', async (request, socket, head) => {
  if (wss.clients.size >= HUB_COLLAB_MAX_CONNECTIONS) {
    socket.write('HTTP/1.1 503 Service Unavailable\r\n\r\n');
    socket.destroy();
    return;
  }

  try {
    const requestUrl = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    const origin = asText(request.headers.origin || '');
    ensureOriginAllowed(origin);

    const docId = asText(requestUrl.searchParams.get('doc_id') || requestUrl.searchParams.get('docId'));
    const wsTicket = asText(requestUrl.searchParams.get('ws_ticket') || requestUrl.searchParams.get('wsTicket'));
    const bearerToken = parseBearerToken(request.headers.authorization || '');
    const protocolToken = parseTokenFromProtocols(request.headers['sec-websocket-protocol'] || '');
    const token = bearerToken || protocolToken;

    if (!docId || !/^doc_[a-z0-9-]+$/i.test(docId)) {
      throw new Error('invalid_doc_id');
    }

    if (!token && !wsTicket) {
      throw new Error('missing_auth');
    }

    const authorization = wsTicket
      ? await authorizeWithWsTicket(wsTicket, docId)
      : await authorizeConnection(token, docId);
    const context = {
      docId: authorization.doc_id,
      projectId: authorization.project_id,
      paneId: authorization.pane_id,
      userId: authorization.user_id,
      displayName: authorization.display_name || 'Collaborator',
      token: authorization.access_token || token,
      canEdit: authorization.can_edit === true,
    };

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request, context);
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'authorization_failed';
    const forbiddenErrors = new Set(['project_membership_required', 'pane_membership_required', 'pane_write_required']);
    const statusLine = forbiddenErrors.has(message) ? 'HTTP/1.1 403 Forbidden\r\n\r\n' : 'HTTP/1.1 401 Unauthorized\r\n\r\n';
    socket.write(statusLine);
    socket.destroy();
    log('warn', 'upgrade.denied', {
      error: message,
    });
  }
});

server.listen(PORT, HOST, () => {
  log('info', 'collab.server.started', {
    port: PORT,
    host: HOST,
    hubApiUrl: HUB_API_URL,
  });
});
