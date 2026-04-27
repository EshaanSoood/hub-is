import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { spawn } from 'node:child_process';
import { createSign, generateKeyPairSync } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const REPORT_DIR = path.resolve('test-results', 'widget-rename-trace');

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

const requestHub = async (baseUrl, token, pathname, init = {}) => {
  const headers = new globalThis.Headers(init.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const response = await globalThis.fetch(new URL(pathname, baseUrl), {
    ...init,
    headers,
  });
  return readEnvelope(response);
};

const expectOk = async (baseUrl, token, pathname, init = {}) => {
  const envelope = await requestHub(baseUrl, token, pathname, init);
  assert.equal(
    envelope.ok,
    true,
    `${init.method || 'GET'} ${pathname} should succeed: ${JSON.stringify(envelope.raw).slice(0, 500)}`,
  );
  assert.ok(envelope.data, `${pathname} should include data`);
  return envelope;
};

const writeJson = async (filename, value) => {
  await writeFile(path.join(REPORT_DIR, filename), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

const reportName = (value) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'dump';

const traceEnvelope = async (name, envelope, context) => {
  const dumpFile = `${reportName(name)}.json`;
  await writeJson(dumpFile, envelope.raw);
  return {
    name,
    dumpFile,
    status: envelope.status,
    ok: envelope.ok,
    findings: findWidgetIdConfusion(envelope.raw, context),
  };
};

const traceRequest = async (baseUrl, token, name, pathname, context, init = {}) => {
  const envelope = await expectOk(baseUrl, token, pathname, init);
  return traceEnvelope(name, envelope, context);
};

const findWidgetIdConfusion = (payload, { spaceId, workProjectId, expectedInstanceIds }) => {
  const expectedIds = new Set(expectedInstanceIds);
  const findings = [];

  const visit = (value, currentPath) => {
    if (Array.isArray(value)) {
      value.forEach((entry, index) => visit(entry, `${currentPath}[${index}]`));
      return;
    }
    if (!value || typeof value !== 'object') {
      return;
    }

    for (const [key, child] of Object.entries(value)) {
      const childPath = `${currentPath}.${key}`;
      if (key === 'widget_instance_id' && typeof child === 'string') {
        if (child === spaceId || child === workProjectId) {
          findings.push(`${childPath} contains ${child}; expected a widget/widget instance ID.`);
        } else if (!expectedIds.has(child)) {
          findings.push(`${childPath} contains unexpected instance ID ${child}.`);
        }
      } else if (key === 'widget_instance_id' && child != null) {
        findings.push(`${childPath} is ${typeof child}; expected a string instance ID.`);
      }
      visit(child, childPath);
    }
  };

  visit(payload, 'response');
  return findings;
};

const assertSeedDataIncludesWidgets = (seedData) => {
  assert.ok(seedData?.calendar, 'Widget picker seed data should include calendar.');
  assert.ok(seedData?.tasks, 'Widget picker seed data should include tasks.');
};

test('widget rename trace reports current widget API shapes', async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'hub-widget-trace-'));
  const dbPath = path.join(tmpDir, 'hub.sqlite');
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const publicJwk = publicKey.export({ format: 'jwk' });
  const jwksPort = await reservePort();
  const apiPort = await reservePort();
  const issuer = `http://127.0.0.1:${jwksPort}`;
  const apiBaseUrl = `http://127.0.0.1:${apiPort}`;

  await rm(REPORT_DIR, { recursive: true, force: true });
  await mkdir(REPORT_DIR, { recursive: true });

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

    const token = signJwt(privateKey, issuer, 'widget-owner-sub', 'Widget Owner', 'widget-owner@example.com');
    await expectOk(apiBaseUrl, token, '/api/hub/me', { method: 'GET' });

    const runId = `widget-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const idSuffix = runId.replace(/[^A-Za-z0-9_-]/g, '_');
    const spaceId = `SPACE_WIDGET_${idSuffix}`;
    const calendarInstanceId = `widget_calendar_${idSuffix}`;
    const tasksInstanceId = `widget_tasks_${idSuffix}`;
    const context = {
      spaceId,
      workProjectId: '',
      expectedInstanceIds: [calendarInstanceId, tasksInstanceId],
    };

    await expectOk(apiBaseUrl, token, '/api/hub/spaces', {
      method: 'POST',
      body: JSON.stringify({
        space_id: spaceId,
        name: `Widget Rename Trace ${runId}`,
      }),
    });

    const layoutConfig = {
      widgets_enabled: true,
      workspace_enabled: true,
      doc_binding_mode: 'owned',
      widgets: [
        { widget_instance_id: calendarInstanceId, widget_type: 'calendar', size_tier: 'M', lens: 'project' },
        { widget_instance_id: tasksInstanceId, widget_type: 'tasks', size_tier: 'M', lens: 'project' },
      ],
    };

    const createProject = await expectOk(apiBaseUrl, token, `/api/hub/spaces/${encodeURIComponent(spaceId)}/projects`, {
      method: 'POST',
      body: JSON.stringify({
        name: `Widget Trace Work ${runId}`,
        layout_config: layoutConfig,
      }),
    });
    const workProjectId = createProject.data.project?.project_id;
    assert.equal(typeof workProjectId, 'string', 'Created work project should include project_id.');
    assert.notEqual(workProjectId, spaceId, 'Trace fixture requires distinct space and work-project IDs.');
    context.workProjectId = workProjectId;

    const reports = [
      await traceEnvelope('create project response', createProject, context),
      await traceRequest(
        apiBaseUrl,
        token,
        'project list response',
        `/api/hub/spaces/${encodeURIComponent(spaceId)}/projects`,
        context,
        { method: 'GET' },
      ),
    ];

    const patchedLayoutConfig = {
      ...layoutConfig,
      widgets: layoutConfig.widgets.map((entry) => ({ ...entry, lens: 'project' })),
    };
    const updateProject = await expectOk(apiBaseUrl, token, `/api/hub/projects/${encodeURIComponent(workProjectId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ layout_config: patchedLayoutConfig }),
    });
    reports.push(await traceEnvelope('update project response', updateProject, context));

    const projectListAfterUpdate = await traceRequest(
      apiBaseUrl,
      token,
      'project list after update response',
      `/api/hub/spaces/${encodeURIComponent(spaceId)}/projects`,
      context,
      { method: 'GET' },
    );
    reports.push(projectListAfterUpdate);

    const seedData = await expectOk(apiBaseUrl, token, '/api/hub/widget-picker/seed-data', { method: 'GET' });
    assertSeedDataIncludesWidgets(seedData.data.seedData);
    reports.push(await traceEnvelope('widget picker seed data response', seedData, context));

    const allFindings = reports.flatMap((report) => report.findings.map((finding) => ({ source: report.name, finding })));
    await writeJson('api-findings.json', allFindings);
    await writeJson('summary.json', {
      runId,
      spaceId,
      workProjectId,
      expectedInstanceIds: context.expectedInstanceIds,
      reports,
    });

    assert.deepEqual(
      allFindings,
      [],
      `Widget rename trace found ID confusion. See ${path.join(REPORT_DIR, 'summary.json')}`,
    );
  } catch (error) {
    const stderr = apiProcess.getStderr();
    if (stderr) {
      await writeFile(path.join(REPORT_DIR, 'hub-api-stderr.log'), stderr, 'utf8').catch(() => undefined);
    }
    throw error;
  } finally {
    await Promise.allSettled([
      apiProcess.stop(),
      new Promise((resolve) => jwksServer.close(resolve)),
    ]);
    await rm(tmpDir, { recursive: true, force: true });
  }
});
