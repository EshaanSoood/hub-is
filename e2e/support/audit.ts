import { mkdir, readFile, writeFile } from 'node:fs/promises';
import type { Browser, BrowserContextOptions, Page, TestInfo } from '@playwright/test';
import { expect } from '@playwright/test';
import { buildStorageStateForToken } from '../utils/auth.ts';
import { AUDIT_FIXTURE_PATH, OWNER_STORAGE_STATE_PATH, PLAYWRIGHT_STATE_DIR, VIEWER_STORAGE_STATE_PATH } from './paths.ts';

export interface AuditSessionSummary {
  userId: string;
  name: string;
  email: string;
  role: string;
  globalCapabilities: string[];
  projectCapabilities: Record<string, string[]>;
  projectMemberships: Array<{ projectId: string; membershipRole: string }>;
}

export interface AuditFixture {
  baseUrl: string;
  apiBaseUrl: string;
  owner: {
    email: string;
    token: string;
    session: AuditSessionSummary;
    personalProjectId: string | null;
  };
  viewer: {
    email: string;
    token: string;
    session: AuditSessionSummary;
  };
  project: {
    id: string;
    name: string;
  };
  auxProject: {
    id: string;
    name: string;
  };
  collection: {
    id: string;
    auxId: string;
  };
  fields: {
    statusId: string;
    notesId: string;
  };
  views: {
    tableId: string;
    kanbanId: string;
  };
  panes: {
    sharedId: string;
    sharedDocId: string;
    privateId: string;
  };
  tasks: {
    todoTitle: string;
    inProgressTitle: string;
    doneTitle: string;
    auxTitle: string;
  };
  event: {
    title: string;
  };
}

interface HubEnvelope<T> {
  ok: boolean;
  data: T | null;
  error?: {
    code?: string;
    message?: string;
  } | null;
}

interface AuditedPageHandle {
  context: ReturnType<Browser['newContext']> extends Promise<infer T> ? T : never;
  page: Page;
  audit: PageAudit;
}

interface PageAuditSummary {
  consoleErrors: string[];
  pageErrors: string[];
  failedResponses: Array<{ status: number; method: string; url: string }>;
  websocketUrls: string[];
}

export interface PageAudit extends PageAuditSummary {
  flush: () => Promise<void>;
}

const pageAudits = new WeakMap<Page, PageAudit>();

const normalizeUrl = (value: string): string => value.trim().replace(/\/+$/, '');

export const resolveAppBaseUrl = (): string =>
  normalizeUrl(
    process.env.E2E_BASE_URL
    || process.env.PLAYWRIGHT_BASE_URL
    || process.env.BASE_URL
    || process.env.HUB_BASE_URL
    || 'https://eshaansood.org',
  );

export const resolveApiBaseUrl = (): string =>
  normalizeUrl(
    process.env.HUB_API_BASE_URL
    || process.env.E2E_BASE_URL
    || process.env.PLAYWRIGHT_BASE_URL
    || process.env.HUB_BASE_URL
    || process.env.BASE_URL
    || 'https://eshaansood.org',
  );

const parseJson = <T>(raw: string): T | null => {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

export const hubRequest = async <T>(
  baseUrl: string,
  accessToken: string,
  path: string,
  init: RequestInit = {},
): Promise<T> => {
  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bearer ${accessToken}`);
  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(new URL(path, baseUrl).toString(), {
    ...init,
    headers,
  });
  const raw = await response.text();
  const contentType = String(response.headers.get('content-type') || '').toLowerCase();
  if (contentType.includes('text/html') || raw.trim().startsWith('<!doctype html')) {
    throw new Error(
      `Expected Hub JSON from ${new URL(path, baseUrl).toString()}, but received HTML instead. Check HUB_API_BASE_URL or the deployed /api routing for this environment.`,
    );
  }
  const parsed = parseJson<HubEnvelope<T> | T>(raw);
  const envelope =
    parsed && typeof parsed === 'object' && 'ok' in parsed ? (parsed as HubEnvelope<T>) : null;

  if (envelope) {
    if (!response.ok || !envelope.ok || envelope.data === null) {
      throw new Error(envelope.error?.message || `Request failed for ${path} (${response.status}).`);
    }
    return envelope.data;
  }

  if (!response.ok || parsed === null) {
    throw new Error(`Request failed for ${path} (${response.status}).`);
  }
  return parsed as T;
};

export const loadSessionSummary = async (baseUrl: string, accessToken: string): Promise<AuditSessionSummary> => {
  const data = await hubRequest<
    | { sessionSummary: AuditSessionSummary }
    | { user?: { user_id?: string }; memberships?: unknown[]; sessionSummary?: AuditSessionSummary }
  >(baseUrl, accessToken, '/api/hub/me', {
    method: 'GET',
  });
  if ('sessionSummary' in data && data.sessionSummary) {
    return data.sessionSummary;
  }
  throw new Error('Unexpected /api/hub/me response shape.');
};

export const getHubHome = async (
  baseUrl: string,
  accessToken: string,
): Promise<{
  personal_project_id: string | null;
  tasks: Array<{ record_id: string; title: string }>;
  events: Array<{ record_id: string; title: string }>;
}> => {
  const data = await hubRequest<{
    home: {
      personal_project_id: string | null;
      tasks: Array<{ record_id: string; title: string }>;
      events: Array<{ record_id: string; title: string }>;
    };
  }>(baseUrl, accessToken, '/api/hub/home?tasks_limit=20&events_limit=20', { method: 'GET' });
  return data.home;
};

export const listProjects = async (
  baseUrl: string,
  accessToken: string,
): Promise<Array<{ project_id: string; name: string; membership_role: string | null }>> => {
  const data = await hubRequest<{ projects: Array<{ project_id: string; name: string; membership_role: string | null }> }>(
    baseUrl,
    accessToken,
    '/api/hub/projects',
    { method: 'GET' },
  );
  return data.projects;
};

export const createProject = async (
  baseUrl: string,
  accessToken: string,
  name: string,
): Promise<{ project_id: string; name: string }> => {
  const data = await hubRequest<{ project: { project_id: string; name: string } }>(baseUrl, accessToken, '/api/hub/projects', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
  return data.project;
};

export const addProjectMember = async (
  baseUrl: string,
  accessToken: string,
  projectId: string,
  payload: { user_id?: string; email?: string; display_name?: string; role: string },
): Promise<void> => {
  await hubRequest(baseUrl, accessToken, `/api/hub/projects/${encodeURIComponent(projectId)}/members`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const listProjectMembers = async (
  baseUrl: string,
  accessToken: string,
  projectId: string,
): Promise<Array<{ user_id: string; role: string; email: string | null }>> => {
  const data = await hubRequest<{ members: Array<{ user_id: string; role: string; email: string | null }> }>(
    baseUrl,
    accessToken,
    `/api/hub/projects/${encodeURIComponent(projectId)}/members`,
    { method: 'GET' },
  );
  return data.members;
};

export const waitForProjectMember = async (
  baseUrl: string,
  accessToken: string,
  projectId: string,
  userId: string,
  timeoutMs = 15_000,
): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const members = await listProjectMembers(baseUrl, accessToken, projectId);
    if (members.some((member) => member.user_id === userId)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for user ${userId} to join project ${projectId}.`);
};

export const createPane = async (
  baseUrl: string,
  accessToken: string,
  projectId: string,
  payload: { name: string; member_user_ids: string[]; layout_config: Record<string, unknown> },
): Promise<{ pane_id: string; doc_id: string | null }> => {
  const data = await hubRequest<{ pane: { pane_id: string; doc_id: string | null } }>(
    baseUrl,
    accessToken,
    `/api/hub/projects/${encodeURIComponent(projectId)}/panes`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
  return data.pane;
};

export const createCollection = async (
  baseUrl: string,
  accessToken: string,
  projectId: string,
  name: string,
): Promise<{ collection_id: string }> => {
  return hubRequest(baseUrl, accessToken, `/api/hub/projects/${encodeURIComponent(projectId)}/collections`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
};

export const createField = async (
  baseUrl: string,
  accessToken: string,
  collectionId: string,
  payload: Record<string, unknown>,
): Promise<{ field_id: string }> => {
  return hubRequest(baseUrl, accessToken, `/api/hub/collections/${encodeURIComponent(collectionId)}/fields`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const createView = async (
  baseUrl: string,
  accessToken: string,
  projectId: string,
  payload: Record<string, unknown>,
): Promise<{ view_id: string }> => {
  return hubRequest(baseUrl, accessToken, `/api/hub/projects/${encodeURIComponent(projectId)}/views`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const createRecord = async (
  baseUrl: string,
  accessToken: string,
  projectId: string,
  payload: Record<string, unknown>,
): Promise<{ record_id: string }> => {
  return hubRequest(baseUrl, accessToken, `/api/hub/projects/${encodeURIComponent(projectId)}/records`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const createEventFromNlp = async (
  baseUrl: string,
  accessToken: string,
  projectId: string,
  payload: {
    pane_id?: string;
    source_pane_id?: string;
    title?: string;
    start_dt?: string;
    end_dt?: string;
    timezone?: string;
    location?: string;
    participants_user_ids?: string[];
  },
): Promise<{ record: { record_id: string; title: string } }> => {
  return hubRequest(baseUrl, accessToken, `/api/hub/projects/${encodeURIComponent(projectId)}/events/from-nlp`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const ensureAuditStateDir = async (): Promise<void> => {
  await mkdir(PLAYWRIGHT_STATE_DIR, { recursive: true });
};

export const writeAuthStateFiles = async (baseUrl: string, ownerToken: string, viewerToken: string): Promise<void> => {
  await ensureAuditStateDir();
  await writeFile(OWNER_STORAGE_STATE_PATH, JSON.stringify(buildStorageStateForToken(baseUrl, ownerToken), null, 2), 'utf8');
  await writeFile(VIEWER_STORAGE_STATE_PATH, JSON.stringify(buildStorageStateForToken(baseUrl, viewerToken), null, 2), 'utf8');
};

export const writeAuditFixture = async (fixture: AuditFixture): Promise<void> => {
  await ensureAuditStateDir();
  await writeFile(AUDIT_FIXTURE_PATH, JSON.stringify(fixture, null, 2), 'utf8');
};

export const loadAuditFixture = async (): Promise<AuditFixture> => {
  const raw = await readFile(AUDIT_FIXTURE_PATH, 'utf8');
  return JSON.parse(raw) as AuditFixture;
};

export const registerPageAudit = (page: Page, testInfo: TestInfo, label: string): PageAudit => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failedResponses: Array<{ status: number; method: string; url: string }> = [];
  const websocketUrls = new Set<string>();

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });
  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });
  page.on('response', (response) => {
    if (response.status() >= 400) {
      failedResponses.push({
        status: response.status(),
        method: response.request().method(),
        url: response.url(),
      });
    }
  });
  page.on('websocket', (socket) => {
    websocketUrls.add(socket.url());
  });

  const audit: PageAudit = {
    consoleErrors,
    pageErrors,
    failedResponses,
    websocketUrls: [],
    flush: async () => {
      const summary: PageAuditSummary = {
        consoleErrors,
        pageErrors,
        failedResponses,
        websocketUrls: Array.from(websocketUrls),
      };
      audit.websocketUrls = summary.websocketUrls;
      await testInfo.attach(`console-errors-${label}`, {
        body: Buffer.from(JSON.stringify(summary, null, 2), 'utf8'),
        contentType: 'application/json',
      });
    },
  };

  pageAudits.set(page, audit);
  return audit;
};

export const flushPageAudit = async (page: Page): Promise<void> => {
  const audit = pageAudits.get(page);
  if (audit) {
    await audit.flush();
  }
};

export const openAuditedPage = async (
  browser: Browser,
  testInfo: TestInfo,
  label: string,
  options: BrowserContextOptions,
): Promise<AuditedPageHandle> => {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  const audit = registerPageAudit(page, testInfo, label);
  return { context, page, audit };
};

export const gotoReady = async (page: Page, path: string): Promise<void> => {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => {
      const body = document.body;
      return Boolean(body) && !body.innerText.includes('Initializing secure session...');
    },
    null,
    { timeout: 30_000 },
  );
};

export const waitForHubHome = async (page: Page): Promise<void> => {
  await expect(page.getByRole('navigation', { name: 'Home tabs' })).toBeVisible({ timeout: 30_000 });
};

const isAuthPage = async (page: Page): Promise<boolean> => {
  const hostname = (() => {
    try {
      return new URL(page.url()).hostname;
    } catch {
      return '';
    }
  })();

  if (/auth\.eshaansood\.org$/i.test(hostname)) {
    return true;
  }

  return page.getByRole('heading', { name: /Sign in to your account/i }).first().isVisible().catch(() => false);
};

const submitKeycloakCredentials = async (
  page: Page,
  account: { email: string; password: string },
): Promise<boolean> => {
  const usernameInput = page.locator('input[name="username"], input#username').first();
  if (!(await usernameInput.isVisible({ timeout: 30_000 }).catch(() => false))) {
    return false;
  }

  await usernameInput.fill(account.email);
  const passwordInput = page.locator('input[name="password"], input#password').first();
  await passwordInput.fill(account.password);
  const submitButton = page.locator('input#kc-login, button#kc-login, button[type="submit"], input[type="submit"]').first();

  await Promise.all([
    page.waitForURL((url) => !/auth\.eshaansood\.org$/i.test(url.hostname), { timeout: 60_000 }).catch(() => undefined),
    submitButton.click(),
  ]);

  return true;
};

export const loginThroughKeycloak = async (
  page: Page,
  account: { email: string; password: string },
): Promise<void> => {
  await gotoReady(page, '/projects');
  const loginButton = page.getByRole('button', { name: /Continue with Keycloak/i });
  if (await loginButton.isVisible().catch(() => false)) {
    await loginButton.click();
  }

  if (await submitKeycloakCredentials(page, account)) {
    await gotoReady(page, '/projects');
  }

  if (await isAuthPage(page)) {
    if (!(await submitKeycloakCredentials(page, account))) {
      throw new Error(`Keycloak sign-in page remained active and credentials could not be submitted. Current URL: ${page.url()}`);
    }
  }

  await gotoReady(page, '/projects');
  await waitForHubHome(page);
};

export const annotateKnownGap = (testInfo: TestInfo, description: string): void => {
  testInfo.annotations.push({
    type: 'known-gap',
    description,
  });
};
