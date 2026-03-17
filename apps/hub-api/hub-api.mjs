import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { URL } from 'node:url';
import { WebSocketServer } from 'ws';
import { createJwksVerifier } from '../shared/jwksVerifier.mjs';
import { createAutomationRoutes } from './routes/automation.mjs';
import { createCollectionRoutes } from './routes/collections.mjs';
import { createDocRoutes } from './routes/docs.mjs';
import { createFileRoutes } from './routes/files.mjs';
import { createNotificationRoutes } from './routes/notifications.mjs';
import { createPaneRoutes } from './routes/panes.mjs';
import { createProjectRoutes } from './routes/projects.mjs';
import { createSearchRoutes } from './routes/search.mjs';
import { createTaskRoutes } from './routes/tasks.mjs';
import { createUserRoutes } from './routes/users.mjs';
import { createViewRoutes } from './routes/views.mjs';

const PORT = Number(process.env.PORT || '3001');
const HUB_DB_PATH = process.env.HUB_DB_PATH || '/data/hub.sqlite';
const ALLOWED_ORIGIN = process.env.POSTMARK_ALLOWED_ORIGIN || '*';
const HUB_DEV_AUTH_ENABLED = process.env.HUB_DEV_AUTH_ENABLED === 'true';
const KEYCLOAK_ISSUER = (process.env.KEYCLOAK_ISSUER || '').trim();
const KEYCLOAK_AUDIENCE = (process.env.KEYCLOAK_AUDIENCE || '').trim();
const KEYCLOAK_JWKS_CACHE_MAX_AGE_MS = Number(process.env.KEYCLOAK_JWKS_CACHE_MAX_AGE_MS || '600000');
const NEXTCLOUD_BASE_URL = (process.env.NEXTCLOUD_BASE_URL || '').trim();
const NEXTCLOUD_USER = (process.env.NEXTCLOUD_USER || '').trim();
const NEXTCLOUD_APP_PASSWORD = (process.env.NEXTCLOUD_APP_PASSWORD || '').trim();
const HUB_API_ALLOW_SCHEMA_RESET = (process.env.HUB_API_ALLOW_SCHEMA_RESET || '').trim().toLowerCase() === 'true';
const HUB_COLLAB_TICKET_TTL_MS_RAW = Number.parseInt(String(process.env.HUB_COLLAB_TICKET_TTL_MS || '120000'), 10);
const HUB_COLLAB_TICKET_TTL_MS = Number.isInteger(HUB_COLLAB_TICKET_TTL_MS_RAW)
  ? Math.min(900_000, Math.max(10_000, HUB_COLLAB_TICKET_TTL_MS_RAW))
  : 120_000;
const HUB_DEV_AUTH_HEADER = 'x-hub-dev-auth';
const HUB_DEV_AUTH_COOKIE = 'hub_dev_auth';
const HUB_DEV_AUTH_ACCESS_TOKEN = 'dev-auth-local-token';
const HUB_DEV_AUTH_SUB = 'dev-auth-local-sub';
const HUB_DEV_AUTH_NAME = 'Dev Local User';
const HUB_DEV_AUTH_EMAIL = 'dev@local';
const WS_READY_STATE_OPEN = 1;

const nowIso = () => new Date().toISOString();
const asText = (value) => (typeof value === 'string' ? value.trim() : '');
const asNullableText = (value) => {
  const normalized = asText(value);
  return normalized || null;
};

const asInteger = (value, fallback, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER) => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isInteger(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, parsed));
};

const asBoolean = (value, fallback = false) => {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'no', 'off'].includes(normalized)) {
      return false;
    }
  }
  return fallback;
};

const parseJson = (value, fallback = null) => {
  if (value === null || value === undefined || value === '') {
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

const parseJsonObject = (value, fallback = {}) => {
  const parsed = parseJson(value, fallback);
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    return parsed;
  }
  return fallback;
};

const relationTargetCollectionIdFromField = (field) => {
  const config = parseJsonObject(field?.config, {});
  const direct = asText(config.target_collection_id || config.targetCollectionId);
  if (direct) {
    return direct;
  }
  const nestedTarget = config.target;
  if (nestedTarget && typeof nestedTarget === 'object' && !Array.isArray(nestedTarget)) {
    const nested = asText(nestedTarget.collection_id || nestedTarget.collectionId);
    if (nested) {
      return nested;
    }
  }
  return '';
};

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const normalizeAssetRelativePath = (value) => {
  const raw = asText(value).replace(/\\/g, '/');
  if (!raw) {
    return '';
  }

  const parts = raw.split('/').map((part) => part.trim()).filter(Boolean);
  const clean = [];
  for (const part of parts) {
    if (part === '.' || part === '..') {
      continue;
    }
    clean.push(part);
  }
  return clean.join('/');
};

const buildAssetRelativePath = (...segments) => normalizeAssetRelativePath(segments.filter(Boolean).join('/'));
const normalizeAssetPathSegment = (value, fallback = 'Unsorted') =>
  asText(value).replace(/[\\/]+/g, ' ').trim().replace(/\s+/g, '_') || fallback;

const collectLexicalNodeKeys = (candidate, output) => {
  if (!candidate || typeof candidate !== 'object') {
    return;
  }

  if (Array.isArray(candidate)) {
    for (const item of candidate) {
      collectLexicalNodeKeys(item, output);
    }
    return;
  }

  const key = candidate.key;
  if (typeof key === 'string' && key.trim()) {
    output.add(key.trim());
  }

  for (const value of Object.values(candidate)) {
    if (value && typeof value === 'object') {
      collectLexicalNodeKeys(value, output);
    }
  }
};

const extractDocNodeKeyState = (snapshotPayload) => {
  const result = {
    hasSignal: false,
    nodeKeys: new Set(),
  };

  if (!snapshotPayload || typeof snapshotPayload !== 'object' || Array.isArray(snapshotPayload)) {
    return result;
  }

  const payload = snapshotPayload;

  if (Array.isArray(payload.node_keys)) {
    result.hasSignal = true;
    for (const key of payload.node_keys) {
      const normalized = asText(key);
      if (normalized) {
        result.nodeKeys.add(normalized);
      }
    }
  }

  const lexicalCandidates = [];
  if (isPlainObject(payload.lexical_state)) {
    lexicalCandidates.push(payload.lexical_state);
  }
  if (isPlainObject(payload.lexicalState)) {
    lexicalCandidates.push(payload.lexicalState);
  }
  if (isPlainObject(payload.lexical_snapshot)) {
    lexicalCandidates.push(payload.lexical_snapshot);
    if (isPlainObject(payload.lexical_snapshot.lexicalState)) {
      lexicalCandidates.push(payload.lexical_snapshot.lexicalState);
    }
    if (isPlainObject(payload.lexical_snapshot.lexical_state)) {
      lexicalCandidates.push(payload.lexical_snapshot.lexical_state);
    }
  }

  for (const lexicalState of lexicalCandidates) {
    result.hasSignal = true;
    collectLexicalNodeKeys(lexicalState, result.nodeKeys);
  }

  return result;
};

const toJson = (value) => JSON.stringify(value ?? null);

const okEnvelope = (data) => ({ ok: true, data, error: null });
const errorEnvelope = (code, message) => ({
  ok: false,
  data: null,
  error: {
    code,
    message,
  },
});

const jsonResponse = (statusCode, payload) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Hub-Dev-Auth',
  },
  body: JSON.stringify(payload),
});

const send = (response, output) => {
  response.writeHead(output.statusCode, output.headers);
  response.end(output.body);
};

const readRequestBuffer = async (request) => {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
};

const parseBody = async (request) => {
  const raw = (await readRequestBuffer(request)).toString('utf8').trim();
  if (!raw) {
    return {};
  }
  return JSON.parse(raw);
};

const fromBase64Url = (value) => {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  return Buffer.from(padded, 'base64').toString('utf8');
};

const parseBearerToken = (request) => {
  const header = asText(request.headers.authorization || '');
  if (!header) {
    return '';
  }
  const [scheme, token] = header.split(/\s+/);
  if (scheme !== 'Bearer' || !token) {
    return '';
  }
  return token;
};

const normalizeRemoteAddress = (value) => asText(value).replace(/^::ffff:/i, '').toLowerCase();

const isLoopbackAddress = (value) => {
  const address = normalizeRemoteAddress(value);
  return address === '127.0.0.1' || address === '::1';
};

const parseCookieHeader = (request) => {
  const raw = asText(request.headers.cookie || '');
  const cookieMap = new Map();
  if (!raw) {
    return cookieMap;
  }

  for (const segment of raw.split(';')) {
    const [name, ...valueParts] = segment.split('=');
    const key = asText(name);
    if (!key) {
      continue;
    }
    cookieMap.set(key, asText(valueParts.join('=')));
  }
  return cookieMap;
};

const isDevAuthRequest = (request) => {
  if (!HUB_DEV_AUTH_ENABLED) {
    return false;
  }

  if (!isLoopbackAddress(request.socket?.remoteAddress || request.connection?.remoteAddress || '')) {
    return false;
  }

  const headerRaw = request.headers[HUB_DEV_AUTH_HEADER];
  const headerValue = Array.isArray(headerRaw) ? asText(headerRaw[0]) : asText(headerRaw);
  const headerEnabled = headerValue === '1';
  const cookieEnabled = parseCookieHeader(request).get(HUB_DEV_AUTH_COOKIE) === '1';
  return headerEnabled || cookieEnabled;
};

const projectRoleSet = new Set(['owner', 'member']);
const fieldTypeSet = new Set([
  'text',
  'number',
  'date',
  'checkbox',
  'select',
  'multi_select',
  'person',
  'relation',
  'file',
]);
const viewTypeSet = new Set(['table', 'kanban', 'list', 'calendar', 'timeline', 'gallery']);
const capabilitySet = new Set(['task', 'calendar_event', 'recurring', 'remindable', 'meeting', 'milestone', 'capture']);
const commentStatusSet = new Set(['open', 'resolved']);
const notificationReasonSet = new Set(['mention', 'assignment', 'reminder', 'comment_reply', 'automation']);
const automationRunStatusSet = new Set(['queued', 'running', 'success', 'failed']);
const projectPolicyCapabilitySet = new Set(['view', 'comment', 'write', 'manage_members']);
const panePolicyCapabilitySet = new Set(['view', 'comment', 'write', 'manage']);
const docPolicyCapabilitySet = new Set(['view', 'comment', 'write']);
const ownerProjectCapabilities = Object.freeze([
  'project.view',
  'project.activity.view',
  'project.notes.view',
  'project.files.view',
  'project.automations.view',
]);
const collaboratorProjectCapabilities = Object.freeze([
  'project.view',
  'project.activity.view',
  'project.notes.view',
  'project.files.view',
]);
const viewerProjectCapabilities = Object.freeze(['project.view', 'project.activity.view', 'project.notes.view', 'project.files.view']);
const globalCapabilitiesBySessionRole = Object.freeze({
  Owner: Object.freeze(['hub.view', 'hub.tasks.write', 'hub.notifications.write', 'hub.live', 'projects.view', 'services.external.view']),
  Collaborator: Object.freeze(['hub.view', 'hub.tasks.write', 'hub.notifications.write', 'hub.live', 'projects.view']),
  Viewer: Object.freeze([]),
});
const sessionRolePriority = Object.freeze({
  Viewer: 0,
  Collaborator: 1,
  Owner: 2,
});

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

  if (HUB_DEV_AUTH_ENABLED) {
    return {
      verifyToken: async () => {
        throw new Error('JWT verification unavailable while running local dev auth mode.');
      },
      jwksUrl: '',
      issuer: '',
      expectedAudiences: [],
    };
  }

  throw new Error('KEYCLOAK_ISSUER must be configured unless HUB_DEV_AUTH_ENABLED=true.');
})();

const db = new DatabaseSync(HUB_DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

const CONTRACT_TABLES = [
  'schema_version',
  'users',
  'projects',
  'project_members',
  'panes',
  'pane_members',
  'docs',
  'doc_storage',
  'doc_presence',
  'collections',
  'collection_fields',
  'records',
  'record_values',
  'record_relations',
  'views',
  'record_capabilities',
  'task_state',
  'assignments',
  'event_state',
  'event_participants',
  'recurrence_rules',
  'reminders',
  'files',
  'file_blobs',
  'entity_attachments',
  'asset_roots',
  'comments',
  'comment_anchors',
  'mentions',
  'timeline_events',
  'notifications',
  'automation_rules',
  'automation_runs',
];

const quoteIdentifier = (identifier) => {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) {
    throw new Error(`Unsafe identifier: ${identifier}`);
  }
  return `"${identifier}"`;
};

const resetSchemaToContractV1 = () => {
  db.exec('BEGIN IMMEDIATE;');
  try {
    db.exec('PRAGMA foreign_keys = OFF;');

    const objects = db.prepare(`
      SELECT type, name
      FROM sqlite_master
      WHERE name NOT LIKE 'sqlite_%'
        AND type IN ('trigger', 'view', 'table')
      ORDER BY CASE type WHEN 'trigger' THEN 1 WHEN 'view' THEN 2 ELSE 3 END
    `).all();

    for (const object of objects) {
      const escaped = quoteIdentifier(object.name);
      if (object.type === 'trigger') {
        db.exec(`DROP TRIGGER IF EXISTS ${escaped};`);
      } else if (object.type === 'view') {
        db.exec(`DROP VIEW IF EXISTS ${escaped};`);
      } else {
        db.exec(`DROP TABLE IF EXISTS ${escaped};`);
      }
    }

    db.exec(`
      CREATE TABLE schema_version (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        version INTEGER NOT NULL CHECK (version = 1),
        updated_at TEXT NOT NULL
      );

      CREATE TABLE users (
        user_id TEXT PRIMARY KEY,
        kc_sub TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        email TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE projects (
        project_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_by TEXT NOT NULL,
        project_type TEXT NOT NULL DEFAULT 'team' CHECK (project_type IN ('team', 'personal')),
        tasks_collection_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(created_by) REFERENCES users(user_id)
      );

      CREATE TABLE project_members (
        project_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        role TEXT CHECK (role IN ('owner', 'member')),
        joined_at TEXT NOT NULL,
        PRIMARY KEY(project_id, user_id),
        FOREIGN KEY(project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
        FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE
      );

      CREATE TABLE panes (
        pane_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        sort_order INTEGER NOT NULL,
        pinned INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0, 1)),
        layout_config TEXT NOT NULL,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
        FOREIGN KEY(created_by) REFERENCES users(user_id)
      );

      CREATE TABLE pane_members (
        pane_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        joined_at TEXT NOT NULL,
        PRIMARY KEY(pane_id, user_id),
        FOREIGN KEY(pane_id) REFERENCES panes(pane_id) ON DELETE CASCADE,
        FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE
      );

      CREATE TABLE docs (
        doc_id TEXT PRIMARY KEY,
        pane_id TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(pane_id) REFERENCES panes(pane_id) ON DELETE CASCADE
      );

      CREATE TABLE doc_storage (
        doc_id TEXT PRIMARY KEY,
        snapshot_version INTEGER NOT NULL DEFAULT 0,
        snapshot_payload TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(doc_id) REFERENCES docs(doc_id) ON DELETE CASCADE
      );

      CREATE TABLE doc_presence (
        doc_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        cursor_payload TEXT,
        last_seen_at TEXT NOT NULL,
        PRIMARY KEY(doc_id, user_id),
        FOREIGN KEY(doc_id) REFERENCES docs(doc_id) ON DELETE CASCADE,
        FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE
      );

      CREATE TABLE collections (
        collection_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        icon TEXT,
        color TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(project_id) REFERENCES projects(project_id) ON DELETE CASCADE
      );

      CREATE TABLE collection_fields (
        field_id TEXT PRIMARY KEY,
        collection_id TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        config TEXT NOT NULL,
        sort_order INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(collection_id) REFERENCES collections(collection_id) ON DELETE CASCADE
      );

      CREATE TABLE records (
        record_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        collection_id TEXT NOT NULL,
        title TEXT NOT NULL,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        archived_at TEXT,
        FOREIGN KEY(project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
        FOREIGN KEY(collection_id) REFERENCES collections(collection_id) ON DELETE CASCADE,
        FOREIGN KEY(created_by) REFERENCES users(user_id)
      );

      CREATE TABLE record_values (
        record_id TEXT NOT NULL,
        field_id TEXT NOT NULL,
        value_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY(record_id, field_id),
        FOREIGN KEY(record_id) REFERENCES records(record_id) ON DELETE CASCADE,
        FOREIGN KEY(field_id) REFERENCES collection_fields(field_id) ON DELETE CASCADE
      );

      CREATE TABLE record_relations (
        relation_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        from_record_id TEXT NOT NULL,
        to_record_id TEXT NOT NULL,
        via_field_id TEXT NOT NULL,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
        FOREIGN KEY(from_record_id) REFERENCES records(record_id) ON DELETE CASCADE,
        FOREIGN KEY(to_record_id) REFERENCES records(record_id) ON DELETE CASCADE,
        FOREIGN KEY(via_field_id) REFERENCES collection_fields(field_id) ON DELETE CASCADE,
        FOREIGN KEY(created_by) REFERENCES users(user_id)
      );

      CREATE TABLE views (
        view_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        collection_id TEXT NOT NULL,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        config TEXT NOT NULL,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
        FOREIGN KEY(collection_id) REFERENCES collections(collection_id) ON DELETE CASCADE,
        FOREIGN KEY(created_by) REFERENCES users(user_id)
      );

      CREATE TABLE record_capabilities (
        record_id TEXT NOT NULL,
        capability_type TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY(record_id, capability_type),
        FOREIGN KEY(record_id) REFERENCES records(record_id) ON DELETE CASCADE
      );

      CREATE TABLE task_state (
        record_id TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        priority TEXT,
        completed_at TEXT,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(record_id) REFERENCES records(record_id) ON DELETE CASCADE
      );

      CREATE TABLE assignments (
        record_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        assigned_at TEXT NOT NULL,
        PRIMARY KEY(record_id, user_id),
        FOREIGN KEY(record_id) REFERENCES records(record_id) ON DELETE CASCADE,
        FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE
      );

      CREATE TABLE event_state (
        record_id TEXT PRIMARY KEY,
        start_dt TEXT NOT NULL,
        end_dt TEXT NOT NULL,
        timezone TEXT NOT NULL,
        location TEXT,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(record_id) REFERENCES records(record_id) ON DELETE CASCADE
      );

      CREATE TABLE event_participants (
        record_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        role TEXT,
        added_at TEXT NOT NULL,
        PRIMARY KEY(record_id, user_id),
        FOREIGN KEY(record_id) REFERENCES records(record_id) ON DELETE CASCADE,
        FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE
      );

      CREATE TABLE recurrence_rules (
        record_id TEXT PRIMARY KEY,
        rule_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(record_id) REFERENCES records(record_id) ON DELETE CASCADE
      );

      CREATE TABLE reminders (
        reminder_id TEXT PRIMARY KEY,
        record_id TEXT NOT NULL,
        remind_at TEXT NOT NULL,
        channels TEXT NOT NULL,
        created_at TEXT NOT NULL,
        fired_at TEXT,
        FOREIGN KEY(record_id) REFERENCES records(record_id) ON DELETE CASCADE
      );

      CREATE TABLE files (
        file_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        asset_root_id TEXT NOT NULL,
        provider TEXT NOT NULL,
        provider_path TEXT NOT NULL,
        name TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        hash TEXT,
        metadata_json TEXT NOT NULL,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
        FOREIGN KEY(asset_root_id) REFERENCES asset_roots(asset_root_id) ON DELETE CASCADE,
        FOREIGN KEY(created_by) REFERENCES users(user_id)
      );

      CREATE TABLE file_blobs (
        file_id TEXT PRIMARY KEY,
        storage_pointer TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(file_id) REFERENCES files(file_id) ON DELETE CASCADE
      );

      CREATE TABLE entity_attachments (
        attachment_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        provider TEXT NOT NULL,
        asset_root_id TEXT NOT NULL,
        asset_path TEXT NOT NULL,
        name TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        metadata_json TEXT NOT NULL,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
        FOREIGN KEY(asset_root_id) REFERENCES asset_roots(asset_root_id) ON DELETE CASCADE,
        FOREIGN KEY(created_by) REFERENCES users(user_id)
      );

      CREATE TABLE asset_roots (
        asset_root_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        provider TEXT NOT NULL,
        root_path TEXT NOT NULL,
        connection_ref TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(project_id) REFERENCES projects(project_id) ON DELETE CASCADE
      );

      CREATE TABLE comments (
        comment_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        author_user_id TEXT NOT NULL,
        target_entity_type TEXT NOT NULL,
        target_entity_id TEXT NOT NULL,
        body_json TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('open', 'resolved')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
        FOREIGN KEY(author_user_id) REFERENCES users(user_id)
      );

      CREATE TABLE comment_anchors (
        comment_id TEXT PRIMARY KEY,
        doc_id TEXT NOT NULL,
        anchor_payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(comment_id) REFERENCES comments(comment_id) ON DELETE CASCADE,
        FOREIGN KEY(doc_id) REFERENCES docs(doc_id) ON DELETE CASCADE
      );

      CREATE TABLE mentions (
        mention_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        source_entity_type TEXT NOT NULL,
        source_entity_id TEXT NOT NULL,
        target_entity_type TEXT NOT NULL,
        target_entity_id TEXT NOT NULL,
        context TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY(project_id) REFERENCES projects(project_id) ON DELETE CASCADE
      );

      CREATE TABLE timeline_events (
        timeline_event_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        actor_user_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        primary_entity_type TEXT NOT NULL,
        primary_entity_id TEXT NOT NULL,
        secondary_entities_json TEXT NOT NULL,
        summary_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
        FOREIGN KEY(actor_user_id) REFERENCES users(user_id)
      );

      CREATE TABLE notifications (
        notification_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        reason TEXT NOT NULL CHECK (reason IN ('mention', 'assignment', 'reminder', 'comment_reply', 'automation')),
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        -- notification_scope: 'network' = server-generated, requires relay (assignments, mentions, etc.)
        -- notification_scope: 'local' = client-generated, device-only (reminders, personal alerts)
        -- Local notifications are never written by the server. This column exists to keep the model coherent when reminders are built.
        notification_scope TEXT NOT NULL DEFAULT 'network' CHECK (notification_scope IN ('network', 'local')),
        read_at TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY(project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
        FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE
      );

      CREATE TABLE automation_rules (
        automation_rule_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)),
        trigger_json TEXT NOT NULL,
        actions_json TEXT NOT NULL,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
        FOREIGN KEY(created_by) REFERENCES users(user_id)
      );

      CREATE TABLE automation_runs (
        automation_run_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        automation_rule_id TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'success', 'failed')),
        input_event_json TEXT NOT NULL,
        output_json TEXT NOT NULL,
        started_at TEXT,
        finished_at TEXT,
        FOREIGN KEY(project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
        FOREIGN KEY(automation_rule_id) REFERENCES automation_rules(automation_rule_id) ON DELETE CASCADE
      );

      CREATE TRIGGER pane_members_must_be_project_members
      BEFORE INSERT ON pane_members
      FOR EACH ROW
      BEGIN
        SELECT
          CASE
            WHEN NOT EXISTS (
              SELECT 1
              FROM panes p
              JOIN project_members pm ON pm.project_id = p.project_id
              WHERE p.pane_id = NEW.pane_id
                AND pm.user_id = NEW.user_id
            )
            THEN RAISE(ABORT, 'pane_members must be a subset of project_members')
          END;
      END;

      CREATE TRIGGER records_collection_project_consistency_insert
      BEFORE INSERT ON records
      FOR EACH ROW
      BEGIN
        SELECT
          CASE
            WHEN NOT EXISTS (
              SELECT 1
              FROM collections c
              WHERE c.collection_id = NEW.collection_id
                AND c.project_id = NEW.project_id
            )
            THEN RAISE(ABORT, 'records.project_id must match collections.project_id')
          END;
      END;

      CREATE TRIGGER records_collection_project_consistency_update
      BEFORE UPDATE OF project_id, collection_id ON records
      FOR EACH ROW
      BEGIN
        SELECT
          CASE
            WHEN NOT EXISTS (
              SELECT 1
              FROM collections c
              WHERE c.collection_id = NEW.collection_id
                AND c.project_id = NEW.project_id
            )
            THEN RAISE(ABORT, 'records.project_id must match collections.project_id')
          END;
      END;

      CREATE TRIGGER record_relations_project_consistency_insert
      BEFORE INSERT ON record_relations
      FOR EACH ROW
      BEGIN
        SELECT
          CASE
            WHEN NOT EXISTS (
              SELECT 1
              FROM records rf
              JOIN records rt ON rt.record_id = NEW.to_record_id
              WHERE rf.record_id = NEW.from_record_id
                AND rf.project_id = NEW.project_id
                AND rt.project_id = NEW.project_id
            )
            THEN RAISE(ABORT, 'record_relations records must match relation project_id')
          END;
      END;

      CREATE TRIGGER record_relations_project_consistency_update
      BEFORE UPDATE OF project_id, from_record_id, to_record_id ON record_relations
      FOR EACH ROW
      BEGIN
        SELECT
          CASE
            WHEN NOT EXISTS (
              SELECT 1
              FROM records rf
              JOIN records rt ON rt.record_id = NEW.to_record_id
              WHERE rf.record_id = NEW.from_record_id
                AND rf.project_id = NEW.project_id
                AND rt.project_id = NEW.project_id
            )
            THEN RAISE(ABORT, 'record_relations records must match relation project_id')
          END;
      END;

      CREATE TRIGGER comment_anchor_requires_doc_target
      BEFORE INSERT ON comment_anchors
      FOR EACH ROW
      BEGIN
        SELECT
          CASE
            WHEN NOT EXISTS (
              SELECT 1
              FROM comments c
              WHERE c.comment_id = NEW.comment_id
                AND c.target_entity_type = 'doc'
                AND c.target_entity_id = NEW.doc_id
            )
            THEN RAISE(ABORT, 'comment_anchors require doc target')
          END;
      END;

      CREATE TRIGGER comment_anchor_requires_node_key_insert
      BEFORE INSERT ON comment_anchors
      FOR EACH ROW
      BEGIN
        SELECT
          CASE
            WHEN COALESCE(json_extract(NEW.anchor_payload, '$.kind'), '') != 'node'
              OR COALESCE(json_extract(NEW.anchor_payload, '$.nodeKey'), '') = ''
            THEN RAISE(ABORT, 'comment_anchors must be node-key anchors')
          END;
      END;

      CREATE TRIGGER comment_anchor_requires_node_key_update
      BEFORE UPDATE OF anchor_payload ON comment_anchors
      FOR EACH ROW
      BEGIN
        SELECT
          CASE
            WHEN COALESCE(json_extract(NEW.anchor_payload, '$.kind'), '') != 'node'
              OR COALESCE(json_extract(NEW.anchor_payload, '$.nodeKey'), '') = ''
            THEN RAISE(ABORT, 'comment_anchors must be node-key anchors')
          END;
      END;

      CREATE INDEX idx_project_members_user_project ON project_members(user_id, project_id);
      CREATE INDEX idx_pane_members_user_pane ON pane_members(user_id, pane_id);
      CREATE INDEX idx_panes_project_sort ON panes(project_id, sort_order);
      CREATE UNIQUE INDEX idx_docs_pane_unique ON docs(pane_id);
      CREATE INDEX idx_records_project_collection_updated ON records(project_id, collection_id, updated_at DESC);
      CREATE INDEX idx_record_values_field_record ON record_values(field_id, record_id);
      CREATE INDEX idx_record_values_record_field ON record_values(record_id, field_id);
      CREATE INDEX idx_record_relations_project_from ON record_relations(project_id, from_record_id);
      CREATE INDEX idx_record_relations_project_to ON record_relations(project_id, to_record_id);
      CREATE UNIQUE INDEX idx_record_relations_unique_edge ON record_relations(project_id, from_record_id, to_record_id, via_field_id);
      CREATE INDEX idx_views_project_collection_type ON views(project_id, collection_id, type);
      CREATE INDEX idx_event_state_start ON event_state(start_dt);
      CREATE INDEX idx_event_participants_user_record ON event_participants(user_id, record_id);
      CREATE INDEX idx_attachments_entity_lookup ON entity_attachments(project_id, entity_type, entity_id);
      CREATE INDEX idx_attachments_asset_lookup ON entity_attachments(asset_root_id, asset_path);
      CREATE INDEX idx_files_project_asset_path ON files(project_id, asset_root_id, provider_path);
      CREATE INDEX idx_comments_entity_lookup ON comments(project_id, target_entity_type, target_entity_id, created_at DESC);
      CREATE INDEX idx_mentions_target_lookup ON mentions(project_id, target_entity_type, target_entity_id);
      CREATE INDEX idx_timeline_project_created ON timeline_events(project_id, created_at DESC);
      CREATE INDEX idx_timeline_primary_lookup ON timeline_events(project_id, primary_entity_type, primary_entity_id, created_at DESC);
      CREATE INDEX idx_notifications_user_unread_created ON notifications(user_id, read_at, created_at DESC);
      CREATE INDEX idx_automation_runs_rule_started ON automation_runs(automation_rule_id, started_at DESC);
      CREATE UNIQUE INDEX idx_projects_personal_owner ON projects(created_by)
        WHERE project_type = 'personal';
    `);

    db.prepare('INSERT INTO schema_version (id, version, updated_at) VALUES (1, 1, ?)').run(nowIso());

    db.exec('PRAGMA foreign_keys = ON;');
    db.exec('COMMIT;');
  } catch (error) {
    try {
      db.exec('ROLLBACK;');
      db.exec('PRAGMA foreign_keys = ON;');
    } catch {
      // no-op
    }
    throw error;
  }
};

const schemaReady = () => {
  const tables = new Set(
    db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
      .all()
      .map((row) => row.name),
  );

  for (const name of CONTRACT_TABLES) {
    if (!tables.has(name)) {
      return false;
    }
  }

  const versionRow = db.prepare('SELECT version FROM schema_version WHERE id = 1').get();
  return Number(versionRow?.version) === 1;
};

if (!schemaReady()) {
  if (!HUB_API_ALLOW_SCHEMA_RESET) {
    throw new Error('Contract schema mismatch. Set HUB_API_ALLOW_SCHEMA_RESET=true to recreate schema v1.');
  }
  resetSchemaToContractV1();
}

const ensurePendingProjectInvitesTable = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS pending_project_invites (
      invite_request_id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      email TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('member')),
      requested_by_user_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
      target_user_id TEXT,
      reviewed_by_user_id TEXT,
      reviewed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(project_id) REFERENCES projects(project_id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_pending_project_invites_project_status_created
      ON pending_project_invites(project_id, status, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_pending_project_invites_email_status
      ON pending_project_invites(LOWER(email), status);
  `);
};

ensurePendingProjectInvitesTable();

const ensureNotificationScopeColumn = () => {
  const column = db
    .prepare("SELECT 1 AS ok FROM pragma_table_info('notifications') WHERE name = 'notification_scope' LIMIT 1")
    .get();
  if (column?.ok) {
    return;
  }

  db.exec('BEGIN IMMEDIATE;');
  try {
    db.exec(`
      ALTER TABLE notifications
      ADD COLUMN notification_scope TEXT NOT NULL DEFAULT 'network'
      CHECK (notification_scope IN ('network', 'local'));
    `);
    db.exec('COMMIT;');
  } catch (error) {
    db.exec('ROLLBACK;');
    throw error;
  }
};

ensureNotificationScopeColumn();

const ensurePersonalTasksTable = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS personal_tasks (
      task_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      priority TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_personal_tasks_user_updated
      ON personal_tasks(user_id, updated_at DESC, task_id DESC);
  `);
};

ensurePersonalTasksTable();

const ensureProjectTypeColumn = () => {
  const column = db
    .prepare("SELECT 1 AS ok FROM pragma_table_info('projects') WHERE name = 'project_type' LIMIT 1")
    .get();
  if (column?.ok) {
    return;
  }

  db.exec('BEGIN IMMEDIATE;');
  try {
    db.exec(`
      ALTER TABLE projects
      ADD COLUMN project_type TEXT NOT NULL DEFAULT 'team'
      CHECK (project_type IN ('team', 'personal'));
    `);
    db.exec('COMMIT;');
  } catch (error) {
    try {
      db.exec('ROLLBACK;');
    } catch {
      // no-op
    }
    if (!/duplicate column name/i.test(String(error?.message || error))) {
      throw error;
    }
  }
};

ensureProjectTypeColumn();

const ensureProjectTasksCollectionIdColumn = () => {
  const column = db
    .prepare("SELECT 1 AS ok FROM pragma_table_info('projects') WHERE name = 'tasks_collection_id' LIMIT 1")
    .get();
  if (column?.ok) {
    return;
  }

  db.exec('BEGIN IMMEDIATE;');
  try {
    db.exec(`
      ALTER TABLE projects
      ADD COLUMN tasks_collection_id TEXT;
    `);
    db.exec('COMMIT;');
  } catch (error) {
    try {
      db.exec('ROLLBACK;');
    } catch {
      // no-op
    }
    if (!/duplicate column name/i.test(String(error?.message || error))) {
      throw error;
    }
  }
};

ensureProjectTasksCollectionIdColumn();

const ensurePersonalProjectOwnerIndex = () => {
  db.exec('BEGIN IMMEDIATE;');
  try {
    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_personal_owner
      ON projects(created_by)
      WHERE project_type = 'personal';
    `);
    db.exec('COMMIT;');
  } catch (error) {
    try {
      db.exec('ROLLBACK;');
    } catch {
      // no-op
    }
    throw error;
  }
};

ensurePersonalProjectOwnerIndex();

const ensureRelationUniqueEdgeIndex = () => {
  const indexExists = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_record_relations_unique_edge'")
    .get();
  if (indexExists) {
    return;
  }

  db.exec('BEGIN IMMEDIATE;');
  try {
    // Keep the earliest inserted edge and remove duplicate rows before applying unique index.
    db.exec(`
      DELETE FROM record_relations
      WHERE rowid NOT IN (
        SELECT MIN(rowid)
        FROM record_relations
        GROUP BY project_id, from_record_id, to_record_id, via_field_id
      );
    `);
    db.exec(`
      CREATE UNIQUE INDEX idx_record_relations_unique_edge
      ON record_relations(project_id, from_record_id, to_record_id, via_field_id);
    `);
    db.exec('COMMIT;');
  } catch (error) {
    try {
      db.exec('ROLLBACK;');
    } catch {
      // no-op
    }
    throw error;
  }
};

ensureRelationUniqueEdgeIndex();

const newId = (prefix) => `${prefix}_${randomUUID()}`;

const userByKcSubStmt = db.prepare('SELECT * FROM users WHERE kc_sub = ?');
const userByIdStmt = db.prepare('SELECT * FROM users WHERE user_id = ?');
const userByEmailStmt = db.prepare('SELECT * FROM users WHERE LOWER(COALESCE(email, \'\')) = LOWER(?) LIMIT 1');
const insertUserStmt = db.prepare(`
  INSERT INTO users (user_id, kc_sub, display_name, email, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?)
`);
const updateUserStmt = db.prepare(`
  UPDATE users
  SET display_name = ?, email = ?, updated_at = ?
  WHERE user_id = ?
`);
const updateProjectTasksCollectionStmt = db.prepare(`
  UPDATE projects
  SET tasks_collection_id = ?, updated_at = ?
  WHERE project_id = ?
`);

const projectMembershipsByUserStmt = db.prepare(`
  SELECT project_id, role, joined_at
  FROM project_members
  WHERE user_id = ?
  ORDER BY joined_at ASC
`);

const projectByIdStmt = db.prepare('SELECT * FROM projects WHERE project_id = ?');
const projectForMemberStmt = db.prepare(`
  SELECT p.*, pm.role AS membership_role, pm.joined_at
  FROM projects p
  JOIN project_members pm ON pm.project_id = p.project_id
  WHERE p.project_id = ? AND pm.user_id = ?
`);
const personalProjectByUserStmt = db.prepare(`
  SELECT p.*, pm.role AS membership_role, pm.joined_at
  FROM projects p
  JOIN project_members pm ON pm.project_id = p.project_id
  WHERE pm.user_id = ?
    AND p.created_by = ?
    AND p.project_type = 'personal'
  ORDER BY p.created_at ASC
  LIMIT 1
`);
const personalProjectsMissingTasksCollectionIdStmt = db.prepare(`
  SELECT p.project_id
  FROM projects p
  WHERE p.project_type = 'personal'
    AND COALESCE(p.tasks_collection_id, '') = ''
  ORDER BY p.created_at ASC, p.project_id ASC
`);
const listProjectsForUserStmt = db.prepare(`
  SELECT p.*, pm.role AS membership_role, pm.joined_at
  FROM projects p
  JOIN project_members pm ON pm.project_id = p.project_id
  WHERE pm.user_id = ?
  ORDER BY p.updated_at DESC
`);
const projectMembersByProjectStmt = db.prepare(`
  SELECT pm.project_id, pm.user_id, pm.role, pm.joined_at, u.display_name, u.email
  FROM project_members pm
  JOIN users u ON u.user_id = pm.user_id
  WHERE pm.project_id = ?
  ORDER BY pm.joined_at ASC
`);
const projectOwnerCountStmt = db.prepare(`
  SELECT COUNT(*) AS owner_count
  FROM project_members
  WHERE project_id = ? AND role = 'owner'
`);
const insertProjectStmt = db.prepare(`
  INSERT INTO projects (project_id, name, created_by, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?)
`);
const insertProjectWithTypeStmt = db.prepare(`
  INSERT INTO projects (project_id, name, created_by, project_type, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?)
`);
const insertProjectMemberStmt = db.prepare(`
  INSERT OR REPLACE INTO project_members (project_id, user_id, role, joined_at)
  VALUES (?, ?, ?, ?)
`);
const deleteProjectMemberStmt = db.prepare('DELETE FROM project_members WHERE project_id = ? AND user_id = ?');
const pendingInvitesByProjectStmt = db.prepare(`
  SELECT *
  FROM pending_project_invites
  WHERE project_id = ? AND status = 'pending'
  ORDER BY created_at DESC, invite_request_id DESC
`);
const pendingInviteByIdStmt = db.prepare('SELECT * FROM pending_project_invites WHERE invite_request_id = ? LIMIT 1');
const activePendingInviteByProjectAndEmailStmt = db.prepare(`
  SELECT *
  FROM pending_project_invites
  WHERE project_id = ?
    AND LOWER(email) = LOWER(?)
    AND status = 'pending'
  LIMIT 1
`);
const insertPendingInviteStmt = db.prepare(`
  INSERT INTO pending_project_invites (
    invite_request_id,
    project_id,
    email,
    role,
    requested_by_user_id,
    status,
    target_user_id,
    reviewed_by_user_id,
    reviewed_at,
    created_at,
    updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?)
`);
const updatePendingInviteDecisionStmt = db.prepare(`
  UPDATE pending_project_invites
  SET status = ?, target_user_id = ?, reviewed_by_user_id = ?, reviewed_at = ?, updated_at = ?
  WHERE invite_request_id = ?
`);

const paneByIdStmt = db.prepare('SELECT * FROM panes WHERE pane_id = ?');
const paneDocByPaneStmt = db.prepare('SELECT * FROM docs WHERE pane_id = ?');
const paneMembersStmt = db.prepare(`
  SELECT pm.user_id, u.display_name
  FROM pane_members pm
  JOIN users u ON u.user_id = pm.user_id
  LEFT JOIN project_members prj ON prj.project_id = (SELECT project_id FROM panes WHERE pane_id = pm.pane_id) AND prj.user_id = pm.user_id
  WHERE pm.pane_id = ?
    AND COALESCE(prj.role, 'member') != 'owner'
  ORDER BY pm.joined_at ASC
`);
const paneEditorExistsStmt = db.prepare('SELECT 1 AS ok FROM pane_members WHERE pane_id = ? AND user_id = ? LIMIT 1');
const projectMembershipExistsStmt = db.prepare('SELECT 1 AS ok FROM project_members WHERE project_id = ? AND user_id = ? LIMIT 1');
const projectMembershipRoleStmt = db.prepare('SELECT role FROM project_members WHERE project_id = ? AND user_id = ? LIMIT 1');
const paneListForUserByProjectStmt = db.prepare(`
  SELECT p.*
  FROM panes p
  WHERE p.project_id = ?
  ORDER BY p.sort_order ASC, p.created_at ASC
`);
const paneNextSortStmt = db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS max_sort FROM panes WHERE project_id = ?');
const insertPaneStmt = db.prepare(`
  INSERT INTO panes (pane_id, project_id, name, sort_order, pinned, layout_config, created_by, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const updatePaneStmt = db.prepare(`
  UPDATE panes
  SET name = ?, sort_order = ?, pinned = ?, layout_config = ?, updated_at = ?
  WHERE pane_id = ?
`);
const deletePaneStmt = db.prepare('DELETE FROM panes WHERE pane_id = ?');
const insertPaneMemberStmt = db.prepare('INSERT OR REPLACE INTO pane_members (pane_id, user_id, joined_at) VALUES (?, ?, ?)');
const deletePaneMemberStmt = db.prepare('DELETE FROM pane_members WHERE pane_id = ? AND user_id = ?');

const insertDocStmt = db.prepare('INSERT INTO docs (doc_id, pane_id, created_at, updated_at) VALUES (?, ?, ?, ?)');
const insertDocStorageStmt = db.prepare('INSERT INTO doc_storage (doc_id, snapshot_version, snapshot_payload, updated_at) VALUES (?, ?, ?, ?)');
const docByIdStmt = db.prepare(`
  SELECT d.doc_id, d.pane_id, d.created_at, d.updated_at, ds.snapshot_version, ds.snapshot_payload, ds.updated_at AS storage_updated_at
  FROM docs d
  LEFT JOIN doc_storage ds ON ds.doc_id = d.doc_id
  WHERE d.doc_id = ?
`);
const paneForDocStmt = db.prepare(`
  SELECT d.doc_id, d.pane_id, p.project_id
  FROM docs d
  JOIN panes p ON p.pane_id = d.pane_id
  WHERE d.doc_id = ?
`);
const updateDocStorageStmt = db.prepare(`
  UPDATE doc_storage
  SET snapshot_version = ?, snapshot_payload = ?, updated_at = ?
  WHERE doc_id = ? AND snapshot_version = ?
`);
const updateDocTimestampStmt = db.prepare('UPDATE docs SET updated_at = ? WHERE doc_id = ?');
const upsertDocPresenceStmt = db.prepare(`
  INSERT INTO doc_presence (doc_id, user_id, cursor_payload, last_seen_at)
  VALUES (?, ?, ?, ?)
  ON CONFLICT(doc_id, user_id)
  DO UPDATE SET cursor_payload = excluded.cursor_payload, last_seen_at = excluded.last_seen_at
`);

const collectionsByProjectStmt = db.prepare('SELECT * FROM collections WHERE project_id = ? ORDER BY created_at ASC');
const collectionByIdStmt = db.prepare('SELECT * FROM collections WHERE collection_id = ?');
const collectionByNameStmt = db.prepare('SELECT * FROM collections WHERE project_id = ? AND name = ? LIMIT 1');
const insertCollectionStmt = db.prepare(`
  INSERT INTO collections (collection_id, project_id, name, icon, color, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
const fieldsByCollectionStmt = db.prepare('SELECT * FROM collection_fields WHERE collection_id = ? ORDER BY sort_order ASC, created_at ASC');
const fieldByIdStmt = db.prepare('SELECT * FROM collection_fields WHERE field_id = ?');
const nextFieldSortStmt = db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS max_sort FROM collection_fields WHERE collection_id = ?');
const insertFieldStmt = db.prepare(`
  INSERT INTO collection_fields (field_id, collection_id, name, type, config, sort_order, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const recordByIdStmt = db.prepare('SELECT * FROM records WHERE record_id = ?');
const recordsByCollectionStmt = db.prepare(`
  SELECT *
  FROM records
  WHERE project_id = ? AND collection_id = ? AND archived_at IS NULL
  ORDER BY updated_at DESC, record_id DESC
`);
const insertRecordStmt = db.prepare(`
  INSERT INTO records (record_id, project_id, collection_id, title, created_by, created_at, updated_at, archived_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
`);
const updateRecordStmt = db.prepare(`
  UPDATE records
  SET title = ?, updated_at = ?, archived_at = ?
  WHERE record_id = ?
`);
const upsertRecordValueStmt = db.prepare(`
  INSERT INTO record_values (record_id, field_id, value_json, updated_at)
  VALUES (?, ?, ?, ?)
  ON CONFLICT(record_id, field_id)
  DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at
`);
const valuesByRecordStmt = db.prepare('SELECT * FROM record_values WHERE record_id = ?');

const insertRelationStmt = db.prepare(`
  INSERT INTO record_relations (relation_id, project_id, from_record_id, to_record_id, via_field_id, created_by, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
const relationByIdStmt = db.prepare('SELECT * FROM record_relations WHERE relation_id = ?');
const relationByEdgeStmt = db.prepare(`
  SELECT relation_id
  FROM record_relations
  WHERE project_id = ? AND from_record_id = ? AND to_record_id = ? AND via_field_id = ?
  LIMIT 1
`);
const deleteRelationStmt = db.prepare('DELETE FROM record_relations WHERE relation_id = ?');
const outgoingRelationsStmt = db.prepare(`
  SELECT
    rr.*,
    tr.title AS to_record_title,
    tr.collection_id AS to_collection_id,
    tc.name AS to_collection_name
  FROM record_relations rr
  JOIN records tr ON tr.record_id = rr.to_record_id
  LEFT JOIN collections tc ON tc.collection_id = tr.collection_id
  WHERE rr.from_record_id = ?
  ORDER BY rr.created_at DESC
`);
const incomingRelationsStmt = db.prepare(`
  SELECT
    rr.*,
    fr.title AS from_record_title,
    fr.collection_id AS from_collection_id,
    fc.name AS from_collection_name
  FROM record_relations rr
  JOIN records fr ON fr.record_id = rr.from_record_id
  LEFT JOIN collections fc ON fc.collection_id = fr.collection_id
  WHERE rr.to_record_id = ?
  ORDER BY rr.created_at DESC
`);

const viewsByProjectStmt = db.prepare('SELECT * FROM views WHERE project_id = ? ORDER BY created_at ASC');
const viewByIdStmt = db.prepare('SELECT * FROM views WHERE view_id = ?');
const insertViewStmt = db.prepare(`
  INSERT INTO views (view_id, project_id, collection_id, type, name, config, created_by, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const mentionSearchUsersStmt = db.prepare(`
  SELECT u.user_id, u.display_name, u.email
  FROM project_members pm
  JOIN users u ON u.user_id = pm.user_id
  WHERE pm.project_id = ?
    AND (
      ? = ''
      OR LOWER(u.display_name) LIKE ?
      OR LOWER(COALESCE(u.email, '')) LIKE ?
    )
  ORDER BY u.display_name COLLATE NOCASE ASC
  LIMIT ?
`);
const mentionSearchRecordsStmt = db.prepare(`
  SELECT r.record_id, r.title, r.collection_id, c.name AS collection_name
  FROM records r
  LEFT JOIN collections c ON c.collection_id = r.collection_id
  WHERE r.project_id = ? AND r.archived_at IS NULL
    AND (
      ? = ''
      OR LOWER(r.title) LIKE ?
    )
  ORDER BY r.updated_at DESC
  LIMIT ?
`);
const relationSearchRecordsStmt = db.prepare(`
  SELECT r.record_id, r.title, r.collection_id, c.name AS collection_name, c.icon AS collection_icon
  FROM records r
  LEFT JOIN collections c ON c.collection_id = r.collection_id
  WHERE r.project_id = ? AND r.archived_at IS NULL
    AND (
      ? = ''
      OR LOWER(r.title) LIKE ?
    )
    AND (
      ? = ''
      OR r.collection_id = ?
    )
    AND (
      ? = ''
      OR r.record_id != ?
    )
  ORDER BY r.updated_at DESC
  LIMIT ?
`);

const insertRecordCapabilityStmt = db.prepare('INSERT OR IGNORE INTO record_capabilities (record_id, capability_type, created_at) VALUES (?, ?, ?)');
const capabilitiesByRecordStmt = db.prepare('SELECT capability_type FROM record_capabilities WHERE record_id = ? ORDER BY capability_type ASC');
const upsertTaskStateStmt = db.prepare(`
  INSERT INTO task_state (record_id, status, priority, completed_at, updated_at)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(record_id)
  DO UPDATE SET status = excluded.status, priority = excluded.priority, completed_at = excluded.completed_at, updated_at = excluded.updated_at
`);
const taskStateByRecordStmt = db.prepare('SELECT * FROM task_state WHERE record_id = ?');
const upsertEventStateStmt = db.prepare(`
  INSERT INTO event_state (record_id, start_dt, end_dt, timezone, location, updated_at)
  VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT(record_id)
  DO UPDATE SET start_dt = excluded.start_dt, end_dt = excluded.end_dt, timezone = excluded.timezone, location = excluded.location, updated_at = excluded.updated_at
`);
const eventStateByRecordStmt = db.prepare('SELECT * FROM event_state WHERE record_id = ?');
const clearEventParticipantsStmt = db.prepare('DELETE FROM event_participants WHERE record_id = ?');
const insertEventParticipantStmt = db.prepare(`
  INSERT OR REPLACE INTO event_participants (record_id, user_id, role, added_at)
  VALUES (?, ?, ?, ?)
`);
const participantsByRecordStmt = db.prepare('SELECT * FROM event_participants WHERE record_id = ? ORDER BY added_at ASC');
const clearAssignmentsStmt = db.prepare('DELETE FROM assignments WHERE record_id = ?');
const insertAssignmentStmt = db.prepare('INSERT OR REPLACE INTO assignments (record_id, user_id, assigned_at) VALUES (?, ?, ?)');
const assignmentsByRecordStmt = db.prepare('SELECT * FROM assignments WHERE record_id = ? ORDER BY assigned_at ASC');
const assignedTasksByUserInProjectStmt = db.prepare(`
  SELECT r.record_id, r.project_id, r.title, r.updated_at, ts.status, ts.priority
  FROM assignments a
  JOIN records r ON r.record_id = a.record_id
  LEFT JOIN task_state ts ON ts.record_id = r.record_id
  WHERE a.user_id = ?
    AND r.project_id = ?
    AND r.archived_at IS NULL
  ORDER BY r.updated_at DESC, r.record_id DESC
`);
const deleteAssignmentStmt = db.prepare('DELETE FROM assignments WHERE record_id = ? AND user_id = ?');
const upsertRecurrenceStmt = db.prepare(`
  INSERT INTO recurrence_rules (record_id, rule_json, updated_at)
  VALUES (?, ?, ?)
  ON CONFLICT(record_id)
  DO UPDATE SET rule_json = excluded.rule_json, updated_at = excluded.updated_at
`);
const recurrenceByRecordStmt = db.prepare('SELECT * FROM recurrence_rules WHERE record_id = ?');
const clearRemindersStmt = db.prepare('DELETE FROM reminders WHERE record_id = ?');
const insertReminderStmt = db.prepare(`
  INSERT INTO reminders (reminder_id, record_id, remind_at, channels, created_at, fired_at)
  VALUES (?, ?, ?, ?, ?, NULL)
`);
const remindersByRecordStmt = db.prepare('SELECT * FROM reminders WHERE record_id = ? ORDER BY remind_at ASC');

const insertFileStmt = db.prepare(`
  INSERT INTO files (file_id, project_id, asset_root_id, provider, provider_path, name, mime_type, size_bytes, hash, metadata_json, created_by, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const filesByProjectStmt = db.prepare(`
  SELECT *
  FROM files
  WHERE project_id = ?
  ORDER BY created_at DESC, file_id DESC
`);
const insertFileBlobStmt = db.prepare('INSERT INTO file_blobs (file_id, storage_pointer, created_at) VALUES (?, ?, ?)');

const insertAttachmentStmt = db.prepare(`
  INSERT INTO entity_attachments (
    attachment_id,
    project_id,
    entity_type,
    entity_id,
    provider,
    asset_root_id,
    asset_path,
    name,
    mime_type,
    size_bytes,
    metadata_json,
    created_by,
    created_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const deleteAttachmentStmt = db.prepare('DELETE FROM entity_attachments WHERE attachment_id = ?');
const attachmentsByEntityStmt = db.prepare(`
  SELECT ea.*
  FROM entity_attachments ea
  WHERE ea.project_id = ? AND ea.entity_type = ? AND ea.entity_id = ?
  ORDER BY ea.created_at DESC
`);
const attachmentByIdStmt = db.prepare('SELECT * FROM entity_attachments WHERE attachment_id = ?');
const defaultAssetRootByProjectStmt = db.prepare(`
  SELECT *
  FROM asset_roots
  WHERE project_id = ?
  ORDER BY created_at ASC
  LIMIT 1
`);

const insertAssetRootStmt = db.prepare(`
  INSERT INTO asset_roots (asset_root_id, project_id, provider, root_path, connection_ref, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
const assetRootsByProjectStmt = db.prepare('SELECT * FROM asset_roots WHERE project_id = ? ORDER BY created_at ASC');
const assetRootByIdStmt = db.prepare('SELECT * FROM asset_roots WHERE asset_root_id = ?');

const insertCommentStmt = db.prepare(`
  INSERT INTO comments (comment_id, project_id, author_user_id, target_entity_type, target_entity_id, body_json, status, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const commentByIdStmt = db.prepare('SELECT * FROM comments WHERE comment_id = ?');
const commentsByTargetStmt = db.prepare(`
  SELECT *
  FROM comments
  WHERE project_id = ? AND target_entity_type = ? AND target_entity_id = ?
  ORDER BY created_at ASC
`);
const updateCommentStatusStmt = db.prepare('UPDATE comments SET status = ?, updated_at = ? WHERE comment_id = ?');
const insertCommentAnchorStmt = db.prepare(`
  INSERT INTO comment_anchors (comment_id, doc_id, anchor_payload, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?)
`);
const commentAnchorsByDocStmt = db.prepare(`
  SELECT ca.*, c.body_json, c.status, c.author_user_id, c.created_at AS comment_created_at
  FROM comment_anchors ca
  JOIN comments c ON c.comment_id = ca.comment_id
  WHERE ca.doc_id = ?
  ORDER BY ca.created_at ASC
`);
const commentAnchorByCommentIdStmt = db.prepare('SELECT * FROM comment_anchors WHERE comment_id = ? LIMIT 1');

const insertMentionStmt = db.prepare(`
  INSERT INTO mentions (mention_id, project_id, source_entity_type, source_entity_id, target_entity_type, target_entity_id, context, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);
const mentionsBySourceStmt = db.prepare(`
  SELECT * FROM mentions
  WHERE project_id = ? AND source_entity_type = ? AND source_entity_id = ?
  ORDER BY created_at ASC
`);
const deleteMentionByIdStmt = db.prepare('DELETE FROM mentions WHERE mention_id = ?');
const updateMentionContextStmt = db.prepare('UPDATE mentions SET context = ? WHERE mention_id = ?');
const mentionsByTargetStmt = db.prepare(`
  SELECT
    m.*,
    d.pane_id AS source_doc_pane_id,
    p.name AS source_doc_pane_name,
    c.target_entity_type AS source_comment_target_entity_type,
    c.target_entity_id AS source_comment_target_entity_id,
    c.author_user_id AS source_comment_author_user_id,
    cdoc.doc_id AS source_comment_doc_id,
    cp.pane_id AS source_comment_pane_id,
    cp.name AS source_comment_pane_name,
    ca.anchor_payload AS source_comment_anchor_payload
  FROM mentions m
  LEFT JOIN docs d ON m.source_entity_type = 'doc' AND d.doc_id = m.source_entity_id
  LEFT JOIN panes p ON p.pane_id = d.pane_id
  LEFT JOIN comments c ON m.source_entity_type = 'comment' AND c.comment_id = m.source_entity_id
  LEFT JOIN docs cdoc ON c.target_entity_type = 'doc' AND cdoc.doc_id = c.target_entity_id
  LEFT JOIN panes cp ON cp.pane_id = cdoc.pane_id
  LEFT JOIN pane_members spm ON spm.pane_id = d.pane_id AND spm.user_id = ?
  LEFT JOIN pane_members cpm ON cpm.pane_id = cdoc.pane_id AND cpm.user_id = ?
  LEFT JOIN comment_anchors ca ON ca.comment_id = c.comment_id
  WHERE m.project_id = ? AND m.target_entity_type = ? AND m.target_entity_id = ?
    AND (
      (m.source_entity_type = 'doc' AND spm.user_id IS NOT NULL)
      OR (m.source_entity_type = 'comment' AND (c.target_entity_type IS NULL OR c.target_entity_type != 'doc' OR cpm.user_id IS NOT NULL))
      OR (m.source_entity_type != 'doc' AND m.source_entity_type != 'comment')
    )
  ORDER BY m.created_at DESC
`);

const insertTimelineStmt = db.prepare(`
  INSERT INTO timeline_events (
    timeline_event_id,
    project_id,
    actor_user_id,
    event_type,
    primary_entity_type,
    primary_entity_id,
    secondary_entities_json,
    summary_json,
    created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const timelineByProjectStmt = db.prepare(`
  SELECT *
  FROM timeline_events
  WHERE project_id = ?
  ORDER BY created_at DESC, timeline_event_id DESC
`);
const timelineByPrimaryEntityStmt = db.prepare(`
  SELECT *
  FROM timeline_events
  WHERE project_id = ? AND primary_entity_type = ? AND primary_entity_id = ?
  ORDER BY created_at DESC
  LIMIT 100
`);

const insertNotificationStmt = db.prepare(`
  INSERT INTO notifications (
    notification_id,
    project_id,
    user_id,
    reason,
    entity_type,
    entity_id,
    payload_json,
    notification_scope,
    read_at,
    created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)
`);
const notificationsByUserStmt = db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?');
const unreadNotificationsByUserStmt = db.prepare('SELECT * FROM notifications WHERE user_id = ? AND read_at IS NULL ORDER BY created_at DESC LIMIT ?');
const notificationByIdStmt = db.prepare('SELECT * FROM notifications WHERE notification_id = ?');
const markNotificationReadStmt = db.prepare('UPDATE notifications SET read_at = ? WHERE notification_id = ? AND user_id = ?');

const insertAutomationRuleStmt = db.prepare(`
  INSERT INTO automation_rules (
    automation_rule_id,
    project_id,
    name,
    enabled,
    trigger_json,
    actions_json,
    created_by,
    created_at,
    updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const automationRulesByProjectStmt = db.prepare('SELECT * FROM automation_rules WHERE project_id = ? ORDER BY created_at DESC');
const automationRuleByIdStmt = db.prepare('SELECT * FROM automation_rules WHERE automation_rule_id = ?');
const updateAutomationRuleStmt = db.prepare(`
  UPDATE automation_rules
  SET name = ?, enabled = ?, trigger_json = ?, actions_json = ?, updated_at = ?
  WHERE automation_rule_id = ?
`);
const deleteAutomationRuleStmt = db.prepare('DELETE FROM automation_rules WHERE automation_rule_id = ?');
const automationRunsByProjectStmt = db.prepare('SELECT * FROM automation_runs WHERE project_id = ? ORDER BY started_at DESC, automation_run_id DESC');

const normalizeProjectRole = (role) => (asText(role) === 'owner' || asText(role) === 'admin' ? 'owner' : 'member');

const membershipRoleLabel = (role) => (normalizeProjectRole(role) === 'owner' ? 'owner' : 'member');

const withProjectPolicyGate = ({ userId, projectId, requiredCapability }) => {
  if (!projectPolicyCapabilitySet.has(requiredCapability)) {
    throw new Error(`Unknown project capability: ${requiredCapability}`);
  }

  const membership = projectMembershipRoleStmt.get(projectId, userId);
  if (!membership) {
    return { error: { status: 403, code: 'forbidden', message: 'Project membership required.' } };
  }

  const role = normalizeProjectRole(membership.role);
  const capabilities = new Set(role === 'owner'
    ? ['view', 'comment', 'write', 'manage_members']
    : ['view', 'comment']);
  if (!capabilities.has(requiredCapability)) {
    return {
      error: {
        status: 403,
        code: 'forbidden',
        message: `Project capability "${requiredCapability}" required.`,
      },
    };
  }

  return {
    project_id: projectId,
    role,
    is_owner: role === 'owner',
  };
};

const withPanePolicyGate = ({ userId, paneId, requiredCapability }) => {
  if (!panePolicyCapabilitySet.has(requiredCapability)) {
    throw new Error(`Unknown pane capability: ${requiredCapability}`);
  }

  const pane = paneByIdStmt.get(paneId);
  if (!pane) {
    return { error: { status: 404, code: 'not_found', message: 'Pane not found.' } };
  }

  const projectGate = withProjectPolicyGate({ userId, projectId: pane.project_id, requiredCapability: 'view' });
  if (projectGate.error) {
    return projectGate;
  }

  const isExplicitEditor = Boolean(paneEditorExistsStmt.get(paneId, userId)?.ok);
  const canWrite = projectGate.is_owner || isExplicitEditor;
  const capabilities = new Set(canWrite ? ['view', 'comment', 'write', 'manage'] : ['view', 'comment']);
  if (!capabilities.has(requiredCapability)) {
    return {
      error: {
        status: 403,
        code: 'forbidden',
        message: `Pane capability "${requiredCapability}" required.`,
      },
    };
  }

  return {
    pane_id: paneId,
    project_id: pane.project_id,
    pane,
    is_owner: projectGate.is_owner,
    is_explicit_editor: isExplicitEditor,
    can_edit: canWrite,
  };
};

const withDocPolicyGate = ({ userId, docId, requiredCapability }) => {
  if (!docPolicyCapabilitySet.has(requiredCapability)) {
    throw new Error(`Unknown doc capability: ${requiredCapability}`);
  }

  const doc = paneForDocStmt.get(docId);
  if (!doc) {
    return { error: { status: 404, code: 'not_found', message: 'Doc not found.' } };
  }

  const paneGate = withPanePolicyGate({
    userId,
    paneId: doc.pane_id,
    requiredCapability: requiredCapability === 'write' ? 'write' : 'view',
  });
  if (paneGate.error) {
    return paneGate;
  }
  if (requiredCapability === 'comment') {
    const commentGate = withPanePolicyGate({ userId, paneId: doc.pane_id, requiredCapability: 'comment' });
    if (commentGate.error) {
      return commentGate;
    }
  }

  return {
    doc_id: doc.doc_id,
    pane_id: doc.pane_id,
    project_id: doc.project_id,
    can_edit: paneGate.can_edit,
  };
};

const ensureProjectMembership = (userId, projectId) =>
  withProjectPolicyGate({ userId, projectId, requiredCapability: 'view' }).error || null;

const requireProjectMember = (projectId, userId) => withProjectPolicyGate({
  userId,
  projectId,
  requiredCapability: 'view',
});

const requirePaneMember = (paneId, userId) => withPanePolicyGate({
  userId,
  paneId,
  requiredCapability: 'view',
});

const requireDocAccess = (docId, userId) => withDocPolicyGate({
  userId,
  docId,
  requiredCapability: 'view',
});

const timelineRecord = (row) => ({
  timeline_event_id: row.timeline_event_id,
  project_id: row.project_id,
  actor_user_id: row.actor_user_id,
  event_type: row.event_type,
  primary_entity_type: row.primary_entity_type,
  primary_entity_id: row.primary_entity_id,
  secondary_entities: parseJson(row.secondary_entities_json, []),
  summary: parseJsonObject(row.summary_json, {}),
  created_at: row.created_at,
});

const notificationRecord = (row) => ({
  notification_id: row.notification_id,
  project_id: row.project_id,
  user_id: row.user_id,
  reason: row.reason,
  entity_type: row.entity_type,
  entity_id: row.entity_id,
  payload: parseJsonObject(row.payload_json, {}),
  notification_scope: asText(row.notification_scope) === 'local' ? 'local' : 'network',
  read_at: row.read_at,
  created_at: row.created_at,
});

const buildNotificationRouteContext = ({
  projectId,
  sourcePaneId = null,
  sourceDocId = null,
  sourceNodeKey = null,
  originKind = null,
}) => {
  const normalizedDocId = asNullableText(sourceDocId);
  const doc = normalizedDocId ? paneForDocStmt.get(normalizedDocId) : null;
  const resolvedPaneId = asNullableText(sourcePaneId) || asNullableText(doc?.pane_id);
  const resolvedProjectId = asNullableText(doc?.project_id) || projectId;
  return {
    sourcePaneId: resolvedPaneId,
    sourceProjectId: resolvedProjectId,
    sourceDocId: normalizedDocId,
    sourceNodeKey: asNullableText(sourceNodeKey),
    originKind: resolvedPaneId ? 'pane' : asNullableText(originKind) || 'project',
  };
};

const hubLiveTicketStore = new Map();
const hubLiveSocketsByUserId = new Map();

const cleanupExpiredHubLiveTickets = () => {
  const nowMs = Date.now();
  for (const [ticket, entry] of hubLiveTicketStore.entries()) {
    if (entry.expires_at_ms <= nowMs) {
      hubLiveTicketStore.delete(ticket);
    }
  }
};

const issueHubLiveTicket = ({ userId }) => {
  cleanupExpiredHubLiveTickets();
  const ticket = `wst_${randomUUID().replace(/-/g, '')}`;
  const issuedAtMs = Date.now();
  const expiresAtMs = issuedAtMs + HUB_COLLAB_TICKET_TTL_MS;
  hubLiveTicketStore.set(ticket, {
    ticket,
    user_id: userId,
    issued_at_ms: issuedAtMs,
    expires_at_ms: expiresAtMs,
  });
  return {
    ws_ticket: ticket,
    issued_at: new Date(issuedAtMs).toISOString(),
    expires_at: new Date(expiresAtMs).toISOString(),
    expires_in_ms: HUB_COLLAB_TICKET_TTL_MS,
  };
};

const consumeHubLiveTicket = ({ wsTicket }) => {
  cleanupExpiredHubLiveTickets();
  const entry = hubLiveTicketStore.get(wsTicket);
  if (!entry) {
    return { error: { status: 401, code: 'unauthorized', message: 'Invalid or expired live ticket.' } };
  }

  hubLiveTicketStore.delete(wsTicket);
  if (entry.expires_at_ms <= Date.now()) {
    return { error: { status: 401, code: 'unauthorized', message: 'Invalid or expired live ticket.' } };
  }

  return {
    ticket: {
      user_id: entry.user_id,
      issued_at: new Date(entry.issued_at_ms).toISOString(),
      expires_at: new Date(entry.expires_at_ms).toISOString(),
    },
  };
};

const sendHubLiveMessage = (socket, message) => {
  if (!socket || socket.readyState !== WS_READY_STATE_OPEN) {
    return;
  }
  try {
    socket.send(JSON.stringify(message), () => {});
  } catch {
    // ignore socket send failures
  }
};

const registerHubLiveSocket = (userId, socket) => {
  const current = hubLiveSocketsByUserId.get(userId) || new Set();
  current.add(socket);
  hubLiveSocketsByUserId.set(userId, current);
};

const unregisterHubLiveSocket = (userId, socket) => {
  const current = hubLiveSocketsByUserId.get(userId);
  if (!current) {
    return;
  }
  current.delete(socket);
  if (current.size === 0) {
    hubLiveSocketsByUserId.delete(userId);
  }
};

const broadcastHubLiveToUser = (userId, message) => {
  const sockets = hubLiveSocketsByUserId.get(userId);
  if (!sockets) {
    return;
  }
  for (const socket of sockets) {
    sendHubLiveMessage(socket, message);
  }
};

const buildNotificationPayload = ({
  message = null,
  sourcePaneId = null,
  sourceProjectId = null,
  sourceDocId = null,
  sourceNodeKey = null,
  originKind = null,
  extras = {},
}) => ({
  ...extras,
  message: message ?? null,
  source_pane_id: sourcePaneId ?? null,
  source_project_id: sourceProjectId ?? null,
  source_doc_id: sourceDocId ?? null,
  source_node_key: sourceNodeKey ?? null,
  origin_kind: originKind ?? null,
});

const notificationContextForSource = ({ projectId, sourceEntityType, sourceEntityId, context = null }) => {
  const sourceNodeKeyFromContext = asNullableText(context?.nodeKey);
  if (sourceEntityType === 'doc') {
    const doc = paneForDocStmt.get(sourceEntityId);
    return {
      sourcePaneId: asNullableText(doc?.pane_id),
      sourceProjectId: asNullableText(doc?.project_id) || projectId,
      sourceDocId: sourceEntityId,
      sourceNodeKey: sourceNodeKeyFromContext,
      originKind: doc?.pane_id ? 'pane' : 'project',
    };
  }

  if (sourceEntityType === 'comment') {
    const comment = commentByIdStmt.get(sourceEntityId);
    if (comment?.target_entity_type === 'doc') {
      const doc = paneForDocStmt.get(comment.target_entity_id);
      const anchor = commentAnchorByCommentIdStmt.get(sourceEntityId);
      const anchorPayload = parseJsonObject(anchor?.anchor_payload, {});
      return {
        sourcePaneId: asNullableText(doc?.pane_id),
        sourceProjectId: asNullableText(doc?.project_id) || projectId,
        sourceDocId: comment.target_entity_id,
        sourceNodeKey: sourceNodeKeyFromContext || asNullableText(anchorPayload.nodeKey),
        originKind: doc?.pane_id ? 'pane' : 'project',
      };
    }
  }

  return {
    sourcePaneId: null,
    sourceProjectId: projectId,
    sourceDocId: null,
    sourceNodeKey: sourceNodeKeyFromContext,
    originKind: 'project',
  };
};

const emitTimelineEvent = ({ projectId, actorUserId, eventType, primaryEntityType, primaryEntityId, secondaryEntities = [], summary = {} }) => {
  const eventId = newId('tle');
  insertTimelineStmt.run(
    eventId,
    projectId,
    actorUserId,
    eventType,
    primaryEntityType,
    primaryEntityId,
    toJson(secondaryEntities),
    toJson(summary),
    nowIso(),
  );
  return eventId;
};

const createNotification = ({ projectId, userId, reason, entityType, entityId, payload = {}, notificationScope = 'network' }) => {
  if (!notificationReasonSet.has(reason)) {
    return;
  }
  const notificationId = newId('ntf');
  const createdAt = nowIso();
  const payloadJson = toJson(payload);
  if (notificationScope !== 'network' && notificationScope !== 'local') {
    throw new Error(`Unsupported notification scope: ${notificationScope}`);
  }
  const normalizedNotificationScope = notificationScope;
  insertNotificationStmt.run(
    notificationId,
    projectId,
    userId,
    reason,
    entityType,
    entityId,
    payloadJson,
    normalizedNotificationScope,
    createdAt,
  );
  broadcastHubLiveToUser(userId, {
    type: 'notification.new',
    notification: notificationRecord({
      notification_id: notificationId,
      project_id: projectId,
      user_id: userId,
      reason,
      entity_type: entityType,
      entity_id: entityId,
      payload_json: payloadJson,
      notification_scope: normalizedNotificationScope,
      read_at: null,
      created_at: createdAt,
    }),
  });
};

// Hub Live WebSocket — network notification relay
// Carries lightweight real-time signals to the client when server-side events occur.
// Payload is always small JSON — "something happened, go fetch details from the REST API."
// This is NOT a document sync channel. Latency tolerance is high.
// In the Tauri/local-first model this relay remains server-side because network notifications
// originate from other users' actions and require a central relay point.
// Local notifications (reminders, personal alerts) never travel through this channel —
// they are handled client-side only.
const hubLiveWss = new WebSocketServer({ noServer: true });

hubLiveWss.on('connection', (socket, _request, ticket) => {
  const userId = asText(ticket?.user_id);
  if (!userId) {
    socket.close();
    return;
  }

  registerHubLiveSocket(userId, socket);
  sendHubLiveMessage(socket, {
    type: 'ready',
    user_id: userId,
  });

  socket.on('close', () => {
    unregisterHubLiveSocket(userId, socket);
  });

  socket.on('error', () => {
    unregisterHubLiveSocket(userId, socket);
  });
});

// Collab WebSocket — document sync relay
// Carries Yjs CRDT document updates between collaborating clients via hub-collab service.
// Payload is continuous and potentially heavy. Latency matters — direct path, no unnecessary hops.
// In the Tauri/local-first model this becomes a relay for offline sync via encrypted TURN-style relay.
// Authentication is via short-lived tickets issued by /api/hub/collab/authorize.
// Project owners have implicit edit access and receive tickets without appearing in pane_members.
const collabTicketStore = new Map();

const cleanupExpiredCollabTickets = () => {
  const nowMs = Date.now();
  for (const [ticket, entry] of collabTicketStore.entries()) {
    if (entry.expires_at_ms <= nowMs) {
      collabTicketStore.delete(ticket);
    }
  }
};

const collabTicketCleanupInterval = setInterval(cleanupExpiredCollabTickets, 60_000);
collabTicketCleanupInterval.unref?.();

const issueCollabTicket = ({ docId, paneId, projectId, userId, displayName, accessToken, devAuthMode = false }) => {
  cleanupExpiredCollabTickets();
  const ticket = `wst_${randomUUID().replace(/-/g, '')}`;
  const issuedAtMs = Date.now();
  const expiresAtMs = issuedAtMs + HUB_COLLAB_TICKET_TTL_MS;
  collabTicketStore.set(ticket, {
    ticket,
    doc_id: docId,
    pane_id: paneId,
    project_id: projectId,
    user_id: userId,
    display_name: displayName,
    access_token: accessToken,
    dev_auth_mode: devAuthMode,
    issued_at_ms: issuedAtMs,
    expires_at_ms: expiresAtMs,
  });
  return {
    ws_ticket: ticket,
    issued_at: new Date(issuedAtMs).toISOString(),
    expires_at: new Date(expiresAtMs).toISOString(),
    expires_in_ms: HUB_COLLAB_TICKET_TTL_MS,
  };
};

const consumeCollabTicket = ({ wsTicket, docId }) => {
  cleanupExpiredCollabTickets();
  const entry = collabTicketStore.get(wsTicket);
  if (!entry) {
    return { error: { status: 401, code: 'unauthorized', message: 'Invalid or expired collaboration ticket.' } };
  }

  if (entry.expires_at_ms <= Date.now()) {
    return { error: { status: 401, code: 'unauthorized', message: 'Invalid or expired collaboration ticket.' } };
  }
  if (entry.doc_id !== docId) {
    return { error: { status: 403, code: 'forbidden', message: 'Collaboration ticket does not match requested doc.' } };
  }

  return {
    ticket: {
      doc_id: entry.doc_id,
      pane_id: entry.pane_id,
      project_id: entry.project_id,
      user_id: entry.user_id,
      display_name: entry.display_name,
      access_token: entry.access_token,
      dev_auth_mode: Boolean(entry.dev_auth_mode),
      issued_at: new Date(entry.issued_at_ms).toISOString(),
      expires_at: new Date(entry.expires_at_ms).toISOString(),
    },
  };
};

const ensureDevAuthUser = () => {
  const existing = userByKcSubStmt.get(HUB_DEV_AUTH_SUB);
  if (!existing) {
    const now = nowIso();
    const userId = newId('usr');
    db.exec('BEGIN');
    try {
      insertUserStmt.run(userId, HUB_DEV_AUTH_SUB, HUB_DEV_AUTH_NAME, HUB_DEV_AUTH_EMAIL, now, now);
      createPersonalProjectForUser({
        user_id: userId,
        kc_sub: HUB_DEV_AUTH_SUB,
        display_name: HUB_DEV_AUTH_NAME,
        email: HUB_DEV_AUTH_EMAIL,
        created_at: now,
        updated_at: now,
      });
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    return userByIdStmt.get(userId);
  }

  updateUserStmt.run(HUB_DEV_AUTH_NAME, HUB_DEV_AUTH_EMAIL, nowIso(), existing.user_id);
  return userByIdStmt.get(existing.user_id);
};

const ensureUserFromRequest = async (request) => {
  if (isDevAuthRequest(request)) {
    const user = ensureDevAuthUser();
    return {
      status: 200,
      token: HUB_DEV_AUTH_ACCESS_TOKEN,
      claims: {
        sub: HUB_DEV_AUTH_SUB,
        name: HUB_DEV_AUTH_NAME,
        email: HUB_DEV_AUTH_EMAIL,
      },
      user,
      devAuthMode: true,
    };
  }

  const token = parseBearerToken(request);
  if (!token) {
    return { status: 401, code: 'unauthorized', message: 'Missing bearer token.' };
  }

  let verification;
  try {
    verification = await jwtVerifier.verifyToken(token);
  } catch (error) {
    return {
      status: 401,
      code: 'unauthorized',
      message: error instanceof Error ? error.message : 'JWT verification failed.',
    };
  }

  const claims = verification.claims;

  const kcSub = asText(claims.sub);
  if (!kcSub) {
    return { status: 401, code: 'unauthorized', message: 'Bearer token missing sub.' };
  }

  const displayName = asText(claims.name) || asText(claims.preferred_username) || asText(claims.email) || 'Hub User';
  const email = asNullableText(claims.email);
  const existing = userByKcSubStmt.get(kcSub);

  if (!existing) {
    const existingByEmail = email ? userByEmailStmt.get(email) : null;
    if (existingByEmail) {
      updateUserStmt.run(displayName, email, nowIso(), existingByEmail.user_id);
      db.prepare('UPDATE users SET kc_sub = ? WHERE user_id = ?').run(kcSub, existingByEmail.user_id);
      return {
        status: 200,
        token,
        claims,
        user: userByIdStmt.get(existingByEmail.user_id),
        devAuthMode: false,
      };
    }

    const now = nowIso();
    const userId = newId('usr');
    db.exec('BEGIN');
    try {
      insertUserStmt.run(userId, kcSub, displayName, email, now, now);
      createPersonalProjectForUser({
        user_id: userId,
        kc_sub: kcSub,
        display_name: displayName,
        email,
        created_at: now,
        updated_at: now,
      });
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    return {
      status: 200,
      token,
      claims,
      user: userByIdStmt.get(userId),
      devAuthMode: false,
    };
  }

  updateUserStmt.run(displayName, email, nowIso(), existing.user_id);
  return {
    status: 200,
    token,
    claims,
    user: userByIdStmt.get(existing.user_id),
    devAuthMode: false,
  };
};

const projectRecord = (row) => ({
  project_id: row.project_id,
  name: row.name,
  created_by: row.created_by,
  created_at: row.created_at,
  updated_at: row.updated_at,
  membership_role: row.membership_role || null,
});

const collectionSchema = (collectionId) => {
  const collection = collectionByIdStmt.get(collectionId);
  if (!collection) {
    return null;
  }

  const fields = fieldsByCollectionStmt.all(collectionId).map((field) => ({
    field_id: field.field_id,
    name: field.name,
    type: field.type,
    config: parseJsonObject(field.config, {}),
    sort_order: field.sort_order,
  }));

  return {
    collection_id: collection.collection_id,
    name: collection.name,
    fields,
  };
};

const recordValuesMap = (recordId) => {
  const values = valuesByRecordStmt.all(recordId);
  const map = {};
  for (const value of values) {
    map[value.field_id] = parseJson(value.value_json, null);
  }
  return map;
};

const recordSummary = (record) => ({
  record_id: record.record_id,
  collection_id: record.collection_id,
  title: record.title,
  fields: recordValuesMap(record.record_id),
  updated_at: record.updated_at,
});

const recordDetail = (record) => {
  const schema = collectionSchema(record.collection_id);
  const values = recordValuesMap(record.record_id);
  const capabilityRows = capabilitiesByRecordStmt.all(record.record_id);
  const capabilityTypes = new Set(capabilityRows.map((row) => row.capability_type));
  const task = taskStateByRecordStmt.get(record.record_id);
  const event = eventStateByRecordStmt.get(record.record_id);
  const recurrence = recurrenceByRecordStmt.get(record.record_id);
  const reminders = remindersByRecordStmt.all(record.record_id).map((row) => ({
    reminder_id: row.reminder_id,
    remind_at: row.remind_at,
    channels: parseJson(row.channels, []),
    created_at: row.created_at,
    fired_at: row.fired_at,
  }));
  const participants = participantsByRecordStmt.all(record.record_id).map((row) => ({
    user_id: row.user_id,
    role: row.role,
    added_at: row.added_at,
  }));
  const assignments = assignmentsByRecordStmt.all(record.record_id).map((row) => ({
    user_id: row.user_id,
    assigned_at: row.assigned_at,
  }));

  const outgoing = outgoingRelationsStmt.all(record.record_id).map((row) => ({
    relation_id: row.relation_id,
    to_record_id: row.to_record_id,
    via_field_id: row.via_field_id,
    to_record: {
      record_id: row.to_record_id,
      title: asText(row.to_record_title) || 'Untitled record',
      collection_id: asText(row.to_collection_id) || null,
      collection_name: asText(row.to_collection_name) || null,
    },
  }));
  const incoming = incomingRelationsStmt.all(record.record_id).map((row) => ({
    relation_id: row.relation_id,
    from_record_id: row.from_record_id,
    via_field_id: row.via_field_id,
    from_record: {
      record_id: row.from_record_id,
      title: asText(row.from_record_title) || 'Untitled record',
      collection_id: asText(row.from_collection_id) || null,
      collection_name: asText(row.from_collection_name) || null,
    },
  }));

  const attachments = attachmentsByEntityStmt
    .all(record.project_id, 'record', record.record_id)
    .map((row) => ({
      attachment_id: row.attachment_id,
      provider: row.provider,
      asset_root_id: row.asset_root_id,
      asset_path: row.asset_path,
      name: row.name,
      mime_type: row.mime_type,
      size_bytes: row.size_bytes,
      metadata: parseJsonObject(row.metadata_json, {}),
      proxy_url: buildAssetProxyPath({
        projectId: row.project_id,
        assetRootId: row.asset_root_id,
        assetPath: row.asset_path,
      }),
      created_at: row.created_at,
    }));

  const comments = commentsByTargetStmt
    .all(record.project_id, 'record', record.record_id)
    .map((row) => ({
      comment_id: row.comment_id,
      author_user_id: row.author_user_id,
      body_json: parseJson(row.body_json, {}),
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));

  const activity = timelineByPrimaryEntityStmt
    .all(record.project_id, 'record', record.record_id)
    .map(timelineRecord);

  return {
    record_id: record.record_id,
    project_id: record.project_id,
    collection_id: record.collection_id,
    title: record.title,
    schema,
    values,
    capabilities: {
      capability_types: [...capabilityTypes],
      task_state: task
        ? {
            status: task.status,
            priority: task.priority,
            completed_at: task.completed_at,
            updated_at: task.updated_at,
          }
        : null,
      event_state: event
        ? {
            start_dt: event.start_dt,
            end_dt: event.end_dt,
            timezone: event.timezone,
            location: event.location,
            updated_at: event.updated_at,
          }
        : null,
      recurrence_rule: recurrence ? parseJson(recurrence.rule_json, null) : null,
      reminders,
      participants,
      assignments,
    },
    relations: {
      outgoing,
      incoming,
    },
    attachments,
    comments,
    activity,
    created_at: record.created_at,
    updated_at: record.updated_at,
    archived_at: record.archived_at,
  };
};

const paneSummary = (pane, userId = '') => {
  const doc = paneDocByPaneStmt.get(pane.pane_id);
  const members = paneMembersStmt.all(pane.pane_id).map((member) => ({
    user_id: member.user_id,
    display_name: member.display_name,
  }));
  const projectRole = userId ? normalizeProjectRole(projectMembershipRoleStmt.get(pane.project_id, userId)?.role) : 'member';
  const canEdit = projectRole === 'owner' || Boolean(userId && paneEditorExistsStmt.get(pane.pane_id, userId)?.ok);

  return {
    pane_id: pane.pane_id,
    project_id: pane.project_id,
    name: pane.name,
    sort_order: pane.sort_order,
    pinned: pane.pinned === 1,
    layout_config: parseJsonObject(pane.layout_config, {}),
    doc_id: doc?.doc_id || null,
    members,
    can_edit: canEdit,
  };
};

const pendingInviteRecord = (row) => ({
  invite_request_id: row.invite_request_id,
  project_id: row.project_id,
  email: row.email,
  role: membershipRoleLabel(row.role),
  requested_by_user_id: row.requested_by_user_id,
  status: row.status,
  target_user_id: row.target_user_id || null,
  reviewed_by_user_id: row.reviewed_by_user_id || null,
  reviewed_at: row.reviewed_at || null,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

const ensureUserForEmail = ({ email, displayName }) => {
  const normalizedEmail = asText(email).toLowerCase();
  if (!normalizedEmail) {
    return null;
  }
  const existing = userByEmailStmt.get(normalizedEmail);
  if (existing) {
    return existing;
  }
  const now = nowIso();
  const userId = newId('usr');
  insertUserStmt.run(userId, `local:${normalizedEmail}`, displayName || normalizedEmail, normalizedEmail, now, now);
  return userByIdStmt.get(userId);
};

const assignedTaskListForUser = ({ projectId, userId }) =>
  assignedTasksByUserInProjectStmt.all(userId, projectId).map((row) => ({
    record_id: row.record_id,
    project_id: row.project_id,
    title: row.title,
    updated_at: row.updated_at,
    status: row.status || 'todo',
    priority: row.priority || null,
  }));

const reassignTasksForRemovedMember = ({ projectId, removedUserId, nextOwnerUserId }) => {
  if (!removedUserId || !nextOwnerUserId || removedUserId === nextOwnerUserId) {
    return [];
  }
  const assignedTasks = assignedTaskListForUser({ projectId, userId: removedUserId });
  const timestamp = nowIso();
  for (const task of assignedTasks) {
    deleteAssignmentStmt.run(task.record_id, removedUserId);
    insertAssignmentStmt.run(task.record_id, nextOwnerUserId, timestamp);
  }
  return assignedTasks;
};

const resolveMutationContextPaneId = ({ body = null, requestUrl = null }) =>
  asText(body?.mutation_context_pane_id) || asText(requestUrl?.searchParams?.get('mutation_context_pane_id'));

const trackedFileRecord = (row) => {
  const metadata = parseJsonObject(row.metadata_json, {});
  const metadataPaneId = asNullableText(metadata.pane_id);
  const pathPaneId = asText(row.provider_path).match(/^Pane Files\/([^/]+)(?:\/|$)/)?.[1] || null;
  const paneId = metadataPaneId || pathPaneId;
  return {
    file_id: row.file_id,
    project_id: row.project_id,
    asset_root_id: row.asset_root_id,
    provider: row.provider,
    asset_path: row.provider_path,
    provider_path: row.provider_path,
    name: row.name,
    mime_type: row.mime_type,
    size_bytes: row.size_bytes,
    created_by: row.created_by,
    created_at: row.created_at,
    scope: paneId ? 'pane' : 'project',
    pane_id: paneId,
    metadata,
    proxy_url: buildAssetProxyPath({
      projectId: row.project_id,
      assetRootId: row.asset_root_id,
      assetPath: row.provider_path,
    }),
  };
};

const resolveProjectContentWriteGate = ({ userId, projectId, paneId = '' }) => {
  const normalizedPaneId = asText(paneId);
  if (!normalizedPaneId) {
    return withProjectPolicyGate({ userId, projectId, requiredCapability: 'write' });
  }
  const paneGate = withPanePolicyGate({ userId, paneId: normalizedPaneId, requiredCapability: 'write' });
  if (paneGate.error) {
    return paneGate;
  }
  if (paneGate.project_id !== projectId) {
    return { error: { status: 404, code: 'not_found', message: 'Pane not found in project.' } };
  }
  return paneGate;
};

const buildProjectTaskSummary = (record) => {
  const project = projectByIdStmt.get(record.project_id);
  const collection = collectionByIdStmt.get(record.collection_id);
  const task = taskStateByRecordStmt.get(record.record_id);
  return {
    record_id: record.record_id,
    project_id: record.project_id,
    project_name: project?.name || null,
    collection_id: record.collection_id,
    collection_name: collection?.name || null,
    title: record.title,
    updated_at: record.updated_at,
    task_state: task
      ? {
          status: task.status,
          priority: task.priority,
          completed_at: task.completed_at,
          updated_at: task.updated_at,
        }
      : {
          status: 'todo',
          priority: null,
          completed_at: null,
          updated_at: record.updated_at,
        },
    assignments: assignmentsByRecordStmt.all(record.record_id).map((row) => ({
      user_id: row.user_id,
      assigned_at: row.assigned_at,
    })),
    origin_kind: 'project',
    source_view_id: null,
    source_pane: null,
  };
};

const buildPersonalTaskSummaryFromRecord = (record) => {
  const task = taskStateByRecordStmt.get(record.record_id);
  return {
    record_id: record.record_id,
    project_id: null,
    project_name: null,
    collection_id: 'personal',
    collection_name: 'Personal',
    title: record.title,
    updated_at: record.updated_at,
    task_state: {
      status: task?.status || 'todo',
      priority: task?.priority || null,
      completed_at: task?.completed_at || null,
      updated_at: task?.updated_at || record.updated_at,
    },
    assignments: assignmentsByRecordStmt.all(record.record_id).map((row) => ({
      user_id: row.user_id,
      assigned_at: row.assigned_at,
    })),
    origin_kind: 'personal',
    source_view_id: null,
    source_pane: null,
  };
};

const personalProjectIdForUser = (userId) => asNullableText(personalProjectByUserStmt.get(userId, userId)?.project_id);

const buildTaskSummaryForUser = (record, personalProjectId) =>
  record.project_id === personalProjectId
    ? buildPersonalTaskSummaryFromRecord(record)
    : buildProjectTaskSummary(record);

const taskFieldMapForCollection = (collectionId) => {
  const fields = fieldsByCollectionStmt.all(collectionId);
  const findField = (name) => fields.find((field) => asText(field.name).toLowerCase() === name);
  return {
    title: findField('title') || null,
    status: findField('status') || null,
    priority: findField('priority') || null,
  };
};

const createPersonalTaskRecord = ({
  userId,
  projectId,
  collectionId,
  title,
  status = 'todo',
  priority = null,
  createdAt,
  updatedAt,
}) => {
  const recordId = newId('rec');
  const timestampCreatedAt = asText(createdAt) || nowIso();
  const timestampUpdatedAt = asText(updatedAt) || timestampCreatedAt;
  const normalizedStatus = asText(status) || 'todo';
  const normalizedPriority = asNullableText(priority);
  const fields = taskFieldMapForCollection(collectionId);

  insertRecordStmt.run(recordId, projectId, collectionId, title, userId, timestampCreatedAt, timestampUpdatedAt);
  insertRecordCapabilityStmt.run(recordId, 'task', timestampCreatedAt);
  upsertTaskStateStmt.run(
    recordId,
    normalizedStatus,
    normalizedPriority,
    normalizedStatus === 'done' ? timestampUpdatedAt : null,
    timestampUpdatedAt,
  );
  insertAssignmentStmt.run(recordId, userId, timestampCreatedAt);

  if (fields.title) {
    upsertRecordValueStmt.run(recordId, fields.title.field_id, toJson(title), timestampUpdatedAt);
  }
  if (fields.status) {
    upsertRecordValueStmt.run(recordId, fields.status.field_id, toJson(normalizedStatus), timestampUpdatedAt);
  }
  if (fields.priority) {
    upsertRecordValueStmt.run(recordId, fields.priority.field_id, toJson(normalizedPriority), timestampUpdatedAt);
  }

  return recordByIdStmt.get(recordId);
};

const createPersonalProjectForUser = (user, now = nowIso()) => {
  const displayName = asText(user.display_name) || 'Personal';
  const projectId = newId('prj');
  const collectionId = newId('col');
  const paneId = newId('pan');
  const docId = newId('doc');
  const assetRootId = newId('ast');
  const titleFieldId = newId('fld');
  const statusFieldId = newId('fld');
  const priorityFieldId = newId('fld');

  insertProjectWithTypeStmt.run(projectId, `${displayName}'s Hub`, user.user_id, 'personal', now, now);
  insertProjectMemberStmt.run(projectId, user.user_id, 'owner', now);
  insertPaneStmt.run(
    paneId,
    projectId,
    'Notes',
    1,
    0,
    toJson({ modules: [], doc_binding_mode: 'owned' }),
    user.user_id,
    now,
    now,
  );
  insertDocStmt.run(docId, paneId, now, now);
  insertDocStorageStmt.run(docId, 0, toJson({}), now);
  insertAssetRootStmt.run(
    assetRootId,
    projectId,
    'nextcloud',
    `/Personal/${user.user_id}`,
    toJson({ provider: 'nextcloud' }),
    now,
    now,
  );
  insertCollectionStmt.run(collectionId, projectId, 'Tasks', null, null, now, now);
  updateProjectTasksCollectionStmt.run(collectionId, now, projectId);
  insertFieldStmt.run(titleFieldId, collectionId, 'title', 'text', toJson({ required: true }), 0, now, now);
  insertFieldStmt.run(
    statusFieldId,
    collectionId,
    'status',
    'select',
    toJson({
      required: true,
      options: [
        { value: 'todo', label: 'Todo' },
        { value: 'in-progress', label: 'In Progress' },
        { value: 'done', label: 'Done' },
      ],
    }),
    1,
    now,
    now,
  );
  insertFieldStmt.run(
    priorityFieldId,
    collectionId,
    'priority',
    'select',
    toJson({
      options: [
        { value: 'low', label: 'Low' },
        { value: 'medium', label: 'Medium' },
        { value: 'high', label: 'High' },
      ],
    }),
    2,
    now,
    now,
  );
};

const ensurePersonalProjectForUser = (user) => {
  const existing = personalProjectByUserStmt.get(user.user_id, user.user_id);
  if (existing) {
    return existing;
  }

  db.exec('BEGIN');
  try {
    createPersonalProjectForUser(user);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  return personalProjectByUserStmt.get(user.user_id, user.user_id);
};

const ensurePersonalProjectTasksCollectionIds = () => {
  const projects = personalProjectsMissingTasksCollectionIdStmt.all();
  if (projects.length === 0) {
    return;
  }

  const now = nowIso();
  db.exec('BEGIN');
  try {
    for (const project of projects) {
      const tasksCollection = collectionByNameStmt.get(project.project_id, 'Tasks');
      if (!tasksCollection) {
        continue;
      }
      updateProjectTasksCollectionStmt.run(tasksCollection.collection_id, now, project.project_id);
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
};
ensurePersonalProjectTasksCollectionIds();

const recordDetailForUser = (record, userId) => {
  const detail = recordDetail(record);
  if (record.project_id !== personalProjectIdForUser(userId)) {
    return detail;
  }
  return {
    ...detail,
    origin_kind: 'personal',
    source_view_id: null,
    source_pane: null,
  };
};

const buildHomeEventSummary = (record) => {
  const project = projectByIdStmt.get(record.project_id);
  const collection = collectionByIdStmt.get(record.collection_id);
  const event = eventStateByRecordStmt.get(record.record_id);
  return {
    record_id: record.record_id,
    project_id: record.project_id,
    project_name: project?.name || null,
    collection_id: record.collection_id,
    collection_name: collection?.name || null,
    title: record.title,
    updated_at: record.updated_at,
    event_state: event
      ? {
          start_dt: event.start_dt,
          end_dt: event.end_dt,
          timezone: event.timezone,
          location: event.location,
          updated_at: event.updated_at,
        }
      : null,
    participants: participantsByRecordStmt.all(record.record_id).map((row) => ({
      user_id: row.user_id,
      role: row.role,
      added_at: row.added_at,
    })),
    source_pane: null,
  };
};

const findOrCreateEventsCollection = (projectId) => {
  const existing = collectionByNameStmt.get(projectId, 'Events');
  if (existing) {
    return existing;
  }

  const now = nowIso();
  const collectionId = newId('col');
  insertCollectionStmt.run(collectionId, projectId, 'Events', 'calendar', 'sky', now, now);
  return collectionByIdStmt.get(collectionId);
};

const normalizeParticipants = (projectId, participantUserIds) => {
  const input = Array.isArray(participantUserIds) ? participantUserIds : [];
  const unique = [...new Set(input.map((value) => asText(value)).filter(Boolean))];
  const valid = [];
  for (const userId of unique) {
    const membership = projectMembershipExistsStmt.get(projectId, userId);
    if (membership?.ok) {
      valid.push(userId);
    }
  }
  return valid;
};

const normalizeMentionRefs = (projectId, mentionRefs) => {
  const input = Array.isArray(mentionRefs) ? mentionRefs : [];
  const seen = new Set();
  const normalized = [];

  for (const mention of input) {
    const targetEntityType = asText(mention?.target_entity_type || mention?.targetEntityType);
    const targetEntityId = asText(mention?.target_entity_id || mention?.targetEntityId);
    if (!targetEntityType || !targetEntityId) {
      continue;
    }
    if (targetEntityType !== 'user' && targetEntityType !== 'record') {
      continue;
    }

    if (targetEntityType === 'user') {
      const membership = projectMembershipExistsStmt.get(projectId, targetEntityId);
      if (!membership?.ok) {
        continue;
      }
    }

    if (targetEntityType === 'record') {
      const record = recordByIdStmt.get(targetEntityId);
      if (!record || record.project_id !== projectId || record.archived_at) {
        continue;
      }
    }

    const key = `${targetEntityType}:${targetEntityId}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    const context = parseJson(mention.context, mention.context || null);
    normalized.push({
      target_entity_type: targetEntityType,
      target_entity_id: targetEntityId,
      context,
    });
  }

  return normalized;
};

const mentionKey = (row) => `${asText(row.target_entity_type)}:${asText(row.target_entity_id)}`;

const mapMentionRowToBacklink = (row) => {
  const context = parseJson(row.context, null);
  const commentAnchor = parseJson(row.source_comment_anchor_payload, null);
  const commentNodeKey = asText(commentAnchor?.nodeKey);
  const commentDocId = asText(row.source_comment_doc_id);
  const docSourcePaneId = asText(row.source_doc_pane_id);
  const docSourcePaneName = asText(row.source_doc_pane_name);
  const commentSourcePaneId = asText(row.source_comment_pane_id);
  const commentSourcePaneName = asText(row.source_comment_pane_name);
  const sourcePaneId = row.source_entity_type === 'doc' ? docSourcePaneId : commentSourcePaneId;
  const sourcePaneName = row.source_entity_type === 'doc' ? docSourcePaneName : commentSourcePaneName;
  const sourceDocId = row.source_entity_type === 'doc' ? asText(row.source_entity_id) : commentDocId;
  const nodeKeyFromContext = asText(context?.nodeKey);
  const sourceNodeKey = nodeKeyFromContext || commentNodeKey || null;

  return {
    mention_id: row.mention_id,
    created_at: row.created_at,
    source_entity_type: row.source_entity_type,
    source_entity_id: row.source_entity_id,
    target_entity_type: row.target_entity_type,
    target_entity_id: row.target_entity_id,
    context,
    source: {
      doc_id: sourceDocId || null,
      pane_id: sourcePaneId || null,
      pane_name: sourcePaneName || null,
      node_key: sourceNodeKey,
      comment_target_entity_type: asText(row.source_comment_target_entity_type) || null,
      comment_target_entity_id: asText(row.source_comment_target_entity_id) || null,
      comment_author_user_id: asText(row.source_comment_author_user_id) || null,
    },
  };
};

const materializeMentions = ({ projectId, sourceEntityType, sourceEntityId, mentions, actorUserId, replaceSource = false }) => {
  const created = [];
  const mentionList = normalizeMentionRefs(projectId, mentions);
  const existingRows = mentionsBySourceStmt.all(projectId, sourceEntityType, sourceEntityId);
  const existingByKey = new Map(existingRows.map((row) => [mentionKey(row), row]));

  if (replaceSource) {
    const nextKeys = new Set(mentionList.map(mentionKey));
    for (const row of existingRows) {
      if (!nextKeys.has(mentionKey(row))) {
        deleteMentionByIdStmt.run(row.mention_id);
      }
    }
  }

  for (const mention of mentionList) {
    const targetEntityType = mention.target_entity_type;
    const targetEntityId = mention.target_entity_id;
    const existing = existingByKey.get(mentionKey(mention));
    const context = mention.context;
    const contextJson = toJson(context);
    if (existing) {
      if ((existing.context || null) !== contextJson) {
        updateMentionContextStmt.run(contextJson, existing.mention_id);
      }
      continue;
    }
    const mentionId = newId('mtn');
    insertMentionStmt.run(
      mentionId,
      projectId,
      sourceEntityType,
      sourceEntityId,
      targetEntityType,
      targetEntityId,
      contextJson,
      nowIso(),
    );

    if (targetEntityType === 'user') {
      const notificationContext = notificationContextForSource({
        projectId,
        sourceEntityType,
        sourceEntityId,
        context,
      });
      createNotification({
        projectId,
        userId: targetEntityId,
        reason: 'mention',
        entityType: sourceEntityType,
        entityId: sourceEntityId,
        notificationScope: 'network',
        payload: buildNotificationPayload({
          message: 'You were mentioned.',
          ...notificationContext,
          extras: {
            mention_id: mentionId,
            source_entity_type: sourceEntityType,
            source_entity_id: sourceEntityId,
          },
        }),
      });
    }

    created.push({
      mention_id: mentionId,
      project_id: projectId,
      source_entity_type: sourceEntityType,
      source_entity_id: sourceEntityId,
      target_entity_type: targetEntityType,
      target_entity_id: targetEntityId,
      context,
    });
  }

  if (created.length > 0) {
    emitTimelineEvent({
      projectId,
      actorUserId,
      eventType: 'mention.created',
      primaryEntityType: sourceEntityType,
      primaryEntityId: sourceEntityId,
      secondaryEntities: created.map((item) => ({
        entity_type: item.target_entity_type,
        entity_id: item.target_entity_id,
      })),
      summary: {
        message: 'Mentions materialized',
        count: created.length,
      },
    });
  }

  return created;
};

const buildSessionSummary = (user) => {
  const memberships = projectMembershipsByUserStmt.all(user.user_id);
  let sessionRole = 'Viewer';
  const projectMemberships = memberships.map((membership) => ({
    projectId: membership.project_id,
    membershipRole: membershipRoleLabel(membership.role),
  }));

  const projectCapabilities = {};
  for (const membership of memberships) {
    const membershipRole = membershipRoleLabel(membership.role);
    let capabilities = collaboratorProjectCapabilities;
    let derivedSessionRole = 'Collaborator';

    if (membershipRole === 'owner') {
      capabilities = ownerProjectCapabilities;
      derivedSessionRole = 'Owner';
    }

    projectCapabilities[membership.project_id] = [...capabilities];
    if (sessionRolePriority[derivedSessionRole] > sessionRolePriority[sessionRole]) {
      sessionRole = derivedSessionRole;
    }
  }

  const globalCapabilities = memberships.length > 0
    ? [...globalCapabilitiesBySessionRole[sessionRole]]
    : [];

  return {
    userId: user.user_id,
    name: user.display_name,
    firstName: user.display_name,
    lastName: '',
    email: user.email || '',
    role: sessionRole,
    projectMemberships,
    globalCapabilities,
    projectCapabilities,
  };
};

const pathMatch = (pathname, regex) => pathname.match(regex);

const parseCursorOffset = (cursorRaw) => {
  const cursor = asText(cursorRaw);
  if (!cursor) {
    return 0;
  }
  try {
    const payload = JSON.parse(fromBase64Url(cursor));
    const offset = Number(payload?.offset);
    return Number.isInteger(offset) && offset >= 0 ? offset : 0;
  } catch {
    return 0;
  }
};

const encodeCursorOffset = (offset) =>
  Buffer.from(JSON.stringify({ offset }), 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

const withAuth = async (request) => {
  const identity = await ensureUserFromRequest(request);
  if (identity.status !== 200) {
    return {
      error: jsonResponse(identity.status, errorEnvelope(identity.code, identity.message)),
    };
  }

  return {
    user: identity.user,
    token: identity.token,
    claims: identity.claims,
    devAuthMode: Boolean(identity.devAuthMode),
  };
};

const hasPolicyCapability = (sessionSummary, requiredCapability, projectId = '') => {
  if (requiredCapability.startsWith('project.')) {
    if (!projectId) {
      return false;
    }
    return (sessionSummary.projectCapabilities[projectId] ?? []).includes(requiredCapability);
  }
  return sessionSummary.globalCapabilities.includes(requiredCapability);
};

const policyGateError = (requiredCapability, projectId = '') => {
  const scopedMessage = projectId
    ? `Missing required capability "${requiredCapability}" for project "${projectId}".`
    : `Missing required capability "${requiredCapability}".`;
  return jsonResponse(403, errorEnvelope('forbidden', scopedMessage));
};

export const withPolicyGate = (requiredCapability, projectIdResolverOrHandler, maybeHandler) => {
  const resolveProjectId = typeof maybeHandler === 'function' ? projectIdResolverOrHandler : null;
  const handler = typeof maybeHandler === 'function' ? maybeHandler : projectIdResolverOrHandler;

  return async (context) => {
    const auth = context.auth ?? await withAuth(context.request);
    if (auth.error) {
      send(context.response, auth.error);
      return;
    }

    const sessionSummary = context.sessionSummary ?? buildSessionSummary(auth.user);
    const projectId = resolveProjectId
      ? asText(resolveProjectId({ ...context, auth, sessionSummary }))
      : asText(context.projectId);

    if (!hasPolicyCapability(sessionSummary, requiredCapability, projectId)) {
      send(context.response, policyGateError(requiredCapability, projectId));
      return;
    }

    return handler({
      ...context,
      auth,
      sessionSummary,
      projectId,
    });
  };
};

const getSessionRoute = withPolicyGate('hub.view', async ({ response, auth, sessionSummary }) => {
  const memberships = projectMembershipsByUserStmt.all(auth.user.user_id).map((row) => ({
    project_id: row.project_id,
    role: membershipRoleLabel(row.role),
    joined_at: row.joined_at,
  }));

  send(
    response,
    jsonResponse(
      200,
      okEnvelope({
        user: {
          user_id: auth.user.user_id,
          kc_sub: auth.user.kc_sub,
          display_name: auth.user.display_name,
          email: auth.user.email,
        },
        memberships,
        sessionSummary,
        dev_auth_mode: Boolean(auth.devAuthMode),
      }),
    ),
  );
});

const listProjectsRoute = withPolicyGate('projects.view', async ({ response, auth }) => {
  const projects = listProjectsForUserStmt.all(auth.user.user_id).map(projectRecord);
  send(response, jsonResponse(200, okEnvelope({ projects })));
});

const createProjectRoute = withPolicyGate('projects.view', async ({ request, response, auth }) => {
  let body;
  try {
    body = await parseBody(request);
  } catch {
    send(response, jsonResponse(400, errorEnvelope('invalid_json', 'Body must be valid JSON.')));
    return;
  }

  const name = asText(body.name);
  if (!name) {
    send(response, jsonResponse(400, errorEnvelope('invalid_input', 'Project name is required.')));
    return;
  }

  const now = nowIso();
  const projectId = asText(body.project_id) || newId('prj');

  if (projectByIdStmt.get(projectId)) {
    send(response, jsonResponse(409, errorEnvelope('conflict', 'Project already exists.')));
    return;
  }

  db.exec('BEGIN');
  try {
    insertProjectStmt.run(projectId, name, auth.user.user_id, now, now);
    insertProjectMemberStmt.run(projectId, auth.user.user_id, 'owner', now);
    const defaultCollectionId = newId('col');
    const defaultCollectionNow = nowIso();
    db.prepare(`
      INSERT INTO collections (collection_id, project_id, name, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(defaultCollectionId, projectId, 'Tasks', defaultCollectionNow, defaultCollectionNow);

    const paneId = newId('pan');
    const docId = newId('doc');
    insertPaneStmt.run(
      paneId,
      projectId,
      'Main Work',
      1,
      0,
      toJson({ modules: [], doc_binding_mode: 'owned' }),
      auth.user.user_id,
      now,
      now,
    );
    insertDocStmt.run(docId, paneId, now, now);
    insertDocStorageStmt.run(docId, 0, toJson({}), now);
    insertAssetRootStmt.run(
      newId('ast'),
      projectId,
      'nextcloud',
      `/HubOS/${projectId}`,
      toJson({ provider: 'nextcloud' }),
      now,
      now,
    );

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  emitTimelineEvent({
    projectId,
    actorUserId: auth.user.user_id,
    eventType: 'project.created',
    primaryEntityType: 'project',
    primaryEntityId: projectId,
    summary: { message: `Project created: ${name}` },
  });

  const project = projectForMemberStmt.get(projectId, auth.user.user_id);
  send(response, jsonResponse(201, okEnvelope({ project: projectRecord(project) })));
});

const listNotificationsRoute = withPolicyGate('hub.view', async ({ response, requestUrl, auth }) => {
  const unreadOnly = asBoolean(requestUrl.searchParams.get('unread'), false);
  const limit = asInteger(requestUrl.searchParams.get('limit'), 100, 1, 250);
  const rows = unreadOnly
    ? unreadNotificationsByUserStmt.all(auth.user.user_id, limit)
    : notificationsByUserStmt.all(auth.user.user_id, limit);
  const notifications = rows.map(notificationRecord);

  send(response, jsonResponse(200, okEnvelope({ notifications })));
});

const markNotificationReadRoute = withPolicyGate('hub.notifications.write', async ({ response, auth, params }) => {
  const notificationId = asText(params?.notificationId);
  const existing = notificationByIdStmt.get(notificationId);
  if (!existing || existing.user_id !== auth.user.user_id) {
    send(response, jsonResponse(404, errorEnvelope('not_found', 'Notification not found.')));
    return;
  }

  markNotificationReadStmt.run(nowIso(), notificationId, auth.user.user_id);
  const refreshed = notificationByIdStmt.get(notificationId);
  send(response, jsonResponse(200, okEnvelope({ notification: notificationRecord(refreshed) })));
});

const authorizeHubLiveRoute = withPolicyGate('hub.live', async ({ response, auth }) => {
  const ticket = issueHubLiveTicket({
    userId: auth.user.user_id,
  });

  send(
    response,
    jsonResponse(
      200,
      okEnvelope({
        authorization: {
          user_id: auth.user.user_id,
          ws_ticket: ticket.ws_ticket,
          ticket_issued_at: ticket.issued_at,
          ticket_expires_at: ticket.expires_at,
          ticket_expires_in_ms: ticket.expires_in_ms,
        },
      }),
    ),
  );
});

const visibleProjectIdsForUser = (userId) =>
  projectMembershipsByUserStmt.all(userId).map((membership) => membership.project_id);

const listVisibleProjectTasksForUser = ({ userId, projectId = '' }) => {
  const visibleProjectIds = visibleProjectIdsForUser(userId);
  const personalProjectId = personalProjectIdForUser(userId);
  const tasks = [];
  for (const visibleProjectId of visibleProjectIds) {
    if (projectId && visibleProjectId !== projectId) {
      continue;
    }
    const records = db.prepare(`
      SELECT r.*
      FROM records r
      JOIN task_state ts ON ts.record_id = r.record_id
      WHERE r.project_id = ? AND r.archived_at IS NULL
      ORDER BY COALESCE(ts.updated_at, r.updated_at) DESC, r.record_id DESC
    `).all(visibleProjectId);
    for (const record of records) {
      tasks.push(buildTaskSummaryForUser(record, personalProjectId));
    }
  }
  return tasks;
};

const listAssignedTasksForUser = ({ userId, projectId = '' }) => {
  const visibleProjectIds = new Set(visibleProjectIdsForUser(userId));
  const personalProjectId = personalProjectIdForUser(userId);
  const rows = db.prepare(`
    SELECT r.*
    FROM assignments a
    JOIN records r ON r.record_id = a.record_id
    JOIN task_state ts ON ts.record_id = r.record_id
    WHERE a.user_id = ? AND r.archived_at IS NULL
    ORDER BY COALESCE(ts.updated_at, r.updated_at) DESC, r.record_id DESC
  `).all(userId);
  return rows
    .filter((row) => visibleProjectIds.has(row.project_id) && (!projectId || row.project_id === projectId))
    .map((row) => buildTaskSummaryForUser(row, personalProjectId));
};

const listHomeEventsForUser = ({ userId, limit }) => {
  const visibleProjectIds = visibleProjectIdsForUser(userId);
  const rows = [];
  for (const projectId of visibleProjectIds) {
    const projectRows = db.prepare(`
      SELECT r.*
      FROM records r
      JOIN event_state es ON es.record_id = r.record_id
      WHERE r.project_id = ? AND r.archived_at IS NULL
      ORDER BY es.start_dt ASC, r.record_id ASC
    `).all(projectId);
    rows.push(...projectRows);
  }
  const nowMs = Date.now();
  return rows
    .filter((row) => {
      const event = eventStateByRecordStmt.get(row.record_id);
      return event ? new Date(event.end_dt).getTime() >= nowMs - 86_400_000 : false;
    })
    .sort((left, right) => {
      const leftStart = new Date(eventStateByRecordStmt.get(left.record_id)?.start_dt || left.updated_at).getTime();
      const rightStart = new Date(eventStateByRecordStmt.get(right.record_id)?.start_dt || right.updated_at).getTime();
      return leftStart - rightStart;
    })
    .slice(0, limit)
    .map(buildHomeEventSummary);
};

const getHubTasksRoute = withPolicyGate('hub.view', async ({ response, requestUrl, auth }) => {
  const lens = asText(requestUrl.searchParams.get('lens')).toLowerCase() || 'assigned';
  const projectId = asText(requestUrl.searchParams.get('project_id'));
  const limit = asInteger(requestUrl.searchParams.get('limit'), 50, 1, 200);
  const offset = parseCursorOffset(requestUrl.searchParams.get('cursor'));
  const personalProject = personalProjectByUserStmt.get(auth.user.user_id, auth.user.user_id);
  if (!personalProject) {
    send(response, jsonResponse(500, errorEnvelope('server_error', 'Personal project is unavailable.')));
    return;
  }

  let tasks = [];
  if (lens === 'project' && projectId) {
    const projectGate = withProjectPolicyGate({ userId: auth.user.user_id, projectId, requiredCapability: 'view' });
    if (projectGate.error) {
      send(response, jsonResponse(projectGate.error.status, errorEnvelope(projectGate.error.code, projectGate.error.message)));
      return;
    }
    tasks = listVisibleProjectTasksForUser({ userId: auth.user.user_id, projectId });
  } else if (lens === 'assigned') {
    tasks = listAssignedTasksForUser({ userId: auth.user.user_id, projectId });
  } else {
    tasks = listVisibleProjectTasksForUser({ userId: auth.user.user_id, projectId });
  }

  const page = tasks.slice(offset, offset + limit);
  const nextOffset = offset + page.length;
  const nextCursor = nextOffset < tasks.length ? encodeCursorOffset(nextOffset) : null;
  send(response, jsonResponse(200, okEnvelope({ tasks: page, next_cursor: nextCursor })));
});

const createHubTaskRoute = withPolicyGate('hub.tasks.write', async ({ response, request, auth }) => {
  let body;
  try {
    body = await parseBody(request);
  } catch {
    send(response, jsonResponse(400, errorEnvelope('invalid_json', 'Body must be valid JSON.')));
    return;
  }

  const title = asText(body.title);
  if (!title) {
    send(response, jsonResponse(400, errorEnvelope('invalid_input', 'title is required.')));
    return;
  }

  const personalProject = personalProjectByUserStmt.get(auth.user.user_id, auth.user.user_id);
  if (!personalProject) {
    send(response, jsonResponse(500, errorEnvelope('server_error', 'Personal project is unavailable.')));
    return;
  }
  const tasksCollectionId = asText(personalProject.tasks_collection_id);
  if (!tasksCollectionId) {
    send(response, jsonResponse(500, errorEnvelope('server_error', 'Personal tasks collection is unavailable.')));
    return;
  }

  const taskRecord = createPersonalTaskRecord({
    userId: auth.user.user_id,
    projectId: personalProject.project_id,
    collectionId: tasksCollectionId,
    title,
    status: asText(body.status) || 'todo',
    priority: asNullableText(body.priority),
  });

  send(response, jsonResponse(201, okEnvelope({ task: buildPersonalTaskSummaryFromRecord(taskRecord) })));
});

const getHubHomeRoute = withPolicyGate('hub.view', async ({ response, requestUrl, auth }) => {
  const tasksLimit = asInteger(requestUrl.searchParams.get('tasks_limit'), 8, 1, 50);
  const eventsLimit = asInteger(requestUrl.searchParams.get('events_limit'), 8, 1, 50);
  const notificationsLimit = asInteger(requestUrl.searchParams.get('notifications_limit'), 8, 1, 50);
  const unreadOnly = asBoolean(requestUrl.searchParams.get('unread'), false);
  const personalProject = personalProjectByUserStmt.get(auth.user.user_id, auth.user.user_id);
  if (!personalProject) {
    send(response, jsonResponse(500, errorEnvelope('server_error', 'Personal project is unavailable.')));
    return;
  }

  const tasks = listAssignedTasksForUser({ userId: auth.user.user_id })
    .sort((left, right) => new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime())
    .slice(0, tasksLimit);

  const notifications = (
    unreadOnly
      ? unreadNotificationsByUserStmt.all(auth.user.user_id, notificationsLimit)
      : notificationsByUserStmt.all(auth.user.user_id, notificationsLimit)
  ).map(notificationRecord);

  send(
    response,
    jsonResponse(
      200,
      okEnvelope({
        home: {
          personal_project_id: personalProject.project_id,
          tasks,
          tasks_next_cursor: null,
          events: listHomeEventsForUser({ userId: auth.user.user_id, limit: eventsLimit }),
          notifications,
        },
      }),
    ),
  );
});

const safeNextcloudConfig = () => Boolean(NEXTCLOUD_BASE_URL && NEXTCLOUD_USER && NEXTCLOUD_APP_PASSWORD);

const nextcloudAuthHeader = () =>
  `Basic ${Buffer.from(`${NEXTCLOUD_USER}:${NEXTCLOUD_APP_PASSWORD}`, 'utf8').toString('base64')}`;

const nextcloudUrl = (rootPath, relativePath) => {
  const normalizedRoot = `/${asText(rootPath).replace(/^\/+/, '').replace(/\/+$/, '')}`;
  const normalizedPath = `/${asText(relativePath).replace(/^\/+/, '')}`;
  const combined = `${normalizedRoot}${normalizedPath === '/' ? '' : normalizedPath}`;
  const encoded = combined
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `${NEXTCLOUD_BASE_URL.replace(/\/$/, '')}/remote.php/dav/files/${encodeURIComponent(NEXTCLOUD_USER)}${encoded}`;
};

const resolveProjectAssetRoot = (projectId, requestedAssetRootId = '') => {
  const requestedId = asText(requestedAssetRootId);
  if (requestedId) {
    const root = assetRootByIdStmt.get(requestedId);
    if (!root || root.project_id !== projectId) {
      return { error: { status: 404, code: 'not_found', message: 'Asset root not found.' } };
    }
    if (root.provider !== 'nextcloud') {
      return { error: { status: 400, code: 'invalid_input', message: 'Only nextcloud asset roots are supported in V1.' } };
    }
    return { root };
  }

  const root = defaultAssetRootByProjectStmt.get(projectId);
  if (!root) {
    return { error: { status: 400, code: 'asset_root_required', message: 'Create an asset root before uploading files.' } };
  }
  if (root.provider !== 'nextcloud') {
    return { error: { status: 400, code: 'invalid_input', message: 'Only nextcloud asset roots are supported in V1.' } };
  }

  return { root };
};

const uploadToNextcloud = async ({ rootPath, relativePath, mimeType, content }) => {
  if (!safeNextcloudConfig()) {
    return { error: { status: 503, code: 'nextcloud_unavailable', message: 'Nextcloud runtime credentials are not configured.' } };
  }

  const normalized = normalizeAssetRelativePath(relativePath);
  const fileSegments = normalized.split('/').filter(Boolean);
  const rootSegments = normalizeAssetRelativePath(rootPath).split('/').filter(Boolean);
  const directorySegments = [...rootSegments, ...fileSegments.slice(0, -1)];

  let currentDir = '';
  for (const segment of directorySegments) {
    currentDir = buildAssetRelativePath(currentDir, segment);
    const mkcolUrl = nextcloudUrl('/', currentDir);
    const mkcolResponse = await fetch(mkcolUrl, {
      method: 'MKCOL',
      headers: {
        Authorization: nextcloudAuthHeader(),
      },
    });

    if (![201, 301, 302, 405].includes(mkcolResponse.status)) {
      return {
        error: {
          status: 502,
          code: 'upstream_error',
          message: `Nextcloud folder create failed (${mkcolResponse.status}).`,
        },
      };
    }
  }

  const targetUrl = nextcloudUrl(rootPath, normalized);
  const upstream = await fetch(targetUrl, {
    method: 'PUT',
    headers: {
      Authorization: nextcloudAuthHeader(),
      'Content-Type': mimeType || 'application/octet-stream',
    },
    body: content,
  });

  if (![200, 201, 204].includes(upstream.status)) {
    return { error: { status: 502, code: 'upstream_error', message: `Nextcloud upload failed (${upstream.status}).` } };
  }

  return { ok: true };
};

const buildAssetProxyPath = ({ projectId, assetRootId, assetPath }) => {
  const params = new URLSearchParams();
  params.set('asset_root_id', assetRootId);
  params.set('path', assetPath);
  return `/api/hub/projects/${encodeURIComponent(projectId)}/assets/proxy?${params.toString()}`;
};

const routeDeps = {
  ALLOWED_ORIGIN,
  NEXTCLOUD_USER,
  asBoolean,
  asInteger,
  asNullableText,
  asText,
  attachmentByIdStmt,
  assetRootByIdStmt,
  assetRootsByProjectStmt,
  assignedTaskListForUser,
  automationRuleByIdStmt,
  automationRulesByProjectStmt,
  automationRunsByProjectStmt,
  buildAssetProxyPath,
  buildAssetRelativePath,
  buildHomeEventSummary,
  buildNotificationPayload,
  buildNotificationRouteContext,
  buildPersonalTaskSummaryFromRecord,
  buildSessionSummary,
  buildTaskSummaryForUser,
  capabilitiesByRecordStmt,
  capabilitySet,
  collectionByIdStmt,
  collectionByNameStmt,
  collectionSchema,
  collectionsByProjectStmt,
  commentAnchorsByDocStmt,
  commentByIdStmt,
  commentStatusSet,
  consumeCollabTicket,
  createNotification,
  createPersonalTaskRecord,
  db,
  defaultAssetRootByProjectStmt,
  deleteAttachmentStmt,
  deletePaneMemberStmt,
  deletePaneStmt,
  deleteProjectMemberStmt,
  deleteRelationStmt,
  docByIdStmt,
  emitTimelineEvent,
  encodeCursorOffset,
  ensureUserForEmail,
  errorEnvelope,
  eventStateByRecordStmt,
  extractDocNodeKeyState,
  fieldByIdStmt,
  fieldTypeSet,
  fieldsByCollectionStmt,
  filesByProjectStmt,
  findOrCreateEventsCollection,
  insertAssetRootStmt,
  insertAssignmentStmt,
  insertAttachmentStmt,
  insertAutomationRuleStmt,
  insertCommentAnchorStmt,
  insertCommentStmt,
  insertCollectionStmt,
  insertDocStmt,
  insertDocStorageStmt,
  insertEventParticipantStmt,
  insertFieldStmt,
  insertFileBlobStmt,
  insertFileStmt,
  insertPaneMemberStmt,
  insertPaneStmt,
  insertPendingInviteStmt,
  insertProjectMemberStmt,
  insertProjectStmt,
  insertRecordCapabilityStmt,
  insertRecordStmt,
  insertRelationStmt,
  insertReminderStmt,
  insertViewStmt,
  isPlainObject,
  issueCollabTicket,
  issueHubLiveTicket,
  jsonResponse,
  listProjectsForUserStmt,
  markNotificationReadStmt,
  mapMentionRowToBacklink,
  materializeMentions,
  membershipRoleLabel,
  newId,
  nextFieldSortStmt,
  nextcloudAuthHeader,
  nextcloudUrl,
  normalizeAssetPathSegment,
  normalizeAssetRelativePath,
  normalizeParticipants,
  normalizeProjectRole,
  notificationByIdStmt,
  notificationRecord,
  notificationsByUserStmt,
  nowIso,
  okEnvelope,
  paneByIdStmt,
  paneListForUserByProjectStmt,
  paneNextSortStmt,
  paneSummary,
  parseBody,
  parseCursorOffset,
  parseJson,
  parseJsonObject,
  participantsByRecordStmt,
  pendingInviteByIdStmt,
  pendingInviteRecord,
  pendingInvitesByProjectStmt,
  personalProjectByUserStmt,
  personalProjectIdForUser,
  projectByIdStmt,
  projectForMemberStmt,
  projectMembershipExistsStmt,
  projectMembershipRoleStmt,
  projectMembershipsByUserStmt,
  projectMembersByProjectStmt,
  projectOwnerCountStmt,
  projectRecord,
  recordByIdStmt,
  recordDetail,
  recordDetailForUser,
  recordSummary,
  recordsByCollectionStmt,
  relationByEdgeStmt,
  relationByIdStmt,
  relationSearchRecordsStmt,
  relationTargetCollectionIdFromField,
  remindersByRecordStmt,
  requireDocAccess,
  resolveMutationContextPaneId,
  resolveProjectAssetRoot,
  resolveProjectContentWriteGate,
  reassignTasksForRemovedMember,
  safeNextcloudConfig,
  send,
  taskStateByRecordStmt,
  timelineByProjectStmt,
  timelineRecord,
  toJson,
  trackedFileRecord,
  unreadNotificationsByUserStmt,
  updateAutomationRuleStmt,
  updateCommentStatusStmt,
  updateDocStorageStmt,
  updateDocTimestampStmt,
  updatePaneStmt,
  updatePendingInviteDecisionStmt,
  updateRecordStmt,
  updateUserStmt,
  upsertDocPresenceStmt,
  upsertEventStateStmt,
  upsertRecurrenceStmt,
  upsertRecordValueStmt,
  upsertTaskStateStmt,
  userByEmailStmt,
  valuesByRecordStmt,
  viewByIdStmt,
  viewsByProjectStmt,
  viewTypeSet,
  withAuth,
  withDocPolicyGate,
  withPanePolicyGate,
  withPolicyGate,
  withProjectPolicyGate,
  clearAssignmentsStmt,
  clearEventParticipantsStmt,
  clearRemindersStmt,
  commentsByTargetStmt,
  deleteAutomationRuleStmt,
  mentionsByTargetStmt,
  mentionSearchRecordsStmt,
  mentionSearchUsersStmt,
  uploadToNextcloud,
};

const userRoutes = createUserRoutes(routeDeps);
const projectRoutes = createProjectRoutes(routeDeps);
const paneRoutes = createPaneRoutes(routeDeps);
const docRoutes = createDocRoutes(routeDeps);
const collectionRoutes = createCollectionRoutes(routeDeps);
const viewRoutes = createViewRoutes(routeDeps);
const fileRoutes = createFileRoutes(routeDeps);
const notificationRoutes = createNotificationRoutes(routeDeps);
const taskRoutes = createTaskRoutes(routeDeps);
const automationRoutes = createAutomationRoutes(routeDeps);
const searchRoutes = createSearchRoutes(routeDeps);

const server = createServer(async (request, response) => {
  if (!request.url) {
    send(response, jsonResponse(400, errorEnvelope('bad_request', 'Missing request URL.')));
    return;
  }

  const requestUrl = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  const pathname = requestUrl.pathname;

  if (request.method === 'OPTIONS') {
    send(response, jsonResponse(204, okEnvelope(null)));
    return;
  }

  try {
    if (request.method === 'GET' && pathname === '/api/hub/health') {
      send(
        response,
        jsonResponse(
          200,
          okEnvelope({
            schema_version: 1,
            db_path: HUB_DB_PATH,
            nextcloud_configured: safeNextcloudConfig(),
            issuer: jwtVerifier.issuer,
            audience: jwtVerifier.expectedAudiences,
            jwks_url: jwtVerifier.jwksUrl,
          }),
        ),
      );
      return;
    }

    if (request.method === 'GET' && pathname === '/api/hub/me') {
      await userRoutes.getSession({ request, response, requestUrl, pathname });
      return;
    }

    if (request.method === 'GET' && pathname === '/api/hub/home') {
      await taskRoutes.getHubHome({ request, response, requestUrl, pathname });
      return;
    }

    if (pathname === '/api/hub/tasks' && request.method === 'GET') {
      await taskRoutes.getHubTasks({ request, response, requestUrl, pathname });
      return;
    }

    if (pathname === '/api/hub/tasks' && request.method === 'POST') {
      await taskRoutes.createHubTask({ request, response, requestUrl, pathname });
      return;
    }

    if (request.method === 'GET' && pathname === '/api/hub/projects') {
      await projectRoutes.listProjects({ request, response, requestUrl, pathname });
      return;
    }

    if (request.method === 'POST' && pathname === '/api/hub/projects') {
      await projectRoutes.createProject({ request, response, requestUrl, pathname });
      return;
    }

    const projectItemMatch = pathMatch(pathname, /^\/api\/hub\/projects\/([^/]+)$/);
    if (request.method === 'GET' && projectItemMatch) {
      await projectRoutes.getProject({
        request,
        response,
        requestUrl,
        pathname,
        params: { projectId: decodeURIComponent(projectItemMatch[1]) },
      });
      return;
    }

    const projectMembersMatch = pathMatch(pathname, /^\/api\/hub\/projects\/([^/]+)\/members$/);
    if (projectMembersMatch && request.method === 'GET') {
      await projectRoutes.listProjectMembers({
        request,
        response,
        requestUrl,
        pathname,
        params: { projectId: decodeURIComponent(projectMembersMatch[1]) },
      });
      return;
    }

    if (projectMembersMatch && request.method === 'POST') {
      await projectRoutes.addProjectMember({
        request,
        response,
        requestUrl,
        pathname,
        params: { projectId: decodeURIComponent(projectMembersMatch[1]) },
      });
      return;
    }

    const projectInvitesMatch = pathMatch(pathname, /^\/api\/hub\/projects\/([^/]+)\/invites$/);
    if (projectInvitesMatch && request.method === 'POST') {
      await projectRoutes.createInvite({
        request,
        response,
        requestUrl,
        pathname,
        params: { projectId: decodeURIComponent(projectInvitesMatch[1]) },
      });
      return;
    }

    const projectInviteItemMatch = pathMatch(pathname, /^\/api\/hub\/projects\/([^/]+)\/invites\/([^/]+)$/);
    if (projectInviteItemMatch && request.method === 'POST') {
      await projectRoutes.reviewInvite({
        request,
        response,
        requestUrl,
        pathname,
        params: {
          projectId: decodeURIComponent(projectInviteItemMatch[1]),
          inviteRequestId: decodeURIComponent(projectInviteItemMatch[2]),
        },
      });
      return;
    }

    const projectMemberItemMatch = pathMatch(pathname, /^\/api\/hub\/projects\/([^/]+)\/members\/([^/]+)$/);
    if (projectMemberItemMatch && request.method === 'DELETE') {
      await projectRoutes.removeProjectMember({
        request,
        response,
        requestUrl,
        pathname,
        params: {
          projectId: decodeURIComponent(projectMemberItemMatch[1]),
          targetUserId: decodeURIComponent(projectMemberItemMatch[2]),
        },
      });
      return;
    }

    const projectPanesMatch = pathMatch(pathname, /^\/api\/hub\/projects\/([^/]+)\/panes$/);
    if (projectPanesMatch && request.method === 'GET') {
      await paneRoutes.listProjectPanes({
        request,
        response,
        requestUrl,
        pathname,
        params: { projectId: decodeURIComponent(projectPanesMatch[1]) },
      });
      return;
    }

    if (projectPanesMatch && request.method === 'POST') {
      await paneRoutes.createProjectPane({
        request,
        response,
        requestUrl,
        pathname,
        params: { projectId: decodeURIComponent(projectPanesMatch[1]) },
      });
      return;
    }

    const projectTasksMatch = pathMatch(pathname, /^\/api\/hub\/projects\/([^/]+)\/tasks$/);
    if (projectTasksMatch && request.method === 'GET') {
      await taskRoutes.listProjectTasks({
        request,
        response,
        requestUrl,
        pathname,
        params: { projectId: decodeURIComponent(projectTasksMatch[1]) },
      });
      return;
    }

    const paneItemMatch = pathMatch(pathname, /^\/api\/hub\/panes\/([^/]+)$/);
    if (paneItemMatch && request.method === 'PATCH') {
      await paneRoutes.updatePane({
        request,
        response,
        requestUrl,
        pathname,
        params: { paneId: decodeURIComponent(paneItemMatch[1]) },
      });
      return;
    }

    if (paneItemMatch && request.method === 'DELETE') {
      await paneRoutes.deletePane({
        request,
        response,
        requestUrl,
        pathname,
        params: { paneId: decodeURIComponent(paneItemMatch[1]) },
      });
      return;
    }

    const paneMembersMatch = pathMatch(pathname, /^\/api\/hub\/panes\/([^/]+)\/members$/);
    if (paneMembersMatch && request.method === 'POST') {
      await paneRoutes.addPaneMember({
        request,
        response,
        requestUrl,
        pathname,
        params: { paneId: decodeURIComponent(paneMembersMatch[1]) },
      });
      return;
    }

    const paneMemberItemMatch = pathMatch(pathname, /^\/api\/hub\/panes\/([^/]+)\/members\/([^/]+)$/);
    if (paneMemberItemMatch && request.method === 'DELETE') {
      await paneRoutes.removePaneMember({
        request,
        response,
        requestUrl,
        pathname,
        params: {
          paneId: decodeURIComponent(paneMemberItemMatch[1]),
          userId: decodeURIComponent(paneMemberItemMatch[2]),
        },
      });
      return;
    }

    const docItemMatch = pathMatch(pathname, /^\/api\/hub\/docs\/([^/]+)$/);
    if (docItemMatch && request.method === 'GET') {
      await docRoutes.getDoc({
        request,
        response,
        requestUrl,
        pathname,
        params: { docId: decodeURIComponent(docItemMatch[1]) },
      });
      return;
    }

    if (docItemMatch && request.method === 'PUT') {
      await docRoutes.updateDoc({
        request,
        response,
        requestUrl,
        pathname,
        params: { docId: decodeURIComponent(docItemMatch[1]) },
      });
      return;
    }

    const docPresenceMatch = pathMatch(pathname, /^\/api\/hub\/docs\/([^/]+)\/presence$/);
    if (docPresenceMatch && request.method === 'POST') {
      await docRoutes.updateDocPresence({
        request,
        response,
        requestUrl,
        pathname,
        params: { docId: decodeURIComponent(docPresenceMatch[1]) },
      });
      return;
    }

    const collectionsByProjectMatch = pathMatch(pathname, /^\/api\/hub\/projects\/([^/]+)\/collections$/);
    if (collectionsByProjectMatch && request.method === 'GET') {
      await collectionRoutes.listCollections({
        request,
        response,
        requestUrl,
        pathname,
        params: { projectId: decodeURIComponent(collectionsByProjectMatch[1]) },
      });
      return;
    }

    if (collectionsByProjectMatch && request.method === 'POST') {
      await collectionRoutes.createCollection({
        request,
        response,
        requestUrl,
        pathname,
        params: { projectId: decodeURIComponent(collectionsByProjectMatch[1]) },
      });
      return;
    }

    const collectionFieldsMatch = pathMatch(pathname, /^\/api\/hub\/collections\/([^/]+)\/fields$/);
    if (collectionFieldsMatch && request.method === 'GET') {
      await collectionRoutes.listCollectionFields({
        request,
        response,
        requestUrl,
        pathname,
        params: { collectionId: decodeURIComponent(collectionFieldsMatch[1]) },
      });
      return;
    }

    if (collectionFieldsMatch && request.method === 'POST') {
      await collectionRoutes.createCollectionField({
        request,
        response,
        requestUrl,
        pathname,
        params: { collectionId: decodeURIComponent(collectionFieldsMatch[1]) },
      });
      return;
    }

    const projectRecordsMatch = pathMatch(pathname, /^\/api\/hub\/projects\/([^/]+)\/records$/);
    if (projectRecordsMatch && request.method === 'POST') {
      await collectionRoutes.createRecord({
        request,
        response,
        requestUrl,
        pathname,
        params: { projectId: decodeURIComponent(projectRecordsMatch[1]) },
      });
      return;
    }

    const projectRecordSearchMatch = pathMatch(pathname, /^\/api\/hub\/projects\/([^/]+)\/records\/search$/);
    if (projectRecordSearchMatch && request.method === 'GET') {
      await collectionRoutes.searchProjectRecords({
        request,
        response,
        requestUrl,
        pathname,
        params: { projectId: decodeURIComponent(projectRecordSearchMatch[1]) },
      });
      return;
    }

    const recordItemMatch = pathMatch(pathname, /^\/api\/hub\/records\/([^/]+)$/);
    if (recordItemMatch && request.method === 'PATCH') {
      await collectionRoutes.updateRecord({
        request,
        response,
        requestUrl,
        pathname,
        params: { recordId: decodeURIComponent(recordItemMatch[1]) },
      });
      return;
    }

    if (recordItemMatch && request.method === 'GET') {
      await collectionRoutes.getRecord({
        request,
        response,
        requestUrl,
        pathname,
        params: { recordId: decodeURIComponent(recordItemMatch[1]) },
      });
      return;
    }

    const recordValuesMatch = pathMatch(pathname, /^\/api\/hub\/records\/([^/]+)\/values$/);
    if (recordValuesMatch && request.method === 'POST') {
      await collectionRoutes.updateRecordValues({
        request,
        response,
        requestUrl,
        pathname,
        params: { recordId: decodeURIComponent(recordValuesMatch[1]) },
      });
      return;
    }

    const recordRelationsMatch = pathMatch(pathname, /^\/api\/hub\/records\/([^/]+)\/relations$/);
    if (recordRelationsMatch && request.method === 'POST') {
      await collectionRoutes.createRecordRelation({
        request,
        response,
        requestUrl,
        pathname,
        params: { recordId: decodeURIComponent(recordRelationsMatch[1]) },
      });
      return;
    }

    const relationItemMatch = pathMatch(pathname, /^\/api\/hub\/relations\/([^/]+)$/);
    if (relationItemMatch && request.method === 'DELETE') {
      await collectionRoutes.deleteRelation({
        request,
        response,
        requestUrl,
        pathname,
        params: { relationId: decodeURIComponent(relationItemMatch[1]) },
      });
      return;
    }

    const projectMentionSearchMatch = pathMatch(pathname, /^\/api\/hub\/projects\/([^/]+)\/mentions\/search$/);
    if (projectMentionSearchMatch && request.method === 'GET') {
      await collectionRoutes.searchMentions({
        request,
        response,
        requestUrl,
        pathname,
        params: { projectId: decodeURIComponent(projectMentionSearchMatch[1]) },
      });
      return;
    }

    const projectBacklinksMatch = pathMatch(pathname, /^\/api\/hub\/projects\/([^/]+)\/backlinks$/);
    if (projectBacklinksMatch && request.method === 'GET') {
      await collectionRoutes.listBacklinks({
        request,
        response,
        requestUrl,
        pathname,
        params: { projectId: decodeURIComponent(projectBacklinksMatch[1]) },
      });
      return;
    }

    const projectViewsMatch = pathMatch(pathname, /^\/api\/hub\/projects\/([^/]+)\/views$/);
    if (projectViewsMatch && request.method === 'GET') {
      await viewRoutes.listViews({
        request,
        response,
        requestUrl,
        pathname,
        params: { projectId: decodeURIComponent(projectViewsMatch[1]) },
      });
      return;
    }

    if (projectViewsMatch && request.method === 'POST') {
      await viewRoutes.createView({
        request,
        response,
        requestUrl,
        pathname,
        params: { projectId: decodeURIComponent(projectViewsMatch[1]) },
      });
      return;
    }

    if (request.method === 'POST' && pathname === '/api/hub/views/query') {
      await viewRoutes.queryView({ request, response, requestUrl, pathname });
      return;
    }

    const eventFromNlpMatch = pathMatch(pathname, /^\/api\/hub\/projects\/([^/]+)\/events\/from-nlp$/);
    if (eventFromNlpMatch && request.method === 'POST') {
      await viewRoutes.createEventFromNlp({
        request,
        response,
        requestUrl,
        pathname,
        params: { projectId: decodeURIComponent(eventFromNlpMatch[1]) },
      });
      return;
    }

    const projectCalendarMatch = pathMatch(pathname, /^\/api\/hub\/projects\/([^/]+)\/calendar$/);
    if (projectCalendarMatch && request.method === 'GET') {
      await viewRoutes.listProjectCalendar({
        request,
        response,
        requestUrl,
        pathname,
        params: { projectId: decodeURIComponent(projectCalendarMatch[1]) },
      });
      return;
    }

    if (request.method === 'POST' && pathname === '/api/hub/comments') {
      await docRoutes.createComment({ request, response, requestUrl, pathname });
      return;
    }

    if (request.method === 'POST' && pathname === '/api/hub/comments/doc-anchor') {
      await docRoutes.createDocAnchorComment({ request, response, requestUrl, pathname });
      return;
    }

    const commentStatusMatch = pathMatch(pathname, /^\/api\/hub\/comments\/([^/]+)\/status$/);
    if (commentStatusMatch && request.method === 'POST') {
      await docRoutes.updateCommentStatus({
        request,
        response,
        requestUrl,
        pathname,
        params: { commentId: decodeURIComponent(commentStatusMatch[1]) },
      });
      return;
    }

    if (request.method === 'GET' && pathname === '/api/hub/comments') {
      await docRoutes.listComments({ request, response, requestUrl, pathname });
      return;
    }

    if (request.method === 'POST' && pathname === '/api/hub/mentions/materialize') {
      await docRoutes.materializeCommentMentions({ request, response, requestUrl, pathname });
      return;
    }

    const projectTimelineMatch = pathMatch(pathname, /^\/api\/hub\/projects\/([^/]+)\/timeline$/);
    if (projectTimelineMatch && request.method === 'GET') {
      await viewRoutes.listProjectTimeline({
        request,
        response,
        requestUrl,
        pathname,
        params: { projectId: decodeURIComponent(projectTimelineMatch[1]) },
      });
      return;
    }

    if (request.method === 'GET' && pathname === '/api/hub/notifications') {
      await notificationRoutes.listNotifications({ request, response, requestUrl, pathname });
      return;
    }

    if (request.method === 'GET' && pathname === '/api/hub/live/authorize') {
      await notificationRoutes.authorizeHubLive({ request, response, requestUrl, pathname });
      return;
    }

    const notificationReadMatch = pathMatch(pathname, /^\/api\/hub\/notifications\/([^/]+)\/read$/);
    if (notificationReadMatch && request.method === 'POST') {
      await notificationRoutes.markNotificationRead({
        request,
        response,
        requestUrl,
        pathname,
        params: {
          notificationId: decodeURIComponent(notificationReadMatch[1]),
        },
      });
      return;
    }

    if (request.method === 'POST' && pathname === '/api/hub/files/upload') {
      await fileRoutes.uploadFile({ request, response, requestUrl, pathname });
      return;
    }

    if (request.method === 'POST' && pathname === '/api/hub/attachments') {
      await fileRoutes.createAttachment({ request, response, requestUrl, pathname });
      return;
    }

    const attachmentItemMatch = pathMatch(pathname, /^\/api\/hub\/attachments\/([^/]+)$/);
    if (attachmentItemMatch && request.method === 'DELETE') {
      await fileRoutes.deleteAttachment({
        request,
        response,
        requestUrl,
        pathname,
        params: { attachmentId: decodeURIComponent(attachmentItemMatch[1]) },
      });
      return;
    }

    const projectAssetRootsMatch = pathMatch(pathname, /^\/api\/hub\/projects\/([^/]+)\/asset-roots$/);
    if (projectAssetRootsMatch && request.method === 'GET') {
      await fileRoutes.listAssetRoots({
        request,
        response,
        requestUrl,
        pathname,
        params: { projectId: decodeURIComponent(projectAssetRootsMatch[1]) },
      });
      return;
    }

    if (projectAssetRootsMatch && request.method === 'POST') {
      await fileRoutes.createAssetRoot({
        request,
        response,
        requestUrl,
        pathname,
        params: { projectId: decodeURIComponent(projectAssetRootsMatch[1]) },
      });
      return;
    }

    const projectFilesMatch = pathMatch(pathname, /^\/api\/hub\/projects\/([^/]+)\/files$/);
    if (projectFilesMatch && request.method === 'GET') {
      await fileRoutes.listProjectFiles({
        request,
        response,
        requestUrl,
        pathname,
        params: { projectId: decodeURIComponent(projectFilesMatch[1]) },
      });
      return;
    }

    const projectAssetsListMatch = pathMatch(pathname, /^\/api\/hub\/projects\/([^/]+)\/assets\/list$/);
    if (projectAssetsListMatch && request.method === 'GET') {
      await fileRoutes.listAssets({
        request,
        response,
        requestUrl,
        pathname,
        params: { projectId: decodeURIComponent(projectAssetsListMatch[1]) },
      });
      return;
    }

    const projectAssetsUploadMatch = pathMatch(pathname, /^\/api\/hub\/projects\/([^/]+)\/assets\/upload$/);
    if (projectAssetsUploadMatch && request.method === 'POST') {
      await fileRoutes.uploadAsset({
        request,
        response,
        requestUrl,
        pathname,
        params: { projectId: decodeURIComponent(projectAssetsUploadMatch[1]) },
      });
      return;
    }

    const projectAssetsDeleteMatch = pathMatch(pathname, /^\/api\/hub\/projects\/([^/]+)\/assets\/delete$/);
    if (projectAssetsDeleteMatch && request.method === 'DELETE') {
      await fileRoutes.deleteAsset({
        request,
        response,
        requestUrl,
        pathname,
        params: { projectId: decodeURIComponent(projectAssetsDeleteMatch[1]) },
      });
      return;
    }

    const projectAssetsProxyMatch = pathMatch(pathname, /^\/api\/hub\/projects\/([^/]+)\/assets\/proxy$/);
    if (projectAssetsProxyMatch && request.method === 'GET') {
      await fileRoutes.proxyAsset({
        request,
        response,
        requestUrl,
        pathname,
        params: { projectId: decodeURIComponent(projectAssetsProxyMatch[1]) },
      });
      return;
    }

    const projectAutomationRulesMatch = pathMatch(pathname, /^\/api\/hub\/projects\/([^/]+)\/automation-rules$/);
    if (projectAutomationRulesMatch && request.method === 'GET') {
      await automationRoutes.listProjectAutomationRules({
        request,
        response,
        requestUrl,
        pathname,
        params: { projectId: decodeURIComponent(projectAutomationRulesMatch[1]) },
      });
      return;
    }

    if (projectAutomationRulesMatch && request.method === 'POST') {
      await automationRoutes.createAutomationRule({
        request,
        response,
        requestUrl,
        pathname,
        params: { projectId: decodeURIComponent(projectAutomationRulesMatch[1]) },
      });
      return;
    }

    const automationRuleItemMatch = pathMatch(pathname, /^\/api\/hub\/automation-rules\/([^/]+)$/);
    if (automationRuleItemMatch && request.method === 'PATCH') {
      await automationRoutes.updateAutomationRule({
        request,
        response,
        requestUrl,
        pathname,
        params: { ruleId: decodeURIComponent(automationRuleItemMatch[1]) },
      });
      return;
    }

    if (automationRuleItemMatch && request.method === 'DELETE') {
      await automationRoutes.deleteAutomationRule({
        request,
        response,
        requestUrl,
        pathname,
        params: { ruleId: decodeURIComponent(automationRuleItemMatch[1]) },
      });
      return;
    }

    const projectAutomationRunsMatch = pathMatch(pathname, /^\/api\/hub\/projects\/([^/]+)\/automation-runs$/);
    if (projectAutomationRunsMatch && request.method === 'GET') {
      await automationRoutes.listAutomationRuns({
        request,
        response,
        requestUrl,
        pathname,
        params: { projectId: decodeURIComponent(projectAutomationRunsMatch[1]) },
      });
      return;
    }

    if (request.method === 'GET' && pathname === '/api/hub/collab/authorize') {
      await docRoutes.authorizeCollab({ request, response, requestUrl, pathname });
      return;
    }

    if (request.method === 'POST' && pathname === '/api/hub/collab/tickets/consume') {
      await docRoutes.consumeCollab({ request, response, requestUrl, pathname });
      return;
    }

    send(response, jsonResponse(404, errorEnvelope('not_found', 'Endpoint not found.')));
  } catch (error) {
    send(
      response,
      jsonResponse(
        500,
        errorEnvelope('internal_error', error instanceof Error ? error.message : 'Internal server error.'),
      ),
    );
  }
});

server.on('upgrade', (request, socket, head) => {
  const rejectUpgrade = (statusCode, reasonPhrase) => {
    socket.write(`HTTP/1.1 ${statusCode} ${reasonPhrase}\r\nConnection: close\r\n\r\n`);
    socket.destroy();
  };

  try {
    const requestUrl = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    if (requestUrl.pathname !== '/api/hub/live') {
      socket.destroy();
      return;
    }

    const wsTicket = asText(requestUrl.searchParams.get('ws_ticket'));
    if (!wsTicket) {
      rejectUpgrade(400, 'Bad Request');
      return;
    }

    const consumed = consumeHubLiveTicket({ wsTicket });
    if (consumed.error) {
      rejectUpgrade(consumed.error.status, consumed.error.status === 401 ? 'Unauthorized' : 'Forbidden');
      return;
    }

    hubLiveWss.handleUpgrade(request, socket, head, (ws) => {
      hubLiveWss.emit('connection', ws, request, consumed.ticket);
    });
  } catch {
    socket.destroy();
  }
});

server.listen(PORT, '0.0.0.0', () => {
  // eslint-disable-next-line no-console
  console.log(`Hub API contract server listening on ${PORT}`);
});
