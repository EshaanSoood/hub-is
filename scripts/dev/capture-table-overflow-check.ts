import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { chromium } from 'playwright';
import { loadEnvFilesIntoProcess, resolveRepoPath } from './lib/env.mjs';

const execFileAsync = promisify(execFile);
const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const slugFromDate = (date: Date): string => date.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);

const readRequiredEnv = (name: string, fallback = ''): string => {
  const value = String(process.env[name] || fallback).trim();
  if (!value) {
    throw new Error(`Missing required environment variable ${name}.`);
  }
  return value;
};

const createStressTitle = (index: number, stamp: string): string =>
  `Overflow check ${stamp} row ${String(index + 1).padStart(2, '0')} title with intentionally long content that should truncate cleanly inside the Title cell instead of rendering into the Status column`;

const buildStorageStateForToken = (baseUrl: string, accessToken: string) => ({
  cookies: [],
  origins: [
    {
      origin: new URL(baseUrl).origin,
      localStorage: [
        {
          name: 'hub:e2e:access-token',
          value: accessToken,
        },
      ],
    },
  ],
});

class HubRequestError extends Error {
  readonly requestPath: string;

  readonly status: number;

  constructor(requestPath: string, status: number, detail?: string) {
    super(`Request failed for ${requestPath} (${status})${detail ? `: ${detail}` : ''}.`);
    this.name = 'HubRequestError';
    this.requestPath = requestPath;
    this.status = status;
  }
}

const hubRequest = async <T>(
  baseUrl: string,
  accessToken: string,
  requestPath: string,
  init: RequestInit = {},
): Promise<T> => {
  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bearer ${accessToken}`);
  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(new URL(requestPath, baseUrl).toString(), {
    ...init,
    headers,
  });
  const responseText = await response.text();
  let payload = null as
    | { ok?: boolean; data?: T | null; error?: { message?: string } | null }
    | T
    | null;
  try {
    payload = responseText
      ? (JSON.parse(responseText) as
          | { ok?: boolean; data?: T | null; error?: { message?: string } | null }
          | T
          | null)
      : null;
  } catch {
    payload = null;
  }

  if (!response.ok || payload === null) {
    const detail = payload && typeof payload === 'object' && 'error' in payload
      ? payload.error?.message || responseText
      : responseText;
    throw new HubRequestError(requestPath, response.status, detail);
  }

  if (typeof payload === 'object' && payload !== null && 'ok' in payload) {
    if (!payload.ok || payload.data === null || payload.data === undefined) {
      const detail = payload.error?.message || responseText;
      throw new HubRequestError(requestPath, response.status, detail);
    }
    return payload.data as T;
  }

  return payload as T;
};

const loadSessionSummary = async (
  baseUrl: string,
  accessToken: string,
): Promise<{ userId: string }> => {
  const data = await hubRequest<{ sessionSummary?: { userId?: string } }>(baseUrl, accessToken, '/api/hub/me', {
    method: 'GET',
  });
  const userId = String(data.sessionSummary?.userId || '').trim();
  if (!userId) {
    throw new Error('Unexpected /api/hub/me response shape.');
  }
  return { userId };
};

const createProject = async (
  baseUrl: string,
  accessToken: string,
  name: string,
): Promise<{ project_id: string }> =>
  hubRequest<{ project: { project_id: string } }>(baseUrl, accessToken, '/api/hub/projects', {
    method: 'POST',
    body: JSON.stringify({ name }),
  }).then((data) => data.project);

const createPane = async (
  baseUrl: string,
  accessToken: string,
  projectId: string,
  payload: Record<string, unknown>,
): Promise<{ pane_id: string }> =>
  hubRequest<{ pane: { pane_id: string } }>(
    baseUrl,
    accessToken,
    `/api/hub/projects/${encodeURIComponent(projectId)}/panes`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  ).then((data) => data.pane);

const createCollection = async (
  baseUrl: string,
  accessToken: string,
  projectId: string,
  name: string,
): Promise<{ collection_id: string }> =>
  hubRequest<{ collection_id: string }>(baseUrl, accessToken, `/api/hub/projects/${encodeURIComponent(projectId)}/collections`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });

const createField = async (
  baseUrl: string,
  accessToken: string,
  collectionId: string,
  payload: Record<string, unknown>,
): Promise<{ field_id: string }> =>
  hubRequest<{ field_id: string }>(baseUrl, accessToken, `/api/hub/collections/${encodeURIComponent(collectionId)}/fields`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

const createView = async (
  baseUrl: string,
  accessToken: string,
  projectId: string,
  payload: Record<string, unknown>,
): Promise<{ view_id: string }> =>
  hubRequest<{ view_id: string }>(baseUrl, accessToken, `/api/hub/projects/${encodeURIComponent(projectId)}/views`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

const createRecord = async (
  baseUrl: string,
  accessToken: string,
  projectId: string,
  payload: Record<string, unknown>,
): Promise<{ record_id: string }> =>
  hubRequest<{ record_id: string }>(baseUrl, accessToken, `/api/hub/projects/${encodeURIComponent(projectId)}/records`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

const resolveOwnerToken = async (apiBaseUrl: string): Promise<string> => {
  let ownerToken = String(process.env.LOCAL_OWNER_ACCESS_TOKEN || '').trim();
  if (ownerToken) {
    try {
      await loadSessionSummary(apiBaseUrl, ownerToken);
      return ownerToken;
    } catch (error) {
      if (
        !(error instanceof HubRequestError)
        || error.requestPath !== '/api/hub/me'
        || ![401, 403].includes(error.status)
      ) {
        throw error;
      }
    }
  }

  await execFileAsync('node', ['scripts/dev/mint-local-tokens.mjs'], {
    cwd: resolveRepoPath(),
    env: process.env,
  });
  await loadEnvFilesIntoProcess(['.env.local.tokens.local'], { override: true });

  ownerToken = readRequiredEnv('LOCAL_OWNER_ACCESS_TOKEN');
  await loadSessionSummary(apiBaseUrl, ownerToken);
  return ownerToken;
};

const main = async (): Promise<void> => {
  await loadEnvFilesIntoProcess(
    ['.env.hub-api.local', '.env.local.users.local', '.env.local.tokens.local'],
    { override: true },
  );

  const appBaseUrl = readRequiredEnv('HUB_PUBLIC_APP_URL', 'http://127.0.0.1:5173').replace(/\/+$/, '');
  const apiBaseUrl = readRequiredEnv('HUB_API_BASE_URL', 'http://127.0.0.1:3001').replace(/\/+$/, '');
  const ownerToken = await resolveOwnerToken(apiBaseUrl);
  const screenshotDir = resolveRepoPath('artifacts', 'table-overflow-check');
  const stamp = slugFromDate(new Date());
  const summaryPath = path.join(screenshotDir, `table-overflow-${stamp}.json`);
  const screenshotPath = path.join(screenshotDir, `table-overflow-${stamp}.png`);

  await mkdir(screenshotDir, { recursive: true });

  const session = await loadSessionSummary(apiBaseUrl, ownerToken);
  const project = await createProject(apiBaseUrl, ownerToken, `Local Table Overflow ${stamp}`);
  const collection = await createCollection(apiBaseUrl, ownerToken, project.project_id, `Overflow Dataset ${stamp}`);
  const statusField = await createField(apiBaseUrl, ownerToken, collection.collection_id, {
    name: 'Status',
    type: 'select',
    sort_order: 1,
    config: { options: ['todo', 'in-progress', 'done'] },
  });
  const notesField = await createField(apiBaseUrl, ownerToken, collection.collection_id, {
    name: 'Notes',
    type: 'text',
    sort_order: 2,
    config: {},
  });
  const tableView = await createView(apiBaseUrl, ownerToken, project.project_id, {
    collection_id: collection.collection_id,
    type: 'table',
    name: `Overflow Table ${stamp}`,
    config: { visible_field_ids: [statusField.field_id, notesField.field_id] },
  });
  const pane = await createPane(apiBaseUrl, ownerToken, project.project_id, {
    name: `Overflow Pane ${stamp}`,
    member_user_ids: [session.userId],
    layout_config: {
      modules_enabled: true,
      workspace_enabled: false,
      modules: [
        {
          module_instance_id: `table-overflow-${stamp}`,
          module_type: 'table',
          size_tier: 'M',
          lens: 'project',
          binding: { view_id: tableView.view_id },
        },
      ],
    },
  });

  const targetTitle = createStressTitle(0, stamp);
  const statuses = ['todo', 'in-progress', 'done'] as const;

  for (let index = 0; index < 18; index += 1) {
    const title = index === 0 ? targetTitle : createStressTitle(index, stamp);
    await createRecord(apiBaseUrl, ownerToken, project.project_id, {
      collection_id: collection.collection_id,
      title,
      source_pane_id: pane.pane_id,
      values: {
        [statusField.field_id]: statuses[index % statuses.length],
        [notesField.field_id]: `Overflow notes row ${index + 1}`,
      },
    });
  }

  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({
      storageState: buildStorageStateForToken(appBaseUrl, ownerToken),
      viewport: { width: 1440, height: 960 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();

    await page.goto(`${appBaseUrl}/projects/${project.project_id}/work/${pane.pane_id}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });

    const tableModule = page.getByRole('region', { name: 'Table module' }).first();
    await tableModule.waitFor({ state: 'visible', timeout: 60_000 });

    const titleButton = tableModule
      .getByRole('button', { name: new RegExp(`^Open record ${escapeRegExp(targetTitle)}$`, 'i') })
      .first();

    await titleButton.waitFor({ state: 'visible', timeout: 60_000 });
    await wait(1000);

    const metrics = await titleButton.evaluate((node) => {
      const cell = node.closest('[role="gridcell"]');
      if (!(node instanceof HTMLElement) || !(cell instanceof HTMLElement)) {
        return null;
      }

      const nodeStyle = window.getComputedStyle(node);
      const cellStyle = window.getComputedStyle(cell);
      const nodeRect = node.getBoundingClientRect();
      const cellRect = cell.getBoundingClientRect();

      return {
        textOverflow: nodeStyle.textOverflow,
        overflowX: nodeStyle.overflowX,
        whiteSpace: nodeStyle.whiteSpace,
        cellOverflowX: cellStyle.overflowX,
        clientWidth: node.clientWidth,
        scrollWidth: node.scrollWidth,
        nodeRight: nodeRect.right,
        cellRight: cellRect.right,
      };
    });

    if (!metrics) {
      throw new Error('Unable to collect Title cell metrics.');
    }

    if (metrics.textOverflow !== 'ellipsis') {
      throw new Error(`Expected text-overflow=ellipsis. Received ${metrics.textOverflow}.`);
    }
    if (metrics.overflowX !== 'hidden') {
      throw new Error(`Expected overflow-x=hidden on title button. Received ${metrics.overflowX}.`);
    }
    if (metrics.whiteSpace !== 'nowrap') {
      throw new Error(`Expected white-space=nowrap on title button. Received ${metrics.whiteSpace}.`);
    }
    if (metrics.cellOverflowX !== 'hidden') {
      throw new Error(`Expected overflow-x=hidden on grid cell. Received ${metrics.cellOverflowX}.`);
    }
    if (metrics.scrollWidth <= metrics.clientWidth) {
      throw new Error('Expected the long title to overflow internally so truncation is meaningful.');
    }
    if (metrics.nodeRight > metrics.cellRight + 1) {
      throw new Error(`Title content exceeded its cell bounds by ${String(metrics.nodeRight - metrics.cellRight)}px.`);
    }

    await tableModule.screenshot({ path: screenshotPath });

    const summary = {
      appBaseUrl,
      apiBaseUrl,
      projectId: project.project_id,
      paneId: pane.pane_id,
      viewId: tableView.view_id,
      screenshotPath: path.relative(resolveRepoPath(), screenshotPath),
      metrics,
      targetTitle,
    };

    await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);

    await context.close();
  } finally {
    await browser.close();
  }
};

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
