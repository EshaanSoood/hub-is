/* global fetch, FormData, Blob */

import { createServer as createHttpServer } from 'node:http';
import { generateKeyPairSync, createSign, randomUUID } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { once } from 'node:events';
import { DatabaseSync } from 'node:sqlite';
import { spawn } from 'node:child_process';
import { createServer as createNetServer } from 'node:net';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const hubApiEntry = resolve(__dirname, '../apps/hub-api/hub-api.mjs');

const PROJECT_ID = 'backend-pilot';
const projectPath = `/api/hub/projects/${PROJECT_ID}`;
const nextcloudUser = 'codex-user';
const REQUEST_TIMEOUT_MS = Number.isFinite(Number(process.env.HUB_REQUEST_TIMEOUT_MS))
  ? Math.max(1_000, Number(process.env.HUB_REQUEST_TIMEOUT_MS))
  : 15_000;

const reservePort = async () => {
  const server = createNetServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  server.close();
  await once(server, 'close');
  return port;
};

const toBase64Url = (input) =>
  Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

const mintToken = ({ privateKey, issuer, email, subject, name, givenName, familyName, audience }) => {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const header = {
    alg: 'RS256',
    typ: 'JWT',
    kid: 'local-kid-1',
  };
  const payload = {
    iss: issuer,
    sub: subject,
    aud: audience,
    exp: nowSeconds + 3600,
    nbf: nowSeconds - 5,
    iat: nowSeconds,
    email,
    name,
    given_name: givenName,
    family_name: familyName,
  };

  const signingInput = `${toBase64Url(JSON.stringify(header))}.${toBase64Url(JSON.stringify(payload))}`;
  const signer = createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(privateKey).toString('base64url');
  return `${signingInput}.${signature}`;
};

const requestJson = async (baseUrl, path, { method = 'GET', token = '', body } = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null);
  return { status: response.status, payload };
};

const requestText = async (baseUrl, path, { method = 'GET', token = '' } = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const payload = await response.text();
  return { status: response.status, payload };
};

const requestMultipart = async (baseUrl, path, { token = '', fields = {}, file }) => {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    form.append(key, String(value));
  }
  if (file) {
    form.append(
      'file',
      new Blob([Buffer.isBuffer(file.content) ? file.content : Buffer.from(String(file.content))], {
        type: file.contentType || 'application/octet-stream',
      }),
      file.filename,
    );
  }

  const controller = new globalThis.AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      signal: controller.signal,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: form,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Multipart request timed out after ${REQUEST_TIMEOUT_MS}ms: ${path}`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutHandle);
  }

  const contentType = String(response.headers.get('content-type') || '').toLowerCase();
  if (contentType.includes('application/json')) {
    const payload = await response.json().catch(() => null);
    return { status: response.status, payload };
  }
  const payload = await response.text();
  return { status: response.status, payload };
};

const expectStatus = (label, response, allowed) => {
  const statuses = Array.isArray(allowed) ? allowed : [allowed];
  if (!statuses.includes(response.status)) {
    throw new Error(`${label}: expected ${statuses.join('|')}, got ${response.status}`);
  }
};

const expect = (label, condition) => {
  if (!condition) {
    throw new Error(`Expectation failed: ${label}`);
  }
};

const waitForHealth = async (baseUrl, timeoutMs = 10_000) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await requestJson(baseUrl, '/api/hub/health');
      if (response.status === 200) {
        return;
      }
    } catch {
      // keep retrying
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 120));
  }

  throw new Error('Hub API did not become healthy in time.');
};

const readRequestBuffer = async (request) => {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
};

const notificationReasonByType = Object.freeze({
  'task.assigned': 'assignment',
  'task.completed': 'update',
  'calendar.event.created': 'update',
  'calendar.series.created': 'update',
  'file.uploaded': 'update',
  'note.updated': 'update',
});

const notificationReasonForType = (type) => notificationReasonByType[type] || type;

const countByTypeForUser = (db, type, userId) =>
  Number(
    db
      .prepare('SELECT COUNT(*) AS count FROM notifications WHERE reason = ? AND user_id = ?')
      .get(notificationReasonForType(type), userId)?.count || 0,
  );

const listTimelineIds = (timelineRows) => timelineRows.map((entry) => entry.id);

const normalizeTimelineEntry = (entry) => ({
  ...entry,
  id: entry.id || entry.timeline_event_id,
  type: entry.type || entry.event_type,
  entityType: entry.entityType || entry.primary_entity_type,
  entityId: entry.entityId || entry.primary_entity_id,
  createdAt: entry.createdAt || entry.created_at,
});

const extractTimelineRows = (response, label) => {
  expectStatus(label, response, 200);
  const rows = Array.isArray(response.payload?.data?.timeline) ? response.payload.data.timeline : [];
  return rows.map(normalizeTimelineEntry);
};

const nextcloudPort = await reservePort();
const nextcloudStore = new Map();
const nextcloudServer = createHttpServer(async (request, response) => {
  const requestUrl = new URL(request.url || '/', `http://${request.headers.host || '127.0.0.1'}`);
  const prefix = `/remote.php/dav/files/${encodeURIComponent(nextcloudUser)}`;
  if (!requestUrl.pathname.startsWith(prefix)) {
    response.writeHead(404, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ error: 'not found' }));
    return;
  }

  const absolutePath = `/${decodeURIComponent(requestUrl.pathname.slice(prefix.length)).replace(/^\/+/, '')}`;
  if (request.method === 'PUT') {
    const payload = await readRequestBuffer(request);
    nextcloudStore.set(absolutePath, {
      size: payload.length,
      payload,
      updatedAt: new Date().toISOString(),
    });
    response.writeHead(201, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ ok: true }));
    return;
  }

  if (request.method === 'DELETE') {
    if (!nextcloudStore.has(absolutePath)) {
      response.writeHead(404, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ error: 'not found' }));
      return;
    }
    nextcloudStore.delete(absolutePath);
    response.writeHead(204);
    response.end();
    return;
  }

  if (request.method === 'GET') {
    const entry = nextcloudStore.get(absolutePath);
    if (!entry) {
      response.writeHead(404, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ error: 'not found' }));
      return;
    }
    response.writeHead(200, { 'Content-Type': 'application/octet-stream' });
    response.end(entry.payload);
    return;
  }

  response.writeHead(405, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify({ error: 'unsupported method' }));
});
nextcloudServer.listen(nextcloudPort, '127.0.0.1');
await once(nextcloudServer, 'listening');

const jwksPort = await reservePort();
const hubPort = await reservePort();
const dbPath = join(tmpdir(), `hub-tasks-${randomUUID()}.sqlite`);

const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
});
const publicJwk = publicKey.export({ format: 'jwk' });
const jwksPayload = {
  keys: [
    {
      ...publicJwk,
      kid: 'local-kid-1',
      use: 'sig',
      alg: 'RS256',
      kty: 'RSA',
    },
  ],
};

const issuer = `http://127.0.0.1:${jwksPort}/realms/test`;
const audience = ['account', 'eshaan-os-hub'];

const jwksServer = createHttpServer((request, response) => {
  if (request.url === '/realms/test/protocol/openid-connect/certs') {
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(jwksPayload));
    return;
  }

  response.writeHead(404, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify({ error: 'not found' }));
});

jwksServer.listen(jwksPort, '127.0.0.1');
await once(jwksServer, 'listening');

const hubEnv = {
  ...process.env,
  PORT: String(hubPort),
  HUB_DB_PATH: dbPath,
  HUB_OWNER_EMAIL: 'owner@example.com',
  KEYCLOAK_ISSUER: issuer,
  KEYCLOAK_AUDIENCE: audience.join(','),
  POSTMARK_ALLOWED_ORIGIN: 'http://localhost:5173',
  FILES_PROVIDER: 'nextcloud',
  NEXTCLOUD_BASE_URL: `http://127.0.0.1:${nextcloudPort}`,
  NEXTCLOUD_USER: nextcloudUser,
  NEXTCLOUD_APP_PASSWORD: 'codex-local-pass',
};
delete hubEnv.TASKS_PROVIDER;
delete hubEnv.CALENDAR_PROVIDER;

const hubChild = spawn('node', [hubApiEntry], {
  env: hubEnv,
  stdio: ['ignore', 'pipe', 'pipe'],
});

let hubStdoutTail = '';
let hubStderrTail = '';
hubChild.stdout.on('data', (chunk) => {
  hubStdoutTail = `${hubStdoutTail}${chunk.toString('utf8')}`.slice(-6000);
});
hubChild.stderr.on('data', (chunk) => {
  hubStderrTail = `${hubStderrTail}${chunk.toString('utf8')}`.slice(-6000);
});

const ownerToken = mintToken({
  privateKey,
  issuer,
  email: 'owner@example.com',
  subject: 'owner-sub',
  name: 'Owner Example',
  givenName: 'Owner',
  familyName: 'Example',
  audience,
});

const collaboratorToken = mintToken({
  privateKey,
  issuer,
  email: 'collab@example.com',
  subject: 'collab-sub',
  name: 'Collab Example',
  givenName: 'Collab',
  familyName: 'Example',
  audience,
});

const nonMemberToken = mintToken({
  privateKey,
  issuer,
  email: 'outsider@example.com',
  subject: 'outsider-sub',
  name: 'Outsider Example',
  givenName: 'Outsider',
  familyName: 'Example',
  audience,
});

const baseUrl = `http://127.0.0.1:${hubPort}`;

try {
  await waitForHealth(baseUrl);

  const health = await requestJson(baseUrl, '/api/hub/health');
  expectStatus('health', health, 200);
  expect('tasks provider defaults to sqlite', health.payload?.providers?.tasks === 'sqlite');
  expect('calendar provider defaults to sqlite', health.payload?.providers?.calendar === 'sqlite');

  const ownerMe = await requestJson(baseUrl, '/api/hub/me', { token: ownerToken });
  expectStatus('owner /me', ownerMe, 200);

  const nonMemberMe = await requestJson(baseUrl, '/api/hub/me', { token: nonMemberToken });
  expectStatus('non-member /me', nonMemberMe, 403);

  const invite = await requestJson(baseUrl, `${projectPath}/invites`, {
    method: 'POST',
    token: ownerToken,
    body: {
      email: 'collab@example.com',
    },
  });
  expectStatus('project invite create', invite, 200);

  const collabMe = await requestJson(baseUrl, '/api/hub/me', { token: collaboratorToken });
  expectStatus('collaborator /me', collabMe, 200);

  const members = await requestJson(baseUrl, `${projectPath}/members`, { token: ownerToken });
  expectStatus('members list', members, 200);
  const memberRows = Array.isArray(members.payload?.members) ? members.payload.members : [];
  const collaborator = memberRows.find((entry) => String(entry?.email || '') === 'collab@example.com') || null;
  const ownerMember = memberRows.find((entry) => String(entry?.email || '') === 'owner@example.com') || null;
  expect('collaborator exists in members', Boolean(collaborator?.userId));
  expect('owner exists in members', Boolean(ownerMember?.userId));
  const collaboratorUserId = String(collaborator.userId);
  const ownerUserId = String(ownerMember.userId);

  const mutableDb = new DatabaseSync(dbPath);
  const mappingResult = mutableDb
    .prepare('UPDATE projects SET nextcloud_folder = ?, updated_at = ? WHERE id = ?')
    .run('/HubOS/backend-pilot/files', new Date().toISOString(), PROJECT_ID);
  expect('nextcloud mapping patched for project', Number(mappingResult?.changes || 0) === 1);
  mutableDb.close();

  const createdProjectTask = await requestJson(baseUrl, `${projectPath}/tasks`, {
    method: 'POST',
    token: ownerToken,
    body: {
      title: 'SQLite lock project task',
      description: 'Project-scoped task for provider lock validation',
      category: 'ops',
    },
  });
  expectStatus('project task create', createdProjectTask, 200);
  const projectTaskId = createdProjectTask.payload?.task?.id;
  expect('project task id created', typeof projectTaskId === 'string' && projectTaskId.startsWith('task_'));

  const assignCollaborator = await requestJson(baseUrl, `${projectPath}/tasks/${encodeURIComponent(projectTaskId)}`, {
    method: 'PATCH',
    token: ownerToken,
    body: {
      assigneeUserId: collaboratorUserId,
    },
  });
  expectStatus('project task assign collaborator', assignCollaborator, 200);
  expect('project task assignee persisted', assignCollaborator.payload?.task?.assigneeUserId === collaboratorUserId);

  const createdPersonalTask = await requestJson(baseUrl, '/api/hub/tasks', {
    method: 'POST',
    token: collaboratorToken,
    body: {
      title: 'SQLite lock personal task',
      description: 'Personal scope validation task',
      category: 'personal',
    },
  });
  expectStatus('personal task create', createdPersonalTask, 200);
  const personalTaskId = createdPersonalTask.payload?.task?.id;
  expect('personal task id created', typeof personalTaskId === 'string' && personalTaskId.startsWith('task_'));

  const collaboratorMine = await requestJson(baseUrl, '/api/hub/tasks', { token: collaboratorToken });
  expectStatus('tasks mine list', collaboratorMine, 200);
  const mineTasks = Array.isArray(collaboratorMine.payload?.tasks) ? collaboratorMine.payload.tasks : [];
  expect('mine scope includes assigned project task', mineTasks.some((task) => task.id === projectTaskId));
  expect('mine scope includes personal task', mineTasks.some((task) => task.id === personalTaskId));

  const projectTasks = await requestJson(baseUrl, `${projectPath}/tasks`, { token: collaboratorToken });
  expectStatus('tasks project scope list', projectTasks, 200);
  const projectTaskRows = Array.isArray(projectTasks.payload?.tasks) ? projectTasks.payload.tasks : [];
  expect('project scope contains project task', projectTaskRows.some((task) => task.id === projectTaskId));
  expect('project scope excludes personal task', !projectTaskRows.some((task) => task.id === personalTaskId));

  const personalScopeRows = mineTasks.filter((task) => !task.projectId);
  expect('personal scope derived from mine includes personal task', personalScopeRows.some((task) => task.id === personalTaskId));
  expect(
    'personal scope derived from mine excludes project task',
    !personalScopeRows.some((task) => task.id === projectTaskId),
  );

  const startTimer = await requestJson(baseUrl, `/api/hub/tasks/${encodeURIComponent(projectTaskId)}/timer/start`, {
    method: 'POST',
    token: collaboratorToken,
  });
  expectStatus('task timer start', startTimer, 200);

  await new Promise((resolveWait) => setTimeout(resolveWait, 50));

  const stopTimer = await requestJson(baseUrl, `/api/hub/tasks/${encodeURIComponent(projectTaskId)}/timer/stop`, {
    method: 'POST',
    token: collaboratorToken,
    body: {
      note: 'sqlite-lock-check',
    },
  });
  expectStatus('task timer stop', stopTimer, 200);

  const timeEntries = await requestJson(baseUrl, `/api/hub/tasks/${encodeURIComponent(projectTaskId)}/time-entries`, {
    token: collaboratorToken,
  });
  expectStatus('task time entries list', timeEntries, 200);
  const taskTimeEntryRows = Array.isArray(timeEntries.payload?.timeEntries) ? timeEntries.payload.timeEntries : [];
  expect('task timer persisted at least one entry', taskTimeEntryRows.length >= 1);
  expect('task timer stop persisted endedAt', taskTimeEntryRows.some((entry) => entry.endedAt));

  const completeTask = await requestJson(baseUrl, `${projectPath}/tasks/${encodeURIComponent(projectTaskId)}/complete`, {
    method: 'POST',
    token: collaboratorToken,
  });
  expectStatus('task complete', completeTask, 200);
  expect('task complete sets status done', completeTask.payload?.task?.status === 'done');

  const projectEvent = await requestJson(baseUrl, `${projectPath}/calendar`, {
    method: 'POST',
    token: ownerToken,
    body: {
      title: 'SQLite lock one-off event',
      description: 'One-off event coverage',
      startsAt: '2026-03-10T14:00:00.000Z',
      endsAt: '2026-03-10T15:00:00.000Z',
      location: 'Online',
    },
  });
  expectStatus('project calendar one-off create', projectEvent, 200);
  const projectEventId = projectEvent.payload?.event?.id;
  expect('one-off event id created', typeof projectEventId === 'string' && projectEventId.startsWith('evt_'));

  const recurringSeries = await requestJson(baseUrl, `${projectPath}/calendar/ingest`, {
    method: 'POST',
    token: ownerToken,
    body: {
      sourceText: 'Every Monday and Wednesday at 08:30 starting 2026-03-02 until 2026-04-30 except 2026-03-16',
      parsed: {
        fields: {
          title: 'SQLite lock recurring series',
          description: 'Recurring coverage for sqlite lock',
          date: '2026-03-02',
          time: '08:30',
          location: 'HQ',
          recurrence: {
            frequency: 'weekly',
            interval: 1,
            days: ['monday', 'wednesday'],
            end_date: '2026-04-30',
            exceptions: ['2026-03-16'],
          },
        },
      },
    },
  });
  expectStatus('project calendar recurring create', recurringSeries, 200);
  const seriesId = recurringSeries.payload?.series?.id;
  expect('recurring series id created', typeof seriesId === 'string' && seriesId.startsWith('ser_'));

  const personalEvent = await requestJson(baseUrl, '/api/hub/calendar', {
    method: 'POST',
    token: collaboratorToken,
    body: {
      title: 'SQLite lock personal event',
      startsAt: '2026-03-12T09:00:00.000Z',
      endsAt: '2026-03-12T09:30:00.000Z',
    },
  });
  expectStatus('personal calendar one-off create', personalEvent, 200);

  const projectCalendar = await requestJson(
    baseUrl,
    `${projectPath}/calendar?start=2026-03-01T00:00:00.000Z&end=2026-04-30T23:59:59.000Z`,
    { token: collaboratorToken },
  );
  expectStatus('project calendar range expansion', projectCalendar, 200);
  const projectOccurrences = Array.isArray(projectCalendar.payload?.occurrences) ? projectCalendar.payload.occurrences : [];
  expect('project calendar includes one-off occurrence', projectOccurrences.some((occ) => occ.eventId === projectEventId));
  expect('project calendar includes recurring series occurrences', projectOccurrences.some((occ) => occ.seriesId === seriesId));
  expect(
    'project calendar excludes explicit series exception date',
    !projectOccurrences.some((occ) => occ.seriesId === seriesId && String(occ.startsAt || '').startsWith('2026-03-16')),
  );

  const personalCalendar = await requestJson(
    baseUrl,
    '/api/hub/calendar?start=2026-03-01T00:00:00.000Z&end=2026-03-31T23:59:59.000Z',
    { token: collaboratorToken },
  );
  expectStatus('personal calendar range list', personalCalendar, 200);
  const personalOccurrences = Array.isArray(personalCalendar.payload?.occurrences) ? personalCalendar.payload.occurrences : [];
  expect(
    'personal calendar contains personal event',
    personalOccurrences.some((occ) => occ.title === 'SQLite lock personal event'),
  );

  const projectIcs = await requestText(baseUrl, `${projectPath}/calendar.ics`, {
    token: collaboratorToken,
  });
  expectStatus('project calendar ICS export', projectIcs, 200);
  expect('project ICS has VCALENDAR', projectIcs.payload.includes('BEGIN:VCALENDAR'));
  expect('project ICS has VEVENT', projectIcs.payload.includes('BEGIN:VEVENT'));
  expect('project ICS has RRULE', projectIcs.payload.includes('RRULE:'));
  expect('project ICS has EXDATE', projectIcs.payload.includes('EXDATE:'));
  expect('project ICS uses CRLF line endings', projectIcs.payload.includes('\r\n'));
  expect('project ICS has no bare LF line endings', !projectIcs.payload.replace(/\r\n/g, '').includes('\n'));

  const personalIcs = await requestText(baseUrl, '/api/hub/calendar.ics', {
    token: collaboratorToken,
  });
  expectStatus('personal calendar ICS export', personalIcs, 200);
  expect('personal ICS has VCALENDAR', personalIcs.payload.includes('BEGIN:VCALENDAR'));
  expect('personal ICS has VEVENT', personalIcs.payload.includes('BEGIN:VEVENT'));

  const uploadedFilename = 'TEST-nextcloud-sqlite-lock.txt';
  const fileUpload = await requestMultipart(baseUrl, `${projectPath}/nextcloud/upload`, {
    token: ownerToken,
    file: {
      filename: uploadedFilename,
      contentType: 'text/plain',
      content: 'sqlite-lock-upload',
    },
  });
  expectStatus('project file upload', fileUpload, 200);
  const uploadedPath = fileUpload.payload?.path;
  expect('uploaded path persisted in response', uploadedPath === uploadedFilename);
  expect(
    'mock nextcloud stored uploaded file',
    nextcloudStore.has(`/HubOS/backend-pilot/files/${uploadedFilename}`),
  );

  const noteCreate = await requestJson(baseUrl, `${projectPath}/notes`, {
    method: 'POST',
    token: ownerToken,
    body: {
      title: 'SQLite lock note',
      lexicalState: {
        root: {
          children: [],
          direction: null,
          format: '',
          indent: 0,
          type: 'root',
          version: 1,
        },
      },
    },
  });
  expectStatus('project note create', noteCreate, 200);
  const noteId = noteCreate.payload?.note?.id;
  expect('note id created', typeof noteId === 'string' && noteId.startsWith('note_'));

  const db = new DatabaseSync(dbPath, { readOnly: true });
  const timelineIdsBeforeNoteUpdate = new Set(
    db.prepare('SELECT timeline_event_id FROM timeline_events ORDER BY created_at ASC, timeline_event_id ASC').all().map((row) => row.timeline_event_id),
  );

  const noteUpdate = await requestJson(baseUrl, `${projectPath}/notes/${encodeURIComponent(noteId)}`, {
    method: 'PATCH',
    token: ownerToken,
    body: {
      title: 'SQLite lock note updated',
    },
  });
  expectStatus('project note update', noteUpdate, 200);

  const timelineIdsAfterNoteUpdate = new Set(
    db.prepare('SELECT timeline_event_id FROM timeline_events ORDER BY created_at ASC, timeline_event_id ASC').all().map((row) => row.timeline_event_id),
  );
  expect('timeline events append-only count increases on new mutation', timelineIdsAfterNoteUpdate.size > timelineIdsBeforeNoteUpdate.size);
  expect(
    'timeline events append-only preserves prior ids',
    Array.from(timelineIdsBeforeNoteUpdate).every((id) => timelineIdsAfterNoteUpdate.has(id)),
  );

  const projectTimelineFull = await requestJson(baseUrl, `${projectPath}/timeline?limit=100`, { token: ownerToken });
  const timelineRows = extractTimelineRows(projectTimelineFull, 'project timeline list');
  expect('timeline includes task.created entry', timelineRows.some((entry) => entry.type === 'task.created' && entry.entityId === projectTaskId));
  expect('timeline includes task.completed entry', timelineRows.some((entry) => entry.type === 'task.completed' && entry.entityId === projectTaskId));
  expect('timeline includes event.created entry', timelineRows.some((entry) => entry.type === 'event.created' && entry.entityId === projectEventId));
  expect('timeline includes series.created entry', timelineRows.some((entry) => entry.type === 'series.created' && entry.entityId === seriesId));
  expect('timeline includes file.uploaded entry', timelineRows.some((entry) => entry.type === 'file.uploaded' && entry.entityId === uploadedPath));
  expect(
    'timeline is newest-first',
    timelineRows.every((entry, index, rows) => index === 0 || entry.createdAt <= rows[index - 1].createdAt),
  );

  const taskTimelineEntry = timelineRows.find((entry) => entry.entityType === 'task' && entry.entityId === projectTaskId);
  const seriesTimelineEntry = timelineRows.find((entry) => entry.entityType === 'series' && entry.entityId === seriesId);
  const fileTimelineEntry = timelineRows.find((entry) => entry.entityType === 'file' && entry.entityId === uploadedPath);
  expect('task deep-link points to task route', String(taskTimelineEntry?.link?.path || '').includes(`taskId=${projectTaskId}`));
  expect('series deep-link points to series route', String(seriesTimelineEntry?.link?.path || '').includes(`seriesId=${seriesId}`));
  expect(
    'file deep-link points to files route',
    String(fileTimelineEntry?.link?.path || '').includes(`path=${encodeURIComponent(uploadedPath)}`),
  );

  const timelinePage1Response = await requestJson(baseUrl, `${projectPath}/timeline?limit=5`, { token: ownerToken });
  const timelinePage1 = extractTimelineRows(timelinePage1Response, 'project timeline page 1');
  expect('timeline page 1 has entries', timelinePage1.length > 0);
  const nextCursor = timelinePage1Response.payload?.pageInfo?.nextCursor || '';
  expect('timeline page 1 has cursor', typeof nextCursor === 'string' && nextCursor.length > 0);

  const timelinePage2Response = await requestJson(
    baseUrl,
    `${projectPath}/timeline?limit=5&cursor=${encodeURIComponent(nextCursor)}`,
    { token: ownerToken },
  );
  const timelinePage2 = extractTimelineRows(timelinePage2Response, 'project timeline page 2');
  const page1Ids = new Set(listTimelineIds(timelinePage1));
  const page2Ids = new Set(listTimelineIds(timelinePage2));
  expect('timeline cursor paging has no overlap', Array.from(page1Ids).every((id) => !page2Ids.has(id)));

  const timelinePage1RepeatResponse = await requestJson(baseUrl, `${projectPath}/timeline?limit=5`, { token: ownerToken });
  const timelinePage1Repeat = extractTimelineRows(timelinePage1RepeatResponse, 'project timeline page 1 repeat');
  expect(
    'timeline range query is stable for identical request',
    JSON.stringify(listTimelineIds(timelinePage1Repeat)) === JSON.stringify(listTimelineIds(timelinePage1)),
  );

  const combinedPagedIds = [...listTimelineIds(timelinePage1), ...listTimelineIds(timelinePage2)];
  const fullPrefixIds = listTimelineIds(timelineRows).slice(0, combinedPagedIds.length);
  expect(
    'timeline cursor pages align with full-list prefix ordering',
    JSON.stringify(combinedPagedIds) === JSON.stringify(fullPrefixIds),
  );

  const collabUnreadBeforeRead = await requestJson(baseUrl, '/api/hub/notifications?unread=1&limit=250', {
    token: collaboratorToken,
  });
  expectStatus('notifications unread list before mark read', collabUnreadBeforeRead, 200);
  const unreadBeforeRows = Array.isArray(collabUnreadBeforeRead.payload?.notifications)
    ? collabUnreadBeforeRead.payload.notifications
    : [];
  expect('notifications include unread rows before read', unreadBeforeRows.length >= 1);

  const unreadId = unreadBeforeRows[0]?.id || '';
  expect('unread notification id exists', typeof unreadId === 'string' && unreadId.startsWith('ntf_'));
  const markRead = await requestJson(baseUrl, `/api/hub/notifications/${encodeURIComponent(unreadId)}/read`, {
    method: 'POST',
    token: collaboratorToken,
  });
  expectStatus('notification mark read', markRead, 200);
  expect('notification mark read returns readAt', Boolean(markRead.payload?.notification?.readAt));

  const collabUnreadAfterRead = await requestJson(baseUrl, '/api/hub/notifications?unread=1&limit=250', {
    token: collaboratorToken,
  });
  expectStatus('notifications unread list after mark read', collabUnreadAfterRead, 200);
  const unreadAfterRows = Array.isArray(collabUnreadAfterRead.payload?.notifications)
    ? collabUnreadAfterRead.payload.notifications
    : [];
  expect('marked-read notification removed from unread list', !unreadAfterRows.some((row) => row.id === unreadId));

  const runningTimeEntries = Number(
    db.prepare('SELECT COUNT(*) AS count FROM task_time_entries WHERE task_id = ? AND ended_at IS NULL').get(projectTaskId)?.count || 0,
  );
  const persistedClosedTimeEntries = Number(
    db
      .prepare('SELECT COUNT(*) AS count FROM task_time_entries WHERE task_id = ? AND user_id = ? AND ended_at IS NOT NULL')
      .get(projectTaskId, collaboratorUserId)?.count || 0,
  );
  expect('task timer has no running entry after stop', runningTimeEntries === 0);
  expect('task timer persisted closed entry', persistedClosedTimeEntries >= 1);

  const seriesRrule = db.prepare('SELECT rrule FROM calendar_series WHERE id = ?').get(seriesId)?.rrule || '';
  const seriesExceptionCount = Number(
    db.prepare("SELECT COUNT(*) AS count FROM calendar_series_exceptions WHERE series_id = ? AND kind = 'skip'").get(seriesId)?.count || 0,
  );
  expect('calendar series stores RRULE', typeof seriesRrule === 'string' && seriesRrule.startsWith('FREQ=WEEKLY'));
  expect('calendar series stores skip exception', seriesExceptionCount >= 1);

  const timelineDistinct = Number(db.prepare('SELECT COUNT(DISTINCT timeline_event_id) AS count FROM timeline_events').get()?.count || 0);
  const timelineTotal = Number(db.prepare('SELECT COUNT(*) AS count FROM timeline_events').get()?.count || 0);
  expect('timeline event ids remain unique', timelineDistinct === timelineTotal);

  const requiredActivityTypes = [
    'task.created',
    'task.assigned',
    'task.completed',
    'event.created',
    'series.created',
    'file.uploaded',
    'note.updated',
  ];
  for (const activityType of requiredActivityTypes) {
    const count = Number(db.prepare('SELECT COUNT(*) AS count FROM timeline_events WHERE event_type = ?').get(activityType)?.count || 0);
    expect(`timeline_events contains ${activityType}`, count >= 1);
  }

  const collabTaskAssignedCount = countByTypeForUser(db, 'task.assigned', collaboratorUserId);
  const ownerTaskAssignedCount = countByTypeForUser(db, 'task.assigned', ownerUserId);
  const ownerTaskCompletedCount = countByTypeForUser(db, 'task.completed', ownerUserId);
  const collabTaskCompletedCount = countByTypeForUser(db, 'task.completed', collaboratorUserId);
  const collabEventCreatedCount = countByTypeForUser(db, 'calendar.event.created', collaboratorUserId);
  const ownerEventCreatedCount = countByTypeForUser(db, 'calendar.event.created', ownerUserId);
  const collabSeriesCreatedCount = countByTypeForUser(db, 'calendar.series.created', collaboratorUserId);
  const ownerSeriesCreatedCount = countByTypeForUser(db, 'calendar.series.created', ownerUserId);
  const collabFileUploadedCount = countByTypeForUser(db, 'file.uploaded', collaboratorUserId);
  const ownerFileUploadedCount = countByTypeForUser(db, 'file.uploaded', ownerUserId);
  const collabNoteUpdatedCount = countByTypeForUser(db, 'note.updated', collaboratorUserId);
  const ownerNoteUpdatedCount = countByTypeForUser(db, 'note.updated', ownerUserId);

  expect('task assignment fan-out sends exactly one notification to collaborator', collabTaskAssignedCount === 1);
  expect('task assignment excludes actor notification', ownerTaskAssignedCount === 0);
  expect('task completion fan-out sends exactly one notification to owner', ownerTaskCompletedCount === 1);
  expect('task completion excludes actor notification', collabTaskCompletedCount === 0);
  expect('event creation fan-out sends exactly one notification to collaborator', collabEventCreatedCount === 1);
  expect('event creation excludes actor notification', ownerEventCreatedCount === 0);
  expect('series creation fan-out sends exactly one notification to collaborator', collabSeriesCreatedCount === 1);
  expect('series creation excludes actor notification', ownerSeriesCreatedCount === 0);
  expect('file upload fan-out sends exactly one notification to collaborator', collabFileUploadedCount === 1);
  expect('file upload excludes actor notification', ownerFileUploadedCount === 0);
  expect('note update fan-out sends two notifications (create + update) to collaborator', collabNoteUpdatedCount === 2);
  expect('note update excludes actor notification', ownerNoteUpdatedCount === 0);

  db.close();

  console.log('PASS: sqlite local harness checks completed (tasks, calendar, timeline, notifications, ICS).');
  console.log(`project_task_id=${projectTaskId} personal_task_id=${personalTaskId} series_id=${seriesId}`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`FAIL: check-hub-tasks-local.mjs: ${message}`);
  if (hubStdoutTail.trim()) {
    console.error(`--- hub stdout tail ---\n${hubStdoutTail.trim()}`);
  }
  if (hubStderrTail.trim()) {
    console.error(`--- hub stderr tail ---\n${hubStderrTail.trim()}`);
  }
  throw error;
} finally {
  if (hubChild.exitCode === null && hubChild.signalCode === null) {
    hubChild.kill('SIGTERM');
    const exited = await Promise.race([
      once(hubChild, 'exit').then(() => true),
      new Promise((resolveWait) => setTimeout(() => resolveWait(false), 1000)),
    ]);
    if (!exited && hubChild.exitCode === null && hubChild.signalCode === null) {
      hubChild.kill('SIGKILL');
      if (hubChild.exitCode === null && hubChild.signalCode === null) {
        await once(hubChild, 'exit');
      }
    }
  }
  jwksServer.close();
  await once(jwksServer, 'close');
  nextcloudServer.close();
  await once(nextcloudServer, 'close');
}
