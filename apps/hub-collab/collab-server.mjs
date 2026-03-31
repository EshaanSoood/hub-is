import { Server } from '@hocuspocus/server';
import * as Y from 'yjs';

const PORT = Number(process.env.PORT || '1234');
const HOST = (process.env.HOST || '0.0.0.0').trim();
const HUB_API_URL = (process.env.HUB_API_URL || 'http://127.0.0.1:3001').trim().replace(/\/+$/, '');
const HUB_COLLAB_ALLOWED_ORIGINS = (process.env.HUB_COLLAB_ALLOWED_ORIGINS || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);
const HUB_COLLAB_REQUIRE_ORIGIN = process.env.HUB_COLLAB_REQUIRE_ORIGIN === 'true';
const HUB_COLLAB_MAX_CONNECTIONS = Number(process.env.HUB_COLLAB_MAX_CONNECTIONS || '250');
const HUB_COLLAB_MAX_DOCUMENTS = Number(process.env.HUB_COLLAB_MAX_DOCUMENTS || '500');
const DOC_SAVE_DEBOUNCE_MS = Number(process.env.HUB_COLLAB_SAVE_DEBOUNCE_MS || '750');
const HUB_API_FETCH_TIMEOUT_MS = Number(process.env.HUB_API_FETCH_TIMEOUT_MS || '8000');

const documentMetadata = new WeakMap();

const nowIso = () => new Date().toISOString();
const asText = (value) => (typeof value === 'string' ? value.trim() : '');
const permissionError = (message) => Object.assign(new Error(message), { reason: message });
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
const buildHubApiAuthHeaders = (token, { hasBody = false } = {}) => ({
  Authorization: `Bearer ${token}`,
  ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
});
const encodeDocUpdateBase64 = (document) => Buffer.from(Y.encodeStateAsUpdate(document)).toString('base64');

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

const rejectUpgrade = (socket, statusCode, reasonPhrase) => {
  try {
    socket.write(`HTTP/1.1 ${statusCode} ${reasonPhrase}\r\nConnection: close\r\n\r\n`);
  } finally {
    socket.destroy();
  }
};

const getDocumentMeta = (document) => {
  let meta = documentMetadata.get(document);
  if (!meta) {
    meta = {
      snapshotVersion: 0,
      lastPersistedYjsUpdate: '',
      accessToken: '',
      projectId: '',
      paneId: '',
    };
    documentMetadata.set(document, meta);
  }
  return meta;
};

const authorizeToken = async (token, docId) => {
  let response;
  try {
    response = await fetchWithTimeout(`${HUB_API_URL}/api/hub/collab/authorize?doc_id=${encodeURIComponent(docId)}`, {
      method: 'GET',
      headers: buildHubApiAuthHeaders(token),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw permissionError('collab_authorize_timeout');
    }
    throw error;
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.ok !== true || !payload?.data?.authorization) {
    throw permissionError(payload?.error?.code || payload?.error?.message || 'collab_authorize_failed');
  }

  const authorization = payload.data.authorization;
  return {
    docId: asText(authorization.doc_id),
    paneId: asText(authorization.pane_id),
    projectId: asText(authorization.project_id),
    userId: asText(authorization.user_id),
    displayName: asText(authorization.display_name) || 'Collaborator',
    accessToken: token,
    canEdit: authorization.can_edit === true,
  };
};

const loadSnapshot = async ({ accessToken, docId }) => {
  let response;
  try {
    response = await fetchWithTimeout(`${HUB_API_URL}/api/hub/docs/${encodeURIComponent(docId)}`, {
      method: 'GET',
      headers: buildHubApiAuthHeaders(accessToken),
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
  const snapshotPayload = parseJson(docSnapshot.snapshot_payload, {});
  return {
    snapshotVersion: Number.isInteger(docSnapshot.snapshot_version) ? docSnapshot.snapshot_version : 0,
    yjsUpdateBase64:
      snapshotPayload?.yjs_update_base64 && typeof snapshotPayload.yjs_update_base64 === 'string'
        ? String(snapshotPayload.yjs_update_base64)
        : '',
  };
};

const refreshSnapshotMeta = async (document, meta) => {
  const snapshot = await loadSnapshot({
    accessToken: meta.accessToken,
    docId: document.name,
  });
  meta.snapshotVersion = snapshot.snapshotVersion;
  meta.lastPersistedYjsUpdate = snapshot.yjsUpdateBase64 || encodeDocUpdateBase64(document);
};

const persistSnapshot = async (document, meta, retryOnConflict = true) => {
  if (!meta.accessToken) {
    return;
  }

  const yjsUpdateBase64 = encodeDocUpdateBase64(document);
  if (yjsUpdateBase64 === meta.lastPersistedYjsUpdate) {
    return;
  }

  let response;
  try {
    response = await fetchWithTimeout(`${HUB_API_URL}/api/hub/docs/${encodeURIComponent(document.name)}`, {
      method: 'PUT',
      headers: buildHubApiAuthHeaders(meta.accessToken, { hasBody: true }),
      body: JSON.stringify({
        snapshot_version: meta.snapshotVersion,
        snapshot_payload: {
          yjs_update_base64: yjsUpdateBase64,
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
    if (retryOnConflict && payload?.error?.code === 'version_conflict') {
      await refreshSnapshotMeta(document, meta);
      await persistSnapshot(document, meta, false);
      return;
    }
    throw new Error(payload?.error?.message || 'doc_snapshot_save_failed');
  }

  meta.snapshotVersion = Number.isInteger(payload?.data?.snapshot_version) ? payload.data.snapshot_version : meta.snapshotVersion + 1;
  meta.lastPersistedYjsUpdate = yjsUpdateBase64;
};

const server = new Server({
  address: HOST,
  debounce: DOC_SAVE_DEBOUNCE_MS,
  maxDebounce: Math.max(DOC_SAVE_DEBOUNCE_MS, DOC_SAVE_DEBOUNCE_MS * 4),
  name: 'hub-collab',
  port: PORT,
  quiet: true,
  timeout: 30_000,
  unloadImmediately: true,
  async onRequest({ request, response }) {
    response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ ok: true, scope: 'hub-collab', timestamp: nowIso(), path: request.url || '/' }));
    throw null;
  },
  async onUpgrade({ instance, request, socket }) {
    try {
      const requestUrl = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
      ensureOriginAllowed(asText(request.headers.origin || ''));

      if (instance.getConnectionsCount() >= HUB_COLLAB_MAX_CONNECTIONS) {
        rejectUpgrade(socket, 503, 'Service Unavailable');
        throw null;
      }

      if (requestUrl.pathname && requestUrl.pathname !== '/') {
        rejectUpgrade(socket, 404, 'Not Found');
        throw null;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      const statusCode = message === 'origin_not_allowed' ? 403 : 401;
      const reasonPhrase = statusCode === 403 ? 'Forbidden' : 'Unauthorized';
      rejectUpgrade(socket, statusCode, reasonPhrase);
      log('warn', 'upgrade.denied', { error: message || 'authorization_failed' });
      throw null;
    }
  },
  async onConnect({ documentName, instance }) {
    if (!/^doc_[a-z0-9-]+$/i.test(documentName)) {
      throw permissionError('invalid_doc_id');
    }
    if (!instance.documents.has(documentName) && instance.getDocumentsCount() >= HUB_COLLAB_MAX_DOCUMENTS) {
      throw permissionError('max_documents_reached');
    }
  },
  async onAuthenticate({ connectionConfig, documentName, token }) {
    const authorization = await authorizeToken(token, documentName);
    connectionConfig.readOnly = authorization.canEdit !== true;
    return authorization;
  },
  async onTokenSync({ connectionConfig, document, token }) {
    const authorization = await authorizeToken(token, document.name);
    const meta = getDocumentMeta(document);
    meta.accessToken = authorization.accessToken;
    connectionConfig.readOnly = authorization.canEdit !== true;
    return authorization;
  },
  async onLoadDocument({ context, document, documentName }) {
    const meta = getDocumentMeta(document);
    meta.accessToken = asText(context?.accessToken || meta.accessToken);
    meta.projectId = asText(context?.projectId || meta.projectId);
    meta.paneId = asText(context?.paneId || meta.paneId);

    const snapshot = await loadSnapshot({
      accessToken: meta.accessToken,
      docId: documentName,
    });

    if (snapshot.yjsUpdateBase64) {
      const update = Buffer.from(snapshot.yjsUpdateBase64, 'base64');
      Y.applyUpdate(document, new Uint8Array(update), 'initial-load');
    }

    meta.snapshotVersion = snapshot.snapshotVersion;
    meta.lastPersistedYjsUpdate = snapshot.yjsUpdateBase64 || encodeDocUpdateBase64(document);
  },
  async onChange({ context, document }) {
    const meta = getDocumentMeta(document);
    meta.accessToken = asText(context?.accessToken || meta.accessToken);
  },
  async onStoreDocument({ context, document }) {
    const meta = getDocumentMeta(document);
    meta.accessToken = asText(context?.accessToken || meta.accessToken);
    await persistSnapshot(document, meta);
  },
  async connected({ clientsCount, context, documentName }) {
    log('info', 'collab.connected', {
      clientsCount,
      docId: documentName,
      projectId: context?.projectId || '',
      userId: context?.userId || '',
    });
  },
  async onDisconnect({ clientsCount, context, documentName }) {
    log('info', 'collab.disconnected', {
      clientsCount,
      docId: documentName,
      projectId: context?.projectId || '',
      userId: context?.userId || '',
    });
  },
});

await server.listen();

log('info', 'collab.server.started', {
  host: HOST,
  hubApiUrl: HUB_API_URL,
  port: PORT,
});
