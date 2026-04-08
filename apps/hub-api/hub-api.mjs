import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from 'node:crypto';
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { URL } from 'node:url';
import { WebSocketServer } from 'ws';
import { createJwksVerifier } from '../shared/jwksVerifier.mjs';
import { runMigrations } from './db/migrations.mjs';
import { initSearch } from './db/search-setup.mjs';
import { initSchema } from './db/schema.mjs';
import { createStatements } from './db/statements.mjs';
import { withTransaction } from './db/transaction.mjs';
import { createAuthHelpers } from './helpers/auth.mjs';
import { createCalendarFeedTokenHelpers } from './helpers/calendarFeedToken.mjs';
import { createPermissionHelpers } from './helpers/permissions.mjs';
import { createValidationHelpers } from './helpers/validation.mjs';
import { createRequestLogger } from './lib/logger.mjs';
import { applyRequestContext } from './lib/requestContext.mjs';
import { fetchWithTimeout, isFetchTimeoutError } from './lib/fetch-utils.mjs';
import { createKeycloakIntegration } from './integrations/keycloak.mjs';
import { createPostmarkIntegration } from './integrations/postmark.mjs';
import { createAutomationRoutes } from './routes/automation.mjs';
import { createChatRoutes } from './routes/chat.mjs';
import { createCollectionRoutes } from './routes/collections.mjs';
import { createDocRoutes } from './routes/docs.mjs';
import { createFileRoutes } from './routes/files.mjs';
import { createNotificationRoutes } from './routes/notifications.mjs';
import { createPaneRoutes } from './routes/panes.mjs';
import { createProjectRoutes } from './routes/projects.mjs';
import { createRecordRoutes } from './routes/records.mjs';
import { createReminderRoutes } from './routes/reminders.mjs';
import { createSearchRoutes } from './routes/search.mjs';
import { createTaskRoutes } from './routes/tasks.mjs';
import { createUserRoutes } from './routes/users.mjs';
import { createViewRoutes } from './routes/views.mjs';

const PORT = Number(process.env.PORT || '3001');
const HUB_DB_PATH = process.env.HUB_DB_PATH || '/data/hub.sqlite';
const ALLOWED_ORIGIN = process.env.POSTMARK_ALLOWED_ORIGIN || '*';
const KEYCLOAK_ISSUER = (process.env.KEYCLOAK_ISSUER || '').trim();
const KEYCLOAK_AUDIENCE = (process.env.KEYCLOAK_AUDIENCE || '').trim();
const KEYCLOAK_JWKS_CACHE_MAX_AGE_MS = Number(process.env.KEYCLOAK_JWKS_CACHE_MAX_AGE_MS || '600000');
const NEXTCLOUD_BASE_URL = (process.env.NEXTCLOUD_BASE_URL || '').trim();
const NEXTCLOUD_USER = (process.env.NEXTCLOUD_USER || '').trim();
const NEXTCLOUD_APP_PASSWORD = (process.env.NEXTCLOUD_APP_PASSWORD || '').trim();
const NEXTCLOUD_FETCH_TIMEOUT_MS_RAW = Number.parseInt(String(process.env.NEXTCLOUD_FETCH_TIMEOUT_MS || '30000'), 10);
const HUB_COLLAB_TICKET_TTL_MS_RAW = Number.parseInt(String(process.env.HUB_COLLAB_TICKET_TTL_MS || '120000'), 10);
const TUWUNEL_INTERNAL_URL = (process.env.TUWUNEL_INTERNAL_URL || 'http://tuwunel:6167').trim() || 'http://tuwunel:6167';
const TUWUNEL_REGISTRATION_SHARED_SECRET = (process.env.TUWUNEL_REGISTRATION_SHARED_SECRET || '').trim();
const MATRIX_ACCOUNT_ENCRYPTION_KEY = (process.env.MATRIX_ACCOUNT_ENCRYPTION_KEY || '').trim();
const HUB_CALENDAR_FEED_TOKEN_SECRET = (process.env.HUB_CALENDAR_FEED_TOKEN_SECRET || MATRIX_ACCOUNT_ENCRYPTION_KEY || '').trim();
const HUB_API_MAX_BODY_BYTES_RAW = Number.parseInt(String(process.env.HUB_API_MAX_BODY_BYTES || '1048576'), 10);
const HUB_API_LARGE_BODY_MAX_BYTES_RAW = Number.parseInt(String(process.env.HUB_API_LARGE_BODY_MAX_BYTES || '52428800'), 10);
const POSTMARK_SERVER_TOKEN = (process.env.POSTMARK_SERVER_TOKEN || '').trim();
const POSTMARK_FROM_EMAIL = (process.env.POSTMARK_FROM_EMAIL || process.env.VITE_POSTMARK_FROM_EMAIL || '').trim();
const POSTMARK_MESSAGE_STREAM = (process.env.POSTMARK_MESSAGE_STREAM || 'outbound').trim() || 'outbound';
const POSTMARK_API_BASE_URL = (process.env.POSTMARK_API_BASE_URL || 'https://api.postmarkapp.com').trim().replace(/\/+$/, '');
const EXTERNAL_API_TIMEOUT_MS_RAW = Number.parseInt(String(process.env.POSTMARK_REQUEST_TIMEOUT_MS || '15000'), 10);
const KEYCLOAK_URL = (process.env.KEYCLOAK_URL || process.env.VITE_KEYCLOAK_URL || '').trim().replace(/\/+$/, '');
const KEYCLOAK_REALM = (process.env.KEYCLOAK_REALM || process.env.VITE_KEYCLOAK_REALM || '').trim();
const KEYCLOAK_CLIENT_ID = (process.env.KEYCLOAK_CLIENT_ID || process.env.VITE_KEYCLOAK_CLIENT_ID || '').trim();
const KEYCLOAK_REDIRECT_URI = (process.env.KEYCLOAK_REDIRECT_URI || process.env.VITE_KEYCLOAK_REDIRECT_URI || '').trim();
const KEYCLOAK_ADMIN_USERNAME = (process.env.KEYCLOAK_ADMIN_USERNAME || '').trim();
const KEYCLOAK_ADMIN_PASSWORD = (process.env.KEYCLOAK_ADMIN_PASSWORD || '').trim();
const KEYCLOAK_INVITE_ACTION_LIFESPAN_SECONDS_RAW = Number.parseInt(String(process.env.KEYCLOAK_INVITE_ACTION_LIFESPAN_SECONDS || '604800'), 10);
const MATRIX_HOMESERVER_URL = 'https://chat.eshaansood.org';
const MATRIX_SERVER_NAME = 'chat.eshaansood.org';
const MATRIX_ACCOUNT_SECRET_VERSION = 'v1';
const WS_READY_STATE_OPEN = 1;
const REMINDER_CHECK_INTERVAL_MS = 30_000;
const HUB_PUBLIC_APP_URL = (process.env.HUB_PUBLIC_APP_URL || 'https://eshaansood.org').trim().replace(/\/+$/, '');
const APP_VERSION = process.env.npm_package_version || 'unknown';
const NODE_ENVIRONMENT = (process.env.NODE_ENV || 'development').trim().toLowerCase() || 'development';
const REGISTERED_ROUTE_COUNT = 79;
const systemLog = createRequestLogger('system', 'SYSTEM', '/system', 'system');

const {
  nowIso,
  asText,
  asNullableText,
  asInteger,
  asBoolean,
  parseJson,
  parseJsonObject,
  parseUpstreamJson,
  toJson,
  okEnvelope,
  errorEnvelope,
  jsonResponse,
  send,
  parseBody,
} = createValidationHelpers({
  ALLOWED_ORIGIN,
  HUB_API_MAX_BODY_BYTES_RAW,
  HUB_API_LARGE_BODY_MAX_BYTES_RAW,
  systemLog,
});


const safeTuwunelConfig = () =>
  Boolean(TUWUNEL_INTERNAL_URL && TUWUNEL_REGISTRATION_SHARED_SECRET && MATRIX_ACCOUNT_ENCRYPTION_KEY);

const matrixAccountEncryptionKey = () => {
  const raw = asText(MATRIX_ACCOUNT_ENCRYPTION_KEY);
  return raw ? createHash('sha256').update(raw, 'utf8').digest() : null;
};

const encryptMatrixAccountSecret = (value) => {
  const key = matrixAccountEncryptionKey();
  const plaintext = asText(value);
  if (!key || !plaintext) {
    return '';
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [
    MATRIX_ACCOUNT_SECRET_VERSION,
    iv.toString('base64url'),
    authTag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join('.');
};

const decryptMatrixAccountSecret = (value) => {
  const key = matrixAccountEncryptionKey();
  const raw = asText(value);
  if (!key || !raw) {
    throw new Error('Matrix account secret is unavailable.');
  }

  const [version, ivRaw, authTagRaw, ciphertextRaw] = raw.split('.');
  if (version !== MATRIX_ACCOUNT_SECRET_VERSION || !ivRaw || !authTagRaw || !ciphertextRaw) {
    throw new Error('Matrix account secret format is invalid.');
  }

  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivRaw, 'base64url'));
  decipher.setAuthTag(Buffer.from(authTagRaw, 'base64url'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextRaw, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
  if (!plaintext) {
    throw new Error('Matrix account secret is empty.');
  }
  return plaintext;
};

if (!safeTuwunelConfig()) {
  systemLog.warn('Matrix chat provisioning is disabled until TUWUNEL_REGISTRATION_SHARED_SECRET and MATRIX_ACCOUNT_ENCRYPTION_KEY are configured.');
}

const HUB_COLLAB_TICKET_TTL_MS = asInteger(HUB_COLLAB_TICKET_TTL_MS_RAW, 120_000, 5_000, 3_600_000);
const EXTERNAL_API_TIMEOUT_MS = asInteger(EXTERNAL_API_TIMEOUT_MS_RAW, 15_000, 1_000, 120_000);
const KEYCLOAK_INVITE_ACTION_LIFESPAN_SECONDS = asInteger(KEYCLOAK_INVITE_ACTION_LIFESPAN_SECONDS_RAW, 604_800, 300, 2_592_000);
const KEYCLOAK_REQUIRED_INVITE_ACTIONS = Object.freeze(['VERIFY_EMAIL', 'UPDATE_PROFILE', 'UPDATE_PASSWORD']);

const NEXTCLOUD_FETCH_TIMEOUT_MS = asInteger(NEXTCLOUD_FETCH_TIMEOUT_MS_RAW, 30_000, 1_000, 300_000);

const {
  ensureKeycloakInviteOnboarding,
  cleanupKeycloakInviteOnboarding,
} = createKeycloakIntegration({
  KEYCLOAK_URL,
  KEYCLOAK_REALM,
  KEYCLOAK_CLIENT_ID,
  KEYCLOAK_REDIRECT_URI,
  KEYCLOAK_ADMIN_USERNAME,
  KEYCLOAK_ADMIN_PASSWORD,
  KEYCLOAK_INVITE_ACTION_LIFESPAN_SECONDS,
  KEYCLOAK_REQUIRED_INVITE_ACTIONS,
  HUB_PUBLIC_APP_URL,
  EXTERNAL_API_TIMEOUT_MS,
  asText,
  fetchWithTimeout,
  isFetchTimeoutError,
  parseUpstreamJson,
});

const { sendHubInviteEmail } = createPostmarkIntegration({
  POSTMARK_SERVER_TOKEN,
  POSTMARK_FROM_EMAIL,
  POSTMARK_MESSAGE_STREAM,
  POSTMARK_API_BASE_URL,
  EXTERNAL_API_TIMEOUT_MS,
  HUB_PUBLIC_APP_URL,
  asText,
  fetchWithTimeout,
  isFetchTimeoutError,
  parseUpstreamJson,
});

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

const db = new DatabaseSync(HUB_DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');
initSchema(db);
runMigrations(db);
initSearch(db);

const newId = (prefix) => `${prefix}_${randomUUID()}`;

const stmts = createStatements(db);

const {
  users: {
    findBySub: userByKcSubStmt,
    findById: userByIdStmt,
    findByEmail: userByEmailStmt,
    insert: insertUserStmt,
    update: updateUserStmt,
  },
  calendarFeedTokens: {
    findByUserId: calendarFeedTokenByUserIdStmt,
    findByToken: calendarFeedTokenByTokenStmt,
    insert: insertCalendarFeedTokenStmt,
  },
  projects: {
    updateTasksCollection: updateProjectTasksCollectionStmt,
    updateRemindersCollection: updateProjectRemindersCollectionStmt,
    findById: projectByIdStmt,
    findPersonalProject: personalProjectByUserStmt,
    listPersonalMissingTasksCollectionIds: personalProjectsMissingTasksCollectionIdStmt,
    listPersonalMissingRemindersCollectionIds: personalProjectsMissingRemindersCollectionIdStmt,
    insertWithType: insertProjectWithTypeStmt,
  },
  projectMembers: {
    listForUser: projectMembershipsByUserStmt,
    insert: insertProjectMemberStmt,
    isMember: projectMembershipExistsStmt,
    getRole: projectMembershipRoleStmt,
  },
  panes: {
    findById: paneByIdStmt,
    listMembers: paneMembersStmt,
    insert: insertPaneStmt,
  },
  paneMembers: {
    isMember: paneEditorExistsStmt,
  },
  docs: {
    findByPaneId: paneDocByPaneStmt,
    findDocProject: paneForDocStmt,
    insert: insertDocStmt,
    insertStorage: insertDocStorageStmt,
  },
  collections: {
    findById: collectionByIdStmt,
    findByName: collectionByNameStmt,
    insert: insertCollectionStmt,
    listFields: fieldsByCollectionStmt,
    insertField: insertFieldStmt,
  },
  records: {
    findById: recordByIdStmt,
    insert: insertRecordStmt,
  },
  recordValues: {
    upsert: upsertRecordValueStmt,
    listForRecord: valuesByRecordStmt,
  },
  recordRelations: {
    listForward: outgoingRelationsStmt,
    listReverse: incomingRelationsStmt,
  },
  recordCapabilities: {
    insertIgnore: insertRecordCapabilityStmt,
    listForRecord: capabilitiesByRecordStmt,
  },
  tasks: {
    upsertState: upsertTaskStateStmt,
    findState: taskStateByRecordStmt,
    listSubtasksByParent: subtasksByParentStmt,
    countSubtasksByParent: subtaskCountByParentStmt,
    insertAssignment: insertAssignmentStmt,
    listAssignments: assignmentsByRecordStmt,
    listAssignedForUserInProject: assignedTasksByUserInProjectStmt,
    deleteAssignment: deleteAssignmentStmt,
  },
  calendar: {
    findEventState: eventStateByRecordStmt,
    listParticipants: participantsByRecordStmt,
    findRecurrence: recurrenceByRecordStmt,
    listReminders: remindersByRecordStmt,
  },
  reminders: {
    listDue: dueRemindersStmt,
    claimFired: claimReminderFiredStmt,
  },
  files: {
    listAttachmentsForEntity: attachmentsByEntityStmt,
  },
  assetRoots: {
    findDefaultForProject: defaultAssetRootByProjectStmt,
    insert: insertAssetRootStmt,
    findById: assetRootByIdStmt,
  },
  comments: {
    findById: commentByIdStmt,
    listForEntity: commentsByTargetStmt,
  },
  commentAnchors: {
    findByCommentId: commentAnchorByCommentIdStmt,
  },
  mentions: {
    insert: insertMentionStmt,
    listForSource: mentionsBySourceStmt,
    delete: deleteMentionByIdStmt,
    updateContext: updateMentionContextStmt,
  },
  timeline: {
    insert: insertTimelineStmt,
    listForEntity: timelineByPrimaryEntityStmt,
  },
  notifications: {
    insert: insertNotificationStmt,
  },
} = stmts;

const {
  fieldTypeSet,
  viewTypeSet,
  capabilitySet,
  commentStatusSet,
  notificationReasons,
  notificationReasonSet,
  ownerProjectCapabilities,
  collaboratorProjectCapabilities,
  globalCapabilitiesBySessionRole,
  authenticatedGlobalCapabilities,
  sessionRolePriority,
  normalizeProjectRole,
  membershipRoleLabel,
  withProjectPolicyGate,
  withPanePolicyGate,
  withDocPolicyGate,
  requireDocAccess,
} = createPermissionHelpers({
  asText,
  projectMembershipRoleStmt,
  paneByIdStmt,
  paneEditorExistsStmt,
  paneForDocStmt,
});

const {
  parseBearerToken,
  parseCursorOffset,
  encodeCursorOffset,
  buildSessionSummary,
} = createAuthHelpers({
  asText,
  systemLog,
  projectMembershipsByUserStmt,
  membershipRoleLabel,
  collaboratorProjectCapabilities,
  ownerProjectCapabilities,
  sessionRolePriority,
  authenticatedGlobalCapabilities,
  globalCapabilitiesBySessionRole,
});

const {
  getOrCreateCalendarFeedToken,
  buildCalendarFeedUrl,
  findCalendarFeedTokenRecord,
} = createCalendarFeedTokenHelpers({
  HUB_CALENDAR_FEED_TOKEN_SECRET,
  HUB_PUBLIC_APP_URL,
  asText,
  nowIso,
  db,
  withTransaction,
  calendarFeedTokenByUserIdStmt,
  calendarFeedTokenByTokenStmt,
  insertCalendarFeedTokenStmt,
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
  } catch (error) {
    systemLog.warn('Hub live socket send failed (best-effort).', { error });
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

const broadcastTaskChanged = (record, userId) => {
  const normalizedUserId = asText(userId);
  if (!record || !normalizedUserId) {
    return;
  }
  broadcastHubLiveToUser(normalizedUserId, {
    type: 'task.changed',
    task: buildTaskSummaryForUser(record, personalProjectIdForUser(normalizedUserId)),
  });
};

const broadcastReminderChanged = (reminder, userId) => {
  const normalizedUserId = asText(userId);
  if (!reminder || !normalizedUserId) {
    return;
  }
  const reminderId = asText(reminder.reminder_id);
  const recordId = asText(reminder.record_id);
  const projectId = asText(reminder.project_id) || null;
  const action = asText(reminder.action);
  if (!reminderId || !recordId || (action !== 'created' && action !== 'dismissed')) {
    return;
  }
  broadcastHubLiveToUser(normalizedUserId, {
    type: 'reminder.changed',
    reminder: {
      reminder_id: reminderId,
      record_id: recordId,
      project_id: projectId,
      action,
    },
  });
};

// Hub Live WebSocket — network notification relay
// Carries lightweight real-time signals to the client when server-side events occur.
// Payload is always small JSON — "something happened, go fetch details from the REST API."
// This is NOT a document sync channel. Latency tolerance is high.
// In the Tauri/local-first model this relay remains server-side because network notifications
// originate from other users' actions and require a central relay point.
// Client-local notifications still do not travel through this channel; only server-authored
// network notifications are broadcast to connected clients.
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

const ensureUserFromRequest = async (request) => {
  const token = parseBearerToken(request);
  if (!token) {
    return { status: 401, code: 'unauthorized', message: 'Missing bearer token.' };
  }

  let verification;
  try {
    verification = await jwtVerifier.verifyToken(token);
  } catch (error) {
    request.log?.warn?.('Bearer token verification failed.', { error });
    return {
      status: 401,
      code: 'unauthorized',
      message: 'Invalid token.',
    };
  }

  const claims = verification.claims;

  const kcSub = asText(claims.sub);
  if (!kcSub) {
    request.log?.warn?.('Bearer token missing subject claim.');
    return { status: 401, code: 'unauthorized', message: 'Invalid token.' };
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
      request.log?.error?.('Failed to persist newly authenticated user.', {
        userId,
        kcSub,
        error,
      });
      throw error;
    }
    try {
      getOrCreateCalendarFeedToken(userId);
    } catch (error) {
      request.log?.warn?.('Failed to create calendar feed token for newly authenticated user.', {
        userId,
        error,
      });
    }
    return {
      status: 200,
      token,
      claims,
      user: userByIdStmt.get(userId),
    };
  }

  updateUserStmt.run(displayName, email, nowIso(), existing.user_id);
  return {
    status: 200,
    token,
    claims,
    user: userByIdStmt.get(existing.user_id),
  };
};

const projectRecord = (row) => ({
  project_id: row.project_id,
  name: row.name,
  created_by: row.created_by,
  created_at: row.created_at,
  updated_at: row.updated_at,
  is_personal: Number(row.is_personal || 0) === 1 || asText(row.project_type).toLowerCase() === 'personal',
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
    parent_record_id: record.parent_record_id || null,
    subtask_count: subtaskCountByParentStmt.get(record.record_id)?.count ?? 0,
    title: record.title,
    schema,
    values,
    capabilities: {
      capability_types: [...capabilityTypes],
      task_state: task
        ? {
            status: task.status,
            priority: task.priority,
            due_at: task.due_at,
            category: task.category || null,
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
  try {
    getOrCreateCalendarFeedToken(userId);
  } catch (error) {
    systemLog.warn('Failed to create calendar feed token for ensured user.', {
      userId,
      error,
    });
  }
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
    created_at: record.created_at,
    updated_at: record.updated_at,
    subtask_count: subtaskCountByParentStmt.get(record.record_id)?.count ?? 0,
    task_state: task
      ? {
          status: task.status,
          priority: task.priority,
          due_at: task.due_at,
          category: task.category || null,
          completed_at: task.completed_at,
          updated_at: task.updated_at,
        }
      : {
          status: 'todo',
          priority: null,
          due_at: null,
          category: null,
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
  const project = projectByIdStmt.get(record.project_id);
  const task = taskStateByRecordStmt.get(record.record_id);
  return {
    record_id: record.record_id,
    project_id: record.project_id,
    project_name: project?.name || null,
    collection_id: 'personal',
    collection_name: 'Personal',
    title: record.title,
    created_at: record.created_at,
    updated_at: record.updated_at,
    subtask_count: subtaskCountByParentStmt.get(record.record_id)?.count ?? 0,
    task_state: {
      status: task?.status || 'todo',
      priority: task?.priority || null,
      due_at: task?.due_at || null,
      category: task?.category || null,
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
  dueAt = null,
  category = null,
  createdAt,
  updatedAt,
}) => {
  const recordId = newId('rec');
  const timestampCreatedAt = asText(createdAt) || nowIso();
  const timestampUpdatedAt = asText(updatedAt) || timestampCreatedAt;
  const normalizedStatus = asText(status) || 'todo';
  const normalizedPriority = asNullableText(priority);
  const normalizedDueAt = asNullableText(dueAt);
  const normalizedCategory = asNullableText(category);
  const fields = taskFieldMapForCollection(collectionId);

  insertRecordStmt.run(recordId, projectId, collectionId, title, userId, timestampCreatedAt, timestampUpdatedAt, null);
  insertRecordCapabilityStmt.run(recordId, 'task', timestampCreatedAt);
  upsertTaskStateStmt.run(
    recordId,
    normalizedStatus,
    normalizedPriority,
    normalizedDueAt,
    normalizedCategory,
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
  const remindersCollectionId = newId('col');
  const paneId = newId('pan');
  const docId = newId('doc');
  const assetRootId = newId('ast');
  const titleFieldId = newId('fld');
  const statusFieldId = newId('fld');
  const priorityFieldId = newId('fld');

  insertProjectWithTypeStmt.run(projectId, `${displayName}'s Hub`, user.user_id, 'personal', 1, now, now);
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
  insertCollectionStmt.run(remindersCollectionId, projectId, 'Reminders', null, null, now, now);
  updateProjectRemindersCollectionStmt.run(remindersCollectionId, now, projectId);
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
    systemLog.error('Failed to ensure personal project for user.', {
      userId: user?.user_id,
      error,
    });
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
    systemLog.error('Failed to backfill personal tasks collection ids.', { error });
    throw error;
  }
};
ensurePersonalProjectTasksCollectionIds();

const ensurePersonalProjectRemindersCollectionIds = () => {
  const projects = personalProjectsMissingRemindersCollectionIdStmt.all();
  if (projects.length === 0) {
    return;
  }

  const now = nowIso();
  db.exec('BEGIN');
  try {
    for (const project of projects) {
      const remindersCollection = collectionByNameStmt.get(project.project_id, 'Reminders');
      if (!remindersCollection) {
        const remindersCollectionId = newId('col');
        insertCollectionStmt.run(remindersCollectionId, project.project_id, 'Reminders', null, null, now, now);
        updateProjectRemindersCollectionStmt.run(remindersCollectionId, now, project.project_id);
        continue;
      }
      updateProjectRemindersCollectionStmt.run(remindersCollection.collection_id, now, project.project_id);
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    systemLog.error('Failed to backfill personal reminders collection ids.', { error });
    throw error;
  }
};
ensurePersonalProjectRemindersCollectionIds();

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
        reason: notificationReasons[0],
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

const pathMatch = (pathname, regex) => pathname.match(regex);

const withAuth = async (request) => {
  const identity = await ensureUserFromRequest(request);
  if (identity.status !== 200) {
    request.log?.warn?.('Authentication failed.', {
      status: identity.status,
      code: identity.code,
    });
    return {
      error: jsonResponse(identity.status, errorEnvelope(identity.code, identity.message)),
    };
  }

  if (identity?.user?.user_id) {
    request.log?.setUserId?.(identity.user.user_id);
  }

  return {
    user: identity.user,
    token: identity.token,
    claims: identity.claims,
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
    let mkcolResponse;
    try {
      mkcolResponse = await fetchWithTimeout(
        mkcolUrl,
        {
          method: 'MKCOL',
          headers: {
            Authorization: nextcloudAuthHeader(),
          },
        },
        { timeoutMs: NEXTCLOUD_FETCH_TIMEOUT_MS },
      );
      mkcolResponse.clearTimeout?.();
    } catch (error) {
      if (isFetchTimeoutError(error)) {
        return { error: { status: 504, code: 'upstream_timeout', message: 'Nextcloud folder create timed out.' } };
      }
      throw error;
    }

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
  let upstream;
  try {
    upstream = await fetchWithTimeout(
      targetUrl,
      {
        method: 'PUT',
        headers: {
          Authorization: nextcloudAuthHeader(),
          'Content-Type': mimeType || 'application/octet-stream',
        },
        body: content,
      },
      { timeoutMs: NEXTCLOUD_FETCH_TIMEOUT_MS },
    );
    upstream.clearTimeout?.();
  } catch (error) {
    if (isFetchTimeoutError(error)) {
      return { error: { status: 504, code: 'upstream_timeout', message: 'Nextcloud upload timed out.' } };
    }
    throw error;
  }

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
  MATRIX_HOMESERVER_URL,
  MATRIX_SERVER_NAME,
  TUWUNEL_INTERNAL_URL,
  TUWUNEL_REGISTRATION_SHARED_SECRET,
  db,
  asBoolean,
  asInteger,
  asNullableText,
  asText,
  attachmentByIdStmt: stmts.files.findAttachmentById,
  assetRootByIdStmt: stmts.assetRoots.findById,
  assetRootsByProjectStmt: stmts.assetRoots.listForProject,
  assignedTaskListForUser,
  automationRuleByIdStmt: stmts.automation.findRule,
  automationRulesByProjectStmt: stmts.automation.listRules,
  automationRunsByProjectStmt: stmts.automation.listRuns,
  buildAssetProxyPath,
  buildAssetRelativePath,
  buildCalendarFeedUrl,
  buildHomeEventSummary,
  buildNotificationPayload,
  buildNotificationRouteContext,
  broadcastReminderChanged,
  broadcastTaskChanged,
  buildPersonalTaskSummaryFromRecord,
  buildSessionSummary,
  buildTaskSummaryForUser,
  capabilitiesByRecordStmt: stmts.recordCapabilities.listForRecord,
  findCalendarFeedTokenRecord,
  capabilitySet,
  collectionByIdStmt: stmts.collections.findById,
  collectionByNameStmt: stmts.collections.findByName,
  collectionSchema,
  collectionsByProjectStmt: stmts.collections.listForProject,
  commentAnchorsByDocStmt: stmts.commentAnchors.listForDoc,
  commentByIdStmt: stmts.comments.findById,
  commentStatusSet,
  createNotification,
  createPersonalTaskRecord,
  cleanupKeycloakInviteOnboarding,
  defaultAssetRootByProjectStmt: stmts.assetRoots.findDefaultForProject,
  deleteAttachmentStmt: stmts.files.deleteAttachment,
  deletePaneMemberStmt: stmts.paneMembers.delete,
  deletePaneStmt: stmts.panes.delete,
  deleteProjectMemberStmt: stmts.projectMembers.delete,
  deleteRelationStmt: stmts.recordRelations.delete,
  docByIdStmt: stmts.docs.findById,
  emitTimelineEvent,
  encodeCursorOffset,
  encryptMatrixAccountSecret,
  ensureUserForEmail,
  errorEnvelope,
  eventStateByRecordStmt: stmts.calendar.findEventState,
  extractDocNodeKeyState,
  fetchWithTimeout,
  fieldByIdStmt: stmts.collections.findFieldById,
  fieldTypeSet,
  fieldsByCollectionStmt: stmts.collections.listFields,
  filesByProjectStmt: stmts.files.listForProject,
  findOrCreateEventsCollection,
  insertAssetRootStmt: stmts.assetRoots.insert,
  insertAssignmentStmt: stmts.tasks.insertAssignment,
  insertAttachmentStmt: stmts.files.insertAttachment,
  insertAutomationRuleStmt: stmts.automation.insertRule,
  insertCommentAnchorStmt: stmts.commentAnchors.insert,
  insertCommentStmt: stmts.comments.insert,
  insertCollectionStmt: stmts.collections.insert,
  insertDocStmt: stmts.docs.insert,
  insertDocStorageStmt: stmts.docs.insertStorage,
  insertProjectDefaultCollectionStmt: stmts.collections.insertMinimal,
  insertEventParticipantStmt: stmts.calendar.insertParticipant,
  insertFieldStmt: stmts.collections.insertField,
  insertFileBlobStmt: stmts.files.insertBlob,
  insertFileStmt: stmts.files.insert,
  insertMatrixAccountStmt: stmts.chat.insertAccount,
  insertPaneMemberStmt: stmts.paneMembers.insert,
  insertPaneStmt: stmts.panes.insert,
  insertPendingInviteStmt: stmts.projectMembers.insertInvite,
  insertProjectMemberStmt: stmts.projectMembers.insert,
  insertProjectStmt: stmts.projects.insert,
  insertRecordCapabilityStmt: stmts.recordCapabilities.insertIgnore,
  insertRecordStmt: stmts.records.insert,
  insertChatSnapshotStmt: stmts.chat.insertSnapshot,
  insertRelationStmt: stmts.recordRelations.insert,
  insertReminderStmt: stmts.calendar.insertReminder,
  insertViewStmt: stmts.views.insert,
  isPlainObject,
  issueHubLiveTicket,
  jsonResponse,
  listProjectsForUserStmt: stmts.projects.listForUser,
  markNotificationReadStmt: stmts.notifications.markRead,
  mapMentionRowToBacklink,
  materializeMentions,
  membershipRoleLabel,
  newId,
  nextFieldSortStmt: stmts.collections.nextFieldSort,
  NEXTCLOUD_FETCH_TIMEOUT_MS,
  nextcloudAuthHeader,
  nextcloudUrl,
  normalizeAssetPathSegment,
  normalizeAssetRelativePath,
  normalizeParticipants,
  normalizeProjectRole,
  notificationContextForSource,
  notificationByIdStmt: stmts.notifications.findById,
  notificationRecord,
  notificationsByUserStmt: stmts.notifications.listForUser,
  nowIso,
  okEnvelope,
  paneByIdStmt: stmts.panes.findById,
  paneMembersByPaneStmt: stmts.paneMembers.listUserIds,
  deletePaneMembersByUserInProjectStmt: stmts.paneMembers.deleteByUserInProject,
  paneListForUserByProjectStmt: stmts.panes.listForProject,
  paneNextSortStmt: stmts.panes.nextSortOrder,
  paneSummary,
  parseBody,
  parseCursorOffset,
  parseJson,
  parseJsonObject,
  matrixAccountByUserIdStmt: stmts.chat.findAccountByUserId,
  deleteMatrixAccountStmt: stmts.chat.deleteAccount,
  decryptMatrixAccountSecret,
  assignmentsByRecordStmt: stmts.tasks.listAssignments,
  assignedTasksStmt: stmts.tasks.listAssignedForUser,
  activePendingInviteByProjectAndEmailStmt: stmts.projectMembers.findPendingByEmail,
  calendarRecordsByProjectStmt: stmts.calendar.listCalendarRecordsForProject,
  chatSnapshotByIdStmt: stmts.chat.findSnapshotById,
  chatSnapshotsPageStmt: stmts.chat.listSnapshotsByProject,
  deleteChatSnapshotStmt: stmts.chat.deleteSnapshot,
  deletePendingInviteStmt: stmts.projectMembers.deleteInvite,
  participantsByRecordStmt: stmts.calendar.listParticipants,
  pendingInviteByIdStmt: stmts.projectMembers.findInvite,
  pendingInviteRecord,
  pendingInvitesByProjectStmt: stmts.projectMembers.listPendingInvites,
  personalProjectByUserStmt: stmts.projects.findPersonalProject,
  personalProjectsMissingRemindersCollectionIdStmt: stmts.projects.listPersonalMissingRemindersCollectionIds,
  personalProjectIdForUser,
  projectByIdStmt: stmts.projects.findById,
  projectForMemberStmt: stmts.projects.findByIdWithMembership,
  projectMembershipExistsStmt: stmts.projectMembers.isMember,
  projectMembershipRoleStmt: stmts.projectMembers.getRole,
  projectMembershipsByUserStmt: stmts.projectMembers.listForUser,
  projectMembersByProjectStmt: stmts.projectMembers.listWithUsers,
  projectOwnerCountStmt: stmts.projectMembers.countOwners,
  projectRecord,
  recordByIdStmt: stmts.records.findById,
  recordDetail,
  recordDetailForUser,
  recordSummary,
  recordsByCollectionStmt: stmts.records.listForCollection,
  relationByEdgeStmt: stmts.recordRelations.findDuplicate,
  relationByIdStmt: stmts.recordRelations.findById,
  relationSearchRecordsStmt: stmts.userSearch.searchRecordsExtended,
  relationTargetCollectionIdFromField,
  requireDocAccess,
  resolveMutationContextPaneId,
  resolveProjectAssetRoot,
  resolveProjectContentWriteGate,
  reassignTasksForRemovedMember,
  safeNextcloudConfig,
  sendHubInviteEmail,
  safeTuwunelConfig,
  send,
  isFetchTimeoutError,
  eventParticipantByRecordAndUserStmt: stmts.calendar.findParticipantByRecordAndUser,
  homeEventsByProjectStmt: stmts.calendar.listEventsForProject,
  personalCapturesStmt: stmts.records.listPersonalCaptures,
  getTaskStateStmt: stmts.tasks.findState,
  getOrCreateCalendarFeedToken,
  subtasksByParentStmt: stmts.tasks.listSubtasksByParent,
  subtaskCountByParentStmt: stmts.tasks.countSubtasksByParent,
  taskStateByRecordStmt: stmts.tasks.findState,
  timelineByProjectStmt: stmts.timeline.listForProject,
  timelineRecord,
  toJson,
  trackedFileRecord,
  unreadNotificationsByUserStmt: stmts.notifications.listUnreadForUser,
  updateProjectRemindersCollectionStmt: stmts.projects.updateRemindersCollection,
  updateAutomationRuleStmt: stmts.automation.updateRule,
  updateCommentStatusStmt: stmts.comments.updateStatus,
  updateDocStorageStmt: stmts.docs.updateStorage,
  updateDocTimestampStmt: stmts.docs.updateTimestamp,
  updatePaneStmt: stmts.panes.update,
  updatePendingInviteDecisionStmt: stmts.projectMembers.updateInvite,
  updateRecordStmt: stmts.records.update,
  updateUserStmt: stmts.users.update,
  upsertDocPresenceStmt: stmts.docs.upsertPresence,
  upsertEventStateStmt: stmts.calendar.upsertEventState,
  upsertRecurrenceStmt: stmts.calendar.upsertRecurrence,
  upsertRecordValueStmt: stmts.recordValues.upsert,
  upsertTaskStateStmt: stmts.tasks.upsertState,
  userByEmailStmt: stmts.users.findByEmail,
  valuesByRecordStmt: stmts.recordValues.listForRecord,
  viewByIdStmt: stmts.views.findById,
  viewsByProjectStmt: stmts.views.listForProject,
  viewTypeSet,
  visibleProjectTasksStmt: stmts.tasks.listVisibleForProject,
  withAuth,
  withDocPolicyGate,
  withPanePolicyGate,
  withPolicyGate,
  withProjectPolicyGate,
  withTransaction: (fn) => withTransaction(db, fn),
  clearAssignmentsStmt: stmts.tasks.deleteAssignments,
  clearEventParticipantsStmt: stmts.calendar.deleteParticipants,
  clearRemindersStmt: stmts.calendar.deleteReminders,
  outgoingRelationsStmt: stmts.recordRelations.listForward,
  incomingRelationsStmt: stmts.recordRelations.listReverse,
  recordCapabilitiesByRecordStmt: stmts.recordCapabilities.listForRecord,
  recurrenceByRecordStmt: stmts.calendar.findRecurrence,
  remindersByRecordStmt: stmts.calendar.listReminders,
  listRemindersForUserStmt: stmts.reminders.listForUser,
  dismissReminderStmt: stmts.reminders.dismiss,
  findReminderByIdStmt: stmts.reminders.findById,
  insertStandaloneReminderStmt: stmts.reminders.insertStandalone,
  attachmentsByEntityStmt: stmts.files.listAttachmentsForEntity,
  commentsByTargetStmt: stmts.comments.listForEntity,
  deleteAutomationRuleStmt: stmts.automation.deleteRule,
  mentionsCountByTargetStmt: stmts.mentions.countForTarget,
  mentionsByTargetStmt: stmts.mentions.listInboxForUser,
  mentionSearchRecordsStmt: stmts.userSearch.searchRecords,
  mentionSearchUsersStmt: stmts.userSearch.searchProjectMembers,
  ensureKeycloakInviteOnboarding,
  updateMatrixAccountCredentialsStmt: stmts.chat.updateAccountCredentials,
  uploadToNextcloud,
  updateMatrixAccountDeviceStmt: stmts.chat.updateAccountDevice,
};

const userRoutes = createUserRoutes(routeDeps);
const chatRoutes = createChatRoutes(routeDeps);
const projectRoutes = createProjectRoutes(routeDeps);
const paneRoutes = createPaneRoutes(routeDeps);
const docRoutes = createDocRoutes(routeDeps);
const collectionRoutes = createCollectionRoutes(routeDeps);
const recordRoutes = createRecordRoutes(routeDeps);
const viewRoutes = createViewRoutes(routeDeps);
const fileRoutes = createFileRoutes(routeDeps);
const notificationRoutes = createNotificationRoutes(routeDeps);
const taskRoutes = createTaskRoutes(routeDeps);
const reminderRoutes = createReminderRoutes(routeDeps);
const automationRoutes = createAutomationRoutes(routeDeps);
const searchRoutes = createSearchRoutes(routeDeps);

const fireDueReminders = () => {
  try {
    const firedAt = nowIso();
    const dueReminders = dueRemindersStmt.all(firedAt);
    for (const reminder of dueReminders) {
      try {
        const createdNotifications = [];
        let claimed = false;
        withTransaction(db, () => {
          const claimResult = claimReminderFiredStmt.run(firedAt, reminder.reminder_id);
          if (claimResult.changes === 0) {
            return;
          }
          claimed = true;

          const recipientUserIds = new Set(
            assignmentsByRecordStmt
              .all(reminder.record_id)
              .map((row) => asText(row.user_id))
              .filter(Boolean),
          );
          for (const participant of participantsByRecordStmt.all(reminder.record_id)) {
            const participantUserId = asText(participant.user_id);
            if (participantUserId) {
              recipientUserIds.add(participantUserId);
            }
          }
          if (recipientUserIds.size === 0) {
            const record = recordByIdStmt.get(reminder.record_id);
            const createdByUserId = asText(record?.created_by);
            if (createdByUserId) {
              recipientUserIds.add(createdByUserId);
            }
          }

          const recordTitle = asText(reminder.record_title) || 'Untitled record';
          for (const userId of recipientUserIds) {
            const notificationId = newId('ntf');
            const createdAt = nowIso();
            const payload = buildNotificationPayload({
              message: `Reminder: ${recordTitle}`,
            });
            const payloadJson = toJson(payload);
            insertNotificationStmt.run(
              notificationId,
              reminder.project_id,
              userId,
              'reminder',
              'record',
              reminder.record_id,
              payloadJson,
              'network',
              createdAt,
            );
            createdNotifications.push({
              userId,
              notification: notificationRecord({
                notification_id: notificationId,
                project_id: reminder.project_id,
                user_id: userId,
                reason: 'reminder',
                entity_type: 'record',
                entity_id: reminder.record_id,
                payload_json: payloadJson,
                notification_scope: 'network',
                read_at: null,
                created_at: createdAt,
              }),
            });
          }
        });

        if (!claimed) {
          continue;
        }

        for (const entry of createdNotifications) {
          broadcastHubLiveToUser(entry.userId, {
            type: 'notification.new',
            notification: entry.notification,
          });
        }

        systemLog.info('Reminder fired.', {
          reminderId: reminder.reminder_id,
          recordId: reminder.record_id,
        });
      } catch (error) {
        systemLog.error('Failed to fire reminder.', {
          reminderId: reminder.reminder_id,
          recordId: reminder.record_id,
          error,
        });
      }
    }
  } catch (error) {
    systemLog.error('Reminder check loop tick failed.', { error });
  }
};

const server = createServer(async (request, response) => {
  applyRequestContext(request, response);

  if (!request.url) {
    request.log.error('Missing request URL.');
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
    if (request.method === 'GET' && pathname === '/api/health') {
      send(
        response,
        jsonResponse(200, {
          status: 'ok',
          timestamp: nowIso(),
          uptime: process.uptime(),
          version: APP_VERSION,
        }),
      );
      return;
    }

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

    if (request.method === 'POST' && pathname === '/api/hub/chat/provision') {
      await chatRoutes.provision({ request, response, requestUrl, pathname });
      return;
    }

    if (pathname === '/api/hub/chat/snapshots' && request.method === 'POST') {
      await chatRoutes.createSnapshot({ request, response, requestUrl, pathname });
      return;
    }

    if (pathname === '/api/hub/chat/snapshots' && request.method === 'GET') {
      await chatRoutes.listSnapshots({ request, response, requestUrl, pathname });
      return;
    }

    const chatSnapshotItemMatch = pathMatch(pathname, /^\/api\/hub\/chat\/snapshots\/([^/]+)$/);
    if (chatSnapshotItemMatch && request.method === 'DELETE') {
      await chatRoutes.deleteSnapshot({
        request,
        response,
        requestUrl,
        pathname,
        params: { snapshotId: decodeURIComponent(chatSnapshotItemMatch[1]) },
      });
      return;
    }

    if (request.method === 'GET' && pathname === '/api/hub/home') {
      await taskRoutes.getHubHome({ request, response, requestUrl, pathname });
      return;
    }

    if (request.method === 'GET' && pathname === '/api/hub/search') {
      await searchRoutes.globalSearch({ request, response, requestUrl, pathname });
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

    if (pathname === '/api/hub/reminders' && request.method === 'GET') {
      await reminderRoutes.listReminders({ request, response, requestUrl, pathname, params: {} });
      return;
    }

    if (pathname === '/api/hub/reminders' && request.method === 'POST') {
      await reminderRoutes.createReminder({ request, response, requestUrl, pathname, params: {} });
      return;
    }

    const reminderDismissMatch = pathMatch(pathname, /^\/api\/hub\/reminders\/([^/]+)\/dismiss$/);
    if (reminderDismissMatch && request.method === 'POST') {
      await reminderRoutes.dismissReminder({
        request,
        response,
        requestUrl,
        pathname,
        params: { reminderId: decodeURIComponent(reminderDismissMatch[1]) },
      });
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
      await recordRoutes.createRecord({
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
      await recordRoutes.searchProjectRecords({
        request,
        response,
        requestUrl,
        pathname,
        params: { projectId: decodeURIComponent(projectRecordSearchMatch[1]) },
      });
      return;
    }

    const recordConvertMatch = pathMatch(pathname, /^\/api\/hub\/records\/([^/]+)\/convert$/);
    if (recordConvertMatch && request.method === 'POST') {
      await recordRoutes.convertRecord({
        request,
        response,
        requestUrl,
        pathname,
        params: { recordId: decodeURIComponent(recordConvertMatch[1]) },
      });
      return;
    }

    const recordSubtasksMatch = pathMatch(pathname, /^\/api\/hub\/records\/([^/]+)\/subtasks$/);
    if (recordSubtasksMatch && request.method === 'GET') {
      await recordRoutes.listSubtasks({
        request,
        response,
        requestUrl,
        pathname,
        params: { recordId: decodeURIComponent(recordSubtasksMatch[1]) },
      });
      return;
    }

    const recordItemMatch = pathMatch(pathname, /^\/api\/hub\/records\/([^/]+)$/);
    if (recordItemMatch && request.method === 'PATCH') {
      await recordRoutes.updateRecord({
        request,
        response,
        requestUrl,
        pathname,
        params: { recordId: decodeURIComponent(recordItemMatch[1]) },
      });
      return;
    }

    if (recordItemMatch && request.method === 'GET') {
      await recordRoutes.getRecord({
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
      await recordRoutes.updateRecordValues({
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
      await recordRoutes.createRecordRelation({
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
      await recordRoutes.deleteRelation({
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

    if (request.method === 'GET' && pathname === '/api/hub/calendar') {
      await viewRoutes.listPersonalCalendar({ request, response, requestUrl, pathname });
      return;
    }

    if (request.method === 'GET' && pathname === '/api/hub/calendar.ics') {
      await viewRoutes.getCalendarFeed({ request, response, requestUrl, pathname });
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

    send(response, jsonResponse(404, errorEnvelope('not_found', 'Endpoint not found.')));
  } catch (error) {
    request.log.error('Unhandled request error.', { error });
    send(
      response,
      jsonResponse(500, errorEnvelope('internal_error', 'Internal server error.')),
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
  } catch (error) {
    systemLog.warn('WebSocket upgrade failed.', { error });
    socket.destroy();
  }
});

server.listen(PORT, '0.0.0.0', () => {
  systemLog.info('Hub API server started.', {
    version: APP_VERSION,
    port: PORT,
    nodeVersion: process.version,
    environment: NODE_ENVIRONMENT,
    routeCount: REGISTERED_ROUTE_COUNT,
    databasePath: HUB_DB_PATH,
  });
  setInterval(fireDueReminders, REMINDER_CHECK_INTERVAL_MS);
  systemLog.info('Reminder check loop started.', { intervalMs: REMINDER_CHECK_INTERVAL_MS });
});
