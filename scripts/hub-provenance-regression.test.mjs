import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { generateKeyPairSync, createSign } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import WebSocket from 'ws';
import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as encoding from 'lib0/encoding';
import { DatabaseSync } from 'node:sqlite';
import {
  buildEventDestinationHref,
  buildNotificationDestinationHref,
  buildTaskDestinationHref,
} from '../src/lib/hubRoutes.ts';

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
      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
  });

const nowIso = () => new Date().toISOString();

const base64Url = (value) => Buffer.from(value).toString('base64url');

const jsonBase64Url = (value) => base64Url(JSON.stringify(value));

const signJwt = (privateKey, issuer, sub, name, email) => {
  const header = { alg: 'RS256', kid: 'test-kid', typ: 'JWT' };
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
    getStderr: () => stderr,
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
      const response = await fetch(url);
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

const readEnvelope = async (response) => {
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

const requestHub = async (baseUrl, token, pathName, init = {}) => {
  const headers = new Headers(init.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const response = await fetch(new URL(pathName, baseUrl), {
    ...init,
    headers,
  });
  return readEnvelope(response);
};

const expectOk = async (baseUrl, token, pathName, init = {}) => {
  const envelope = await requestHub(baseUrl, token, pathName, init);
  assert.equal(envelope.ok, true, `${pathName} should succeed`);
  assert.ok(envelope.data, `${pathName} should include data`);
  return envelope.data;
};

const expectStatus = async (baseUrl, token, pathName, status, init = {}) => {
  const envelope = await requestHub(baseUrl, token, pathName, init);
  assert.equal(envelope.status, status, `${pathName} should return ${status}`);
  return envelope;
};

const createSyncUpdateMessage = (value) => {
  const doc = new Y.Doc();
  doc.getMap('root').set('content', value);
  const update = Y.encodeStateAsUpdate(doc);
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, 0);
  syncProtocol.writeUpdate(encoder, update);
  return Buffer.from(encoding.toUint8Array(encoder));
};

const createSyncStep1Message = () => {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, 0);
  syncProtocol.writeSyncStep1(encoder, new Y.Doc());
  return Buffer.from(encoding.toUint8Array(encoder));
};

const applyCollabUpdate = async ({ collabBaseUrl, docId, wsTicket, updateValue }) => {
  const wsUrl = `${collabBaseUrl.replace(/^http/, 'ws')}/?doc_id=${encodeURIComponent(docId)}&ws_ticket=${encodeURIComponent(wsTicket)}`;
  const socket = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    socket.once('open', resolve);
    socket.once('error', reject);
  });
  await new Promise((resolve, reject) => {
    socket.send(createSyncUpdateMessage(updateValue), (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
  const serverProcessedUpdate = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timed out waiting for collab sync acknowledgement.'));
    }, 2_000);
    socket.once('message', () => {
      clearTimeout(timeout);
      resolve();
    });
    socket.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
  await new Promise((resolve, reject) => {
    socket.send(createSyncStep1Message(), (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
  await serverProcessedUpdate;
  socket.close();
  await new Promise((resolve) => socket.once('close', resolve));
};

const waitForDocSnapshot = async ({ apiBaseUrl, token, docId, predicate, timeoutMs = 5_000, label }) => {
  const deadline = Date.now() + timeoutMs;
  let lastDoc = null;

  while (Date.now() < deadline) {
    const data = await expectOk(apiBaseUrl, token, `/api/hub/docs/${docId}`, { method: 'GET' });
    lastDoc = data.doc;
    if (predicate(lastDoc)) {
      return lastDoc;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  throw new Error(`Timed out waiting for doc snapshot condition: ${label}. Last version: ${lastDoc?.snapshot_version ?? 'unknown'}`);
};

const assertDocSnapshotVersionStays = async ({ apiBaseUrl, token, docId, expectedVersion, durationMs = 300 }) => {
  const deadline = Date.now() + durationMs;
  let lastDoc = null;

  while (Date.now() < deadline) {
    const data = await expectOk(apiBaseUrl, token, `/api/hub/docs/${docId}`, { method: 'GET' });
    lastDoc = data.doc;
    assert.equal(lastDoc.snapshot_version, expectedVersion, `Doc snapshot version should stay at ${expectedVersion}`);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  return lastDoc;
};

const authorizeLiveSocket = async ({ apiBaseUrl, token }) => {
  const data = await expectOk(apiBaseUrl, token, '/api/hub/live/authorize', { method: 'GET' });
  return data.authorization;
};

const waitForTaskChangedMessage = async ({ apiBaseUrl, token, trigger }) => {
  const authorization = await authorizeLiveSocket({ apiBaseUrl, token });
  const wsUrl = `${apiBaseUrl.replace(/^http/, 'ws')}/api/hub/live?ws_ticket=${encodeURIComponent(authorization.ws_ticket)}`;
  const socket = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    socket.once('open', resolve);
    socket.once('error', reject);
  });

  const messagePromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timed out waiting for task.changed websocket message.'));
    }, 4_000);
    socket.on('message', (raw) => {
      try {
        const parsed = JSON.parse(String(raw));
        if (parsed?.type === 'task.changed') {
          clearTimeout(timeout);
          resolve(parsed);
        }
      } catch {
        // ignore malformed frames
      }
    });
  });

  await trigger();
  const message = await messagePromise;
  socket.close();
  await new Promise((resolve) => socket.once('close', resolve));
  return message;
};

const setupFixture = async ({ apiBaseUrl, ownerToken, ownerId, readerId, name }) => {
  const projectResult = await expectOk(apiBaseUrl, ownerToken, '/api/hub/projects', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
  const projectId = projectResult.project.project_id;

  await expectOk(apiBaseUrl, ownerToken, `/api/hub/projects/${projectId}/members`, {
    method: 'POST',
    body: JSON.stringify({ user_id: readerId, role: 'member' }),
  });

  const paneList = await expectOk(apiBaseUrl, ownerToken, `/api/hub/projects/${projectId}/panes`, {
    method: 'GET',
  });
  const pane = paneList.panes[0];
  assert.ok(pane?.pane_id, 'Expected default pane');

  const collection = await expectOk(apiBaseUrl, ownerToken, `/api/hub/projects/${projectId}/collections`, {
    method: 'POST',
    body: JSON.stringify({ name: `${name} Tasks`, icon: 'table', color: 'blue' }),
  });

  const relationField = await expectOk(apiBaseUrl, ownerToken, `/api/hub/collections/${collection.collection_id}/fields`, {
    method: 'POST',
    body: JSON.stringify({
      name: 'Related',
      type: 'relation',
      config: { target_collection_id: collection.collection_id },
    }),
  });

  const sourceRecord = await expectOk(apiBaseUrl, ownerToken, `/api/hub/projects/${projectId}/records`, {
    method: 'POST',
    body: JSON.stringify({
      collection_id: collection.collection_id,
      title: `${name} Source`,
      source_pane_id: pane.pane_id,
    }),
  });
  const targetRecord = await expectOk(apiBaseUrl, ownerToken, `/api/hub/projects/${projectId}/records`, {
    method: 'POST',
    body: JSON.stringify({
      collection_id: collection.collection_id,
      title: `${name} Target`,
      source_pane_id: pane.pane_id,
    }),
  });

  return {
    projectId,
    paneId: pane.pane_id,
    docId: pane.doc_id,
    collectionId: collection.collection_id,
    relationFieldId: relationField.field_id,
    sourceRecordId: sourceRecord.record_id,
    targetRecordId: targetRecord.record_id,
    ownerId,
    readerId,
  };
};

const createTaskRecord = async ({ apiBaseUrl, ownerToken, projectId, collectionId, paneId, assigneeUserIds, title }) => {
  const result = await expectOk(apiBaseUrl, ownerToken, `/api/hub/projects/${projectId}/records`, {
    method: 'POST',
    body: JSON.stringify({
      collection_id: collectionId,
      title,
      ...(paneId ? { source_pane_id: paneId } : {}),
      task_state: {
        status: 'todo',
        priority: 'high',
      },
      assignment_user_ids: assigneeUserIds,
    }),
  });
  return result.record_id;
};

const createEventRecord = async ({ apiBaseUrl, ownerToken, projectId, paneId, participantUserIds, title, startDt, endDt }) => {
  const result = await expectOk(apiBaseUrl, ownerToken, `/api/hub/projects/${projectId}/events/from-nlp`, {
    method: 'POST',
    body: JSON.stringify({
      title,
      start_dt: startDt,
      end_dt: endDt,
      source_pane_id: paneId,
      participants_user_ids: participantUserIds,
    }),
  });
  return result.record.record_id;
};

const addBulkAssignedTasks = ({ dbPath, projectId, collectionId, userId, count }) => {
  // This intentionally bypasses the API to stress pagination with many assigned tasks.
  // Keep it aligned with record/task schema changes: it inserts records, task capability rows,
  // task_state rows, and assignments directly into SQLite.
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON;');
  const insertRecord = db.prepare(`
    INSERT INTO records (record_id, project_id, collection_id, title, created_by, created_at, updated_at, archived_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
  `);
  const insertCapability = db.prepare('INSERT OR IGNORE INTO record_capabilities (record_id, capability_type, created_at) VALUES (?, ?, ?)');
  const insertTaskState = db.prepare(`
    INSERT INTO task_state (record_id, status, priority, completed_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertAssignment = db.prepare('INSERT OR REPLACE INTO assignments (record_id, user_id, assigned_at) VALUES (?, ?, ?)');
  const now = nowIso();

  db.exec('BEGIN IMMEDIATE');
  try {
    for (let index = 0; index < count; index += 1) {
      const recordId = `rec_bulk_${index}`;
      insertRecord.run(recordId, projectId, collectionId, `Bulk Task ${index}`, userId, now, now);
      insertCapability.run(recordId, 'task', now);
      insertTaskState.run(recordId, 'todo', null, null, now);
      insertAssignment.run(recordId, userId, now);
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  } finally {
    db.close();
  }
};

test('hub provenance, notifications, and pane permissions', async (t) => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'hub-provenance-'));
  const dbPath = path.join(tmpDir, 'hub.sqlite');
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const publicJwk = publicKey.export({ format: 'jwk' });

  const jwksPort = await reservePort();
  const nextcloudPort = await reservePort();
  const apiPort = await reservePort();
  const collabPort = await reservePort();

  const issuer = `http://127.0.0.1:${jwksPort}`;
  const apiBaseUrl = `http://127.0.0.1:${apiPort}`;
  const collabBaseUrl = `http://127.0.0.1:${collabPort}`;

  const jwksServer = createServer((request, response) => {
    if (request.url === '/protocol/openid-connect/certs') {
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ keys: [{ ...publicJwk, kid: 'test-kid', alg: 'RS256', use: 'sig', kty: 'RSA' }] }));
      return;
    }
    response.writeHead(404);
    response.end();
  });
  await new Promise((resolve) => jwksServer.listen(jwksPort, '127.0.0.1', resolve));

  const nextcloudServer = createServer((request, response) => {
    if (request.method === 'MKCOL') {
      response.writeHead(201);
      response.end();
      return;
    }
    if (request.method === 'PUT') {
      response.writeHead(201);
      response.end();
      return;
    }
    response.writeHead(204);
    response.end();
  });
  await new Promise((resolve) => nextcloudServer.listen(nextcloudPort, '127.0.0.1', resolve));

  const apiProcess = startProcess({
    cwd: path.resolve('.'),
    scriptPath: 'apps/hub-api/hub-api.mjs',
    env: {
      PORT: String(apiPort),
      HUB_DB_PATH: dbPath,
      HUB_API_ALLOW_SCHEMA_RESET: 'true',
      KEYCLOAK_ISSUER: issuer,
      KEYCLOAK_AUDIENCE: 'hub-test',
      NEXTCLOUD_BASE_URL: `http://127.0.0.1:${nextcloudPort}`,
      NEXTCLOUD_USER: 'tester',
      NEXTCLOUD_APP_PASSWORD: 'secret',
    },
  });

  const collabProcess = startProcess({
    cwd: path.resolve('.'),
    scriptPath: 'apps/hub-collab/collab-server.mjs',
    env: {
      PORT: String(collabPort),
      HOST: '127.0.0.1',
      HUB_API_URL: apiBaseUrl,
      HUB_DB_PATH: dbPath,
      KEYCLOAK_ISSUER: issuer,
      KEYCLOAK_AUDIENCE: 'hub-test',
      HUB_COLLAB_SAVE_DEBOUNCE_MS: '25',
    },
  });

  try {
    await waitForOk(`${apiBaseUrl}/api/hub/health`);
    await waitForOk(`${collabBaseUrl}/`);

    const ownerToken = signJwt(privateKey, issuer, 'owner-sub', 'Owner User', 'owner@example.com');
    const readerToken = signJwt(privateKey, issuer, 'reader-sub', 'Reader User', 'reader@example.com');

    const ownerSession = await expectOk(apiBaseUrl, ownerToken, '/api/hub/me', { method: 'GET' });
    const readerSession = await expectOk(apiBaseUrl, readerToken, '/api/hub/me', { method: 'GET' });
    const ownerId = ownerSession.user.user_id;
    const readerId = readerSession.user.user_id;

    const fixture = await setupFixture({
      apiBaseUrl,
      ownerToken,
      ownerId,
      readerId,
      name: 'Regression Project',
    });

    await t.test('pane visibility, collab read-only, and doc comment status', async () => {
      const readerPanes = await expectOk(apiBaseUrl, readerToken, `/api/hub/projects/${fixture.projectId}/panes`, { method: 'GET' });
      const visiblePane = readerPanes.panes.find((pane) => pane.pane_id === fixture.paneId);
      assert.ok(visiblePane, 'Reader should see pane in project list');
      assert.equal(visiblePane.can_edit, false, 'Reader should see pane as read-only');

      const docSnapshot = await expectOk(apiBaseUrl, readerToken, `/api/hub/docs/${fixture.docId}`, { method: 'GET' });
      assert.equal(docSnapshot.doc.doc_id, fixture.docId);

      const collabAuth = await expectOk(
        apiBaseUrl,
        readerToken,
        `/api/hub/collab/authorize?doc_id=${encodeURIComponent(fixture.docId)}`,
        { method: 'GET' },
      );
      assert.equal(collabAuth.authorization.can_edit, false, 'Reader collab ticket should be read-only');

      await expectStatus(apiBaseUrl, readerToken, `/api/hub/docs/${fixture.docId}`, 403, {
        method: 'PUT',
        body: JSON.stringify({ snapshot_payload: { plain_text: 'reader denied' } }),
      });

      await applyCollabUpdate({
        collabBaseUrl,
        docId: fixture.docId,
        wsTicket: collabAuth.authorization.ws_ticket,
        updateValue: 'reader-change',
      });
      const afterReaderCollab = await assertDocSnapshotVersionStays({
        apiBaseUrl,
        token: ownerToken,
        docId: fixture.docId,
        expectedVersion: 0,
      });
      assert.equal(afterReaderCollab.snapshot_version, 0, 'Read-only collab updates should not persist');

      const ownerCollabAuth = await expectOk(
        apiBaseUrl,
        ownerToken,
        `/api/hub/collab/authorize?doc_id=${encodeURIComponent(fixture.docId)}`,
        { method: 'GET' },
      );
      await applyCollabUpdate({
        collabBaseUrl,
        docId: fixture.docId,
        wsTicket: ownerCollabAuth.authorization.ws_ticket,
        updateValue: 'owner-change',
      });
      const afterOwnerCollab = await waitForDocSnapshot({
        apiBaseUrl,
        token: ownerToken,
        docId: fixture.docId,
        predicate: (doc) => Number(doc?.snapshot_version) > 0,
        label: 'editable collab update persisted',
      });
      assert.ok(afterOwnerCollab.snapshot_version > 0, 'Editable collab updates should persist');

      const docComment = await expectOk(apiBaseUrl, readerToken, '/api/hub/comments/doc-anchor', {
        method: 'POST',
        body: JSON.stringify({
          project_id: fixture.projectId,
          doc_id: fixture.docId,
          anchor_payload: {
            kind: 'node',
            nodeKey: 'node-reader-comment',
          },
          body_json: { text: 'Reader comment' },
        }),
      });

      await expectStatus(
        apiBaseUrl,
        readerToken,
        `/api/hub/comments/${docComment.comment_id}/status`,
        403,
        {
          method: 'POST',
          body: JSON.stringify({ status: 'resolved' }),
        },
      );
      await expectOk(apiBaseUrl, ownerToken, `/api/hub/comments/${docComment.comment_id}/status`, {
        method: 'POST',
        body: JSON.stringify({ status: 'resolved' }),
      });
    });

    await t.test('pane-scoped uploads and inspector mutation permissions', async () => {
      await expectStatus(apiBaseUrl, readerToken, '/api/hub/files/upload', 403, {
        method: 'POST',
        body: JSON.stringify({
          project_id: fixture.projectId,
          name: 'reader-pane.txt',
          mime_type: 'text/plain',
          content_base64: Buffer.from('reader-pane').toString('base64'),
          metadata: {
            scope: 'pane',
            pane_id: fixture.paneId,
          },
        }),
      });

      const paneUpload = await expectOk(apiBaseUrl, ownerToken, '/api/hub/files/upload', {
        method: 'POST',
        body: JSON.stringify({
          project_id: fixture.projectId,
          name: 'owner-pane.txt',
          mime_type: 'text/plain',
          content_base64: Buffer.from('owner-pane').toString('base64'),
          metadata: {
            scope: 'pane',
            pane_id: fixture.paneId,
          },
        }),
      });
      assert.equal(paneUpload.file.metadata.pane_id, fixture.paneId);

      await expectStatus(apiBaseUrl, readerToken, `/api/hub/projects/${fixture.projectId}/records`, 403, {
        method: 'POST',
        body: JSON.stringify({
          collection_id: fixture.collectionId,
          title: 'Reader created record',
          source_pane_id: fixture.paneId,
        }),
      });

      await expectStatus(apiBaseUrl, readerToken, `/api/hub/records/${fixture.sourceRecordId}/values`, 403, {
        method: 'POST',
        body: JSON.stringify({
          mutation_context_pane_id: fixture.paneId,
          values: { non_existent: 'reader edit' },
        }),
      });

      await expectStatus(apiBaseUrl, readerToken, `/api/hub/records/${fixture.sourceRecordId}`, 403, {
        method: 'PATCH',
        body: JSON.stringify({
          title: 'Reader renamed pane record',
          mutation_context_pane_id: fixture.paneId,
        }),
      });

      const attachDenied = await expectStatus(apiBaseUrl, readerToken, '/api/hub/attachments', 403, {
        method: 'POST',
        body: JSON.stringify({
          project_id: fixture.projectId,
          entity_type: 'record',
          entity_id: fixture.sourceRecordId,
          provider: paneUpload.file.provider,
          asset_root_id: paneUpload.file.asset_root_id,
          asset_path: paneUpload.file.asset_path,
          name: paneUpload.file.name,
          mime_type: paneUpload.file.mime_type,
          size_bytes: paneUpload.file.size_bytes,
          mutation_context_pane_id: fixture.paneId,
          metadata: {
            pane_id: fixture.paneId,
          },
        }),
      });
      assert.equal(attachDenied.error?.code, 'pane_edit_required');

      await expectStatus(apiBaseUrl, readerToken, `/api/hub/records/${fixture.sourceRecordId}/relations`, 403, {
        method: 'POST',
        body: JSON.stringify({
          to_record_id: fixture.targetRecordId,
          via_field_id: fixture.relationFieldId,
          mutation_context_pane_id: fixture.paneId,
        }),
      });

      const readerComment = await expectOk(apiBaseUrl, readerToken, '/api/hub/comments', {
        method: 'POST',
        body: JSON.stringify({
          project_id: fixture.projectId,
          target_entity_type: 'record',
          target_entity_id: fixture.sourceRecordId,
          body_json: { text: 'Reader discussion comment' },
        }),
      });
      assert.ok(readerComment.comment_id, 'Reader comments should remain allowed');

      await expectOk(apiBaseUrl, ownerToken, `/api/hub/records/${fixture.sourceRecordId}/values`, {
        method: 'POST',
        body: JSON.stringify({
          mutation_context_pane_id: fixture.paneId,
          values: {},
        }),
      });

      const renamedPaneRecord = await expectOk(apiBaseUrl, ownerToken, `/api/hub/records/${fixture.sourceRecordId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: 'Owner Renamed Pane Record',
          mutation_context_pane_id: fixture.paneId,
        }),
      });
      assert.equal(renamedPaneRecord.record.title, 'Owner Renamed Pane Record', 'Pane editors should be able to rename pane-origin records');

      const ownerAttachment = await expectOk(apiBaseUrl, ownerToken, '/api/hub/attachments', {
        method: 'POST',
        body: JSON.stringify({
          project_id: fixture.projectId,
          entity_type: 'record',
          entity_id: fixture.sourceRecordId,
          provider: paneUpload.file.provider,
          asset_root_id: paneUpload.file.asset_root_id,
          asset_path: paneUpload.file.asset_path,
          name: paneUpload.file.name,
          mime_type: paneUpload.file.mime_type,
          size_bytes: paneUpload.file.size_bytes,
          mutation_context_pane_id: fixture.paneId,
          metadata: {
            pane_id: fixture.paneId,
          },
        }),
      });
      assert.ok(ownerAttachment.attachment_id, 'Pane editor should be able to attach file');

      const ownerRelation = await expectOk(apiBaseUrl, ownerToken, `/api/hub/records/${fixture.sourceRecordId}/relations`, {
        method: 'POST',
        body: JSON.stringify({
          to_record_id: fixture.targetRecordId,
          via_field_id: fixture.relationFieldId,
          mutation_context_pane_id: fixture.paneId,
        }),
      });
      await expectOk(
        apiBaseUrl,
        ownerToken,
        `/api/hub/relations/${ownerRelation.relation.relation_id}?mutation_context_pane_id=${encodeURIComponent(fixture.paneId)}`,
        { method: 'DELETE' },
      );
      await expectOk(
        apiBaseUrl,
        ownerToken,
        `/api/hub/attachments/${ownerAttachment.attachment_id}?mutation_context_pane_id=${encodeURIComponent(fixture.paneId)}`,
        { method: 'DELETE' },
      );

      const projectOriginRecord = await expectOk(apiBaseUrl, ownerToken, `/api/hub/projects/${fixture.projectId}/records`, {
        method: 'POST',
        body: JSON.stringify({
          collection_id: fixture.collectionId,
          title: 'Project Origin Record',
        }),
      });

      await expectOk(apiBaseUrl, ownerToken, `/api/hub/records/${projectOriginRecord.record_id}/values`, {
        method: 'POST',
        body: JSON.stringify({
          values: {},
        }),
      });

      const renamedProjectOriginRecord = await expectOk(apiBaseUrl, ownerToken, `/api/hub/records/${projectOriginRecord.record_id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: 'Renamed Project Origin Record',
        }),
      });
      assert.equal(
        renamedProjectOriginRecord.record.title,
        'Renamed Project Origin Record',
        'Project-origin records should still update without pane mutation context',
      );

      const projectUpload = await expectOk(apiBaseUrl, ownerToken, '/api/hub/files/upload', {
        method: 'POST',
        body: JSON.stringify({
          project_id: fixture.projectId,
          name: 'project-origin.txt',
          mime_type: 'text/plain',
          content_base64: Buffer.from('project-origin').toString('base64'),
          metadata: {
            attached_entity_type: 'record',
            attached_entity_id: projectOriginRecord.record_id,
          },
        }),
      });
      assert.equal(projectUpload.file.metadata.scope, 'project', 'Project-origin uploads should remain project scoped');

      const projectAttachment = await expectOk(apiBaseUrl, ownerToken, '/api/hub/attachments', {
        method: 'POST',
        body: JSON.stringify({
          project_id: fixture.projectId,
          entity_type: 'record',
          entity_id: projectOriginRecord.record_id,
          provider: projectUpload.file.provider,
          asset_root_id: projectUpload.file.asset_root_id,
          asset_path: projectUpload.file.asset_path,
          name: projectUpload.file.name,
          mime_type: projectUpload.file.mime_type,
          size_bytes: projectUpload.file.size_bytes,
          metadata: {},
        }),
      });

      const projectRelation = await expectOk(apiBaseUrl, ownerToken, `/api/hub/records/${projectOriginRecord.record_id}/relations`, {
        method: 'POST',
        body: JSON.stringify({
          to_record_id: fixture.targetRecordId,
          via_field_id: fixture.relationFieldId,
        }),
      });

      await expectOk(apiBaseUrl, ownerToken, `/api/hub/attachments/${projectAttachment.attachment_id}`, { method: 'DELETE' });
      await expectOk(apiBaseUrl, ownerToken, `/api/hub/relations/${projectRelation.relation.relation_id}`, { method: 'DELETE' });
    });

    await t.test('hub personal tasks stay in hub and broadcast live task changes', async () => {
      let createdTask = null;
      const liveMessage = await waitForTaskChangedMessage({
        apiBaseUrl,
        token: ownerToken,
        trigger: async () => {
          const created = await expectOk(apiBaseUrl, ownerToken, '/api/hub/tasks', {
            method: 'POST',
            body: JSON.stringify({ title: 'Hub Personal Task' }),
          });
          createdTask = created.task;
        },
      });

      assert.ok(createdTask, 'Expected personal task creation response');
      assert.equal(createdTask.origin_kind, 'personal', 'Hub-created task should be personal');
      assert.equal(createdTask.project_id, null, 'Hub-created task summaries should not expose hidden project ids');
      assert.equal(createdTask.project_name, null, 'Personal task should not expose hidden project name');
      assert.equal(
        liveMessage.task.record_id,
        createdTask.record_id,
        'Hub live websocket should publish task.changed for the created personal task',
      );
      assert.equal(liveMessage.task.project_id, null, 'Personal task live events should not leak hidden project ids');

      const ownerHome = await expectOk(apiBaseUrl, ownerToken, '/api/hub/home?tasks_limit=20&events_limit=8&notifications_limit=8&unread=1', {
        method: 'GET',
      });
      assert.equal(
        ownerHome.home.tasks.some((task) => task.record_id === createdTask.record_id),
        true,
        'Hub home should include the new personal task',
      );

      const personalTaskDetail = await expectOk(apiBaseUrl, ownerToken, `/api/hub/records/${createdTask.record_id}`, { method: 'GET' });
      assert.equal(personalTaskDetail.record.origin_kind, 'personal', 'Record detail should preserve personal origin');

      const visibleProjects = await expectOk(apiBaseUrl, ownerToken, '/api/hub/projects', { method: 'GET' });
      assert.equal(
        visibleProjects.projects.some((project) => project.name === 'Hub'),
        false,
        'Hidden personal task space should stay out of the visible project list',
      );

      const ownerMe = await expectOk(apiBaseUrl, ownerToken, '/api/hub/me', { method: 'GET' });
      assert.equal(
        ownerMe.memberships.some((membership) => membership.name === 'Hub'),
        false,
        'Hidden personal task space should stay out of session membership rollups',
      );

      assert.equal(
        buildTaskDestinationHref(createdTask),
        `/projects?task_id=${createdTask.record_id}`,
        'Personal tasks should route back to Hub',
      );
      assert.equal(
        buildNotificationDestinationHref({
          projectId: null,
          entityType: 'record',
          entityId: createdTask.record_id,
          payload: { origin_kind: 'personal' },
          fallbackHref: '/projects',
        }),
        `/projects?task_id=${createdTask.record_id}`,
        'Notification routing should send personal tasks back to Hub',
      );
    });

    await t.test('inactive project memberships hide assigned tasks from hub lenses', async () => {
      const membershipFixture = await setupFixture({
        apiBaseUrl,
        ownerToken,
        ownerId,
        readerId,
        name: 'Inactive Membership',
      });

      const removedTaskId = await createTaskRecord({
        apiBaseUrl,
        ownerToken,
        projectId: membershipFixture.projectId,
        collectionId: membershipFixture.collectionId,
        paneId: membershipFixture.paneId,
        assigneeUserIds: [readerId],
        title: 'Removed Member Task',
      });

      const assignedBeforeRemoval = await expectOk(apiBaseUrl, readerToken, '/api/hub/tasks?lens=assigned&limit=10', { method: 'GET' });
      assert.equal(
        assignedBeforeRemoval.tasks.some((task) => task.record_id === removedTaskId),
        true,
        'Assigned lens should include the task before membership is deactivated',
      );

      await expectOk(
        apiBaseUrl,
        ownerToken,
        `/api/hub/projects/${membershipFixture.projectId}/members/${readerId}`,
        { method: 'DELETE' },
      );

      const visibleProjects = await expectOk(apiBaseUrl, readerToken, '/api/hub/projects', { method: 'GET' });
      assert.equal(
        visibleProjects.projects.some((project) => project.project_id === membershipFixture.projectId),
        false,
        'Inactive memberships should hide the project from project lists',
      );

      const assignedAfterRemoval = await expectOk(apiBaseUrl, readerToken, '/api/hub/tasks?lens=assigned&limit=20', { method: 'GET' });
      assert.equal(
        assignedAfterRemoval.tasks.some((task) => task.record_id === removedTaskId),
        false,
        'Assigned lens should not leak tasks from inactive project memberships',
      );

      const homeAfterRemoval = await expectOk(apiBaseUrl, readerToken, '/api/hub/home?tasks_limit=20&events_limit=8&notifications_limit=8&unread=1', {
        method: 'GET',
      });
      assert.equal(
        homeAfterRemoval.home.tasks.some((task) => task.record_id === removedTaskId),
        false,
        'Hub home should not include tasks from inactive project memberships',
      );
    });

    await t.test('member management requires admin access and preserves an active owner', async () => {
      const membershipFixture = await setupFixture({
        apiBaseUrl,
        ownerToken,
        ownerId,
        readerId,
        name: 'Member Admin Guard',
      });

      await expectStatus(apiBaseUrl, readerToken, `/api/hub/projects/${membershipFixture.projectId}/members`, 403, {
        method: 'POST',
        body: JSON.stringify({ user_id: ownerId, role: 'member' }),
      });

      await expectStatus(
        apiBaseUrl,
        readerToken,
        `/api/hub/projects/${membershipFixture.projectId}/members/${ownerId}`,
        403,
        { method: 'DELETE' },
      );

      await expectStatus(
        apiBaseUrl,
        ownerToken,
        `/api/hub/projects/${membershipFixture.projectId}/members/${ownerId}`,
        409,
        { method: 'DELETE' },
      );

      await expectStatus(apiBaseUrl, ownerToken, `/api/hub/projects/${membershipFixture.projectId}/members`, 409, {
        method: 'POST',
        body: JSON.stringify({ user_id: ownerId, role: 'member' }),
      });
    });

    await t.test('provenance survives overview, hub, notifications, fallback routing, and large task loads', async () => {
      const currentStart = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const currentEnd = new Date(Date.now() + 20 * 60 * 1000).toISOString();
      const staleStart = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      const staleEnd = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

      await expectStatus(apiBaseUrl, ownerToken, `/api/hub/projects/${fixture.projectId}/records`, 400, {
        method: 'POST',
        body: JSON.stringify({
          collection_id: fixture.collectionId,
          title: 'Invalid Structured Event',
          source_pane_id: fixture.paneId,
          event_state: {
            start_dt: currentStart,
            end_dt: currentStart,
          },
        }),
      });

      await expectStatus(apiBaseUrl, ownerToken, `/api/hub/projects/${fixture.projectId}/events/from-nlp`, 400, {
        method: 'POST',
        body: JSON.stringify({
          title: 'Invalid NLP Event',
          start_dt: currentEnd,
          end_dt: currentStart,
          source_pane_id: fixture.paneId,
          participants_user_ids: [readerId],
        }),
      });

      const taskRecordId = await createTaskRecord({
        apiBaseUrl,
        ownerToken,
        projectId: fixture.projectId,
        collectionId: fixture.collectionId,
        paneId: fixture.paneId,
        assigneeUserIds: [readerId],
        title: 'Pane Task',
      });
      const projectTaskRecordId = await createTaskRecord({
        apiBaseUrl,
        ownerToken,
        projectId: fixture.projectId,
        collectionId: fixture.collectionId,
        paneId: '',
        assigneeUserIds: [],
        title: 'Project Task',
      });

      const eventRecordId = await createEventRecord({
        apiBaseUrl,
        ownerToken,
        projectId: fixture.projectId,
        paneId: fixture.paneId,
        participantUserIds: [readerId, ownerId],
        title: 'Current Event',
        startDt: currentStart,
        endDt: currentEnd,
      });

      await createEventRecord({
        apiBaseUrl,
        ownerToken,
        projectId: fixture.projectId,
        paneId: fixture.paneId,
        participantUserIds: [readerId, ownerId],
        title: 'Stale Event',
        startDt: staleStart,
        endDt: staleEnd,
      });

      const taskDetail = await expectOk(apiBaseUrl, ownerToken, `/api/hub/records/${taskRecordId}`, { method: 'GET' });
      assert.equal(taskDetail.record.source_pane?.pane_id, fixture.paneId, 'Record detail should expose durable source pane');

      const projectTasks = await expectOk(apiBaseUrl, readerToken, `/api/hub/projects/${fixture.projectId}/tasks`, { method: 'GET' });
      const projectTask = projectTasks.tasks.find((task) => task.record_id === taskRecordId);
      const projectOriginTask = projectTasks.tasks.find((task) => task.record_id === projectTaskRecordId);
      assert.equal(projectTask?.source_pane?.pane_id, fixture.paneId, 'Project overview tasks should preserve source pane');
      assert.equal(projectTask?.origin_kind, 'pane', 'Pane task should retain pane origin');
      assert.equal(projectOriginTask?.origin_kind, 'project', 'Project task should retain project origin');
      assert.equal(projectOriginTask?.source_pane, null, 'Project task should not synthesize pane provenance');

      const projectLens = await expectOk(
        apiBaseUrl,
        readerToken,
        `/api/hub/tasks?lens=project&project_id=${fixture.projectId}&limit=10`,
        { method: 'GET' },
      );
      assert.equal(projectLens.tasks.some((task) => task.record_id === taskRecordId), true, 'Project lens should include pane-originated tasks');
      assert.equal(projectLens.tasks.some((task) => task.record_id === projectTaskRecordId), true, 'Project lens should include project-originated tasks');

      const assignedLens = await expectOk(apiBaseUrl, readerToken, '/api/hub/tasks?lens=assigned&limit=10', { method: 'GET' });
      assert.equal(assignedLens.tasks.some((task) => task.record_id === taskRecordId), true, 'Assigned lens should filter the same master task list');

      const projectCalendar = await expectOk(
        apiBaseUrl,
        readerToken,
        `/api/hub/projects/${fixture.projectId}/calendar?mode=all`,
        { method: 'GET' },
      );
      const currentEvent = projectCalendar.events.find((event) => event.record_id === eventRecordId);
      assert.equal(currentEvent?.source_pane?.pane_id, fixture.paneId, 'Project calendar should preserve source pane');

      const readerHome = await expectOk(apiBaseUrl, readerToken, '/api/hub/home?tasks_limit=8&events_limit=8&notifications_limit=20&unread=1', {
        method: 'GET',
      });
      const homeTask = readerHome.home.tasks.find((task) => task.record_id === taskRecordId);
      assert.ok(homeTask, 'Expected home task entry');
      assert.equal(homeTask?.source_pane?.pane_id, fixture.paneId, 'Hub home tasks should preserve source pane');
      const homeEvent = readerHome.home.events.find((event) => event.record_id === eventRecordId);
      assert.ok(homeEvent, 'Expected home event entry');
      assert.equal(homeEvent?.source_pane?.pane_id, fixture.paneId, 'Hub home events should preserve source pane');
      assert.equal(
        readerHome.home.events.some((event) => event.title === 'Stale Event'),
        false,
        'Hub home should prefer current/upcoming events over stale past ones',
      );

      const deletedPane = await expectOk(apiBaseUrl, ownerToken, `/api/hub/projects/${fixture.projectId}/panes`, {
        method: 'POST',
        body: JSON.stringify({ name: 'Archived Pane' }),
      });
      const deletedPaneTaskId = await createTaskRecord({
        apiBaseUrl,
        ownerToken,
        projectId: fixture.projectId,
        collectionId: fixture.collectionId,
        paneId: deletedPane.pane.pane_id,
        assigneeUserIds: [readerId],
        title: 'Deleted Pane Task',
      });
      await expectOk(apiBaseUrl, ownerToken, `/api/hub/panes/${deletedPane.pane.pane_id}`, { method: 'DELETE' });

      const deletedPaneTask = await expectOk(apiBaseUrl, readerToken, `/api/hub/records/${deletedPaneTaskId}`, { method: 'GET' });
      assert.equal(deletedPaneTask.record.origin_kind, 'pane', 'Pane-origin tasks should retain pane origin after pane deletion');
      assert.equal(deletedPaneTask.record.source_pane, null, 'Deleted panes should clear source_pane_id instead of deleting task provenance');

      const notifications = await expectOk(apiBaseUrl, readerToken, '/api/hub/notifications?unread=1&limit=20', { method: 'GET' });
      const assignmentNotification = notifications.notifications.find(
        (notification) => notification.entity_id === taskRecordId && notification.reason === 'assignment',
      );
      assert.equal(
        assignmentNotification?.payload?.source_pane_id,
        fixture.paneId,
        'Assignment notification payload should carry pane provenance',
      );

      assert.equal(
        buildTaskDestinationHref(homeTask),
        `/projects/${fixture.projectId}/work/${fixture.paneId}`,
        'Task destination should route back to source pane',
      );
      assert.equal(
        buildEventDestinationHref(homeEvent),
        `/projects/${fixture.projectId}/work/${fixture.paneId}`,
        'Event destination should route back to source pane',
      );
      assert.equal(
        buildNotificationDestinationHref({
          projectId: fixture.projectId,
          payload: {
            source_pane_id: fixture.paneId,
            source_node_key: 'node-42',
          },
          fallbackHref: `/projects/${fixture.projectId}/work`,
        }),
        `/projects/${fixture.projectId}/work/${fixture.paneId}?focus_node_key=node-42`,
        'Notification destination helper should route to source pane with focus key',
      );
      assert.equal(
        buildNotificationDestinationHref({
          projectId: fixture.projectId,
          payload: {},
          fallbackHref: `/projects/${fixture.projectId}/overview?view=calendar`,
        }),
        `/projects/${fixture.projectId}/overview?view=calendar`,
        'Notification destination should fall back cleanly when no source pane exists',
      );

      addBulkAssignedTasks({
        dbPath,
        projectId: fixture.projectId,
        collectionId: fixture.collectionId,
        userId: readerId,
        count: 1_050,
      });
      let bulkCursor = '';
      let bulkCount = 0;
      let bulkPages = 0;
      do {
        const bulkTasks = await expectOk(
          apiBaseUrl,
          readerToken,
          `/api/hub/projects/${fixture.projectId}/tasks?limit=50${bulkCursor ? `&cursor=${encodeURIComponent(bulkCursor)}` : ''}`,
          { method: 'GET' },
        );
        bulkCount += bulkTasks.tasks.length;
        bulkPages += 1;
        if (bulkPages === 1) {
          assert.equal(bulkTasks.tasks.length, 50, 'Project tasks should stream in fixed-size pages');
          assert.ok(bulkTasks.next_cursor, 'Project tasks should expose a next cursor while more results remain');
        }
        bulkCursor = bulkTasks.next_cursor || '';
      } while (bulkCursor && bulkPages < 30);

      assert.ok(bulkCount >= 1_052, 'Paginated project task loading should safely traverse large task sets');
    });
  } finally {
    await Promise.allSettled([
      apiProcess.stop(),
      collabProcess.stop(),
      new Promise((resolve) => jwksServer.close(resolve)),
      new Promise((resolve) => nextcloudServer.close(resolve)),
    ]);
    await rm(tmpDir, { recursive: true, force: true });
  }
});
