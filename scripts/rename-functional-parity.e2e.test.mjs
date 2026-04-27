import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { spawn } from 'node:child_process';
import { generateKeyPairSync, createSign } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { initializeDatabase } from '../apps/hub-api/db/bootstrap.mjs';

const PARITY_CONTRACT = {
  vocab: {
    container: {
      table: 'spaces',
      idColumn: 'space_id',
      memberTable: 'space_members',
      pendingInviteTable: 'pending_space_invites',
      routeSegment: 'spaces',
      jsonCollectionKey: 'spaces',
      jsonMemberCollectionKey: 'members',
      jsonInviteCollectionKey: 'pending_invites',
      memberIndex: 'idx_space_members_user_space',
      personalOwnerIndex: 'idx_spaces_personal_owner',
      pendingInviteProjectStatusIndex: 'idx_pending_space_invites_space_status_created',
      pendingInviteEmailStatusIndex: 'idx_pending_space_invites_email_status',
      searchTable: 'search_spaces_fts',
    },
    work: {
      table: 'projects',
      idColumn: 'project_id',
      memberTable: 'project_members',
      routeSegment: 'projects',
      jsonCollectionKey: 'projects',
      memberIndex: 'idx_project_members_user_project',
      searchTable: 'search_projects_fts',
    },
  },
  db: {
    staticTables: [
      'asset_roots',
      'assignments',
      'automation_rules',
      'automation_runs',
      'bug_reports',
      'calendar_feed_tokens',
      'chat_snapshots',
      'collection_fields',
      'collections',
      'comment_anchors',
      'comments',
      'doc_presence',
      'doc_storage',
      'docs',
      'entity_attachments',
      'event_participants',
      'event_state',
      'file_blobs',
      'files',
      'matrix_accounts',
      'mentions',
      'widget_picker_seed_data',
      'notifications',
      'personal_tasks',
      'record_capabilities',
      'record_relations',
      'record_values',
      'records',
      'recurrence_rules',
      'reminders',
      'schema_version',
      'search_records_fts',
      'search_records_fts_config',
      'search_records_fts_content',
      'search_records_fts_data',
      'search_records_fts_docsize',
      'search_records_fts_idx',
      'task_state',
      'timeline_events',
      'users',
      'views',
    ],
    staticIndexes: [
      'idx_attachments_asset_lookup',
      'idx_attachments_entity_lookup',
      'idx_automation_runs_rule_started',
      'idx_bug_reports_public_created',
      'idx_chat_snapshots_space_created',
      'idx_comments_entity_lookup',
      'idx_docs_project_unique',
      'idx_event_participants_user_record',
      'idx_event_state_start',
      'idx_files_space_asset_path',
      'idx_mentions_target_lookup',
      'idx_widget_picker_seed_widget_size',
      'idx_notifications_user_unread_created',
      'idx_projects_space_sort',
      'idx_personal_tasks_user_updated',
      'idx_record_relations_space_from',
      'idx_record_relations_space_to',
      'idx_record_relations_unique_edge',
      'idx_record_values_field_record',
      'idx_record_values_record_field',
      'idx_records_parent',
      'idx_records_space_collection_updated',
      'idx_records_space_source_project',
      'idx_records_space_source_view',
      'idx_reminders_due_active',
      'idx_reminders_visible_undismissed',
      'idx_timeline_primary_lookup',
      'idx_timeline_space_created',
      'idx_views_space_collection_type',
    ],
    staticTriggers: [
      'comment_anchor_requires_doc_target',
      'comment_anchor_requires_node_key_insert',
      'comment_anchor_requires_node_key_update',
      'record_relations_space_consistency_insert',
      'record_relations_space_consistency_update',
      'records_collection_space_consistency_insert',
      'records_collection_space_consistency_update',
      'search_records_fts_delete',
      'search_records_fts_insert',
      'search_records_fts_update',
    ],
    triggerErrors: {
      projectMembersSubset: 'project_members must be a subset of space_members',
      recordsCollectionProject: 'records.space_id must match collections.space_id',
      recordRelationsProject: 'record_relations records must match relation space_id',
      commentAnchorDocTarget: 'comment_anchors require doc target',
      commentAnchorNodeKey: 'comment_anchors must be node-key anchors',
    },
  },
  api: {
    collectionKey: 'collection_id',
    fieldKey: 'field_id',
    recordKey: 'record_id',
    attachmentKey: 'attachment_id',
    assetRootKey: 'asset_root_id',
    proxyKey: 'proxy_url',
    relationFieldKey: 'via_field_id',
    memberUserIdsKey: 'member_user_ids',
    responseKeys: {
      members: 'members',
      pendingInvites: 'pending_invites',
      collections: 'collections',
      fields: 'fields',
      assetRoots: 'asset_roots',
      files: 'files',
      entries: 'entries',
      uploaded: 'uploaded',
      deleted: 'deleted',
      removed: 'removed',
    },
    requestKeys: {
      name: 'name',
      position: 'position',
      pinned: 'pinned',
      layoutConfig: 'layout_config',
      sortOrder: 'sort_order',
      role: 'role',
      userId: 'user_id',
      email: 'email',
      projectId: 'space_id',
      sourceWorkId: 'source_project_id',
      mimeType: 'mime_type',
      contentBase64: 'content_base64',
      metadata: 'metadata',
      mutationContextWorkId: 'mutation_context_project_id',
      provider: 'provider',
      assetPath: 'asset_path',
      sizeBytes: 'size_bytes',
      entityType: 'entity_type',
      entityId: 'entity_id',
      rootPath: 'root_path',
      directory: 'directory',
      path: 'path',
    },
    responseShapes: {
      project: [
        'space_id',
        'name',
        'created_by',
        'created_at',
        'updated_at',
        'position',
        'is_personal',
        'membership_role',
        'needs_name_prompt',
      ],
      projectMember: [
        'space_id',
        'user_id',
        'role',
        'joined_at',
        'display_name',
        'email',
      ],
      pendingInvite: [
        'invite_request_id',
        'space_id',
        'email',
        'role',
        'requested_by_user_id',
        'status',
        'target_user_id',
        'reviewed_by_user_id',
        'reviewed_at',
        'created_at',
        'updated_at',
      ],
      projectMemberMutation: [
        'space_id',
        'user_id',
        'role',
      ],
      work: [
        'project_id',
        'space_id',
        'name',
        'sort_order',
        'position',
        'pinned',
        'layout_config',
        'doc_id',
        'members',
        'can_edit',
      ],
      workMember: [
        'user_id',
        'display_name',
      ],
      collection: [
        'collection_id',
        'space_id',
        'name',
        'icon',
        'color',
        'created_at',
        'updated_at',
      ],
      field: [
        'field_id',
        'collection_id',
        'name',
        'type',
        'config',
        'sort_order',
      ],
      file: [
        'file_id',
        'space_id',
        'asset_root_id',
        'provider',
        'asset_path',
        'name',
        'mime_type',
        'size_bytes',
        'metadata',
        'proxy_url',
      ],
      listedFile: [
        'file_id',
        'space_id',
        'asset_root_id',
        'provider',
        'asset_path',
        'provider_path',
        'name',
        'mime_type',
        'size_bytes',
        'created_by',
        'created_at',
        'scope',
        'project_id',
        'metadata',
        'proxy_url',
      ],
      attachment: [
        'attachment_id',
        'space_id',
        'entity_type',
        'entity_id',
        'provider',
        'asset_root_id',
        'asset_path',
        'name',
        'mime_type',
        'size_bytes',
        'metadata',
        'proxy_url',
      ],
      assetRoot: [
        'asset_root_id',
        'space_id',
        'provider',
        'root_path',
        'connection_ref',
        'created_at',
        'updated_at',
      ],
      createdCollection: [
        'collection_id',
      ],
      createdField: [
        'field_id',
      ],
      createdRecord: [
        'record_id',
      ],
      assetUpload: [
        'uploaded',
        'provider',
        'asset_root_id',
        'path',
        'proxy_url',
      ],
      assetEntry: [
        'name',
        'path',
        'proxy_url',
      ],
    },
  },
};

const reservePort = async () =>
  await new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Failed to reserve port.'));
        return;
      }
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(address.port);
      });
    });
  });

const nowIso = () => new Date().toISOString();

const base64Url = (value) => Buffer.from(value).toString('base64url');

const jsonBase64Url = (value) => base64Url(JSON.stringify(value));

const signJwt = (privateKey, issuer, sub, name, email) => {
  const header = { alg: 'RS256', kid: 'rename-parity-kid', typ: 'JWT' };
  const payload = {
    iss: issuer,
    aud: 'hub-test',
    sub,
    name,
    email,
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
    iat: Math.floor(Date.now() / 1000) - 10,
  };
  const signingInput = `${jsonBase64Url(header)}.${jsonBase64Url(payload)}`;
  const signer = createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();
  return `${signingInput}.${signer.sign(privateKey).toString('base64url')}`;
};

const startProcess = ({ cwd, scriptPath, env }) => {
  const child = spawn(process.execPath, [scriptPath], {
    cwd,
    env: {
      ...process.env,
      ...env,
    },
    stdio: ['ignore', 'ignore', 'pipe'],
  });

  let stderr = '';
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString('utf8');
  });

  return {
    child,
    stderr: () => stderr,
    stop: async () => {
      if (child.exitCode !== null || child.signalCode) {
        return;
      }
      child.kill('SIGTERM');
      await new Promise((resolve) => {
        const timer = setTimeout(() => {
          child.kill('SIGKILL');
        }, 3_000);
        child.once('exit', () => {
          clearTimeout(timer);
          resolve();
        });
      });
    },
  };
};

const waitForOk = async (url, attempts = 60) => {
  let lastError = null;
  for (let index = 0; index < attempts; index += 1) {
    try {
      const response = await globalThis.fetch(url);
      if (response.ok) {
        return;
      }
      lastError = new Error(`Unexpected status ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw lastError || new Error(`Timed out waiting for ${url}`);
};

const readJsonEnvelope = async (response) => {
  const text = await response.text();
  const parsed = text ? JSON.parse(text) : {};
  return {
    status: response.status,
    ok: parsed?.ok === true,
    data: parsed?.data ?? null,
    error: parsed?.error ?? null,
    raw: parsed,
  };
};

const requestHubJson = async (baseUrl, token, pathName, init = {}) => {
  const headers = new globalThis.Headers(init.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const response = await globalThis.fetch(new URL(pathName, baseUrl), {
    ...init,
    headers,
  });
  return readJsonEnvelope(response);
};

const expectOk = async (baseUrl, token, pathName, init = {}) => {
  const envelope = await requestHubJson(baseUrl, token, pathName, init);
  assert.equal(envelope.ok, true, `${pathName} should succeed`);
  assert.ok(envelope.data, `${pathName} should include data`);
  return envelope.data;
};

const expectStatus = async (baseUrl, token, pathName, status, init = {}) => {
  const envelope = await requestHubJson(baseUrl, token, pathName, init);
  assert.equal(envelope.status, status, `${pathName} should return ${status}: ${JSON.stringify(envelope.raw)}`);
  return envelope;
};

const expectOkStatus = async (baseUrl, token, pathName, status, init = {}) => {
  const envelope = await expectStatus(baseUrl, token, pathName, status, init);
  assert.equal(envelope.ok, true, `${pathName} should succeed`);
  assert.ok(envelope.data, `${pathName} should include data`);
  return envelope.data;
};

const assertExactKeys = (value, expectedKeys, label) => {
  assert.deepEqual(sortStrings(Object.keys(value)), sortStrings(expectedKeys), `${label} keys mismatch`);
};

const assertExactArrayItemKeys = (values, expectedKeys, label) => {
  for (const [index, value] of values.entries()) {
    assertExactKeys(value, expectedKeys, `${label}[${index}]`);
  }
};

const sortStrings = (values) => [...values].sort((left, right) => left.localeCompare(right));

const quoteIdentifier = (identifier) => {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) {
    throw new Error(`Unsafe identifier: ${identifier}`);
  }
  return `"${identifier}"`;
};

const q = quoteIdentifier;

const buildExpectedTableColumns = () => {
  const { container, work } = PARITY_CONTRACT.vocab;
  const containerId = container.idColumn;
  const workId = work.idColumn;

  return {
    [container.table]: [
      { name: containerId, type: 'TEXT', notnull: 0, pk: 1 },
      { name: 'name', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'created_by', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'is_personal', type: 'INTEGER', notnull: 1, pk: 0 },
      { name: 'space_type', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'tasks_collection_id', type: 'TEXT', notnull: 0, pk: 0 },
      { name: 'reminders_collection_id', type: 'TEXT', notnull: 0, pk: 0 },
      { name: 'position', type: 'INTEGER', notnull: 0, pk: 0 },
      { name: 'name_prompt_completed', type: 'INTEGER', notnull: 1, pk: 0 },
      { name: 'created_at', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'updated_at', type: 'TEXT', notnull: 1, pk: 0 },
    ],
    [container.memberTable]: [
      { name: containerId, type: 'TEXT', notnull: 1, pk: 1 },
      { name: 'user_id', type: 'TEXT', notnull: 1, pk: 2 },
      { name: 'role', type: 'TEXT', notnull: 0, pk: 0 },
      { name: 'joined_at', type: 'TEXT', notnull: 1, pk: 0 },
    ],
    [container.pendingInviteTable]: [
      { name: 'invite_request_id', type: 'TEXT', notnull: 0, pk: 1 },
      { name: containerId, type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'email', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'role', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'requested_by_user_id', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'status', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'target_user_id', type: 'TEXT', notnull: 0, pk: 0 },
      { name: 'reviewed_by_user_id', type: 'TEXT', notnull: 0, pk: 0 },
      { name: 'reviewed_at', type: 'TEXT', notnull: 0, pk: 0 },
      { name: 'created_at', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'updated_at', type: 'TEXT', notnull: 1, pk: 0 },
    ],
    [work.table]: [
      { name: workId, type: 'TEXT', notnull: 0, pk: 1 },
      { name: containerId, type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'name', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'sort_order', type: 'INTEGER', notnull: 1, pk: 0 },
      { name: 'position', type: 'INTEGER', notnull: 0, pk: 0 },
      { name: 'pinned', type: 'INTEGER', notnull: 1, pk: 0 },
      { name: 'layout_config', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'created_by', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'created_at', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'updated_at', type: 'TEXT', notnull: 1, pk: 0 },
    ],
    [work.memberTable]: [
      { name: workId, type: 'TEXT', notnull: 1, pk: 1 },
      { name: 'user_id', type: 'TEXT', notnull: 1, pk: 2 },
      { name: 'joined_at', type: 'TEXT', notnull: 1, pk: 0 },
    ],
    docs: [
      { name: 'doc_id', type: 'TEXT', notnull: 0, pk: 1 },
      { name: workId, type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'created_at', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'updated_at', type: 'TEXT', notnull: 1, pk: 0 },
    ],
    collections: [
      { name: 'collection_id', type: 'TEXT', notnull: 0, pk: 1 },
      { name: containerId, type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'name', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'icon', type: 'TEXT', notnull: 0, pk: 0 },
      { name: 'color', type: 'TEXT', notnull: 0, pk: 0 },
      { name: 'created_at', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'updated_at', type: 'TEXT', notnull: 1, pk: 0 },
    ],
    records: [
      { name: 'record_id', type: 'TEXT', notnull: 0, pk: 1 },
      { name: containerId, type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'collection_id', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'title', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'source_project_id', type: 'TEXT', notnull: 0, pk: 0 },
      { name: 'source_view_id', type: 'TEXT', notnull: 0, pk: 0 },
      { name: 'created_by', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'created_at', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'updated_at', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'archived_at', type: 'TEXT', notnull: 0, pk: 0 },
      { name: 'parent_record_id', type: 'TEXT', notnull: 0, pk: 0 },
    ],
    views: [
      { name: 'view_id', type: 'TEXT', notnull: 0, pk: 1 },
      { name: containerId, type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'collection_id', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'type', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'name', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'config', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'created_by', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'created_at', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'updated_at', type: 'TEXT', notnull: 1, pk: 0 },
    ],
    files: [
      { name: 'file_id', type: 'TEXT', notnull: 0, pk: 1 },
      { name: containerId, type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'asset_root_id', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'provider', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'provider_path', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'name', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'mime_type', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'size_bytes', type: 'INTEGER', notnull: 1, pk: 0 },
      { name: 'hash', type: 'TEXT', notnull: 0, pk: 0 },
      { name: 'metadata_json', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'created_by', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'created_at', type: 'TEXT', notnull: 1, pk: 0 },
    ],
    entity_attachments: [
      { name: 'attachment_id', type: 'TEXT', notnull: 0, pk: 1 },
      { name: containerId, type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'entity_type', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'entity_id', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'provider', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'asset_root_id', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'asset_path', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'name', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'mime_type', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'size_bytes', type: 'INTEGER', notnull: 1, pk: 0 },
      { name: 'metadata_json', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'created_by', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'created_at', type: 'TEXT', notnull: 1, pk: 0 },
    ],
    asset_roots: [
      { name: 'asset_root_id', type: 'TEXT', notnull: 0, pk: 1 },
      { name: containerId, type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'provider', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'root_path', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'connection_ref', type: 'TEXT', notnull: 0, pk: 0 },
      { name: 'created_at', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'updated_at', type: 'TEXT', notnull: 1, pk: 0 },
    ],
    chat_snapshots: [
      { name: 'snapshot_id', type: 'TEXT', notnull: 0, pk: 1 },
      { name: containerId, type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'conversation_room_id', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'message_sender_display_name', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'message_text', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'message_timestamp', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'created_by', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'created_at', type: 'TEXT', notnull: 1, pk: 0 },
    ],
    automation_rules: [
      { name: 'automation_rule_id', type: 'TEXT', notnull: 0, pk: 1 },
      { name: containerId, type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'name', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'enabled', type: 'INTEGER', notnull: 1, pk: 0 },
      { name: 'trigger_json', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'actions_json', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'created_by', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'created_at', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'updated_at', type: 'TEXT', notnull: 1, pk: 0 },
    ],
    automation_runs: [
      { name: 'automation_run_id', type: 'TEXT', notnull: 0, pk: 1 },
      { name: containerId, type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'automation_rule_id', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'status', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'input_event_json', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'output_json', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'started_at', type: 'TEXT', notnull: 0, pk: 0 },
      { name: 'finished_at', type: 'TEXT', notnull: 0, pk: 0 },
    ],
    notifications: [
      { name: 'notification_id', type: 'TEXT', notnull: 0, pk: 1 },
      { name: containerId, type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'user_id', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'reason', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'entity_type', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'entity_id', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'payload_json', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'notification_scope', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'read_at', type: 'TEXT', notnull: 0, pk: 0 },
      { name: 'created_at', type: 'TEXT', notnull: 1, pk: 0 },
    ],
    timeline_events: [
      { name: 'timeline_event_id', type: 'TEXT', notnull: 0, pk: 1 },
      { name: containerId, type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'actor_user_id', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'event_type', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'primary_entity_type', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'primary_entity_id', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'secondary_entities_json', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'summary_json', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'created_at', type: 'TEXT', notnull: 1, pk: 0 },
    ],
    [container.searchTable]: [
      { name: containerId, type: '', notnull: 0, pk: 0 },
      { name: 'name', type: '', notnull: 0, pk: 0 },
    ],
    [work.searchTable]: [
      { name: workId, type: '', notnull: 0, pk: 0 },
      { name: containerId, type: '', notnull: 0, pk: 0 },
      { name: 'name', type: '', notnull: 0, pk: 0 },
    ],
    search_records_fts: [
      { name: 'record_id', type: '', notnull: 0, pk: 0 },
      { name: containerId, type: '', notnull: 0, pk: 0 },
      { name: 'title', type: '', notnull: 0, pk: 0 },
      { name: 'content_type', type: '', notnull: 0, pk: 0 },
    ],
  };
};

const buildExpectedObjects = () => {
  const { container, work } = PARITY_CONTRACT.vocab;
  const tables = [
    ...PARITY_CONTRACT.db.staticTables,
    container.table,
    container.memberTable,
    container.pendingInviteTable,
    work.table,
    work.memberTable,
    container.searchTable,
    `${container.searchTable}_config`,
    `${container.searchTable}_content`,
    `${container.searchTable}_data`,
    `${container.searchTable}_docsize`,
    `${container.searchTable}_idx`,
    work.searchTable,
    `${work.searchTable}_config`,
    `${work.searchTable}_content`,
    `${work.searchTable}_data`,
    `${work.searchTable}_docsize`,
    `${work.searchTable}_idx`,
  ];
  const indexes = [
    ...PARITY_CONTRACT.db.staticIndexes,
    container.memberIndex,
    work.memberIndex,
    container.pendingInviteProjectStatusIndex,
    container.pendingInviteEmailStatusIndex,
    container.personalOwnerIndex,
  ];
  const triggers = [
    ...PARITY_CONTRACT.db.staticTriggers,
    'project_members_must_be_space_members',
    `search_${container.table}_fts_delete`,
    `search_${container.table}_fts_insert`,
    `search_${container.table}_fts_update`,
    `search_${work.table}_fts_delete`,
    `search_${work.table}_fts_insert`,
    `search_${work.table}_fts_update`,
  ];
  return {
    tables: sortStrings(tables),
    indexes: sortStrings(indexes),
    triggers: sortStrings(triggers),
  };
};

const buildRoutes = () => {
  const { container, work } = PARITY_CONTRACT.vocab;
  return {
    health: '/api/hub/health',
    me: '/api/hub/me',
    projects: `/api/hub/${container.routeSegment}`,
    project: (projectId) => `/api/hub/${container.routeSegment}/${encodeURIComponent(projectId)}`,
    projectMembers: (projectId) => `/api/hub/${container.routeSegment}/${encodeURIComponent(projectId)}/members`,
    projectMember: (projectId, userId) =>
      `/api/hub/${container.routeSegment}/${encodeURIComponent(projectId)}/members/${encodeURIComponent(userId)}`,
    projectProjects: (projectId) => `/api/hub/${container.routeSegment}/${encodeURIComponent(projectId)}/${work.routeSegment}`,
    workProject: (projectId) => `/api/hub/${work.routeSegment}/${encodeURIComponent(projectId)}`,
    workProjectMembers: (projectId) => `/api/hub/${work.routeSegment}/${encodeURIComponent(projectId)}/members`,
    projectCollections: (projectId) => `/api/hub/${container.routeSegment}/${encodeURIComponent(projectId)}/collections`,
    collectionFields: (collectionId) => `/api/hub/collections/${encodeURIComponent(collectionId)}/fields`,
    projectRecords: (projectId) => `/api/hub/${container.routeSegment}/${encodeURIComponent(projectId)}/records`,
    filesUpload: '/api/hub/files/upload',
    attachments: '/api/hub/attachments',
    attachment: (attachmentId) => `/api/hub/attachments/${encodeURIComponent(attachmentId)}`,
    projectAssetRoots: (projectId) => `/api/hub/${container.routeSegment}/${encodeURIComponent(projectId)}/asset-roots`,
    projectFiles: (projectId) => `/api/hub/${container.routeSegment}/${encodeURIComponent(projectId)}/files`,
    projectAssetsUpload: (projectId) => `/api/hub/${container.routeSegment}/${encodeURIComponent(projectId)}/assets/upload`,
    projectAssetsList: (projectId) => `/api/hub/${container.routeSegment}/${encodeURIComponent(projectId)}/assets/list`,
    projectAssetsDelete: (projectId) => `/api/hub/${container.routeSegment}/${encodeURIComponent(projectId)}/assets/delete`,
    projectAssetsProxy: (projectId) => `/api/hub/${container.routeSegment}/${encodeURIComponent(projectId)}/assets/proxy`,
  };
};

const getColumnContract = () => buildExpectedTableColumns();

const getObjectNames = (db, type) =>
  sortStrings(
    db
      .prepare(`SELECT name FROM sqlite_master WHERE type = ? AND name NOT LIKE 'sqlite_%' ORDER BY name`)
      .all(type)
      .map((row) => row.name),
  );

const getTableColumns = (db, tableName) =>
  db.prepare(`PRAGMA table_info(${q(tableName)})`).all().map((column) => ({
    name: column.name,
    type: column.type,
    notnull: column.notnull,
    pk: column.pk,
  }));

const getRowCount = (db, tableName, whereClause = '', values = []) => {
  const sql = `SELECT COUNT(*) AS count FROM ${q(tableName)}${whereClause ? ` WHERE ${whereClause}` : ''}`;
  return Number(db.prepare(sql).get(...values)?.count || 0);
};

const insertUser = (stmts, { userId, sub, name, email, now = nowIso() }) => {
  stmts.users.insert.run(userId, sub, name, email, now, now);
};

const insertContainer = (stmts, { containerId, ownerUserId, name, now = nowIso() }) => {
  stmts.spaces.insert.run(containerId, name, ownerUserId, now, now);
};

const insertContainerMember = (stmts, { containerId, userId, role = 'member', now = nowIso() }) => {
  stmts.spaceMembers.insert.run(containerId, userId, role, now);
};

const insertWork = (stmts, { workId, containerId, name, createdBy, sortOrder = 1, position = 1, pinned = 0, layoutConfig = {}, now = nowIso() }) => {
  stmts.projects.insert.run(
    workId,
    containerId,
    name,
    sortOrder,
    position,
    pinned,
    JSON.stringify(layoutConfig),
    createdBy,
    now,
    now,
  );
};

const insertWorkMember = (stmts, { workId, userId, now = nowIso() }) => {
  stmts.projectMembers.insert.run(workId, userId, now);
};

const insertDoc = (stmts, { docId, workId, now = nowIso() }) => {
  stmts.docs.insert.run(docId, workId, now, now);
  stmts.docs.insertStorage.run(docId, 0, JSON.stringify({}), now);
};

const insertCollection = (stmts, { collectionId, containerId, name, now = nowIso() }) => {
  stmts.collections.insert.run(collectionId, containerId, name, null, null, now, now);
};

const insertField = (stmts, { fieldId, collectionId, name = 'Relation', type = 'relation', config = {}, sortOrder = 1, now = nowIso() }) => {
  stmts.collections.insertField.run(fieldId, collectionId, name, type, JSON.stringify(config), sortOrder, now, now);
};

const insertRecord = (stmts, { recordId, containerId, collectionId, title, sourceWorkId = null, sourceViewId = null, createdBy, parentRecordId = null, now = nowIso() }) => {
  stmts.records.insert.run(
    recordId,
    containerId,
    collectionId,
    title,
    sourceWorkId,
    sourceViewId,
    createdBy,
    now,
    now,
    parentRecordId,
  );
};

const insertRelation = (stmts, { relationId, containerId, fromRecordId, toRecordId, viaFieldId, createdBy, now = nowIso() }) => {
  stmts.recordRelations.insert.run(relationId, containerId, fromRecordId, toRecordId, viaFieldId, createdBy, now);
};

const insertComment = (stmts, { commentId, containerId, authorUserId, targetEntityType, targetEntityId, body = { text: 'comment' }, status = 'open', now = nowIso() }) => {
  stmts.comments.insert.run(commentId, containerId, authorUserId, targetEntityType, targetEntityId, JSON.stringify(body), status, now, now);
};

const insertCommentAnchor = (stmts, { commentId, docId, anchorPayload = { kind: 'node', nodeKey: 'node-1' }, now = nowIso() }) => {
  stmts.commentAnchors.insert.run(commentId, docId, JSON.stringify(anchorPayload), now, now);
};

const insertAssetRoot = (stmts, { assetRootId, containerId, rootPath, provider = 'nextcloud', connectionRef = null, now = nowIso() }) => {
  stmts.assetRoots.insert.run(assetRootId, containerId, provider, rootPath, JSON.stringify(connectionRef), now, now);
};

const insertFile = (stmts, { fileId, containerId, assetRootId, providerPath, name, createdBy, mimeType = 'text/plain', sizeBytes = 4, metadata = {}, now = nowIso() }) => {
  stmts.files.insert.run(
    fileId,
    containerId,
    assetRootId,
    'nextcloud',
    providerPath,
    name,
    mimeType,
    sizeBytes,
    null,
    JSON.stringify(metadata),
    createdBy,
    now,
  );
  stmts.files.insertBlob.run(fileId, JSON.stringify({ provider_path: providerPath }), now);
};

const insertAttachment = (stmts, { attachmentId, containerId, entityType, entityId, assetRootId, assetPath, name, createdBy, mimeType = 'text/plain', sizeBytes = 4, metadata = {}, now = nowIso() }) => {
  stmts.files.insertAttachment.run(
    attachmentId,
    containerId,
    entityType,
    entityId,
    'nextcloud',
    assetRootId,
    assetPath,
    name,
    mimeType,
    sizeBytes,
    JSON.stringify(metadata),
    createdBy,
    now,
  );
};

const withDbHarness = async (run) => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'rename-parity-db-'));
  const dbPath = path.join(tmpDir, 'hub.sqlite');
  const { db, stmts } = initializeDatabase(dbPath);
  try {
    await run({ db, stmts, dbPath, tmpDir });
  } finally {
    db.close();
    await rm(tmpDir, { recursive: true, force: true });
  }
};

const createNextcloudStub = () => {
  const fileStore = new Map();
  const directoryStore = new Set(['/remote.php/dav/files/tester']);

  const ensureDirectory = (pathName) => {
    const normalized = pathName.replace(/\/+$/, '') || '/';
    directoryStore.add(normalized);
  };

  const responseXml = (entries) =>
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<d:multistatus xmlns:d="DAV:">` +
    entries.map((entry) => `<d:response><d:href>${entry}</d:href></d:response>`).join('') +
    `</d:multistatus>`;

  const server = createServer(async (request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    const pathName = decodeURIComponent(url.pathname.replace(/\/+$/, '') || '/');

    if (request.method === 'MKCOL') {
      if (directoryStore.has(pathName)) {
        response.writeHead(405);
        response.end();
        return;
      }
      ensureDirectory(pathName);
      response.writeHead(201);
      response.end();
      return;
    }

    if (request.method === 'PUT') {
      const chunks = [];
      for await (const chunk of request) {
        chunks.push(Buffer.from(chunk));
      }
      const directoryPath = pathName.split('/').slice(0, -1).join('/') || '/';
      ensureDirectory(directoryPath);
      fileStore.set(pathName, {
        content: Buffer.concat(chunks),
        contentType: request.headers['content-type'] || 'application/octet-stream',
      });
      response.writeHead(201);
      response.end();
      return;
    }

    if (request.method === 'GET') {
      const file = fileStore.get(pathName);
      if (!file) {
        response.writeHead(404);
        response.end();
        return;
      }
      response.writeHead(200, { 'Content-Type': file.contentType });
      response.end(file.content);
      return;
    }

    if (request.method === 'DELETE') {
      fileStore.delete(pathName);
      response.writeHead(204);
      response.end();
      return;
    }

    if (request.method === 'PROPFIND') {
      const prefix = `${pathName}/`;
      const children = new Set([`${pathName}/`]);
      for (const directoryPath of directoryStore) {
        if (directoryPath.startsWith(prefix)) {
          const remainder = directoryPath.slice(prefix.length);
          if (remainder && !remainder.includes('/')) {
            children.add(`${directoryPath}/`);
          }
        }
      }
      for (const filePath of fileStore.keys()) {
        if (filePath.startsWith(prefix)) {
          const remainder = filePath.slice(prefix.length);
          if (remainder && !remainder.includes('/')) {
            children.add(filePath);
          }
        }
      }
      response.writeHead(207, { 'Content-Type': 'application/xml; charset=utf-8' });
      response.end(responseXml([...children]));
      return;
    }

    response.writeHead(204);
    response.end();
  });

  return {
    server,
    ensureDirectory,
  };
};

const startApiHarness = async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'rename-parity-api-'));
  const dbPath = path.join(tmpDir, 'hub.sqlite');
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const publicJwk = publicKey.export({ format: 'jwk' });

  const jwksPort = await reservePort();
  const nextcloudPort = await reservePort();
  const apiPort = await reservePort();

  const issuer = `http://127.0.0.1:${jwksPort}`;
  const apiBaseUrl = `http://127.0.0.1:${apiPort}`;

  const jwksServer = createServer((request, response) => {
    if (request.url === '/protocol/openid-connect/certs') {
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ keys: [{ ...publicJwk, kid: 'rename-parity-kid', alg: 'RS256', use: 'sig', kty: 'RSA' }] }));
      return;
    }
    response.writeHead(404);
    response.end();
  });
  await new Promise((resolve) => jwksServer.listen(jwksPort, '127.0.0.1', resolve));

  const nextcloud = createNextcloudStub();
  await new Promise((resolve) => nextcloud.server.listen(nextcloudPort, '127.0.0.1', resolve));

  const apiProcess = startProcess({
    cwd: path.resolve('.'),
    scriptPath: 'apps/hub-api/hub-api.mjs',
    env: {
      PORT: String(apiPort),
      HUB_API_BASE_URL: apiBaseUrl,
      HUB_DB_PATH: dbPath,
      HUB_API_ALLOW_SCHEMA_RESET: 'true',
      KEYCLOAK_ISSUER: issuer,
      KEYCLOAK_AUDIENCE: 'hub-test',
      NEXTCLOUD_BASE_URL: `http://127.0.0.1:${nextcloudPort}`,
      NEXTCLOUD_USER: 'tester',
      NEXTCLOUD_APP_PASSWORD: 'secret',
    },
  });

  try {
    await waitForOk(`${apiBaseUrl}${buildRoutes().health}`);
  } catch (error) {
    await apiProcess.stop();
    await new Promise((resolve) => jwksServer.close(resolve));
    await new Promise((resolve) => nextcloud.server.close(resolve));
    await rm(tmpDir, { recursive: true, force: true });
    throw new Error(`hub-api failed to start: ${apiProcess.stderr()}\n${error instanceof Error ? error.message : String(error)}`);
  }

  return {
    apiBaseUrl,
    issuer,
    privateKey,
    stop: async () => {
      await apiProcess.stop();
      await new Promise((resolve) => jwksServer.close(resolve));
      await new Promise((resolve) => nextcloud.server.close(resolve));
      await rm(tmpDir, { recursive: true, force: true });
    },
  };
};

const buildAccessibleWorkQuery = () => {
  const { container, work } = PARITY_CONTRACT.vocab;
  return `
    SELECT p.${q(work.idColumn)} AS work_id
    FROM ${q(work.table)} p
    LEFT JOIN ${q(container.memberTable)} owners
      ON owners.${q(container.idColumn)} = p.${q(container.idColumn)}
      AND owners.${q('user_id')} = ?
      AND owners.${q('role')} = 'owner'
    LEFT JOIN ${q(work.memberTable)} editors
      ON editors.${q(work.idColumn)} = p.${q(work.idColumn)}
      AND editors.${q('user_id')} = ?
    WHERE p.${q(container.idColumn)} = ?
      AND (owners.${q('user_id')} IS NOT NULL OR editors.${q('user_id')} IS NOT NULL)
    ORDER BY p.${q('sort_order')} ASC, p.${q(work.idColumn)} ASC
  `;
};

test('rename functional parity contract', async (t) => {
  const routes = buildRoutes();
  const expectedObjects = buildExpectedObjects();
  const expectedColumns = getColumnContract();
  const { container, work } = PARITY_CONTRACT.vocab;
  const { requestKeys, responseKeys, responseShapes } = PARITY_CONTRACT.api;

  await t.test('db schema contract matches expected names and columns', async () => {
    await withDbHarness(async ({ db }) => {
      assert.deepEqual(getObjectNames(db, 'table'), expectedObjects.tables);
      assert.deepEqual(getObjectNames(db, 'index'), expectedObjects.indexes);
      assert.deepEqual(getObjectNames(db, 'trigger'), expectedObjects.triggers);

      for (const [tableName, expected] of Object.entries(expectedColumns)) {
        assert.deepEqual(
          getTableColumns(db, tableName),
          expected,
          `Column contract mismatch for table ${tableName}`,
        );
      }
    });
  });

  await t.test('db triggers enforce allowed and forbidden writes', async () => {
    await withDbHarness(async ({ db, stmts }) => {
      const now = nowIso();

      insertUser(stmts, { userId: 'usr_owner', sub: 'owner-sub', name: 'Owner', email: 'owner@example.com', now });
      insertUser(stmts, { userId: 'usr_member', sub: 'member-sub', name: 'Member', email: 'member@example.com', now });
      insertUser(stmts, { userId: 'usr_outsider', sub: 'outsider-sub', name: 'Outsider', email: 'outsider@example.com', now });

      insertContainer(stmts, { containerId: 'prj_alpha', ownerUserId: 'usr_owner', name: 'Alpha', now });
      insertContainer(stmts, { containerId: 'prj_beta', ownerUserId: 'usr_owner', name: 'Beta', now });
      insertContainerMember(stmts, { containerId: 'prj_alpha', userId: 'usr_owner', role: 'owner', now });
      insertContainerMember(stmts, { containerId: 'prj_alpha', userId: 'usr_member', role: 'member', now });
      insertContainerMember(stmts, { containerId: 'prj_beta', userId: 'usr_owner', role: 'owner', now });

      insertWork(stmts, { workId: 'pan_alpha_a', containerId: 'prj_alpha', name: 'Alpha A', createdBy: 'usr_owner', sortOrder: 1, position: 1, now });
      insertWork(stmts, { workId: 'pan_alpha_b', containerId: 'prj_alpha', name: 'Alpha B', createdBy: 'usr_owner', sortOrder: 2, position: 2, now });
      insertWork(stmts, { workId: 'pan_beta_a', containerId: 'prj_beta', name: 'Beta A', createdBy: 'usr_owner', sortOrder: 1, position: 1, now });
      insertDoc(stmts, { docId: 'doc_alpha_a', workId: 'pan_alpha_a', now });
      insertDoc(stmts, { docId: 'doc_alpha_b', workId: 'pan_alpha_b', now });

      insertCollection(stmts, { collectionId: 'col_alpha_a', containerId: 'prj_alpha', name: 'Alpha Tasks', now });
      insertCollection(stmts, { collectionId: 'col_alpha_b', containerId: 'prj_alpha', name: 'Alpha Notes', now });
      insertCollection(stmts, { collectionId: 'col_beta_a', containerId: 'prj_beta', name: 'Beta Tasks', now });
      insertField(stmts, { fieldId: 'fld_alpha_rel', collectionId: 'col_alpha_a', config: { target_collection_id: 'col_alpha_a' }, now });
      insertField(stmts, { fieldId: 'fld_beta_rel', collectionId: 'col_beta_a', config: { target_collection_id: 'col_beta_a' }, now });

      insertRecord(stmts, {
        recordId: 'rec_alpha_source',
        containerId: 'prj_alpha',
        collectionId: 'col_alpha_a',
        title: 'Alpha Source',
        sourceWorkId: 'pan_alpha_a',
        createdBy: 'usr_owner',
        now,
      });
      insertRecord(stmts, {
        recordId: 'rec_alpha_target',
        containerId: 'prj_alpha',
        collectionId: 'col_alpha_a',
        title: 'Alpha Target',
        sourceWorkId: 'pan_alpha_a',
        createdBy: 'usr_owner',
        now,
      });
      insertRecord(stmts, {
        recordId: 'rec_beta_source',
        containerId: 'prj_beta',
        collectionId: 'col_beta_a',
        title: 'Beta Source',
        sourceWorkId: 'pan_beta_a',
        createdBy: 'usr_owner',
        now,
      });

      insertWorkMember(stmts, { workId: 'pan_alpha_a', userId: 'usr_member', now });
      assert.throws(
        () => insertWorkMember(stmts, { workId: 'pan_alpha_a', userId: 'usr_outsider', now }),
        new RegExp(PARITY_CONTRACT.db.triggerErrors.projectMembersSubset),
      );

      insertRecord(stmts, {
        recordId: 'rec_consistent_insert',
        containerId: 'prj_alpha',
        collectionId: 'col_alpha_a',
        title: 'Consistent Insert',
        createdBy: 'usr_owner',
        now,
      });
      assert.throws(
        () => insertRecord(stmts, {
          recordId: 'rec_inconsistent_insert',
          containerId: 'prj_alpha',
          collectionId: 'col_beta_a',
          title: 'Inconsistent Insert',
          createdBy: 'usr_owner',
          now,
        }),
        new RegExp(PARITY_CONTRACT.db.triggerErrors.recordsCollectionProject),
      );

      db.prepare(`UPDATE ${q('records')} SET ${q('collection_id')} = ? WHERE ${q('record_id')} = ?`)
        .run('col_alpha_b', 'rec_consistent_insert');
      db.prepare(`UPDATE ${q('records')} SET ${q('title')} = ? WHERE ${q('record_id')} = ?`)
        .run('Consistent Insert Renamed', 'rec_consistent_insert');
      assert.equal(
        db.prepare(`SELECT ${q('title')} AS title FROM ${q('records')} WHERE ${q('record_id')} = ?`).get('rec_consistent_insert').title,
        'Consistent Insert Renamed',
      );
      assert.throws(
        () => db.prepare(`UPDATE ${q('records')} SET ${q(container.idColumn)} = ? WHERE ${q('record_id')} = ?`)
          .run('prj_beta', 'rec_consistent_insert'),
        new RegExp(PARITY_CONTRACT.db.triggerErrors.recordsCollectionProject),
      );

      insertRelation(stmts, {
        relationId: 'rel_consistent_insert',
        containerId: 'prj_alpha',
        fromRecordId: 'rec_alpha_source',
        toRecordId: 'rec_alpha_target',
        viaFieldId: 'fld_alpha_rel',
        createdBy: 'usr_owner',
        now,
      });
      assert.throws(
        () => insertRelation(stmts, {
          relationId: 'rel_inconsistent_insert',
          containerId: 'prj_alpha',
          fromRecordId: 'rec_alpha_source',
          toRecordId: 'rec_beta_source',
          viaFieldId: 'fld_alpha_rel',
          createdBy: 'usr_owner',
          now,
        }),
        new RegExp(PARITY_CONTRACT.db.triggerErrors.recordRelationsProject),
      );

      insertRecord(stmts, {
        recordId: 'rec_alpha_third',
        containerId: 'prj_alpha',
        collectionId: 'col_alpha_a',
        title: 'Alpha Third',
        createdBy: 'usr_owner',
        now,
      });
      insertField(stmts, {
        fieldId: 'fld_alpha_rel_two',
        collectionId: 'col_alpha_a',
        config: { target_collection_id: 'col_alpha_a' },
        now,
      });
      db.prepare(`UPDATE ${q('record_relations')} SET ${q('to_record_id')} = ? WHERE ${q('relation_id')} = ?`)
        .run('rec_alpha_third', 'rel_consistent_insert');
      db.prepare(`UPDATE ${q('record_relations')} SET ${q(PARITY_CONTRACT.api.relationFieldKey)} = ? WHERE ${q('relation_id')} = ?`)
        .run('fld_alpha_rel_two', 'rel_consistent_insert');
      assert.equal(
        db.prepare(`SELECT ${q(PARITY_CONTRACT.api.relationFieldKey)} AS via_field_id FROM ${q('record_relations')} WHERE ${q('relation_id')} = ?`).get('rel_consistent_insert').via_field_id,
        'fld_alpha_rel_two',
      );
      assert.throws(
        () => db.prepare(`UPDATE ${q('record_relations')} SET ${q(container.idColumn)} = ?, ${q('to_record_id')} = ? WHERE ${q('relation_id')} = ?`)
          .run('prj_beta', 'rec_alpha_third', 'rel_consistent_insert'),
        new RegExp(PARITY_CONTRACT.db.triggerErrors.recordRelationsProject),
      );

      insertComment(stmts, {
        commentId: 'cmt_doc_ok',
        containerId: 'prj_alpha',
        authorUserId: 'usr_owner',
        targetEntityType: 'doc',
        targetEntityId: 'doc_alpha_a',
        now,
      });
      insertCommentAnchor(stmts, { commentId: 'cmt_doc_ok', docId: 'doc_alpha_a', now });

      insertComment(stmts, {
        commentId: 'cmt_record_bad',
        containerId: 'prj_alpha',
        authorUserId: 'usr_owner',
        targetEntityType: 'record',
        targetEntityId: 'rec_alpha_source',
        now,
      });
      assert.throws(
        () => insertCommentAnchor(stmts, { commentId: 'cmt_record_bad', docId: 'doc_alpha_a', now }),
        new RegExp(PARITY_CONTRACT.db.triggerErrors.commentAnchorDocTarget),
      );

      insertComment(stmts, {
        commentId: 'cmt_bad_anchor_insert',
        containerId: 'prj_alpha',
        authorUserId: 'usr_owner',
        targetEntityType: 'doc',
        targetEntityId: 'doc_alpha_b',
        now,
      });
      assert.throws(
        () => insertCommentAnchor(stmts, {
          commentId: 'cmt_bad_anchor_insert',
          docId: 'doc_alpha_b',
          anchorPayload: { kind: 'text' },
          now,
        }),
        new RegExp(PARITY_CONTRACT.db.triggerErrors.commentAnchorNodeKey),
      );

      insertComment(stmts, {
        commentId: 'cmt_bad_anchor_update',
        containerId: 'prj_alpha',
        authorUserId: 'usr_owner',
        targetEntityType: 'doc',
        targetEntityId: 'doc_alpha_b',
        now,
      });
      insertCommentAnchor(stmts, { commentId: 'cmt_bad_anchor_update', docId: 'doc_alpha_b', now });
      db.prepare(`UPDATE ${q('comment_anchors')} SET ${q('updated_at')} = ? WHERE ${q('comment_id')} = ?`)
        .run(nowIso(), 'cmt_bad_anchor_update');
      assert.equal(getRowCount(db, 'comment_anchors', `${q('comment_id')} = ?`, ['cmt_bad_anchor_update']), 1);
      assert.throws(
        () => db.prepare(`UPDATE ${q('comment_anchors')} SET ${q('anchor_payload')} = ? WHERE ${q('comment_id')} = ?`)
          .run(JSON.stringify({ kind: 'text' }), 'cmt_bad_anchor_update'),
        new RegExp(PARITY_CONTRACT.db.triggerErrors.commentAnchorNodeKey),
      );
    });
  });

  await t.test('db cascades and access queries preserve semantics', async () => {
    await withDbHarness(async ({ db, stmts }) => {
      const now = nowIso();

      insertUser(stmts, { userId: 'usr_owner', sub: 'owner-sub', name: 'Owner', email: 'owner@example.com', now });
      insertUser(stmts, { userId: 'usr_member', sub: 'member-sub', name: 'Member', email: 'member@example.com', now });
      insertUser(stmts, { userId: 'usr_extra', sub: 'extra-sub', name: 'Extra', email: 'extra@example.com', now });

      insertContainer(stmts, { containerId: 'prj_cascade', ownerUserId: 'usr_owner', name: 'Cascade', now });
      insertContainer(stmts, { containerId: 'prj_other', ownerUserId: 'usr_owner', name: 'Other', now });
      insertContainerMember(stmts, { containerId: 'prj_cascade', userId: 'usr_owner', role: 'owner', now });
      insertContainerMember(stmts, { containerId: 'prj_cascade', userId: 'usr_member', role: 'member', now });
      insertContainerMember(stmts, { containerId: 'prj_other', userId: 'usr_owner', role: 'owner', now });

      insertWork(stmts, { workId: 'pan_shared', containerId: 'prj_cascade', name: 'Shared', createdBy: 'usr_owner', sortOrder: 1, position: 1, now });
      insertWork(stmts, { workId: 'pan_private', containerId: 'prj_cascade', name: 'Private', createdBy: 'usr_owner', sortOrder: 2, position: 2, now });
      insertWork(stmts, { workId: 'pan_other', containerId: 'prj_other', name: 'Other', createdBy: 'usr_owner', sortOrder: 1, position: 1, now });
      insertDoc(stmts, { docId: 'doc_shared', workId: 'pan_shared', now });
      insertDoc(stmts, { docId: 'doc_private', workId: 'pan_private', now });
      insertDoc(stmts, { docId: 'doc_other', workId: 'pan_other', now });
      insertWorkMember(stmts, { workId: 'pan_shared', userId: 'usr_member', now });

      insertCollection(stmts, { collectionId: 'col_cascade', containerId: 'prj_cascade', name: 'Tasks', now });
      insertCollection(stmts, { collectionId: 'col_other', containerId: 'prj_other', name: 'Other Tasks', now });
      insertField(stmts, { fieldId: 'fld_rel', collectionId: 'col_cascade', config: { target_collection_id: 'col_cascade' }, now });
      insertRecord(stmts, {
        recordId: 'rec_cascade',
        containerId: 'prj_cascade',
        collectionId: 'col_cascade',
        title: 'Cascade Record',
        sourceWorkId: 'pan_shared',
        createdBy: 'usr_owner',
        now,
      });
      insertAssetRoot(stmts, { assetRootId: 'ast_cascade', containerId: 'prj_cascade', rootPath: '/Parity/Cascade', now });
      insertFile(stmts, {
        fileId: 'fil_cascade',
        containerId: 'prj_cascade',
        assetRootId: 'ast_cascade',
        providerPath: 'Uploads/cascade.txt',
        name: 'cascade.txt',
        createdBy: 'usr_owner',
        now,
      });
      insertAttachment(stmts, {
        attachmentId: 'att_cascade',
        containerId: 'prj_cascade',
        entityType: 'record',
        entityId: 'rec_cascade',
        assetRootId: 'ast_cascade',
        assetPath: 'Uploads/cascade.txt',
        name: 'cascade.txt',
        createdBy: 'usr_owner',
        now,
      });
      insertRecord(stmts, {
        recordId: 'rec_other',
        containerId: 'prj_other',
        collectionId: 'col_other',
        title: 'Other Record',
        sourceWorkId: 'pan_other',
        createdBy: 'usr_owner',
        now,
      });
      insertAssetRoot(stmts, { assetRootId: 'ast_other', containerId: 'prj_other', rootPath: '/Parity/Other', now });
      insertFile(stmts, {
        fileId: 'fil_other',
        containerId: 'prj_other',
        assetRootId: 'ast_other',
        providerPath: 'Uploads/other.txt',
        name: 'other.txt',
        createdBy: 'usr_owner',
        now,
      });
      insertAttachment(stmts, {
        attachmentId: 'att_other',
        containerId: 'prj_other',
        entityType: 'record',
        entityId: 'rec_other',
        assetRootId: 'ast_other',
        assetPath: 'Uploads/other.txt',
        name: 'other.txt',
        createdBy: 'usr_owner',
        now,
      });

      const accessibleWorkStmt = db.prepare(buildAccessibleWorkQuery());
      assert.deepEqual(
        accessibleWorkStmt.all('usr_owner', 'usr_owner', 'prj_cascade').map((row) => row.work_id),
        ['pan_shared', 'pan_private'],
      );
      assert.deepEqual(
        accessibleWorkStmt.all('usr_member', 'usr_member', 'prj_cascade').map((row) => row.work_id),
        ['pan_shared'],
      );
      assert.deepEqual(
        accessibleWorkStmt.all('usr_extra', 'usr_extra', 'prj_cascade').map((row) => row.work_id),
        [],
      );
      db.prepare(`DELETE FROM ${q(work.memberTable)} WHERE ${q(work.idColumn)} = ? AND ${q('user_id')} = ?`).run('pan_shared', 'usr_member');
      assert.deepEqual(
        accessibleWorkStmt.all('usr_member', 'usr_member', 'prj_cascade').map((row) => row.work_id),
        [],
      );
      insertWorkMember(stmts, { workId: 'pan_shared', userId: 'usr_member', now });
      assert.deepEqual(
        accessibleWorkStmt.all('usr_member', 'usr_member', 'prj_other').map((row) => row.work_id),
        [],
      );
      assert.deepEqual(
        accessibleWorkStmt.all('usr_member', 'usr_member', 'prj_missing').map((row) => row.work_id),
        [],
      );

      db.prepare(`DELETE FROM ${q(work.table)} WHERE ${q(work.idColumn)} = ?`).run('pan_shared');
      assert.deepEqual(
        accessibleWorkStmt.all('usr_owner', 'usr_owner', 'prj_cascade').map((row) => row.work_id),
        ['pan_private'],
      );
      const recordAfterProjectDelete = db.prepare(`SELECT ${q('source_project_id')} AS work_id FROM ${q('records')} WHERE ${q('record_id')} = ?`).get('rec_cascade');
      assert.equal(recordAfterProjectDelete.work_id, null);

      db.prepare(`DELETE FROM ${q('users')} WHERE ${q('user_id')} = ?`).run('usr_member');
      assert.equal(getRowCount(db, container.memberTable, `${q('user_id')} = ?`, ['usr_member']), 0);
      assert.equal(getRowCount(db, work.memberTable, `${q('user_id')} = ?`, ['usr_member']), 0);

      db.prepare(`DELETE FROM ${q(container.table)} WHERE ${q(container.idColumn)} = ?`).run('prj_cascade');
      assert.equal(getRowCount(db, work.table, `${q(container.idColumn)} = ?`, ['prj_cascade']), 0);
      assert.equal(getRowCount(db, 'docs', `${q(work.idColumn)} = ?`, ['pan_shared']), 0);
      assert.equal(getRowCount(db, 'docs', `${q(work.idColumn)} = ?`, ['pan_private']), 0);
      assert.equal(getRowCount(db, 'collections', `${q(container.idColumn)} = ?`, ['prj_cascade']), 0);
      assert.equal(getRowCount(db, 'records', `${q(container.idColumn)} = ?`, ['prj_cascade']), 0);
      assert.equal(getRowCount(db, 'asset_roots', `${q(container.idColumn)} = ?`, ['prj_cascade']), 0);
      assert.equal(getRowCount(db, 'files', `${q(container.idColumn)} = ?`, ['prj_cascade']), 0);
      assert.equal(getRowCount(db, 'entity_attachments', `${q(container.idColumn)} = ?`, ['prj_cascade']), 0);
      assert.equal(getRowCount(db, container.table, `${q(container.idColumn)} = ?`, ['prj_other']), 1);
      assert.equal(getRowCount(db, work.table, `${q(container.idColumn)} = ?`, ['prj_other']), 1);
      assert.equal(getRowCount(db, 'docs', `${q(work.idColumn)} = ?`, ['pan_other']), 1);
      assert.equal(getRowCount(db, 'collections', `${q(container.idColumn)} = ?`, ['prj_other']), 1);
      assert.equal(getRowCount(db, 'records', `${q(container.idColumn)} = ?`, ['prj_other']), 1);
      assert.equal(getRowCount(db, 'asset_roots', `${q(container.idColumn)} = ?`, ['prj_other']), 1);
      assert.equal(getRowCount(db, 'files', `${q(container.idColumn)} = ?`, ['prj_other']), 1);
      assert.equal(getRowCount(db, 'entity_attachments', `${q(container.idColumn)} = ?`, ['prj_other']), 1);
    });
  });

  await t.test('db search triggers keep rename-sensitive FTS mirrors in sync', async () => {
    await withDbHarness(async ({ db, stmts }) => {
      const now = nowIso();
      insertUser(stmts, { userId: 'usr_owner', sub: 'owner-sub', name: 'Owner', email: 'owner@example.com', now });
      insertContainer(stmts, { containerId: 'prj_search', ownerUserId: 'usr_owner', name: 'Search Alpha', now });
      insertContainerMember(stmts, { containerId: 'prj_search', userId: 'usr_owner', role: 'owner', now });
      insertWork(stmts, { workId: 'pan_search', containerId: 'prj_search', name: 'Search Project', createdBy: 'usr_owner', now });
      insertCollection(stmts, { collectionId: 'col_search', containerId: 'prj_search', name: 'Search Tasks', now });
      insertRecord(stmts, {
        recordId: 'rec_search',
        containerId: 'prj_search',
        collectionId: 'col_search',
        title: 'Search Record',
        sourceWorkId: 'pan_search',
        createdBy: 'usr_owner',
        now,
      });

      const projectSearchRow = db.prepare(`SELECT * FROM ${q(container.searchTable)} WHERE ${q(container.idColumn)} = ?`).get('prj_search');
      assert.equal(projectSearchRow.name, 'Search Alpha');
      const workProjectSearchRow = db.prepare(`SELECT * FROM ${q(work.searchTable)} WHERE ${q(work.idColumn)} = ?`).get('pan_search');
      assert.equal(workProjectSearchRow.name, 'Search Project');
      const recordSearchRow = db.prepare(`SELECT * FROM ${q('search_records_fts')} WHERE ${q('record_id')} = ?`).get('rec_search');
      assert.equal(recordSearchRow.title, 'Search Record');

      const initialProjectSearchCount = getRowCount(db, container.searchTable);
      const initialWorkProjectSearchCount = getRowCount(db, work.searchTable);
      const initialRecordSearchCount = getRowCount(db, 'search_records_fts');
      insertCollection(stmts, { collectionId: 'col_search_unrelated', containerId: 'prj_search', name: 'Search Unrelated', now });
      assert.equal(getRowCount(db, container.searchTable), initialProjectSearchCount);
      assert.equal(getRowCount(db, work.searchTable), initialWorkProjectSearchCount);
      assert.equal(getRowCount(db, 'search_records_fts'), initialRecordSearchCount);

      db.prepare(`UPDATE ${q(container.table)} SET ${q('position')} = ? WHERE ${q(container.idColumn)} = ?`).run(42, 'prj_search');
      db.prepare(`UPDATE ${q(work.table)} SET ${q('position')} = ? WHERE ${q(work.idColumn)} = ?`).run(12, 'pan_search');
      db.prepare(`UPDATE ${q('records')} SET ${q('updated_at')} = ? WHERE ${q('record_id')} = ?`).run(nowIso(), 'rec_search');
      assert.equal(
        db.prepare(`SELECT ${q('name')} AS name FROM ${q(container.searchTable)} WHERE ${q(container.idColumn)} = ?`).get('prj_search').name,
        'Search Alpha',
      );
      assert.equal(
        db.prepare(`SELECT ${q('name')} AS name FROM ${q(work.searchTable)} WHERE ${q(work.idColumn)} = ?`).get('pan_search').name,
        'Search Project',
      );
      assert.equal(
        db.prepare(`SELECT ${q('title')} AS title FROM ${q('search_records_fts')} WHERE ${q('record_id')} = ?`).get('rec_search').title,
        'Search Record',
      );

      db.prepare(`UPDATE ${q(container.table)} SET ${q('name')} = ? WHERE ${q(container.idColumn)} = ?`).run('Search Beta', 'prj_search');
      db.prepare(`UPDATE ${q(work.table)} SET ${q('name')} = ? WHERE ${q(work.idColumn)} = ?`).run('Search Project Beta', 'pan_search');
      db.prepare(`UPDATE ${q('records')} SET ${q('title')} = ? WHERE ${q('record_id')} = ?`).run('Search Record Beta', 'rec_search');

      assert.equal(
        db.prepare(`SELECT ${q('name')} AS name FROM ${q(container.searchTable)} WHERE ${q(container.idColumn)} = ?`).get('prj_search').name,
        'Search Beta',
      );
      assert.equal(
        db.prepare(`SELECT ${q('name')} AS name FROM ${q(work.searchTable)} WHERE ${q(work.idColumn)} = ?`).get('pan_search').name,
        'Search Project Beta',
      );
      assert.equal(
        db.prepare(`SELECT ${q('title')} AS title FROM ${q('search_records_fts')} WHERE ${q('record_id')} = ?`).get('rec_search').title,
        'Search Record Beta',
      );

      db.prepare(`DELETE FROM ${q('records')} WHERE ${q('record_id')} = ?`).run('rec_search');
      db.prepare(`DELETE FROM ${q(work.table)} WHERE ${q(work.idColumn)} = ?`).run('pan_search');
      db.prepare(`DELETE FROM ${q(container.table)} WHERE ${q(container.idColumn)} = ?`).run('prj_search');

      assert.equal(getRowCount(db, 'search_records_fts', `${q('record_id')} = ?`, ['rec_search']), 0);
      assert.equal(getRowCount(db, work.searchTable, `${q(work.idColumn)} = ?`, ['pan_search']), 0);
      assert.equal(getRowCount(db, container.searchTable, `${q(container.idColumn)} = ?`, ['prj_search']), 0);
    });
  });

  await t.test('api routes preserve functional parity with current names', async () => {
    const harness = await startApiHarness();
    try {
      const ownerToken = signJwt(harness.privateKey, harness.issuer, 'owner-sub', 'Owner User', 'owner@example.com');
      const memberToken = signJwt(harness.privateKey, harness.issuer, 'member-sub', 'Member User', 'member@example.com');
      const extraToken = signJwt(harness.privateKey, harness.issuer, 'extra-sub', 'Extra User', 'extra@example.com');

      await expectStatus(harness.apiBaseUrl, null, routes.me, 401, { method: 'GET' });
      await expectStatus(harness.apiBaseUrl, null, routes.projects, 401, { method: 'GET' });
      await expectOk(harness.apiBaseUrl, ownerToken, routes.me, { method: 'GET' });
      const memberSession = await expectOk(harness.apiBaseUrl, memberToken, routes.me, { method: 'GET' });
      const extraSession = await expectOk(harness.apiBaseUrl, extraToken, routes.me, { method: 'GET' });
      const memberId = memberSession.user.user_id;
      const extraId = extraSession.user.user_id;

      const createdProject = await expectOkStatus(harness.apiBaseUrl, ownerToken, routes.projects, 201, {
        method: 'POST',
        body: JSON.stringify({
          [requestKeys.name]: 'Parity Space',
          [container.idColumn]: 'prj_api_parity',
        }),
      });
      assertExactKeys(createdProject, ['space'], 'createdProject');
      assertExactKeys(createdProject.space, responseShapes.project, 'createdProject.space');
      assert.equal(createdProject.space[container.idColumn], 'prj_api_parity');
      assert.equal(createdProject.space.name, 'Parity Space');

      await expectStatus(harness.apiBaseUrl, ownerToken, routes.projects, 409, {
        method: 'POST',
        body: JSON.stringify({
          [requestKeys.name]: 'Parity Space Duplicate',
          [container.idColumn]: 'prj_api_parity',
        }),
      });
      await expectStatus(harness.apiBaseUrl, ownerToken, routes.projects, 400, {
        method: 'POST',
        body: JSON.stringify({
          [container.idColumn]: 'prj_missing_name',
        }),
      });

      const listedProjects = await expectOkStatus(harness.apiBaseUrl, ownerToken, routes.projects, 200, { method: 'GET' });
      assert.equal(Array.isArray(listedProjects[container.jsonCollectionKey]), true);
      assertExactKeys(listedProjects, [container.jsonCollectionKey], 'listedProjects');
      assertExactArrayItemKeys(listedProjects[container.jsonCollectionKey], responseShapes.project, 'listedProjects.projects');
      assert.equal(
        listedProjects[container.jsonCollectionKey].some((project) => project[container.idColumn] === 'prj_api_parity'),
        true,
      );

      await expectStatus(harness.apiBaseUrl, extraToken, routes.project('prj_api_parity'), 404, { method: 'GET' });
      await expectStatus(harness.apiBaseUrl, extraToken, routes.projectProjects('prj_api_parity'), 403, { method: 'GET' });
      const fetchedProject = await expectOkStatus(harness.apiBaseUrl, ownerToken, routes.project('prj_api_parity'), 200, { method: 'GET' });
      assertExactKeys(fetchedProject, ['space'], 'fetchedProject');
      assertExactKeys(fetchedProject.space, responseShapes.project, 'fetchedProject.space');
      assert.equal(fetchedProject.space[container.idColumn], 'prj_api_parity');

      const updatedProject = await expectOkStatus(harness.apiBaseUrl, ownerToken, routes.project('prj_api_parity'), 200, {
        method: 'PATCH',
        body: JSON.stringify({ [requestKeys.name]: 'Parity Space Renamed', [requestKeys.position]: 7 }),
      });
      assertExactKeys(updatedProject, ['space'], 'updatedProject');
      assertExactKeys(updatedProject.space, responseShapes.project, 'updatedProject.space');
      assert.equal(updatedProject.space.name, 'Parity Space Renamed');
      assert.equal(updatedProject.space.position, 7);
      await expectStatus(harness.apiBaseUrl, ownerToken, routes.project('prj_api_parity'), 400, {
        method: 'PATCH',
        body: JSON.stringify({ [requestKeys.position]: -1 }),
      });

      const addedMember = await expectOkStatus(harness.apiBaseUrl, ownerToken, routes.projectMembers('prj_api_parity'), 200, {
        method: 'POST',
        body: JSON.stringify({ [requestKeys.userId]: memberId, [requestKeys.role]: 'member' }),
      });
      assertExactKeys(addedMember, responseShapes.projectMemberMutation, 'addedMember');
      await expectStatus(harness.apiBaseUrl, ownerToken, routes.projectMembers('prj_api_parity'), 409, {
        method: 'POST',
        body: JSON.stringify({ [requestKeys.userId]: memberId, [requestKeys.role]: 'member' }),
      });
      const addedExtraMember = await expectOkStatus(harness.apiBaseUrl, ownerToken, routes.projectMembers('prj_api_parity'), 200, {
        method: 'POST',
        body: JSON.stringify({ [requestKeys.userId]: extraId, [requestKeys.role]: 'member' }),
      });
      assertExactKeys(addedExtraMember, responseShapes.projectMemberMutation, 'addedExtraMember');

      const membersPayload = await expectOkStatus(harness.apiBaseUrl, ownerToken, routes.projectMembers('prj_api_parity'), 200, {
        method: 'GET',
      });
      assertExactKeys(membersPayload, [responseKeys.members, responseKeys.pendingInvites], 'membersPayload');
      assert.equal(Array.isArray(membersPayload[container.jsonMemberCollectionKey]), true);
      assert.equal(Array.isArray(membersPayload[container.jsonInviteCollectionKey]), true);
      assertExactArrayItemKeys(membersPayload[container.jsonMemberCollectionKey], responseShapes.projectMember, 'membersPayload.members');
      assert.equal(
        membersPayload[container.jsonMemberCollectionKey].some((member) => member.user_id === memberId),
        true,
      );

      const ownerDefaultProjects = await expectOkStatus(harness.apiBaseUrl, ownerToken, routes.projectProjects('prj_api_parity'), 200, {
        method: 'GET',
      });
      assertExactKeys(ownerDefaultProjects, [work.jsonCollectionKey], 'ownerDefaultProjects');
      assertExactArrayItemKeys(ownerDefaultProjects[work.jsonCollectionKey], responseShapes.work, 'ownerDefaultProjects.projects');
      const defaultProject = ownerDefaultProjects[work.jsonCollectionKey][0];
      assert.ok(defaultProject[work.idColumn]);
      assert.equal(defaultProject[container.idColumn], 'prj_api_parity');

      const assignedProject = await expectOkStatus(harness.apiBaseUrl, ownerToken, routes.projectProjects('prj_api_parity'), 201, {
        method: 'POST',
        body: JSON.stringify({
          [requestKeys.name]: 'Member Project',
          [requestKeys.pinned]: true,
          [requestKeys.layoutConfig]: { widgets: [] },
          [requestKeys.position]: 2,
          [requestKeys.sortOrder]: 2,
          [PARITY_CONTRACT.api.memberUserIdsKey]: [memberId],
        }),
      });
      assertExactKeys(assignedProject, ['project'], 'assignedProject');
      assertExactKeys(assignedProject.project, responseShapes.work, 'assignedProject.project');
      assert.equal(assignedProject.project[container.idColumn], 'prj_api_parity');
      assert.ok(assignedProject.project[work.idColumn]);

      const privateProject = await expectOkStatus(harness.apiBaseUrl, ownerToken, routes.projectProjects('prj_api_parity'), 201, {
        method: 'POST',
        body: JSON.stringify({
          [requestKeys.name]: 'Owner Only Project',
          [requestKeys.pinned]: false,
          [requestKeys.layoutConfig]: { widgets: [] },
          [requestKeys.position]: 3,
          [requestKeys.sortOrder]: 3,
        }),
      });
      assertExactKeys(privateProject, ['project'], 'privateProject');
      assertExactKeys(privateProject.project, responseShapes.work, 'privateProject.project');

      const memberProjects = await expectOkStatus(harness.apiBaseUrl, memberToken, routes.projectProjects('prj_api_parity'), 200, {
        method: 'GET',
      });
      assertExactKeys(memberProjects, [work.jsonCollectionKey], 'memberProjects');
      assertExactArrayItemKeys(memberProjects[work.jsonCollectionKey], responseShapes.work, 'memberProjects.projects');
      assert.equal(memberProjects[work.jsonCollectionKey].length, 3);
      assert.equal(
        memberProjects[work.jsonCollectionKey].some(
          (project) => project[work.idColumn] === assignedProject.project[work.idColumn] && project.can_edit === true,
        ),
        true,
      );
      assert.equal(
        memberProjects[work.jsonCollectionKey].some(
          (project) => project[work.idColumn] === privateProject.project[work.idColumn] && project.can_edit === false,
        ),
        true,
      );

      const updatedWorkProject = await expectOkStatus(harness.apiBaseUrl, memberToken, routes.workProject(assignedProject.project[work.idColumn]), 200, {
        method: 'PATCH',
        body: JSON.stringify({
          [requestKeys.name]: 'Member Project Renamed',
          [requestKeys.pinned]: false,
          [requestKeys.position]: 4,
          [requestKeys.sortOrder]: 4,
          [requestKeys.layoutConfig]: { widgets: [], doc_binding_mode: 'owned' },
        }),
      });
      assertExactKeys(updatedWorkProject, ['project'], 'updatedWorkProject');
      assertExactKeys(updatedWorkProject.project, responseShapes.work, 'updatedWorkProject.project');
      assert.equal(updatedWorkProject.project.name, 'Member Project Renamed');
      assert.equal(updatedWorkProject.project[work.idColumn], assignedProject.project[work.idColumn]);

      await expectStatus(
        harness.apiBaseUrl,
        memberToken,
        routes.workProject(privateProject.project[work.idColumn]),
        403,
        {
          method: 'PATCH',
          body: JSON.stringify({ [requestKeys.name]: 'Forbidden Rename' }),
        },
      );

      const addedProjectMember = await expectOkStatus(harness.apiBaseUrl, ownerToken, routes.workProjectMembers(defaultProject[work.idColumn]), 200, {
        method: 'POST',
        body: JSON.stringify({ [requestKeys.userId]: extraId }),
      });
      assertExactKeys(addedProjectMember, ['project'], 'addedProjectMember');
      assertExactKeys(addedProjectMember.project, responseShapes.work, 'addedProjectMember.project');
      await expectStatus(harness.apiBaseUrl, ownerToken, routes.workProjectMembers(defaultProject[work.idColumn]), 400, {
        method: 'POST',
        body: JSON.stringify({ [requestKeys.userId]: 'usr_not_a_member' }),
      });

      const createdCollection = await expectOkStatus(harness.apiBaseUrl, ownerToken, routes.projectCollections('prj_api_parity'), 201, {
        method: 'POST',
        body: JSON.stringify({ [requestKeys.name]: 'Parity Records', icon: 'table', color: 'blue' }),
      });
      assertExactKeys(createdCollection, responseShapes.createdCollection, 'createdCollection');
      assert.ok(createdCollection[PARITY_CONTRACT.api.collectionKey]);

      const listedCollections = await expectOkStatus(harness.apiBaseUrl, ownerToken, routes.projectCollections('prj_api_parity'), 200, {
        method: 'GET',
      });
      assertExactKeys(listedCollections, [responseKeys.collections], 'listedCollections');
      assert.equal(Array.isArray(listedCollections.collections), true);
      assertExactArrayItemKeys(listedCollections.collections, responseShapes.collection, 'listedCollections.collections');
      assert.equal(
        listedCollections.collections.some((collection) => collection[PARITY_CONTRACT.api.collectionKey] === createdCollection[PARITY_CONTRACT.api.collectionKey]),
        true,
      );

      const createdField = await expectOkStatus(harness.apiBaseUrl, ownerToken, routes.collectionFields(createdCollection[PARITY_CONTRACT.api.collectionKey]), 201, {
        method: 'POST',
        body: JSON.stringify({
          [requestKeys.name]: 'Status',
          type: 'select',
          config: { options: ['todo', 'done'] },
        }),
      });
      assertExactKeys(createdField, responseShapes.createdField, 'createdField');
      assert.ok(createdField[PARITY_CONTRACT.api.fieldKey]);

      const listedFields = await expectOkStatus(harness.apiBaseUrl, ownerToken, routes.collectionFields(createdCollection[PARITY_CONTRACT.api.collectionKey]), 200, {
        method: 'GET',
      });
      assertExactKeys(listedFields, [responseKeys.fields], 'listedFields');
      assert.equal(Array.isArray(listedFields.fields), true);
      assertExactArrayItemKeys(listedFields.fields, responseShapes.field, 'listedFields.fields');
      assert.equal(
        listedFields.fields.some((field) => field[PARITY_CONTRACT.api.fieldKey] === createdField[PARITY_CONTRACT.api.fieldKey]),
        true,
      );

      const createdRecord = await expectOkStatus(harness.apiBaseUrl, ownerToken, routes.projectRecords('prj_api_parity'), 201, {
        method: 'POST',
        body: JSON.stringify({
          [PARITY_CONTRACT.api.collectionKey]: createdCollection[PARITY_CONTRACT.api.collectionKey],
          title: 'Parity Record',
          [requestKeys.sourceWorkId]: assignedProject.project[work.idColumn],
        }),
      });
      assertExactKeys(createdRecord, responseShapes.createdRecord, 'createdRecord');
      assert.ok(createdRecord[PARITY_CONTRACT.api.recordKey]);

      const initialRoots = await expectOkStatus(harness.apiBaseUrl, ownerToken, routes.projectAssetRoots('prj_api_parity'), 200, {
        method: 'GET',
      });
      assertExactKeys(initialRoots, [responseKeys.assetRoots], 'initialRoots');
      assert.equal(Array.isArray(initialRoots[responseKeys.assetRoots]), true);
      assertExactArrayItemKeys(initialRoots[responseKeys.assetRoots], responseShapes.assetRoot, 'initialRoots.assetRoots');
      assert.ok(initialRoots[responseKeys.assetRoots][0][PARITY_CONTRACT.api.assetRootKey]);
      const defaultRootId = initialRoots[responseKeys.assetRoots][0][PARITY_CONTRACT.api.assetRootKey];

      const extraRoot = await expectOkStatus(harness.apiBaseUrl, ownerToken, routes.projectAssetRoots('prj_api_parity'), 201, {
        method: 'POST',
        body: JSON.stringify({ [requestKeys.provider]: 'nextcloud', [requestKeys.rootPath]: '/Parity/Extra Root' }),
      });
      assertExactKeys(extraRoot, ['asset_root_id'], 'extraRoot');
      assert.ok(extraRoot[PARITY_CONTRACT.api.assetRootKey]);
      await expectStatus(harness.apiBaseUrl, ownerToken, routes.projectAssetRoots('prj_api_parity'), 400, {
        method: 'POST',
        body: JSON.stringify({ [requestKeys.provider]: 'dropbox', [requestKeys.rootPath]: '/Parity/Bad Root' }),
      });

      const assetUpload = await expectOkStatus(harness.apiBaseUrl, ownerToken, routes.projectAssetsUpload('prj_api_parity'), 200, {
        method: 'POST',
        body: JSON.stringify({
          [PARITY_CONTRACT.api.assetRootKey]: defaultRootId,
          [requestKeys.path]: 'Uploads',
          [requestKeys.name]: 'asset.txt',
          [requestKeys.mimeType]: 'text/plain',
          [requestKeys.contentBase64]: Buffer.from('asset-bytes', 'utf8').toString('base64'),
        }),
      });
      assertExactKeys(assetUpload, responseShapes.assetUpload, 'assetUpload');
      assert.equal(assetUpload.uploaded, true);
      assert.equal(assetUpload.asset_root_id, defaultRootId);
      assert.equal(assetUpload.path, 'Uploads/asset.txt');

      const listedAssets = await expectOkStatus(
        harness.apiBaseUrl,
        ownerToken,
        `${routes.projectAssetsList('prj_api_parity')}?asset_root_id=${encodeURIComponent(defaultRootId)}&path=/`,
        200,
        { method: 'GET' },
      );
      assertExactKeys(listedAssets, ['provider', 'path', responseKeys.entries], 'listedAssets');
      assert.equal(Array.isArray(listedAssets.entries), true);
      assertExactArrayItemKeys(listedAssets.entries, responseShapes.assetEntry, 'listedAssets.entries');
      assert.equal(listedAssets.entries.some((entry) => entry.path === 'Uploads'), true);

      const listedUploadDirectory = await expectOkStatus(
        harness.apiBaseUrl,
        ownerToken,
        `${routes.projectAssetsList('prj_api_parity')}?asset_root_id=${encodeURIComponent(defaultRootId)}&path=${encodeURIComponent('Uploads')}`,
        200,
        { method: 'GET' },
      );
      assertExactKeys(listedUploadDirectory, ['provider', 'path', responseKeys.entries], 'listedUploadDirectory');
      assertExactArrayItemKeys(listedUploadDirectory.entries, responseShapes.assetEntry, 'listedUploadDirectory.entries');
      assert.equal(listedUploadDirectory.entries.some((entry) => entry.path === 'Uploads/asset.txt'), true);

      const proxiedAssetResponse = await globalThis.fetch(
        new URL(
          `${routes.projectAssetsProxy('prj_api_parity')}?asset_root_id=${encodeURIComponent(defaultRootId)}&path=${encodeURIComponent('Uploads/asset.txt')}`,
          harness.apiBaseUrl,
        ),
        {
          headers: { Authorization: `Bearer ${ownerToken}` },
        },
      );
      assert.equal(proxiedAssetResponse.status, 200);
      assert.equal(await proxiedAssetResponse.text(), 'asset-bytes');

      const uploadedFile = await expectOkStatus(harness.apiBaseUrl, ownerToken, routes.filesUpload, 201, {
        method: 'POST',
        body: JSON.stringify({
          [requestKeys.projectId]: 'prj_api_parity',
          [requestKeys.name]: 'project-file.txt',
          [requestKeys.mimeType]: 'text/plain',
          [requestKeys.contentBase64]: Buffer.from('project-file', 'utf8').toString('base64'),
          [requestKeys.metadata]: {
            scope: 'space',
          },
        }),
      });
      assertExactKeys(uploadedFile, ['file'], 'uploadedFile');
      assertExactKeys(uploadedFile.file, responseShapes.file, 'uploadedFile.file');
      assert.equal(uploadedFile.file[container.idColumn], 'prj_api_parity');
      assert.equal(uploadedFile.file.name, 'project-file.txt');
      assert.ok(uploadedFile.file[PARITY_CONTRACT.api.proxyKey]);

      const projectScopedFile = await expectOkStatus(harness.apiBaseUrl, memberToken, routes.filesUpload, 201, {
        method: 'POST',
        body: JSON.stringify({
          [requestKeys.projectId]: 'prj_api_parity',
          [requestKeys.name]: 'project-file.txt',
          [requestKeys.mimeType]: 'text/plain',
          [requestKeys.contentBase64]: Buffer.from('project-file', 'utf8').toString('base64'),
          [requestKeys.mutationContextWorkId]: assignedProject.project[work.idColumn],
          [requestKeys.metadata]: {
            scope: 'project',
            [work.idColumn]: assignedProject.project[work.idColumn],
          },
        }),
      });
      assertExactKeys(projectScopedFile, ['file'], 'projectScopedFile');
      assertExactKeys(projectScopedFile.file, responseShapes.file, 'projectScopedFile.file');
      assert.equal(projectScopedFile.file[container.idColumn], 'prj_api_parity');
      assert.equal(projectScopedFile.file.metadata[work.idColumn], assignedProject.project[work.idColumn]);

      await expectStatus(harness.apiBaseUrl, memberToken, routes.filesUpload, 403, {
        method: 'POST',
        body: JSON.stringify({
          [requestKeys.projectId]: 'prj_api_parity',
          [requestKeys.name]: 'forbidden-project-file.txt',
          [requestKeys.mimeType]: 'text/plain',
          [requestKeys.contentBase64]: Buffer.from('nope', 'utf8').toString('base64'),
        }),
      });
      await expectStatus(harness.apiBaseUrl, ownerToken, routes.filesUpload, 400, {
        method: 'POST',
        body: JSON.stringify({
          [requestKeys.projectId]: 'prj_api_parity',
          [requestKeys.name]: 'bad-file.txt',
          [requestKeys.mimeType]: 'text/plain',
          [requestKeys.contentBase64]: 'not base64',
        }),
      });

      const listedFiles = await expectOkStatus(harness.apiBaseUrl, ownerToken, routes.projectFiles('prj_api_parity'), 200, { method: 'GET' });
      assertExactKeys(listedFiles, [responseKeys.files], 'listedFiles');
      assert.equal(Array.isArray(listedFiles.files), true);
      assertExactArrayItemKeys(listedFiles.files, responseShapes.listedFile, 'listedFiles.files');
      assert.equal(
        listedFiles.files.some((file) => file.file_id === uploadedFile.file.file_id),
        true,
      );

      const projectOnlyFiles = await expectOkStatus(
        harness.apiBaseUrl,
        ownerToken,
        `${routes.projectFiles('prj_api_parity')}?scope=project&project_id=${encodeURIComponent(assignedProject.project[work.idColumn])}`,
        200,
        { method: 'GET' },
      );
      assertExactKeys(projectOnlyFiles, [responseKeys.files], 'projectOnlyFiles');
      assertExactArrayItemKeys(projectOnlyFiles.files, responseShapes.listedFile, 'projectOnlyFiles.files');
      assert.deepEqual(
        projectOnlyFiles.files.map((file) => file.file_id),
        [projectScopedFile.file.file_id],
      );
      await expectStatus(
        harness.apiBaseUrl,
        ownerToken,
        `${routes.projectFiles('prj_api_parity')}?scope=project`,
        400,
        { method: 'GET' },
      );
      await expectStatus(
        harness.apiBaseUrl,
        ownerToken,
        `${routes.projectFiles('prj_api_parity')}?scope=project&project_id=${encodeURIComponent('prj_missing')}`,
        404,
        { method: 'GET' },
      );

      const createdAttachment = await expectOkStatus(harness.apiBaseUrl, memberToken, routes.attachments, 201, {
        method: 'POST',
        body: JSON.stringify({
          [requestKeys.projectId]: 'prj_api_parity',
          [requestKeys.entityType]: 'record',
          [requestKeys.entityId]: createdRecord.record_id,
          [requestKeys.provider]: projectScopedFile.file.provider,
          [PARITY_CONTRACT.api.assetRootKey]: projectScopedFile.file.asset_root_id,
          [requestKeys.assetPath]: projectScopedFile.file.asset_path,
          [requestKeys.name]: projectScopedFile.file.name,
          [requestKeys.mimeType]: projectScopedFile.file.mime_type,
          [requestKeys.sizeBytes]: projectScopedFile.file.size_bytes,
          [requestKeys.mutationContextWorkId]: assignedProject.project[work.idColumn],
          [requestKeys.metadata]: {
            [work.idColumn]: assignedProject.project[work.idColumn],
          },
        }),
      });
      assertExactKeys(createdAttachment, [PARITY_CONTRACT.api.attachmentKey, 'attachment'], 'createdAttachment');
      assertExactKeys(createdAttachment.attachment, responseShapes.attachment, 'createdAttachment.attachment');
      assert.equal(createdAttachment.attachment[container.idColumn], 'prj_api_parity');
      assert.ok(createdAttachment.attachment[PARITY_CONTRACT.api.attachmentKey]);

      const detachedAttachment = await expectOkStatus(
        harness.apiBaseUrl,
        memberToken,
        `${routes.attachment(createdAttachment[PARITY_CONTRACT.api.attachmentKey])}?${encodeURIComponent(requestKeys.mutationContextWorkId)}=${encodeURIComponent(assignedProject.project[work.idColumn])}`,
        200,
        { method: 'DELETE' },
      );
      assertExactKeys(detachedAttachment, [responseKeys.deleted], 'detachedAttachment');
      assert.equal(detachedAttachment.deleted, true);

      const deletedAsset = await expectOkStatus(
        harness.apiBaseUrl,
        ownerToken,
        `${routes.projectAssetsDelete('prj_api_parity')}?asset_root_id=${encodeURIComponent(defaultRootId)}&path=${encodeURIComponent('Uploads/asset.txt')}`,
        200,
        { method: 'DELETE' },
      );
      assertExactKeys(deletedAsset, [responseKeys.deleted], 'deletedAsset');
      assert.equal(deletedAsset.deleted, true);

      const removedMember = await expectOkStatus(harness.apiBaseUrl, ownerToken, routes.projectMember('prj_api_parity', extraId), 200, { method: 'DELETE' });
      assertExactKeys(removedMember, [responseKeys.removed], 'removedMember');
      assert.equal(removedMember.removed, true);
      await expectStatus(harness.apiBaseUrl, extraToken, routes.project('prj_api_parity'), 404, { method: 'GET' });
    } finally {
      await harness.stop();
    }
  });
});
