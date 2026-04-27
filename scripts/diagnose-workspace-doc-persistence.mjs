/* global fetch */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const repoRoot = process.cwd();
const artifactsDir = resolve(repoRoot, '.artifacts', 'workspace-doc-persistence');
const reportPath = resolve(artifactsDir, 'report.md');
const jsonPath = resolve(artifactsDir, 'diagnostics.json');
const screenshotPath = resolve(artifactsDir, 'final-state.png');

const baseUrl = String(process.env.BASE_URL || process.env.HUB_BASE_URL || 'https://eshaansood.org').trim().replace(/\/+$/, '');
const configuredTokenFilePath = resolve(repoRoot, String(process.env.HUB_SMOKE_TOKENS_FILE || '.env.contract-smoke.tokens.local').trim());
const tokenName = String(process.env.HUB_DIAGNOSTIC_TOKEN_NAME || 'TOKEN_A').trim();
const e2eAccessTokenKey = 'hub:e2e:access-token';
const timestamp = new Date().toISOString();
const diagnosticLabel = `workspace-doc-diag ${timestamp}`;
const fallbackTokenFilePaths = [
  configuredTokenFilePath,
  resolve(repoRoot, '.env.contract-smoke.tokens.local'),
  resolve(repoRoot, 'e2e/.env.tokens.local'),
];
const fallbackUserEnvPaths = [
  resolve(repoRoot, '.env.contract-smoke.users.local'),
  resolve(repoRoot, 'e2e/.env.users.local'),
];

const normalizeText = (value) => String(value || '').replace(/\s+/g, ' ').trim();

const truncate = (value, maxLength = 240) => {
  const text = String(value || '');
  return text.length <= maxLength ? text : `${text.slice(0, maxLength)}...[truncated]`;
};

const parseEnvFile = (raw) => {
  const entries = new Map();
  for (const line of String(raw || '').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const separator = trimmed.indexOf('=');
    if (separator <= 0) {
      continue;
    }
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    entries.set(key, value);
  }
  return entries;
};

const loadEnvFileIntoProcess = (filePath) => {
  if (!existsSync(filePath)) {
    return;
  }
  const entries = parseEnvFile(readFileSync(filePath, 'utf8'));
  for (const [key, value] of entries.entries()) {
    if (process.env[key] === undefined || process.env[key] === '') {
      process.env[key] = value;
    }
  }
};

const readTokenFromFiles = () => {
  for (const filePath of fallbackTokenFilePaths) {
    if (!existsSync(filePath)) {
      continue;
    }
    const entries = parseEnvFile(readFileSync(filePath, 'utf8'));
    const token = String(entries.get(tokenName) || '').trim();
    if (token) {
      return token;
    }
  }
  return '';
};

const requestJson = async (token, path, init = {}) => {
  const response = await fetch(new URL(path, baseUrl).toString(), {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
  });
  const payload = await response.json().catch(() => null);
  return { response, payload };
};

const tokenIsValid = async (token) => {
  if (!token) {
    return false;
  }
  try {
    const { response } = await requestJson(token, '/api/hub/me');
    return response.ok;
  } catch {
    return false;
  }
};

const ensureAccessToken = async () => {
  for (const path of fallbackUserEnvPaths) {
    loadEnvFileIntoProcess(path);
  }

  const existingToken = readTokenFromFiles();
  if (await tokenIsValid(existingToken)) {
    return existingToken;
  }

  execFileSync('node', ['scripts/mint-contract-smoke-tokens.mjs'], {
    cwd: repoRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      HUB_SMOKE_TOKENS_FILE: configuredTokenFilePath,
    },
  });

  const mintedToken = readTokenFromFiles();
  if (!(await tokenIsValid(mintedToken))) {
    throw new Error(`Unable to load a valid ${tokenName} from token files after minting.`);
  }

  return mintedToken;
};

const listProjects = async (token) => {
  const { response, payload } = await requestJson(token, '/api/hub/spaces');
  if (!response.ok) {
    throw new Error(`GET /api/hub/spaces failed (${response.status}).`);
  }
  return Array.isArray(payload?.data?.spaces) ? payload.data.spaces : [];
};

const listWorkProjects = async (token, projectId) => {
  const { response, payload } = await requestJson(token, `/api/hub/spaces/${encodeURIComponent(projectId)}/projects`);
  if (!response.ok) {
    throw new Error(`GET /api/hub/spaces/${projectId}/projects failed (${response.status}).`);
  }
  return Array.isArray(payload?.data?.projects) ? payload.data.projects : [];
};

const createProject = async (token, projectId, name) => {
  const { response, payload } = await requestJson(token, `/api/hub/spaces/${encodeURIComponent(projectId)}/projects`, {
    method: 'POST',
    body: JSON.stringify({
      name,
      layout_config: {
        workspace_enabled: true,
        modules_enabled: false,
      },
    }),
  });
  if (!response.ok) {
    throw new Error(`POST /api/hub/spaces/${projectId}/projects failed (${response.status}).`);
  }
  const project = payload?.data?.project;
  if (!project?.project_id || !project?.doc_id) {
    throw new Error('Created project response did not include project_id/doc_id.');
  }
  return project;
};

const deleteProject = async (token, projectId) => {
  const { response } = await requestJson(token, `/api/hub/projects/${encodeURIComponent(projectId)}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(`DELETE /api/hub/projects/${projectId} failed (${response.status}).`);
  }
};

const getSnapshot = async (token, docId) => {
  const { response, payload } = await requestJson(token, `/api/hub/docs/${encodeURIComponent(docId)}`);
  if (!response.ok) {
    throw new Error(`GET /api/hub/docs/${docId} failed (${response.status}).`);
  }
  return payload?.data?.doc || null;
};

const chooseProject = async (token) => {
  const explicitProjectId = String(process.env.HUB_PROJECT_ID || '').trim();
  if (explicitProjectId) {
    return explicitProjectId;
  }

  const projects = await listProjects(token);
  for (const project of projects) {
    const projectId = String(project?.id || project?.space_id || '').trim();
    if (!projectId) {
      continue;
    }
    const projects = await listWorkProjects(token, projectId).catch(() => []);
    const editableProject = projects.find((project) => project && project.can_edit !== false);
    if (editableProject) {
      return projectId;
    }
  }

  throw new Error('Unable to find a project with an editable project.');
};

const buildWorkUrl = (projectId, workProjectId) => `${baseUrl}/projects/${encodeURIComponent(projectId)}/work/${encodeURIComponent(workProjectId)}`;
const buildOverviewUrl = (projectId) => `${baseUrl}/projects/${encodeURIComponent(projectId)}/overview`;

const readEditorText = async (page) => {
  const content = page.getByLabel('Project note editor');
  await content.waitFor({ state: 'visible', timeout: 30_000 });
  return normalizeText(await content.innerText().catch(() => ''));
};

const waitForSnapshotContains = async (token, docId, needle, timeoutMs = 8_000) => {
  const started = Date.now();
  let lastSnapshot = null;
  while (Date.now() - started < timeoutMs) {
    lastSnapshot = await getSnapshot(token, docId);
    const plainText = normalizeText(lastSnapshot?.snapshot_payload?.plain_text || '');
    if (plainText.includes(needle)) {
      return { matched: true, snapshot: lastSnapshot };
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 400));
  }
  return { matched: false, snapshot: lastSnapshot };
};

const attachDiagnostics = (page, store) => {
  page.on('console', (message) => {
    store.console.push({
      type: message.type(),
      text: message.text(),
    });
  });

  page.on('pageerror', (error) => {
    store.pageErrors.push({
      message: error.message,
      stack: error.stack || '',
    });
  });

  page.on('request', (request) => {
    const url = request.url();
    if (!url.includes('/api/hub/docs/') && !url.includes('/api/hub/collab/authorize')) {
      return;
    }
    store.requests.push({
      method: request.method(),
      url,
      postData: truncate(request.postData() || '', 1200),
    });
  });

  page.on('response', async (response) => {
    const url = response.url();
    if (!url.includes('/api/hub/docs/') && !url.includes('/api/hub/collab/authorize')) {
      return;
    }
    let body = '';
    try {
      body = await response.text();
    } catch {
      body = '';
    }
    store.responses.push({
      status: response.status(),
      url,
      body: truncate(body, 1600),
    });
  });

  page.on('websocket', (ws) => {
    const entry = {
      url: ws.url(),
      events: [],
    };
    store.websockets.push(entry);
    ws.on('framesent', (frame) => {
      entry.events.push(`sent:${typeof frame.payload === 'string' ? truncate(frame.payload, 120) : '[binary]'}`);
    });
    ws.on('framereceived', (frame) => {
      entry.events.push(`received:${typeof frame.payload === 'string' ? truncate(frame.payload, 120) : '[binary]'}`);
    });
    ws.on('close', () => {
      entry.events.push('close');
    });
    ws.on('socketerror', (error) => {
      entry.events.push(`error:${error}`);
    });
  });
};

const prepareContext = async (browser, token) => {
  const context = await browser.newContext();
  await context.addInitScript(([key, value]) => {
    const traces = [];
    let nextSocketId = 1;
    const captureStack = () => {
      const stack = new Error().stack || '';
      return stack
        .split('\n')
        .slice(2)
        .map((line) => line.trim())
        .filter(Boolean);
    };

    const OriginalWebSocket = globalThis.WebSocket;
    class InstrumentedWebSocket extends OriginalWebSocket {
      constructor(url, protocols) {
        super(url, protocols);

        const socketId = nextSocketId++;
        const trace = {
          id: socketId,
          url: String(url || ''),
          createdAt: new Date().toISOString(),
          createdStack: captureStack(),
          closeCalls: [],
          events: [],
        };
        traces.push(trace);
        this.__hubTraceId = socketId;

        const pushEvent = (type, details = null) => {
          trace.events.push({
            at: new Date().toISOString(),
            type,
            readyState: this.readyState,
            ...(details && typeof details === 'object' ? details : {}),
          });
        };

        pushEvent('construct', {
          protocols: Array.isArray(protocols) ? protocols : protocols ? [protocols] : [],
        });

        this.addEventListener('open', () => {
          pushEvent('open');
        });
        this.addEventListener('error', () => {
          pushEvent('error');
        });
        this.addEventListener('close', (event) => {
          pushEvent('close', {
            code: event?.code ?? null,
            reason: event?.reason ?? '',
            wasClean: event?.wasClean ?? null,
          });
        });
        this.addEventListener('message', (event) => {
          pushEvent('message', {
            dataType: typeof event?.data,
          });
        });
      }

      close(code, reason) {
        const trace = traces.find((entry) => entry.id === this.__hubTraceId);
        if (trace) {
          trace.closeCalls.push({
            at: new Date().toISOString(),
            code: code ?? null,
            reason: reason ?? '',
            readyState: this.readyState,
            stack: captureStack(),
          });
        }
        return super.close(code, reason);
      }

      send(data) {
        const trace = traces.find((entry) => entry.id === this.__hubTraceId);
        if (trace) {
          trace.events.push({
            at: new Date().toISOString(),
            type: 'send',
            readyState: this.readyState,
            dataType: typeof data,
          });
        }
        return super.send(data);
      }
    }

    Object.defineProperty(InstrumentedWebSocket, 'CONNECTING', { value: OriginalWebSocket.CONNECTING });
    Object.defineProperty(InstrumentedWebSocket, 'OPEN', { value: OriginalWebSocket.OPEN });
    Object.defineProperty(InstrumentedWebSocket, 'CLOSING', { value: OriginalWebSocket.CLOSING });
    Object.defineProperty(InstrumentedWebSocket, 'CLOSED', { value: OriginalWebSocket.CLOSED });

    globalThis.WebSocket = InstrumentedWebSocket;
    globalThis.__hubWsTraces = traces;
    globalThis.localStorage.setItem(key, value);
  }, [e2eAccessTokenKey, token]);
  return context;
};

const collectPageWebSocketTraces = async (page) =>
  page.evaluate(() => {
    const traces = Array.isArray(globalThis.__hubWsTraces) ? globalThis.__hubWsTraces : [];
    return traces.map((trace) => ({
      id: trace.id,
      url: trace.url,
      createdAt: trace.createdAt,
      createdStack: Array.isArray(trace.createdStack) ? trace.createdStack : [],
      closeCalls: Array.isArray(trace.closeCalls) ? trace.closeCalls : [],
      events: Array.isArray(trace.events) ? trace.events : [],
    }));
  }).catch(() => []);

const formatList = (items) => items.length === 0 ? '- none' : items.map((item) => `- ${item}`).join('\n');

const main = async () => {
  mkdirSync(artifactsDir, { recursive: true });

  const token = await ensureAccessToken();
  const projectId = await chooseProject(token);
  const projectName = `Workspace Persistence Diagnostic ${new Date().toISOString()}`;
  const project = await createProject(token, projectId, projectName);
  const docId = String(project.doc_id);
  const workUrl = buildWorkUrl(projectId, project.project_id);
  const overviewUrl = buildOverviewUrl(projectId);

  const diagnostics = {
    startedAt: timestamp,
    baseUrl,
    projectId,
    workProjectId: project.project_id,
    docId,
    workUrl,
    overviewUrl,
    marker: diagnosticLabel,
    sameContext: {
      console: [],
      pageErrors: [],
      requests: [],
      responses: [],
      websockets: [],
      webSocketTraces: [],
    },
    freshContext: {
      console: [],
      pageErrors: [],
      requests: [],
      responses: [],
      websockets: [],
      webSocketTraces: [],
    },
    checks: {},
  };

  const browser = await chromium.launch({ headless: true });
  let context = null;
  let freshContext = null;

  try {
    context = await prepareContext(browser, token);
    const page = await context.newPage();
    attachDiagnostics(page, diagnostics.sameContext);

    await page.goto(workUrl, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'Workspace Doc' }).waitFor({ state: 'visible', timeout: 30_000 });
    await page.getByLabel('Project note editor').click();
    await page.keyboard.type(diagnosticLabel, { delay: 12 });

    diagnostics.checks.domAfterType = await readEditorText(page);
    diagnostics.checks.snapshotBeforeWait = await getSnapshot(token, docId);

    const snapshotWait = await waitForSnapshotContains(token, docId, diagnosticLabel);
    diagnostics.checks.snapshotAfterWait = snapshotWait.snapshot;
    diagnostics.checks.snapshotMatchedAfterWait = snapshotWait.matched;

    await page.goto(overviewUrl, { waitUntil: 'domcontentloaded' });
    await page.goto(workUrl, { waitUntil: 'domcontentloaded' });
    diagnostics.checks.domAfterOverviewRoundTrip = await readEditorText(page);
    diagnostics.checks.domHasMarkerAfterOverviewRoundTrip = diagnostics.checks.domAfterOverviewRoundTrip.includes(diagnosticLabel);

    await page.reload({ waitUntil: 'domcontentloaded' });
    diagnostics.checks.domAfterReload = await readEditorText(page);
    diagnostics.checks.domHasMarkerAfterReload = diagnostics.checks.domAfterReload.includes(diagnosticLabel);
    diagnostics.sameContext.webSocketTraces = await collectPageWebSocketTraces(page);

    freshContext = await prepareContext(browser, token);
    const freshPage = await freshContext.newPage();
    attachDiagnostics(freshPage, diagnostics.freshContext);
    await freshPage.goto(workUrl, { waitUntil: 'domcontentloaded' });
    diagnostics.checks.domFreshContext = await readEditorText(freshPage);
    diagnostics.checks.domHasMarkerFreshContext = diagnostics.checks.domFreshContext.includes(diagnosticLabel);
    diagnostics.freshContext.webSocketTraces = await collectPageWebSocketTraces(freshPage);
    await freshPage.screenshot({ path: screenshotPath, fullPage: true });

    diagnostics.checks.finalSnapshot = await getSnapshot(token, docId);
    diagnostics.checks.finalSnapshotPlainText = normalizeText(diagnostics.checks.finalSnapshot?.snapshot_payload?.plain_text || '');
    diagnostics.checks.finalSnapshotHasMarker = diagnostics.checks.finalSnapshotPlainText.includes(diagnosticLabel);
    diagnostics.checks.putRequestsWithMarker = diagnostics.sameContext.requests.filter(
      (entry) => entry.method === 'PUT' && entry.url.includes(`/api/hub/docs/${encodeURIComponent(docId)}`) && entry.postData.includes(diagnosticLabel),
    ).length;
    diagnostics.checks.putResponses = diagnostics.sameContext.responses.filter(
      (entry) => entry.url.includes(`/api/hub/docs/${encodeURIComponent(docId)}`) && entry.status >= 200 && entry.status < 300,
    ).length;
  } finally {
    await freshContext?.close().catch(() => {});
    await context?.close().catch(() => {});
    await browser.close().catch(() => {});
    await deleteProject(token, project.project_id).catch((error) => {
      diagnostics.cleanupError = error instanceof Error ? error.message : String(error);
    });
  }

  const summary = [];
  summary.push('# Workspace Doc Persistence Diagnostic');
  summary.push('');
  summary.push(`- Started: ${timestamp}`);
  summary.push(`- Base URL: ${baseUrl}`);
  summary.push(`- Project: ${projectId}`);
  summary.push(`- Temporary project: ${project.project_id}`);
  summary.push(`- Doc: ${docId}`);
  summary.push(`- Marker: ${diagnosticLabel}`);
  summary.push(`- Snapshot contained marker after wait: ${diagnostics.checks.snapshotMatchedAfterWait ? 'yes' : 'no'}`);
  summary.push(`- PUT requests with marker: ${diagnostics.checks.putRequestsWithMarker}`);
  summary.push(`- DOM contained marker after overview round trip: ${diagnostics.checks.domHasMarkerAfterOverviewRoundTrip ? 'yes' : 'no'}`);
  summary.push(`- DOM contained marker after reload: ${diagnostics.checks.domHasMarkerAfterReload ? 'yes' : 'no'}`);
  summary.push(`- DOM contained marker in fresh context: ${diagnostics.checks.domHasMarkerFreshContext ? 'yes' : 'no'}`);
  summary.push(`- Final REST snapshot contained marker: ${diagnostics.checks.finalSnapshotHasMarker ? 'yes' : 'no'}`);
  if (diagnostics.cleanupError) {
    summary.push(`- Cleanup error: ${diagnostics.cleanupError}`);
  }
  summary.push('');
  summary.push('## Observed DOM');
  summary.push('');
  summary.push(`- After type: ${truncate(diagnostics.checks.domAfterType || '', 300)}`);
  summary.push(`- After overview round trip: ${truncate(diagnostics.checks.domAfterOverviewRoundTrip || '', 300)}`);
  summary.push(`- After reload: ${truncate(diagnostics.checks.domAfterReload || '', 300)}`);
  summary.push(`- Fresh context: ${truncate(diagnostics.checks.domFreshContext || '', 300)}`);
  summary.push('');
  summary.push('## Network Highlights');
  summary.push('');
  summary.push(formatList(diagnostics.sameContext.requests.map((entry) => `${entry.method} ${entry.url} ${entry.postData ? `body=${entry.postData}` : ''}`)));
  summary.push('');
  summary.push('## Response Highlights');
  summary.push('');
  summary.push(formatList(diagnostics.sameContext.responses.map((entry) => `${entry.status} ${entry.url} body=${entry.body}`)));
  summary.push('');
  summary.push('## Console');
  summary.push('');
  summary.push(formatList(diagnostics.sameContext.console.map((entry) => `${entry.type}: ${entry.text}`)));
  summary.push('');
  summary.push('## WebSocket Trace');
  summary.push('');
  summary.push(formatList(
    diagnostics.sameContext.webSocketTraces.map((entry) => {
      const closeCalls = (entry.closeCalls || []).length;
      const topCreateFrame = entry.createdStack?.[0] || 'unknown';
      const topCloseFrame = entry.closeCalls?.[0]?.stack?.[0] || 'none';
      return `${entry.url} create=${topCreateFrame} close=${topCloseFrame} closeCalls=${closeCalls}`;
    }),
  ));
  summary.push('');
  summary.push('## Page Errors');
  summary.push('');
  summary.push(formatList(diagnostics.sameContext.pageErrors.map((entry) => `${entry.message} ${truncate(entry.stack, 300)}`)));

  writeFileSync(reportPath, `${summary.join('\n')}\n`);
  writeFileSync(jsonPath, `${JSON.stringify(diagnostics, null, 2)}\n`);

  console.log(`Diagnostic report written to ${reportPath}`);
  console.log(`Raw diagnostics written to ${jsonPath}`);
  console.log(`Screenshot written to ${screenshotPath}`);
};

void main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
