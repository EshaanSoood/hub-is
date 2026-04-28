import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { spawn } from 'node:child_process';
import { createSign, generateKeyPairSync } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { initializeDatabase } from '../apps/hub-api/db/bootstrap.mjs';
import {
  canUserAccessProject,
  canUserAccessSpaceOverview,
  canUserManageSpaceMembers,
  canUserEditProject,
  canUserDeleteSpace,
  canUserManageProjectVisibility,
} from '../apps/hub-api/lib/permissions.mjs';

const q = (identifier) => {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) {
    throw new Error(`Unsafe identifier: ${identifier}`);
  }
  return `"${identifier}"`;
};

const nowIso = () => new Date().toISOString();

const withDbHarness = async (run) => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'access-model-schema-db-'));
  const dbPath = path.join(tmpDir, 'hub.sqlite');
  const { db, stmts } = initializeDatabase(dbPath);
  try {
    await run({ db, stmts, dbPath, tmpDir });
  } finally {
    db.close();
    await rm(tmpDir, { recursive: true, force: true });
  }
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

const base64Url = (value) => Buffer.from(value).toString('base64url');
const jsonBase64Url = (value) => base64Url(JSON.stringify(value));

const signJwt = (privateKey, issuer, sub, name, email) => {
  const header = { alg: 'RS256', kid: 'access-model-schema-kid', typ: 'JWT' };
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

const expectStatus = async (baseUrl, token, pathName, status, init = {}) => {
  const envelope = await requestHubJson(baseUrl, token, pathName, init);
  assert.equal(envelope.status, status, `${pathName} should return ${status}: ${JSON.stringify(envelope.raw)}`);
  return envelope;
};

const startApiHarness = async ({ seed }) => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'access-model-schema-api-'));
  const dbPath = path.join(tmpDir, 'hub.sqlite');
  const { db, stmts } = initializeDatabase(dbPath);
  try {
    await seed({ db, stmts, dbPath, tmpDir });
  } finally {
    db.close();
  }

  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const publicJwk = publicKey.export({ format: 'jwk' });
  const jwksPort = await reservePort();
  const apiPort = await reservePort();
  const issuer = `http://127.0.0.1:${jwksPort}`;
  const apiBaseUrl = `http://127.0.0.1:${apiPort}`;

  const jwksServer = createServer((request, response) => {
    if (request.url === '/protocol/openid-connect/certs') {
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ keys: [{ ...publicJwk, kid: 'access-model-schema-kid', alg: 'RS256', use: 'sig', kty: 'RSA' }] }));
      return;
    }
    response.writeHead(404);
    response.end();
  });
  await new Promise((resolve) => jwksServer.listen(jwksPort, '127.0.0.1', resolve));

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
    },
  });

  try {
    await waitForOk(`${apiBaseUrl}/api/hub/health`);
  } catch (error) {
    await apiProcess.stop();
    await new Promise((resolve) => jwksServer.close(resolve));
    await rm(tmpDir, { recursive: true, force: true });
    throw new Error(`hub-api failed to start: ${apiProcess.stderr()}\n${error instanceof Error ? error.message : String(error)}`);
  }

  return {
    apiBaseUrl,
    issuer,
    privateKey,
    dbPath,
    stop: async () => {
      await apiProcess.stop();
      await new Promise((resolve) => jwksServer.close(resolve));
      await rm(tmpDir, { recursive: true, force: true });
    },
  };
};

const insertUser = (stmts, { userId, sub, name, email, now = nowIso() }) => {
  stmts.users.insert.run(userId, sub, name, email, now, now);
};

const insertSpace = (stmts, { spaceId, ownerUserId, name, spaceType = 'team', isPersonal = 0, now = nowIso() }) => {
  stmts.spaces.insertWithType.run(spaceId, name, ownerUserId, spaceType, isPersonal, now, now);
};

const insertSpaceMember = (stmts, { spaceId, userId, role, now = nowIso() }) => {
  stmts.spaceMembers.insert.run(spaceId, userId, role, now);
};

const insertWorkProject = (
  stmts,
  { workProjectId, spaceId, name, createdBy, sortOrder = 1, position = 1, pinned = 0, layoutConfig = {}, now = nowIso() },
) => {
  stmts.projects.insert.run(
    workProjectId,
    spaceId,
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

const insertWorkProjectMember = (stmts, { workProjectId, userId, now = nowIso() }) => {
  stmts.projectMembers.insert.run(workProjectId, userId, now);
};

const getTableColumns = (db, tableName) =>
  db.prepare(`PRAGMA table_info(${q(tableName)})`).all().map((column) => column.name);

test('access model schema verification', async (t) => {
  await t.test('permission predicates return expected booleans for all roles', async () => {
    await withDbHarness(async ({ db, stmts }) => {
      const now = nowIso();
      const users = {
        owner: 'usr_pred_owner',
        admin: 'usr_pred_admin',
        member: 'usr_pred_member',
        viewer: 'usr_pred_viewer',
        guest: 'usr_pred_guest',
      };
      const roles = Object.keys(users);
      const spaceId = 'spc_predicates';
      const assignedProjectId = 'prj_pred_assigned';
      const unassignedProjectId = 'prj_pred_unassigned';

      for (const role of roles) {
        insertUser(stmts, {
          userId: users[role],
          sub: `${role}-predicate-sub`,
          name: `${role} Predicate`,
          email: `${role}.predicate@example.com`,
          now,
        });
      }
      insertSpace(stmts, { spaceId, ownerUserId: users.owner, name: 'Predicate Space', now });
      for (const role of roles) {
        insertSpaceMember(stmts, { spaceId, userId: users[role], role, now });
      }
      insertWorkProject(stmts, {
        workProjectId: assignedProjectId,
        spaceId,
        name: 'Assigned Project',
        createdBy: users.owner,
        now,
      });
      insertWorkProject(stmts, {
        workProjectId: unassignedProjectId,
        spaceId,
        name: 'Unassigned Project',
        createdBy: users.owner,
        sortOrder: 2,
        position: 2,
        now,
      });
      insertWorkProjectMember(stmts, { workProjectId: assignedProjectId, userId: users.member, now });
      db.prepare(`
        INSERT INTO space_member_project_access (space_id, user_id, project_id, access_level, granted_at, granted_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(spaceId, users.viewer, assignedProjectId, 'read', now, users.owner);
      db.prepare(`
        INSERT INTO space_member_project_access (space_id, user_id, project_id, access_level, granted_at, granted_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(spaceId, users.guest, assignedProjectId, 'write', now, users.owner);

      assert.deepEqual(
        Object.fromEntries(roles.map((role) => [role, canUserAccessProject(db, users[role], assignedProjectId)])),
        { owner: true, admin: true, member: true, viewer: true, guest: true },
      );
      assert.deepEqual(
        Object.fromEntries(roles.map((role) => [role, canUserAccessProject(db, users[role], unassignedProjectId)])),
        { owner: true, admin: true, member: true, viewer: false, guest: false },
      );
      assert.deepEqual(
        Object.fromEntries(roles.map((role) => [role, canUserEditProject(db, users[role], assignedProjectId)])),
        { owner: true, admin: true, member: true, viewer: false, guest: true },
      );
      assert.deepEqual(
        Object.fromEntries(roles.map((role) => [role, canUserEditProject(db, users[role], unassignedProjectId)])),
        { owner: true, admin: true, member: false, viewer: false, guest: false },
      );
      assert.deepEqual(
        Object.fromEntries(roles.map((role) => [role, canUserAccessSpaceOverview(db, users[role], spaceId)])),
        { owner: true, admin: true, member: true, viewer: false, guest: false },
      );
      assert.deepEqual(
        Object.fromEntries(roles.map((role) => [role, canUserManageSpaceMembers(db, users[role], spaceId)])),
        { owner: true, admin: true, member: false, viewer: false, guest: false },
      );
      assert.deepEqual(
        Object.fromEntries(roles.map((role) => [role, canUserDeleteSpace(db, users[role], spaceId)])),
        { owner: true, admin: false, member: false, viewer: false, guest: false },
      );
      assert.deepEqual(
        Object.fromEntries(roles.map((role) => [role, canUserManageProjectVisibility(db, users[role], spaceId)])),
        { owner: true, admin: true, member: false, viewer: false, guest: false },
      );
    });
  });

  await t.test('space_members roles and columns, spaces pending_deletion_at, and access trigger behave correctly', async () => {
    await withDbHarness(async ({ db, stmts }) => {
      const now = nowIso();

      insertUser(stmts, { userId: 'usr_owner', sub: 'owner-sub', name: 'Owner', email: 'owner@example.com', now });
      insertUser(stmts, { userId: 'usr_admin', sub: 'admin-sub', name: 'Admin', email: 'admin@example.com', now });
      insertUser(stmts, { userId: 'usr_member', sub: 'member-sub', name: 'Member', email: 'member@example.com', now });
      insertUser(stmts, { userId: 'usr_viewer', sub: 'viewer-sub', name: 'Viewer', email: 'viewer@example.com', now });
      insertUser(stmts, { userId: 'usr_guest', sub: 'guest-sub', name: 'Guest', email: 'guest@example.com', now });

      insertSpace(stmts, { spaceId: 'spc_access', ownerUserId: 'usr_owner', name: 'Access Space', now });

      db.prepare(`
        INSERT INTO space_members (
          space_id,
          user_id,
          role,
          joined_at,
          expires_at,
          invited_by,
          approved_by,
          cooldown_until
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run('spc_access', 'usr_owner', 'owner', now, null, null, null, null);
      db.prepare(`
        INSERT INTO space_members (
          space_id,
          user_id,
          role,
          joined_at,
          expires_at,
          invited_by,
          approved_by,
          cooldown_until
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run('spc_access', 'usr_admin', 'admin', now, null, 'usr_owner', 'usr_owner', null);
      db.prepare(`
        INSERT INTO space_members (
          space_id,
          user_id,
          role,
          joined_at,
          expires_at,
          invited_by,
          approved_by,
          cooldown_until
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run('spc_access', 'usr_member', 'member', now, null, 'usr_owner', 'usr_owner', null);
      db.prepare(`
        INSERT INTO space_members (
          space_id,
          user_id,
          role,
          joined_at,
          expires_at,
          invited_by,
          approved_by,
          cooldown_until
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run('spc_access', 'usr_viewer', 'viewer', now, '2026-05-04T00:00:00.000Z', 'usr_admin', 'usr_owner', null);
      db.prepare(`
        INSERT INTO space_members (
          space_id,
          user_id,
          role,
          joined_at,
          expires_at,
          invited_by,
          approved_by,
          cooldown_until
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run('spc_access', 'usr_guest', 'guest', now, '2026-05-27T00:00:00.000Z', 'usr_admin', 'usr_owner', '2026-08-25T00:00:00.000Z');

      const storedRoles = db.prepare(`
        SELECT role
        FROM space_members
        WHERE space_id = 'spc_access'
        ORDER BY user_id ASC
      `).all().map((row) => row.role);
      assert.deepEqual(storedRoles, ['admin', 'guest', 'member', 'owner', 'viewer']);

      const guestMembership = db.prepare(`
        SELECT expires_at, invited_by, approved_by, cooldown_until
        FROM space_members
        WHERE space_id = ? AND user_id = ?
      `).get('spc_access', 'usr_guest');
      assert.deepEqual({ ...guestMembership }, {
        expires_at: '2026-05-27T00:00:00.000Z',
        invited_by: 'usr_admin',
        approved_by: 'usr_owner',
        cooldown_until: '2026-08-25T00:00:00.000Z',
      });

      db.prepare('UPDATE spaces SET pending_deletion_at = ? WHERE space_id = ?').run('2026-05-01T00:00:00.000Z', 'spc_access');
      assert.equal(
        db.prepare('SELECT pending_deletion_at FROM spaces WHERE space_id = ?').get('spc_access')?.pending_deletion_at,
        '2026-05-01T00:00:00.000Z',
      );

      insertWorkProject(stmts, {
        workProjectId: 'prj_access_a',
        spaceId: 'spc_access',
        name: 'Project A',
        createdBy: 'usr_owner',
        now,
      });
      insertWorkProject(stmts, {
        workProjectId: 'prj_access_b',
        spaceId: 'spc_access',
        name: 'Project B',
        createdBy: 'usr_owner',
        sortOrder: 2,
        position: 2,
        now,
      });

      db.prepare(`
        INSERT INTO space_member_project_access (space_id, user_id, project_id, access_level, granted_at, granted_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run('spc_access', 'usr_viewer', 'prj_access_a', 'read', now, 'usr_owner');
      db.prepare(`
        INSERT INTO space_member_project_access (space_id, user_id, project_id, access_level, granted_at, granted_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run('spc_access', 'usr_guest', 'prj_access_b', 'write', now, 'usr_owner');

      const accessRows = db.prepare(`
        SELECT user_id, access_level
        FROM space_member_project_access
        ORDER BY user_id ASC
      `).all().map((row) => ({ ...row }));
      assert.deepEqual(accessRows, [
        { user_id: 'usr_guest', access_level: 'write' },
        { user_id: 'usr_viewer', access_level: 'read' },
      ]);

      assert.throws(
        () => {
          db.prepare(`
            INSERT INTO space_member_project_access (space_id, user_id, project_id, access_level, granted_at, granted_by)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run('spc_access', 'usr_member', 'prj_access_a', 'write', now, 'usr_owner');
        },
        /space_member_project_access requires viewer or guest membership/,
      );

      assert.deepEqual(getTableColumns(db, 'spaces').includes('pending_deletion_at'), true);
      assert.deepEqual(
        getTableColumns(db, 'space_members'),
        ['space_id', 'user_id', 'role', 'joined_at', 'expires_at', 'invited_by', 'approved_by', 'cooldown_until'],
      );
      assert.deepEqual(
        getTableColumns(db, 'space_member_project_access'),
        ['space_id', 'user_id', 'project_id', 'access_level', 'granted_at', 'granted_by'],
      );
    });
  });

  await t.test('pending_space_invite_projects cascades on invite and project deletion', async () => {
    await withDbHarness(async ({ db, stmts }) => {
      const now = nowIso();

      insertUser(stmts, { userId: 'usr_owner', sub: 'owner-sub', name: 'Owner', email: 'owner@example.com', now });
      insertSpace(stmts, { spaceId: 'spc_invites', ownerUserId: 'usr_owner', name: 'Invite Space', now });
      insertSpaceMember(stmts, { spaceId: 'spc_invites', userId: 'usr_owner', role: 'owner', now });
      insertWorkProject(stmts, {
        workProjectId: 'prj_invite_a',
        spaceId: 'spc_invites',
        name: 'Project A',
        createdBy: 'usr_owner',
        now,
      });
      insertWorkProject(stmts, {
        workProjectId: 'prj_invite_b',
        spaceId: 'spc_invites',
        name: 'Project B',
        createdBy: 'usr_owner',
        sortOrder: 2,
        position: 2,
        now,
      });

      db.prepare(`
        INSERT INTO pending_space_invites (
          invite_request_id,
          space_id,
          email,
          role,
          expires_after_days,
          requested_by_user_id,
          status,
          target_user_id,
          reviewed_by_user_id,
          reviewed_at,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run('pinv_a', 'spc_invites', 'viewer@example.com', 'viewer', 14, 'usr_owner', 'pending', null, null, null, now, now);
      db.prepare(`
        INSERT INTO pending_space_invite_projects (invite_id, project_id)
        VALUES (?, ?)
      `).run('pinv_a', 'prj_invite_a');

      db.prepare('DELETE FROM pending_space_invites WHERE invite_request_id = ?').run('pinv_a');
      assert.equal(
        db.prepare('SELECT COUNT(*) AS count FROM pending_space_invite_projects WHERE invite_id = ?').get('pinv_a')?.count,
        0,
      );

      db.prepare(`
        INSERT INTO pending_space_invites (
          invite_request_id,
          space_id,
          email,
          role,
          expires_after_days,
          requested_by_user_id,
          status,
          target_user_id,
          reviewed_by_user_id,
          reviewed_at,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run('pinv_b', 'spc_invites', 'guest@example.com', 'guest', 30, 'usr_owner', 'pending', null, null, null, now, now);
      db.prepare(`
        INSERT INTO pending_space_invite_projects (invite_id, project_id)
        VALUES (?, ?)
      `).run('pinv_b', 'prj_invite_b');

      db.prepare('DELETE FROM projects WHERE project_id = ?').run('prj_invite_b');
      assert.equal(
        db.prepare('SELECT COUNT(*) AS count FROM pending_space_invite_projects WHERE invite_id = ?').get('pinv_b')?.count,
        0,
      );

      assert.deepEqual(
        getTableColumns(db, 'pending_space_invite_projects'),
        ['invite_id', 'project_id'],
      );
    });
  });

  await t.test('personal space deletion guard returns 409 for the last personal space and allows scheduling otherwise', async () => {
    const guardHarness = await startApiHarness({
      seed: async ({ stmts }) => {
        const now = nowIso();
        insertUser(stmts, { userId: 'usr_owner', sub: 'owner-sub', name: 'Owner', email: 'owner@example.com', now });
        insertSpace(stmts, {
          spaceId: 'spc_personal_only',
          ownerUserId: 'usr_owner',
          name: 'Only Personal',
          spaceType: 'personal',
          isPersonal: 1,
          now,
        });
        stmts.spaces.updateTasksCollection.run('col_tasks_personal_only', now, 'spc_personal_only');
        stmts.spaces.updateRemindersCollection.run('col_reminders_personal_only', now, 'spc_personal_only');
        insertSpaceMember(stmts, { spaceId: 'spc_personal_only', userId: 'usr_owner', role: 'owner', now });
      },
    });

    try {
      const token = signJwt(guardHarness.privateKey, guardHarness.issuer, 'owner-sub', 'Owner', 'owner@example.com');
      const envelope = await expectStatus(
        guardHarness.apiBaseUrl,
        token,
        '/api/hub/spaces/spc_personal_only',
        409,
        { method: 'DELETE' },
      );
      assert.equal(envelope.error?.message, 'Cannot delete your last personal space. Keep or create another personal space first.');
    } finally {
      await guardHarness.stop();
    }

    const scheduleHarness = await startApiHarness({
      seed: async ({ stmts }) => {
        const now = nowIso();
        insertUser(stmts, { userId: 'usr_owner', sub: 'owner-sub', name: 'Owner', email: 'owner@example.com', now });
        insertSpace(stmts, {
          spaceId: 'spc_personal_a',
          ownerUserId: 'usr_owner',
          name: 'Personal A',
          spaceType: 'personal',
          isPersonal: 1,
          now,
        });
        stmts.spaces.updateTasksCollection.run('col_tasks_personal_a', now, 'spc_personal_a');
        stmts.spaces.updateRemindersCollection.run('col_reminders_personal_a', now, 'spc_personal_a');
        insertSpaceMember(stmts, { spaceId: 'spc_personal_a', userId: 'usr_owner', role: 'owner', now });
        insertSpace(stmts, {
          spaceId: 'spc_personal_b',
          ownerUserId: 'usr_owner',
          name: 'Personal B',
          spaceType: 'personal',
          isPersonal: 1,
          now,
        });
        stmts.spaces.updateTasksCollection.run('col_tasks_personal_b', now, 'spc_personal_b');
        stmts.spaces.updateRemindersCollection.run('col_reminders_personal_b', now, 'spc_personal_b');
        insertSpaceMember(stmts, { spaceId: 'spc_personal_b', userId: 'usr_owner', role: 'owner', now });
      },
    });

    try {
      const token = signJwt(scheduleHarness.privateKey, scheduleHarness.issuer, 'owner-sub', 'Owner', 'owner@example.com');
      const envelope = await expectStatus(
        scheduleHarness.apiBaseUrl,
        token,
        '/api/hub/spaces/spc_personal_a',
        200,
        { method: 'DELETE' },
      );
      assert.equal(envelope.ok, true);
      assert.equal(typeof envelope.data?.pending_deletion_at, 'string');

      const { db } = initializeDatabase(scheduleHarness.dbPath);
      try {
        const pendingDeletionAt = db.prepare('SELECT pending_deletion_at FROM spaces WHERE space_id = ?').get('spc_personal_a')?.pending_deletion_at;
        assert.equal(typeof pendingDeletionAt, 'string');
        assert.ok(pendingDeletionAt.length > 0);
      } finally {
        db.close();
      }
    } finally {
      await scheduleHarness.stop();
    }
  });
});
