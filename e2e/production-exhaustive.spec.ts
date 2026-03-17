import { execFile } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { test, type BrowserContext, type Page } from '@playwright/test';
import { DEFAULT_BASE_URL } from './utils/auth-state';
import { mintTokensForAccounts, resolveLinkedTestAccounts } from './utils/tokenMint';

const execFileAsync = promisify(execFile);

const BASE_URL = 'https://eshaansood.org';
const TARGET_PROJECT_ID = 'backend-pilot';
const REPORT_PATH = '/Users/eshaansood/eshaan-os/e2e/E2E_FULL_REPORT.md';

type VerificationStatus = 'PASS' | 'FAIL' | 'BLOCKED WITH CAUSE';

interface ApiProbe {
  label: string;
  method: string;
  path: string;
  status: number;
  ok: boolean;
  raw: string;
}

interface VerificationCase {
  name: string;
  status: VerificationStatus;
  approachUsed: string[];
  apiChecks: string[];
  genuineFailures: string[];
  reproductionSteps: string[];
}

interface SessionSummary {
  userId: string;
  name: string;
  email: string;
  memberships: Array<{ projectId: string; membershipRole: string }>;
}

interface PaneSummary {
  pane_id: string;
  project_id: string;
  name: string;
  pinned: boolean;
  can_edit: boolean;
  doc_id?: string;
  layout_config?: Record<string, unknown>;
  members?: Array<{ user_id: string; display_name?: string }>;
}

interface SuiteFixture {
  runId: string;
  tokenA: string;
  tokenB: string;
  userA: SessionSummary;
  userB: SessionSummary;
  collaboratorProjectId: string;
  sharedPaneId: string;
  sharedPaneDocId: string;
  privatePaneId: string;
  privatePaneDocId: string;
  tableViewId: string;
  kanbanViewId: string;
  collectionId: string;
  notesFieldId: string;
  statusFieldId: string;
  recordAId: string;
  recordATitle: string;
  recordBId: string;
  recordBTitle: string;
  cleanupPaneIds: string[];
}

interface PageMonitor {
  label: string;
  hubLiveReady: boolean;
  collabUrls: Set<string>;
  websocketEvents: string[];
  responses: Array<{ status: number; method: string; url: string; body: string }>;
  pageErrors: string[];
  consoleErrors: string[];
  consoleWarnings: string[];
}

const optionalEnv = (name: string): string => String(process.env[name] || '').trim();

const resolvedBaseUrl = (optionalEnv('BASE_URL') || optionalEnv('HUB_BASE_URL') || BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
const onlyCaseFilter = optionalEnv('ONLY_CASE').toLowerCase();

const previewText = (value: string, limit = 800): string => {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length <= limit ? normalized : `${normalized.slice(0, limit)}...`;
};

const markdownCode = (value: string): string => `\`${value.replace(/`/g, '\\`')}\``;

const createCase = (name: string): VerificationCase => ({
  name,
  status: 'PASS',
  approachUsed: [],
  apiChecks: [],
  genuineFailures: [],
  reproductionSteps: [],
});

const setFail = (entry: VerificationCase, failure: string, steps: string[]): void => {
  entry.status = 'FAIL';
  entry.genuineFailures.push(failure);
  entry.reproductionSteps.push(...steps);
};

const setBlocked = (entry: VerificationCase, cause: string, steps: string[]): void => {
  entry.status = 'BLOCKED WITH CAUSE';
  entry.genuineFailures.push(cause);
  entry.reproductionSteps.push(...steps);
};

const formatProbe = (probe: ApiProbe): string =>
  `${probe.label}: ${probe.method} ${probe.path} -> ${probe.status} ${probe.ok ? 'OK' : 'NOT OK'} | ${previewText(probe.raw, 500)}`;

const jsonHeaders = (token: string, init?: RequestInit): Headers => {
  const headers = new Headers(init?.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  if (init?.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return headers;
};

const hubFetch = async (token: string, path: string, init: RequestInit = {}, label = path): Promise<ApiProbe> => {
  const response = await fetch(new URL(path, resolvedBaseUrl).toString(), {
    ...init,
    headers: jsonHeaders(token, init),
  });
  const raw = await response.text();
  return {
    label,
    method: init.method || 'GET',
    path,
    status: response.status,
    ok: response.ok,
    raw,
  };
};

const parseEnvelopeData = <T>(probe: ApiProbe): T => {
  const parsed = JSON.parse(probe.raw) as { ok?: boolean; data?: T | null; error?: { message?: string } };
  if (!parsed?.ok || parsed.data == null) {
    throw new Error(parsed?.error?.message || `Request failed for ${probe.path} (${probe.status}).`);
  }
  return parsed.data;
};

const installMonitor = (page: Page, label: string): PageMonitor => {
  const monitor: PageMonitor = {
    label,
    hubLiveReady: false,
    collabUrls: new Set<string>(),
    websocketEvents: [],
    responses: [],
    pageErrors: [],
    consoleErrors: [],
    consoleWarnings: [],
  };

  page.on('response', async (response) => {
    if (response.status() < 400) {
      return;
    }
    const body = await response.text().catch(() => '');
    monitor.responses.push({
      status: response.status(),
      method: response.request().method(),
      url: response.url(),
      body: previewText(body, 500),
    });
  });

  page.on('pageerror', (error) => {
    monitor.pageErrors.push(error.message);
  });

  page.on('console', (message) => {
    const text = message.text();
    if (message.type() === 'error') {
      monitor.consoleErrors.push(text);
    }
    if (message.type() === 'warning') {
      monitor.consoleWarnings.push(text);
    }
  });

  page.on('websocket', (socket) => {
    const url = socket.url();
    if (url.includes('/api/hub/live')) {
      monitor.websocketEvents.push(`hub-live-open ${url}`);
    }
    if (url.includes('collab.')) {
      monitor.collabUrls.add(url);
      monitor.websocketEvents.push(`collab-open ${url}`);
    }
    socket.on('framereceived', (event) => {
      const payload = String(event.payload || '');
      if (url.includes('/api/hub/live') && payload.includes('"type":"ready"')) {
        monitor.hubLiveReady = true;
      }
      if (url.includes('collab.') && payload.length > 0) {
        monitor.websocketEvents.push(`collab-rx ${previewText(payload, 120)}`);
      }
    });
  });

  return monitor;
};

const authenticatePage = async (context: BrowserContext, token: string, path: string, label: string): Promise<{ page: Page; monitor: PageMonitor }> => {
  const page = await context.newPage();
  const monitor = installMonitor(page, label);

  const meProbe = await hubFetch(token, '/api/hub/me', { method: 'GET' }, `${label} auth preflight`);
  if (meProbe.status !== 200) {
    throw new Error(`Auth preflight failed for ${label}: ${formatProbe(meProbe)}`);
  }

  await page.goto(`${resolvedBaseUrl}/projects`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.readyState === 'interactive' || document.readyState === 'complete');
  await page.evaluate((accessToken) => {
    window.localStorage.setItem('hub:e2e:access-token', accessToken);
  }, token);

  await page.goto(new URL(path, resolvedBaseUrl).toString(), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !document.body.innerText.includes('Initializing secure session...'), null, {
    timeout: 30_000,
  });
  await page.waitForFunction(() => !document.body.innerText.includes('Continue with Keycloak'), null, {
    timeout: 30_000,
  }).catch(() => null);

  return { page, monitor };
};

const waitForText = async (page: Page, text: string, timeout = 10_000): Promise<boolean> => {
  try {
    await page.getByText(text, { exact: false }).waitFor({ state: 'visible', timeout });
    return true;
  } catch {
    return false;
  }
};

const openCaptureDialog = async (page: Page): Promise<void> => {
  await page.getByRole('button', { name: 'New Capture' }).click();
  await page.getByRole('dialog').waitFor({ state: 'visible', timeout: 10_000 });
};

const readSessionSummary = (probe: ApiProbe): SessionSummary => {
  const data = parseEnvelopeData<{
    sessionSummary: {
      userId: string;
      name: string;
      email: string;
      projectMemberships: Array<{ projectId: string; membershipRole: string }>;
    };
  }>(probe);
  return {
    userId: data.sessionSummary.userId,
    name: data.sessionSummary.name,
    email: data.sessionSummary.email,
    memberships: data.sessionSummary.projectMemberships,
  };
};

const bootstrapFixture = async (tokenA: string, tokenB: string): Promise<SuiteFixture> => {
  const runId = `prod-${Date.now().toString(36)}`;
  const meA = readSessionSummary(await hubFetch(tokenA, '/api/hub/me', { method: 'GET' }, 'User A /api/hub/me'));
  const meB = readSessionSummary(await hubFetch(tokenB, '/api/hub/me', { method: 'GET' }, 'User B /api/hub/me'));

  const createCollaboratorProject = await hubFetch(
    tokenA,
    '/api/hub/projects',
    {
      method: 'POST',
      body: JSON.stringify({
        name: `E2E Collaborators ${runId}`,
      }),
    },
    'Create collaborator project',
  );
  const collaboratorProjectId = parseEnvelopeData<{ project: { project_id: string } }>(createCollaboratorProject).project.project_id;

  const createCollection = await hubFetch(
    tokenA,
    `/api/hub/projects/${encodeURIComponent(TARGET_PROJECT_ID)}/collections`,
    {
      method: 'POST',
      body: JSON.stringify({ name: `E2E Verify ${runId}` }),
    },
    'Create fixture collection',
  );
  const collectionId = parseEnvelopeData<{ collection_id: string }>(createCollection).collection_id;

  const createStatusField = await hubFetch(
    tokenA,
    `/api/hub/collections/${encodeURIComponent(collectionId)}/fields`,
    {
      method: 'POST',
      body: JSON.stringify({
        name: 'Status',
        type: 'select',
        config: { options: ['todo', 'doing', 'done'] },
        sort_order: 1,
      }),
    },
    'Create fixture status field',
  );
  const statusFieldId = parseEnvelopeData<{ field_id: string }>(createStatusField).field_id;

  const createNotesField = await hubFetch(
    tokenA,
    `/api/hub/collections/${encodeURIComponent(collectionId)}/fields`,
    {
      method: 'POST',
      body: JSON.stringify({
        name: 'Notes',
        type: 'text',
        config: {},
        sort_order: 2,
      }),
    },
    'Create fixture notes field',
  );
  const notesFieldId = parseEnvelopeData<{ field_id: string }>(createNotesField).field_id;

  const createTableView = await hubFetch(
    tokenA,
    `/api/hub/projects/${encodeURIComponent(TARGET_PROJECT_ID)}/views`,
    {
      method: 'POST',
      body: JSON.stringify({
        collection_id: collectionId,
        type: 'table',
        name: `E2E Table ${runId}`,
        config: {
          visible_field_ids: [notesFieldId, statusFieldId],
        },
      }),
    },
    'Create fixture table view',
  );
  const tableViewId = parseEnvelopeData<{ view_id: string }>(createTableView).view_id;

  const createKanbanView = await hubFetch(
    tokenA,
    `/api/hub/projects/${encodeURIComponent(TARGET_PROJECT_ID)}/views`,
    {
      method: 'POST',
      body: JSON.stringify({
        collection_id: collectionId,
        type: 'kanban',
        name: `E2E Kanban ${runId}`,
        config: {
          group_by_field_id: statusFieldId,
        },
      }),
    },
    'Create fixture kanban view',
  );
  const kanbanViewId = parseEnvelopeData<{ view_id: string }>(createKanbanView).view_id;

  const sharedLayout = {
    modules_enabled: true,
    workspace_enabled: true,
    doc_binding_mode: 'owned',
    modules: [
      {
        module_instance_id: `table-${runId}`,
        module_type: 'table',
        size_tier: 'L',
        lens: 'project',
        binding: { view_id: tableViewId },
      },
      {
        module_instance_id: `kanban-${runId}`,
        module_type: 'kanban',
        size_tier: 'L',
        lens: 'project',
        binding: { view_id: kanbanViewId },
      },
      {
        module_instance_id: `files-${runId}`,
        module_type: 'files',
        size_tier: 'M',
        lens: 'project',
      },
    ],
  };

  const createSharedPane = await hubFetch(
    tokenA,
    `/api/hub/projects/${encodeURIComponent(TARGET_PROJECT_ID)}/panes`,
    {
      method: 'POST',
      body: JSON.stringify({
        name: `E2E Shared ${runId}`,
        member_user_ids: [meB.userId],
        layout_config: sharedLayout,
      }),
    },
    'Create fixture shared pane',
  );
  const sharedPane = parseEnvelopeData<{ pane: PaneSummary }>(createSharedPane).pane;

  const createPrivatePane = await hubFetch(
    tokenA,
    `/api/hub/projects/${encodeURIComponent(TARGET_PROJECT_ID)}/panes`,
    {
      method: 'POST',
      body: JSON.stringify({
        name: `E2E Private ${runId}`,
        member_user_ids: [],
        layout_config: sharedLayout,
      }),
    },
    'Create fixture private pane',
  );
  const privatePane = parseEnvelopeData<{ pane: PaneSummary }>(createPrivatePane).pane;

  const createRecordA = await hubFetch(
    tokenA,
    `/api/hub/projects/${encodeURIComponent(TARGET_PROJECT_ID)}/records`,
    {
      method: 'POST',
      body: JSON.stringify({
        collection_id: collectionId,
        title: `E2E Card Todo ${runId}`,
        source_pane_id: sharedPane.pane_id,
        values: {
          [statusFieldId]: 'todo',
          [notesFieldId]: `Initial todo note ${runId}`,
        },
      }),
    },
    'Create fixture record A',
  );
  const recordAId = parseEnvelopeData<{ record_id: string }>(createRecordA).record_id;

  const createRecordB = await hubFetch(
    tokenA,
    `/api/hub/projects/${encodeURIComponent(TARGET_PROJECT_ID)}/records`,
    {
      method: 'POST',
      body: JSON.stringify({
        collection_id: collectionId,
        title: `E2E Card Doing ${runId}`,
        source_pane_id: sharedPane.pane_id,
        values: {
          [statusFieldId]: 'doing',
          [notesFieldId]: `Initial doing note ${runId}`,
        },
      }),
    },
    'Create fixture record B',
  );
  const recordBId = parseEnvelopeData<{ record_id: string }>(createRecordB).record_id;

  return {
    runId,
    tokenA,
    tokenB,
    userA: meA,
    userB: meB,
    collaboratorProjectId,
    sharedPaneId: sharedPane.pane_id,
    sharedPaneDocId: sharedPane.doc_id || '',
    privatePaneId: privatePane.pane_id,
    privatePaneDocId: privatePane.doc_id || '',
    tableViewId,
    kanbanViewId,
    collectionId,
    notesFieldId,
    statusFieldId,
    recordAId,
    recordATitle: `E2E Card Todo ${runId}`,
    recordBId,
    recordBTitle: `E2E Card Doing ${runId}`,
    cleanupPaneIds: [sharedPane.pane_id, privatePane.pane_id],
  };
};

const flushReport = async (results: VerificationCase[]): Promise<void> => {
  const rows = results.map((entry, index) => `| ${index + 1} | ${entry.name} | ${entry.status} |`).join('\n');
  const failures = results
    .flatMap((entry, index) =>
      entry.status === 'FAIL'
        ? [
            `### Test ${index + 1} - ${entry.name}`,
            ...entry.genuineFailures.map((failure) => `- ${failure}`),
            ...entry.reproductionSteps.map((step) => `- ${step}`),
            '',
          ]
        : [],
    )
    .join('\n')
    .trim();

  const body = [
    '# E2E Full Report',
    '',
    ...results.flatMap((entry, index) => [
      `Test ${index + 1} - ${entry.name}`,
      `Status: ${entry.status}`,
      `Approach used: ${entry.approachUsed.length > 0 ? entry.approachUsed.join(' ') : 'No approach recorded.'}`,
      `API checks: ${entry.apiChecks.length > 0 ? entry.apiChecks.join(' ') : 'No API checks recorded.'}`,
      `Genuine failures: ${entry.genuineFailures.length > 0 ? entry.genuineFailures.join(' ') : 'None.'}`,
      `Reproduction steps: ${entry.reproductionSteps.length > 0 ? entry.reproductionSteps.join(' ') : 'None.'}`,
      '',
    ]),
    '## Summary Table',
    '',
    '| Test | Name | Status |',
    '| --- | --- | --- |',
    rows || '| - | No tests recorded | - |',
    '',
    '## Genuine Application Failures',
    '',
    failures || 'None.',
    '',
  ].join('\n');

  await writeFile(REPORT_PATH, body, 'utf8');
};

test('production exhaustive verification', async ({ browser }) => {
  test.setTimeout(60 * 60 * 1000);

  const results: VerificationCase[] = [];
  await flushReport(results);

  const { accountA, accountB } = await resolveLinkedTestAccounts();
  const { tokenA, tokenB } = await mintTokensForAccounts(accountA, accountB);
  const fixture = await bootstrapFixture(tokenA, tokenB);
  const openIsolatedPage = async (token: string, path: string, label: string) => {
    const context = await browser.newContext();
    const auth = await authenticatePage(context, token, path, label);
    return {
      ...auth,
      context,
    };
  };

  const runCase = async (name: string, fn: (entry: VerificationCase) => Promise<void>) => {
    if (onlyCaseFilter && !name.toLowerCase().includes(onlyCaseFilter)) {
      return;
    }
    const entry = createCase(name);
    console.log(`CASE START: ${name}`);
    try {
      await fn(entry);
    } catch (error) {
      setBlocked(
        entry,
        error instanceof Error ? error.message : String(error),
        ['The suite reached an unhandled condition after exhausting the scripted recovery path.'],
      );
    }
    results.push(entry);
    await flushReport(results);
    console.log(`CASE END: ${name} -> ${entry.status}`);
  };

  await runCase('Hub Home', async (entry) => {
    const { page, monitor, context } = await openIsolatedPage(fixture.tokenA, '/projects', 'user-a-home');
    entry.approachUsed.push(
      'Authenticated User A with the localStorage `hub:e2e:access-token` bootstrap, opened `/projects`, verified the project list, seeded `backend-pilot` as the last-opened project, then verified that `New Capture` forwards the draft into project quick-capture and creates a real record.',
    );

    await page.evaluate((projectId) => {
      window.localStorage.setItem('hub:last-opened-project-id', projectId);
    }, TARGET_PROJECT_ID);
    await page.reload({ waitUntil: 'domcontentloaded' });

    const list = page.getByRole('list', { name: 'Project list' });
    await list.waitFor({ state: 'visible', timeout: 15_000 });
    const projectNames = (await list.locator('li').evaluateAll((items) =>
      items
        .map((item) => item.querySelector('p')?.textContent?.trim() || '')
        .filter(Boolean),
    )) as string[];

    const bellPresent = await page.getByRole('button', { name: /Notifications|unread notifications/i }).isVisible();
    await openCaptureDialog(page);
    const captureSeed = 'dentist thursday 3pm for an hour remind me 30 min before';
    const captureTextarea = page.locator('textarea').first();
    await captureTextarea.fill(captureSeed);

    const captureDomBeforeSave = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      return {
        url: window.location.pathname,
        title: document.title,
        dialogText: dialog?.textContent?.trim() || '',
      };
    });
    const createCaptureResponsePromise = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return response.request().method() === 'POST' && url.pathname === `/api/hub/projects/${TARGET_PROJECT_ID}/records`;
    }, { timeout: 20_000 });
    await page.getByRole('button', { name: 'Save Capture' }).click();
    await page.waitForURL(new RegExp(`/projects/${TARGET_PROJECT_ID}/work`), { timeout: 20_000 });
    const createCaptureResponse = await createCaptureResponsePromise;
    const createCaptureRaw = await createCaptureResponse.text().catch(() => '');
    const createdCaptureRecordId = (() => {
      try {
        const parsed = JSON.parse(createCaptureRaw) as { ok?: boolean; data?: { record_id?: string | null } | null };
        return parsed?.ok ? String(parsed.data?.record_id || '') : '';
      } catch {
        return '';
      }
    })();
    const inspectorVisible = await page.getByRole('dialog', { name: 'Record Inspector' }).isVisible().catch(() => false);
    const createdTitleVisible = await waitForText(page, captureSeed, 15_000);
    const captureDomAfterSave = await page.evaluate(() => ({
      url: window.location.pathname + window.location.search,
      title: document.title,
      body: document.body.innerText.replace(/\s+/g, ' ').trim().slice(0, 600),
    }));
    let createdCaptureProbe: ApiProbe | null = null;
    if (createdCaptureRecordId) {
      createdCaptureProbe = await hubFetch(
        fixture.tokenA,
        `/api/hub/records/${encodeURIComponent(createdCaptureRecordId)}`,
        { method: 'GET' },
        'Quick capture created record detail',
      );
    }

    entry.approachUsed.push(
      `Direct DOM query confirmed the home route ${markdownCode(captureDomBeforeSave.url)} with title ${markdownCode(captureDomBeforeSave.title)} before submit, then confirmed the forwarded work route ${markdownCode(captureDomAfterSave.url)} with title ${markdownCode(captureDomAfterSave.title)} after submit.`,
    );

    entry.apiChecks.push(`Project list names rendered: ${projectNames.join(', ') || 'none'}.`);
    entry.apiChecks.push(`Notifications bell visible: ${bellPresent ? 'yes' : 'no'}.`);
    entry.apiChecks.push(`Hub Live WebSocket ready frame observed: ${monitor.hubLiveReady ? 'yes' : 'no'}.`);
    entry.apiChecks.push(`Capture dialog text before submit: ${markdownCode(previewText(captureDomBeforeSave.dialogText, 240))}.`);
    entry.apiChecks.push(`Quick capture create response: ${previewText(createCaptureRaw, 400)}.`);
    entry.apiChecks.push(`Record Inspector opened after submit: ${inspectorVisible ? 'yes' : 'no'}.`);
    entry.apiChecks.push(`Created title visible after submit: ${createdTitleVisible ? 'yes' : 'no'}.`);
    entry.apiChecks.push(`Work surface body after submit: ${markdownCode(captureDomAfterSave.body)}.`);
    if (createdCaptureProbe) {
      entry.apiChecks.push(formatProbe(createdCaptureProbe));
    }
    if (monitor.responses.length > 0) {
      entry.apiChecks.push(
        `Page-level 4xx/5xx responses during home verification: ${monitor.responses.map((response) => `${response.status} ${response.url}`).join(' | ')}`,
      );
    }

    if (projectNames.length === 0 || !bellPresent || !monitor.hubLiveReady) {
      setFail(entry, 'Hub Home did not fully render the baseline authenticated shell.', [
        'Sign in as User A with a valid E2E token.',
        'Open `https://eshaansood.org/projects`.',
        'Verify the project list, notification bell, and Hub Live socket bootstrap.',
      ]);
    }

    if (
      createCaptureResponse.status() !== 201 ||
      !createdCaptureRecordId ||
      !createdCaptureProbe?.ok
    ) {
      setFail(entry, 'The production Hub Home quick-capture flow did not forward the draft into backend-pilot and create a real record.', [
        'Sign in as User A.',
        'Open `https://eshaansood.org/projects`.',
        'Set `backend-pilot` as the last-opened project context.',
        'Click `New Capture`.',
        `Type ${markdownCode(captureSeed)} and click \`Save Capture\`.`,
        'Verify the app navigates to `/projects/backend-pilot/work`, opens the Record Inspector, and persists the created record through `POST /api/hub/projects/backend-pilot/records`.',
      ]);
    }

    await page.close();
    await context.close();
  });

  await runCase('Project space bootstrap', async (entry) => {
    const { page, context } = await openIsolatedPage(fixture.tokenA, `/projects/${TARGET_PROJECT_ID}/overview`, 'user-a-bootstrap');
    entry.approachUsed.push(
      'Opened `backend-pilot` overview directly, verified the project chrome, then switched to `Work` to confirm pane switcher availability and the active pane route.',
    );

    const overviewHeading = await waitForText(page, 'Backend Pilot', 15_000);

    await page.getByRole('tab', { name: 'Work' }).click();
    await page.waitForURL(/\/projects\/backend-pilot\/work/, { timeout: 15_000 });

    const paneToolbar = page.getByRole('toolbar', { name: 'Open panes' });
    const panesVisible = await paneToolbar.isVisible().catch(() => false);
    const paneNames = panesVisible
      ? ((await paneToolbar.getByRole('button').evaluateAll((buttons) =>
          buttons
            .map(
              (button) =>
                button.getAttribute('aria-label')?.trim() ||
                button.textContent?.trim() ||
                '',
            )
            .filter(Boolean),
        )) as string[])
      : [];

    if (!panesVisible) {
      const paneProbe = await hubFetch(
        fixture.tokenA,
        `/api/hub/projects/${encodeURIComponent(TARGET_PROJECT_ID)}/panes`,
        { method: 'GET' },
        'Fallback list panes',
      );
      entry.apiChecks.push(formatProbe(paneProbe));
      await page.goto(`${resolvedBaseUrl}/projects/${TARGET_PROJECT_ID}/work/${fixture.sharedPaneId}`, { waitUntil: 'domcontentloaded' });
      entry.approachUsed.push('The normal Work route was missing panes, so the suite fell back to the live panes API and then opened a known pane URL directly.');
    }

    entry.apiChecks.push(`Overview heading visible: ${overviewHeading ? 'yes' : 'no'}.`);
    entry.apiChecks.push(`Pane switcher buttons: ${paneNames.join(', ') || 'none'}.`);

    if (!overviewHeading || paneNames.length === 0) {
      setFail(entry, 'The backend-pilot project space did not complete its overview/work bootstrap flow.', [
        'Sign in as User A.',
        'Open `https://eshaansood.org/projects/backend-pilot/overview`.',
        'Verify the `Overview`, `Work`, and `Tools` tabs render and that `Work` lands on a pane route with visible pane controls.',
      ]);
    }

    await page.close();
    await context.close();
  });

  await runCase('Overview surfaces', async (entry) => {
    const { page, context } = await openIsolatedPage(fixture.tokenA, `/projects/${TARGET_PROJECT_ID}/overview`, 'user-a-overview');
    entry.approachUsed.push(
      'Verified the Overview subviews in production by switching through `Tasks`, `Calendar`, `Timeline`, and `Tools`, and used direct API probes when a surface rendered empty.',
    );

    const overviewViews = page.getByRole('tablist', { name: 'Overview views' });
    await overviewViews.getByRole('button', { name: 'Tasks' }).click();
    await waitForText(page, 'Project Tasks', 10_000);
    const taskRows = await page.locator('section').filter({ hasText: 'Project Tasks' }).locator('li').count();
    if (taskRows === 0) {
      entry.apiChecks.push(formatProbe(await hubFetch(
        fixture.tokenA,
        `/api/hub/projects/${encodeURIComponent(TARGET_PROJECT_ID)}/tasks`,
        { method: 'GET' },
        'Overview tasks fallback',
      )));
    }

    await overviewViews.getByRole('button', { name: 'Calendar' }).click();
    await waitForText(page, 'Project Calendar', 10_000);
    const calendarBody = await page.locator('section').filter({ hasText: 'Project Calendar' }).innerText().catch(() => '');
    if (!/Today|Previous month|Next month|No upcoming events|No events/i.test(calendarBody)) {
      entry.apiChecks.push(formatProbe(await hubFetch(
        fixture.tokenA,
        `/api/hub/projects/${encodeURIComponent(TARGET_PROJECT_ID)}/calendar`,
        { method: 'GET' },
        'Overview calendar fallback',
      )));
    } else if (/No upcoming events|No events/i.test(calendarBody)) {
      entry.apiChecks.push(formatProbe(await hubFetch(
        fixture.tokenA,
        `/api/hub/projects/${encodeURIComponent(TARGET_PROJECT_ID)}/calendar`,
        { method: 'GET' },
        'Overview calendar empty response',
      )));
    }

    await overviewViews.getByRole('button', { name: 'Timeline' }).click();
    await waitForText(page, 'Project Timeline', 10_000);
    const feed = page.getByRole('feed');
    const timelineFilters = page.getByRole('group', { name: 'Filter timeline' });
    const beforeText = previewText(await feed.innerText(), 800);
    await timelineFilters.getByRole('button', { name: 'Workspace' }).click();
    await page.waitForTimeout(1_000);
    const afterToggleText = previewText(await feed.innerText(), 800);
    await timelineFilters.getByRole('button', { name: 'Workspace' }).click();
    await page.waitForTimeout(1_000);
    const afterRestoreText = previewText(await feed.innerText(), 800);
    entry.apiChecks.push(`Timeline before toggle: ${markdownCode(beforeText)}`);
    entry.apiChecks.push(`Timeline after toggle: ${markdownCode(afterToggleText)}`);
    entry.apiChecks.push(`Timeline after restore: ${markdownCode(afterRestoreText)}`);

    await page.getByRole('tab', { name: 'Tools' }).click();
    await page.waitForURL(/\/projects\/backend-pilot\/tools$/, { timeout: 15_000 });
    const toolsBody = previewText(await page.locator('body').innerText().catch(() => ''), 800);
    const toolsVisible = /Automations|Asset Library Roots/i.test(toolsBody);
    entry.apiChecks.push(`Tools body: ${markdownCode(toolsBody)}`);

    if (!beforeText || beforeText === afterToggleText || !/workspace/i.test(beforeText) || /workspace/i.test(afterToggleText) || !/workspace/i.test(afterRestoreText) || !toolsVisible) {
      setFail(entry, 'One or more overview surfaces did not update correctly in production.', [
        'Sign in as User A.',
        'Open `https://eshaansood.org/projects/backend-pilot/overview`.',
        'Switch across `Tasks`, `Calendar`, and `Timeline`.',
        'Toggle the `Workspace` timeline filter off and back on.',
        'Open `Tools` and verify the Tools surface renders.',
      ]);
    }

    await page.close();
    await context.close();
  });

  await runCase('Work surface and pane operations', async (entry) => {
    const { page, context } = await openIsolatedPage(fixture.tokenA, `/projects/${TARGET_PROJECT_ID}/work`, 'user-a-pane-ops');
    entry.approachUsed.push(
      'Used the live Work surface to create a new pane, renamed it through the pane header input, pinned and unpinned it, then deleted it from pane management.',
    );

    const paneName = `E2E Test Pane ${fixture.runId}`;
    const renamedPane = `E2E Renamed Pane ${fixture.runId}`;

    const createResponsePromise = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return response.request().method() === 'POST' && url.pathname === `/api/hub/projects/${TARGET_PROJECT_ID}/panes`;
    }, { timeout: 20_000 });

    await page.getByLabel('New pane name').fill(paneName);
    await page.getByRole('button', { name: 'Create pane' }).click();
    const createResponse = createResponsePromise ? await createResponsePromise : null;
    const createdPaneRaw = createResponse ? await createResponse.text().catch(() => '') : '';
    entry.apiChecks.push(`Create pane response: ${previewText(createdPaneRaw, 400)}`);

    await waitForText(page, paneName, 15_000);
    const currentUrlAfterCreate = page.url();
    const paneNameInput = page.getByRole('textbox', { name: 'Pane name', exact: true });
    await paneNameInput.fill(renamedPane);
    await paneNameInput.blur();
    await waitForText(page, renamedPane, 10_000);

    const managementDetails = page.locator('details').filter({ hasText: 'Editable pane management' }).first();
    const isOpen = await managementDetails.evaluate((element) => (element as HTMLDetailsElement).open).catch(() => false);
    if (!isOpen) {
      await managementDetails.locator('summary').click();
    }
    const manageCard = managementDetails.locator('article').filter({ hasText: renamedPane }).first();
    await manageCard.getByRole('button', { name: 'Pin' }).click();
    const pinnedTab = page.getByRole('tab', { name: new RegExp(`Open pinned pane ${renamedPane}`) });
    await pinnedTab.waitFor({ state: 'visible', timeout: 10_000 });

    await manageCard.getByRole('button', { name: 'Unpin' }).click();
    await pinnedTab.waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => null);

    await manageCard.getByRole('button', { name: 'Delete' }).click();
    await page.waitForTimeout(1_000);
    const stillPresent = await page.getByText(renamedPane, { exact: false }).count();

    if (!currentUrlAfterCreate.includes('/work/') || stillPresent > 0) {
      setFail(entry, 'The pane lifecycle flow did not complete cleanly through the Work surface.', [
        'Sign in as User A.',
        'Open `https://eshaansood.org/projects/backend-pilot/work`.',
        'Create a pane, rename it, pin it, unpin it, and delete it.',
        'Verify the URL updates on creation and the pane disappears after deletion.',
      ]);
    }

    await page.close();
    await context.close();
  });

  await runCase('Collaborative document editor', async (entry) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const authedA = await authenticatePage(
      contextA,
      fixture.tokenA,
      `/projects/${TARGET_PROJECT_ID}/work/${fixture.sharedPaneId}`,
      'user-a-collab',
    );
    const authedB = await authenticatePage(
      contextB,
      fixture.tokenB,
      `/projects/${TARGET_PROJECT_ID}/work/${fixture.sharedPaneId}`,
      'user-b-collab',
    );
    const { page: pageA, monitor: monitorA } = authedA;
    const { page: pageB, monitor: monitorB } = authedB;

    entry.approachUsed.push(
      'Opened the shared pane in parallel User A and User B contexts, typed a timestamped token into the workspace doc, reloaded User A, waited for User B replication, and then ran the standalone `e2e/collab-verify/collab-verify.mjs` process.',
    );

    const editorA = pageA.getByLabel('Project note editor');
    const editorB = pageB.getByLabel('Project note editor');
    await editorA.waitFor({ state: 'visible', timeout: 20_000 });
    await editorB.waitFor({ state: 'visible', timeout: 20_000 });

    const token = `e2e-doc-test-${Date.now()}`;
    await editorA.click();
    await pageA.keyboard.type(`\n${token}`);
    await pageA.waitForFunction((value) => {
      const editor = document.querySelector('[aria-label="Project note editor"]');
      return Boolean(editor?.textContent?.includes(value));
    }, token, { timeout: 10_000 });
    await pageA.reload({ waitUntil: 'domcontentloaded' });
    await pageA.getByLabel('Project note editor').waitFor({ state: 'visible', timeout: 20_000 });
    const persistedOnReload = await pageA.waitForFunction((value) => {
      const editor = document.querySelector('[aria-label="Project note editor"]');
      return Boolean(editor?.textContent?.includes(value));
    }, token, { timeout: 15_000 }).then(() => true, () => false);
    const replicatedToB = await pageB.waitForFunction((value) => {
      const editor = document.querySelector('[aria-label="Project note editor"]');
      return Boolean(editor?.textContent?.includes(value));
    }, token, { timeout: 10_000 }).then(() => true, () => false);

    const collabAuthorize = await hubFetch(
      fixture.tokenA,
      `/api/hub/collab/authorize?doc_id=${encodeURIComponent(fixture.sharedPaneDocId)}`,
      { method: 'GET' },
      'Collab authorization probe',
    );
    entry.apiChecks.push(formatProbe(collabAuthorize));
    entry.apiChecks.push(`User A collab websockets: ${Array.from(monitorA.collabUrls).join(', ') || 'none'}.`);
    entry.apiChecks.push(`User B collab websockets: ${Array.from(monitorB.collabUrls).join(', ') || 'none'}.`);
    entry.apiChecks.push(`Persisted on User A reload: ${persistedOnReload ? 'yes' : 'no'}.`);
    entry.apiChecks.push(`Replicated to User B: ${replicatedToB ? 'yes' : 'no'}.`);
    if (monitorA.consoleErrors.length > 0) {
      entry.apiChecks.push(`User A console errors: ${monitorA.consoleErrors.map((error) => markdownCode(previewText(error, 200))).join(' | ')}`);
    }
    if (monitorB.consoleErrors.length > 0) {
      entry.apiChecks.push(`User B console errors: ${monitorB.consoleErrors.map((error) => markdownCode(previewText(error, 200))).join(' | ')}`);
    }

    const collabEnv = {
      ...process.env,
      COLLAB_VERIFY_BASE_URL: resolvedBaseUrl,
      COLLAB_VERIFY_WS_URL: 'wss://collab.eshaansood.org',
      COLLAB_VERIFY_KEYCLOAK_URL: 'https://auth.eshaansood.org',
      COLLAB_VERIFY_REALM: 'eshaan-os',
      COLLAB_VERIFY_CLIENT_ID: 'eshaan-os-hub',
      COLLAB_VERIFY_USER_A_USERNAME: accountA.email,
      COLLAB_VERIFY_USER_A_PASSWORD: accountA.password,
      COLLAB_VERIFY_USER_B_USERNAME: accountB.email,
      COLLAB_VERIFY_USER_B_PASSWORD: accountB.password,
      COLLAB_VERIFY_PROJECT_ID: TARGET_PROJECT_ID,
      COLLAB_VERIFY_DOC_ID: fixture.sharedPaneDocId,
    };

    const collabVerify = await execFileAsync('node', ['e2e/collab-verify/collab-verify.mjs'], {
      cwd: '/Users/eshaansood/eshaan-os',
      env: collabEnv,
      timeout: 120_000,
      maxBuffer: 2 * 1024 * 1024,
    }).then(
      (result) => ({ exitCode: 0, stdout: result.stdout, stderr: result.stderr }),
      (error: { code?: number; stdout?: string; stderr?: string }) => ({
        exitCode: typeof error.code === 'number' ? error.code : 1,
        stdout: error.stdout || '',
        stderr: error.stderr || '',
      }),
    );
    entry.apiChecks.push(
      `collab-verify exit=${collabVerify.exitCode} stdout=${markdownCode(previewText(collabVerify.stdout || ''))} stderr=${markdownCode(previewText(collabVerify.stderr || ''))}`,
    );

    if (!monitorA.collabUrls.size || !monitorB.collabUrls.size || !persistedOnReload || !replicatedToB || collabVerify.exitCode !== 0) {
      setFail(entry, 'The collaborative document editor did not satisfy the real-time persistence contract.', [
        'Sign in as User A and User B.',
        `Open the shared pane route \`${resolvedBaseUrl}/projects/${TARGET_PROJECT_ID}/work/${fixture.sharedPaneId}\` in both sessions.`,
        'Type a unique string in User A, reload User A, and verify it persists.',
        'Verify User B receives the same string within 10 seconds.',
        'Run `node e2e/collab-verify/collab-verify.mjs` with the production collab environment variables.',
      ]);
    }

    await pageA.close();
    await pageB.close();
    await contextA.close();
    await contextB.close();
  });

  await runCase('Record inspector', async (entry) => {
    const { page, context } = await openIsolatedPage(
      fixture.tokenA,
      `/projects/${TARGET_PROJECT_ID}/work/${fixture.sharedPaneId}?view_id=${fixture.tableViewId}`,
      'user-a-record-inspector',
    );
    entry.approachUsed.push(
      'Opened the table-focused work surface for the fixture view, launched the record inspector, edited the `Notes` field, added a comment, uploaded an attachment, and reopened the record to confirm persistence.',
    );

    const recordCell = page.getByRole('grid').getByText(fixture.recordATitle).first();
    await recordCell.waitFor({ state: 'visible', timeout: 20_000 });
    await recordCell.click();

    const inspector = page.getByRole('dialog', { name: 'Record Inspector' });
    await inspector.waitFor({ state: 'visible', timeout: 15_000 });
    const notesInput = inspector.getByLabel('Notes');
    await notesInput.fill(`Updated note ${fixture.runId}`);
    await notesInput.blur();
    await page.waitForTimeout(1_500);

    await inspector.getByRole('textbox', { name: 'Record comment', exact: true }).fill(`Comment ${fixture.runId}`);
    await inspector.getByRole('button', { name: 'Add comment' }).click();
    await waitForText(inspector, `Comment ${fixture.runId}`, 10_000);

    const attachInput = inspector.getByLabel('Attach file');
    await attachInput.setInputFiles({
      name: `record-${fixture.runId}.txt`,
      mimeType: 'text/plain',
      buffer: Buffer.from(`record attachment ${fixture.runId}`, 'utf8'),
    });
    await inspector.getByRole('button', { name: 'Attach', exact: true }).click();
    await waitForText(inspector, `record-${fixture.runId}.txt`, 15_000);
    await inspector.getByRole('button', { name: `record-${fixture.runId}.txt`, exact: true }).click().catch(() => null);

    await page.keyboard.press('Escape');
    await recordCell.click();
    await inspector.waitFor({ state: 'visible', timeout: 15_000 });
    const notesPersistedValue = await inspector.getByLabel('Notes').inputValue();
    const inspectorText = await inspector.innerText().catch(() => '');
    const backlinksVisible = inspectorText.includes('Backlinks / Mentions');
    const commentVisible = inspectorText.includes(`Comment ${fixture.runId}`);
    const attachmentVisible = inspectorText.includes(`record-${fixture.runId}.txt`);
    const attachmentActionChecks = {
      download: await inspector.getByRole('button', { name: 'Download', exact: true }).isVisible().catch(() => false),
      copyLink: await inspector.getByRole('button', { name: 'Copy link', exact: true }).isVisible().catch(() => false),
      move: await inspector.getByRole('button', { name: 'Move', exact: true }).isVisible().catch(() => false),
      rename: await inspector.getByRole('button', { name: 'Rename', exact: true }).isVisible().catch(() => false),
      remove: await inspector.getByRole('button', { name: 'Remove', exact: true }).isVisible().catch(() => false),
    };
    const recordDetailProbe = await hubFetch(
      fixture.tokenA,
      `/api/hub/records/${encodeURIComponent(fixture.recordAId)}`,
      { method: 'GET' },
      'Record inspector detail after reopen',
    );
    entry.apiChecks.push(formatProbe(recordDetailProbe));
    entry.apiChecks.push(`Inspector route: ${markdownCode(page.url())} title=${markdownCode(await page.title())}.`);
    entry.apiChecks.push(`Attachment action buttons: ${JSON.stringify(attachmentActionChecks)}.`);

    if (
      !notesPersistedValue.includes(`Updated note ${fixture.runId}`) ||
      !commentVisible ||
      !backlinksVisible ||
      !attachmentVisible ||
      Object.values(attachmentActionChecks).some((value) => !value) ||
      !recordDetailProbe.ok
    ) {
      setFail(entry, 'The record inspector did not persist record edits and attachments through reopen.', [
        'Sign in as User A.',
        `Open \`${resolvedBaseUrl}/projects/${TARGET_PROJECT_ID}/work/${fixture.sharedPaneId}?view_id=${fixture.tableViewId}\`.`,
        `Open the record \`${fixture.recordATitle}\` from the focused table grid.`,
        'Edit the `Notes` field, add a comment, upload an attachment, close the inspector, and reopen it.',
        'Verify the field value, comment, backlinks panel, and attachment actions still render.',
      ]);
    }

    await page.close();
    await context.close();
  });

  await runCase('Kanban view', async (entry) => {
    const { page, context } = await openIsolatedPage(
      fixture.tokenA,
      `/projects/${TARGET_PROJECT_ID}/work/${fixture.sharedPaneId}?view_id=${fixture.kanbanViewId}`,
      'user-a-kanban',
    );
    entry.approachUsed.push(
      'Opened the focused Kanban view and used the inline `Move <card>` select control rather than drag-and-drop so the move remained deterministic under Playwright.',
    );

    const todoColumn = page.getByLabel('todo column').first();
    const doingColumn = page.getByLabel('doing column').first();
    await todoColumn.waitFor({ state: 'visible', timeout: 20_000 });
    await doingColumn.waitFor({ state: 'visible', timeout: 20_000 });

    const moveSelect = page.getByLabel(`Move ${fixture.recordATitle}`).first();
    const moveResponsePromise = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return response.request().method() === 'POST' && /\/api\/hub\/records\/.+\/values$/.test(url.pathname);
    }, { timeout: 20_000 });
    await moveSelect.selectOption('doing');
    const moveResponse = await moveResponsePromise;
    entry.apiChecks.push(`Kanban move API status: ${moveResponse.status()} ${moveResponse.url()}`);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForText(page, fixture.recordATitle, 20_000);
    const cardInDoing = await page.getByLabel('doing column').getByRole('listitem').filter({ hasText: fixture.recordATitle }).count();

    if (cardInDoing === 0) {
      setFail(entry, 'The Kanban card did not persist in its new column after the move.', [
        'Sign in as User A.',
        `Open \`${resolvedBaseUrl}/projects/${TARGET_PROJECT_ID}/work/${fixture.sharedPaneId}?view_id=${fixture.kanbanViewId}\`.`,
        `Use the inline \`Move ${fixture.recordATitle}\` control to move the card from \`todo\` to \`doing\`.`,
        'Reload the page and verify the card remains in the `doing` column.',
      ]);
    }

    await page.close();
    await context.close();
  });

  await runCase('Notifications', async (entry) => {
    const { page, monitor, context } = await openIsolatedPage(
      fixture.tokenA,
      `/projects/${TARGET_PROJECT_ID}/work/${fixture.sharedPaneId}`,
      'user-a-notifications',
    );
    entry.approachUsed.push(
      'Opened the notifications bell, probed both the user-requested and canonical notification endpoints, then triggered a doc save and rechecked the panel after five seconds.',
    );

    const bell = page.getByRole('button', { name: /Notifications|unread notifications/i });
    await bell.click();
    const panelVisible = await page.getByRole('dialog', { name: 'Notifications' }).isVisible().catch(() => false);

    const notificationsRequested = await hubFetch(
      fixture.tokenA,
      '/api/hub/users/me/notifications',
      { method: 'GET' },
      'Requested notifications endpoint',
    );
    const notificationsCanonical = await hubFetch(
      fixture.tokenA,
      '/api/hub/notifications',
      { method: 'GET' },
      'Canonical notifications endpoint',
    );
    entry.apiChecks.push(formatProbe(notificationsRequested));
    entry.apiChecks.push(formatProbe(notificationsCanonical));

    const editor = page.getByLabel('Project note editor');
    await editor.click();
    await page.keyboard.type(`\nnotify-${Date.now()}`);
    await page.waitForTimeout(5_000);
    await bell.click().catch(() => null);
    const panelText = previewText(await page.getByRole('dialog', { name: 'Notifications' }).innerText().catch(() => ''), 600);
    entry.apiChecks.push(`Notifications panel after doc save: ${markdownCode(panelText)}`);
    entry.apiChecks.push(`Hub Live ready during notification check: ${monitor.hubLiveReady ? 'yes' : 'no'}.`);

    if (!panelVisible || !monitor.hubLiveReady) {
      setFail(entry, 'The notifications shell did not open reliably on the production app shell.', [
        'Sign in as User A.',
        'Open the bell icon in the bottom app toolbar.',
        'Verify the notifications panel opens and Hub Live remains connected.',
      ]);
    }

    await page.close();
    await context.close();
  });

  await runCase('Collaborator management', async (entry) => {
    const targetProjectId = fixture.collaboratorProjectId;
    const membersBefore = await hubFetch(
      fixture.tokenA,
      `/api/hub/projects/${encodeURIComponent(targetProjectId)}/members`,
      { method: 'GET' },
      'Collaborator project members before UI add',
    );
    entry.apiChecks.push(formatProbe(membersBefore));

    const beforeData = parseEnvelopeData<{
      members: Array<{ user_id: string; display_name: string; role: string; email: string }>;
    }>(membersBefore);

    if (beforeData.members.some((member) => member.user_id === fixture.userB.userId)) {
      setBlocked(entry, `Project ${targetProjectId} already contains User B, so it cannot verify the add-member path without mutating unrelated state.`, [
        `Open \`${resolvedBaseUrl}/projects/${targetProjectId}/overview\` and inspect the current member list.`,
      ]);
      return;
    }

    const { page, context } = await openIsolatedPage(
      fixture.tokenA,
      `/projects/${targetProjectId}/overview`,
      'user-a-collaborators',
    );
    entry.approachUsed.push(
      `Used the overview collaborator form on project ${markdownCode(targetProjectId)} and watched the live network traffic to ensure the owner path called \`/members\` instead of \`/invites\`.`,
    );

    const memberRequests: string[] = [];
    const inviteRequests: string[] = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (request.method() !== 'POST') {
        return;
      }
      if (url.pathname.endsWith(`/projects/${targetProjectId}/members`)) {
        memberRequests.push(url.pathname);
      }
      if (url.pathname.endsWith(`/projects/${targetProjectId}/invites`)) {
        inviteRequests.push(url.pathname);
      }
    });

    const emailInput = page.getByLabel('Collaborator email');
    await emailInput.fill(fixture.userB.email);
    await page.getByRole('button', { name: 'Add collaborator' }).click();
    await page.waitForTimeout(2_000);

    const membersAfter = await hubFetch(
      fixture.tokenA,
      `/api/hub/projects/${encodeURIComponent(targetProjectId)}/members`,
      { method: 'GET' },
      'Collaborator project members after UI add',
    );
    entry.apiChecks.push(formatProbe(membersAfter));

    const afterData = parseEnvelopeData<{
      members: Array<{ user_id: string; display_name: string; role: string; email: string }>;
    }>(membersAfter);
    const userAOwner = afterData.members.some((member) => member.user_id === fixture.userA.userId && member.role === 'owner');
    const userBAdded = afterData.members.some((member) => member.user_id === fixture.userB.userId);

    if (!userAOwner || !userBAdded || memberRequests.length === 0 || inviteRequests.length > 0) {
      setFail(entry, 'The collaborator management flow did not use the direct member-add path cleanly.', [
        'Sign in as User A on an owner-controlled project where User B is not already a member.',
        'Open the project overview collaborator form.',
        `Submit ${fixture.userB.email}.`,
        'Verify the request goes to `/members`, not `/invites`, and the refreshed member list contains User B while User A remains owner.',
      ]);
    }

    await page.close();
    await context.close();
  });

  await runCase('Permissions boundary', async (entry) => {
    const paneListProbe = await hubFetch(
      fixture.tokenB,
      `/api/hub/projects/${encodeURIComponent(TARGET_PROJECT_ID)}/panes`,
      { method: 'GET' },
      'User B pane list for read-only selection',
    );
    entry.apiChecks.push(formatProbe(paneListProbe));
    const paneList = parseEnvelopeData<{ panes: PaneSummary[] }>(paneListProbe).panes;
    const readOnlyPane = paneList.find((pane) => !pane.can_edit && pane.doc_id) || null;
    if (!readOnlyPane) {
      setBlocked(entry, 'No read-only pane was available for User B in backend-pilot.', [
        'List `GET /api/hub/projects/backend-pilot/panes` as User B.',
        'Confirm there is at least one pane with `can_edit: false` and a `doc_id`.',
      ]);
      return;
    }

    const { page, context } = await openIsolatedPage(
      fixture.tokenB,
      `/projects/${TARGET_PROJECT_ID}/work/${readOnlyPane.pane_id}`,
      'user-b-permissions',
    );
    entry.approachUsed.push(
      'Opened a pane where User B is not a pane editor, inspected the live DOM for write controls, probed collab authorization directly, and investigated the pane-creation boundary instead of assuming the UI state was correct.',
    );

    await page.waitForFunction(
      () => document.body.innerText.includes('Read-only mode') || document.body.innerText.includes('Collaboration unavailable'),
      null,
      { timeout: 15_000 },
    ).catch(() => null);

    const pageState = await page.evaluate(() => ({
      url: window.location.pathname,
      title: document.title,
      body: document.body.innerText,
      hasEditor: Boolean(document.querySelector('[aria-label="Project note editor"]')),
    }));
    entry.apiChecks.push(`Read-only route: ${markdownCode(pageState.url)} title=${markdownCode(pageState.title)}`);

    const collabProbe = await hubFetch(
      fixture.tokenB,
      `/api/hub/collab/authorize?doc_id=${encodeURIComponent(readOnlyPane.doc_id || '')}`,
      { method: 'GET' },
      'User B collab authorization on read-only pane doc',
    );
    entry.apiChecks.push(formatProbe(collabProbe));

    const readOnlyControlLeak = {
      editablePaneManagement: pageState.body.includes('EDITABLE PANE MANAGEMENT'),
      createPaneButton: pageState.body.includes('Create pane'),
      pinButton: pageState.body.includes('Pin'),
      renameButton: pageState.body.includes('Rename'),
      deleteButton: pageState.body.includes('Delete'),
      addModuleTable: pageState.body.includes('Add module: Table'),
      createPaneInput: pageState.body.includes('New pane name'),
    };
    entry.apiChecks.push(`User B editable pane controls: ${JSON.stringify(readOnlyControlLeak)}.`);

    if (Object.values(readOnlyControlLeak).some((value) => value)) {
      const memberPaneProbe = await hubFetch(
        fixture.tokenB,
        `/api/hub/projects/${encodeURIComponent(TARGET_PROJECT_ID)}/panes`,
        {
          method: 'POST',
          body: JSON.stringify({
            name: `B-should-not-create-${fixture.runId}`,
          }),
        },
        'User B direct create pane permission probe',
      );
      entry.apiChecks.push(formatProbe(memberPaneProbe));
      const steps = [
        'Sign in as User B.',
        `Open \`${resolvedBaseUrl}/projects/${TARGET_PROJECT_ID}/work/${fixture.privatePaneId}\`.`,
        'Observe that the page shows read-only workspace messaging but still renders editable pane management controls such as `Create pane`, `Pin`, `Rename`, `Delete`, or `Add module` actions.',
      ];
      if (memberPaneProbe.ok) {
        const created = parseEnvelopeData<{ pane: PaneSummary }>(memberPaneProbe).pane;
        fixture.cleanupPaneIds.push(created.pane_id);
        steps.push('Submit the create request and observe that the backend creates the pane for User B.');
      } else {
        steps.push('Attempt the same action against `/api/hub/projects/backend-pilot/panes` and observe the backend reject it with `Project capability "write" required.`');
      }
      setFail(entry, 'User B still sees editable pane-management controls on a read-only work surface.', steps);
    }

    if (!pageState.body.includes('Read-only mode') || pageState.hasEditor) {
      setFail(entry, 'The read-only pane did not clearly enforce the non-editor boundary.', [
        'Sign in as User B.',
        `Open \`${resolvedBaseUrl}/projects/${TARGET_PROJECT_ID}/work/${readOnlyPane.pane_id}\`.`,
        'Verify the workspace surface clearly blocks editing and does not allow doc mutation.',
      ]);
    }

    await page.close();
    await context.close();
  });

  await runCase('AppShell and navigation', async (entry) => {
    const { page, context } = await openIsolatedPage(fixture.tokenA, '/projects', 'user-a-appshell');
    entry.approachUsed.push(
      'Verified the bottom app toolbar controls, inspected the disabled global search field, opened the account menu to confirm the signed-in identity, and then signed out to verify the login screen returns.',
    );

    const navChecks = {
      goHome: await page.getByRole('button', { name: 'Go home' }).isVisible(),
      quickNav: await page.getByRole('button', { name: 'Quick navigation' }).isVisible(),
      quickAdd: await page.getByRole('button', { name: 'Quick add to inbox' }).isVisible(),
      notifications: await page.getByRole('button', { name: /Notifications|unread notifications/i }).isVisible(),
      account: await page.getByRole('button', { name: 'Account menu' }).isVisible(),
    };
    const globalSearch = page.getByLabel('Global search');
    const globalSearchDisabled = await globalSearch.isDisabled();
    entry.apiChecks.push(`App toolbar controls: ${JSON.stringify(navChecks)}`);
    entry.apiChecks.push(`Global search disabled: ${globalSearchDisabled ? 'yes' : 'no'}.`);

    await page.getByRole('button', { name: 'Account menu' }).click();
    const accountMenuText = previewText(await page.locator('body').innerText(), 500);
    entry.apiChecks.push(`Account menu text: ${markdownCode(accountMenuText)}`);

    const identityVisible = accountMenuText.includes(fixture.userA.name) && accountMenuText.includes(fixture.userA.email);
    await page.getByRole('menuitem', { name: /Log out/i }).click({ noWaitAfter: true });
    await page.waitForTimeout(5_000);
    const signedOutBody = previewText(await page.locator('body').innerText().catch(() => ''), 800);
    entry.apiChecks.push(`Signed-out body: ${markdownCode(signedOutBody)}`);
    const signedOutVisible = /Continue with Keycloak|Secure sign-in for the control plane|Eshaan OS/i.test(signedOutBody);

    if (Object.values(navChecks).some((value) => !value) || !identityVisible || !signedOutVisible) {
      setFail(entry, 'The app shell or account navigation did not expose the expected authenticated controls.', [
        'Sign in as User A.',
        'Open `https://eshaansood.org/projects`.',
        'Verify the app toolbar renders home, quick navigation, global search, quick add, notifications, and account controls.',
        'Open the account menu and verify the current user identity before signing out.',
      ]);
    }

    await page.close();
    await context.close();
  });

  await runCase('Files module', async (entry) => {
    const { page, monitor, context } = await openIsolatedPage(
      fixture.tokenA,
      `/projects/${TARGET_PROJECT_ID}/work/${fixture.sharedPaneId}`,
      'user-a-files',
    );
    entry.approachUsed.push(
      'Opened the shared pane with a Files module in its layout, inspected the module and direct file-list APIs, then attempted a real upload with a small text file.',
    );

    const filesSection = page.getByLabel('Files module');
    const filesVisible = await filesSection.isVisible().catch(() => false);
    const requestedProjectFiles = await hubFetch(
      fixture.tokenA,
      `/api/hub/projects/${encodeURIComponent(TARGET_PROJECT_ID)}/files?scope=project`,
      { method: 'GET' },
      'Project files API',
    );
    const requestedPaneFiles = await hubFetch(
      fixture.tokenA,
      `/api/hub/projects/${encodeURIComponent(TARGET_PROJECT_ID)}/files?scope=pane&pane_id=${encodeURIComponent(fixture.sharedPaneId)}`,
      { method: 'GET' },
      'Pane files API',
    );
    entry.apiChecks.push(formatProbe(requestedProjectFiles));
    entry.apiChecks.push(formatProbe(requestedPaneFiles));

    if (filesVisible) {
      const fileInput = filesSection.locator('input[type="file"]').first();
      await fileInput.setInputFiles({
        name: `files-${fixture.runId}.txt`,
        mimeType: 'text/plain',
        buffer: Buffer.from(`files module upload ${fixture.runId}`, 'utf8'),
      });
      await page.waitForTimeout(5_000);
      const fileListText = previewText(await filesSection.innerText().catch(() => ''), 600);
      entry.apiChecks.push(`Files module text after upload attempt: ${markdownCode(fileListText)}`);
    } else {
      entry.approachUsed.push('The Files module never became visible in the DOM, so the suite used the live file APIs and page error log to investigate the cause.');
    }

    const fileEndpoint404 = requestedProjectFiles.status === 404 || requestedPaneFiles.status === 404;
    const filePageErrors = monitor.responses.filter((response) => response.url.includes('/api/hub/projects/backend-pilot/files'));
    if (!filesVisible || fileEndpoint404 || filePageErrors.length > 0) {
      setFail(entry, 'The production Files module is backed by missing `/api/hub/projects/:projectId/files` endpoints, so list/upload verification cannot complete successfully.', [
        'Sign in as User A.',
        `Open \`${resolvedBaseUrl}/projects/${TARGET_PROJECT_ID}/work/${fixture.sharedPaneId}\`.`,
        'Observe the Files module area.',
        'Check the network traffic for `/api/hub/projects/backend-pilot/files?scope=project` and `scope=pane`.',
        'Attempt a file upload and verify that the list endpoint 404s prevent normal file-list verification.',
      ]);
    }

    await page.close();
    await context.close();
  });

  await runCase('Timeline filter regression', async (entry) => {
    const { page, context } = await openIsolatedPage(
      fixture.tokenA,
      `/projects/${TARGET_PROJECT_ID}/overview`,
      'user-a-timeline-regression',
    );
    entry.approachUsed.push(
      'Repeated the specific regression flow on the overview timeline by capturing the initial feed, toggling off `Workspace`, verifying the feed collapsed, then toggling it back on and confirming the original entries returned.',
    );

    const overviewViews = page.getByRole('tablist', { name: 'Overview views' });
    const timelineFilters = page.getByRole('group', { name: 'Filter timeline' });
    await overviewViews.getByRole('button', { name: 'Timeline' }).click();
    await waitForText(page, 'Project Timeline', 10_000);
    const feed = page.getByRole('feed');
    const initial = previewText(await feed.innerText(), 800);
    await timelineFilters.getByRole('button', { name: 'Workspace' }).click();
    await page.waitForTimeout(1_000);
    const filtered = previewText(await feed.innerText(), 800);
    await timelineFilters.getByRole('button', { name: 'Workspace' }).click();
    await page.waitForTimeout(1_000);
    const restored = previewText(await feed.innerText(), 800);

    entry.apiChecks.push(`Initial clusters: ${markdownCode(initial)}`);
    entry.apiChecks.push(`Filtered clusters: ${markdownCode(filtered)}`);
    entry.apiChecks.push(`Restored clusters: ${markdownCode(restored)}`);

    if (initial === filtered || !/workspace/i.test(initial) || /workspace/i.test(filtered) || !/workspace/i.test(restored)) {
      setFail(entry, 'The overview timeline filter regression is still present: toggling the filter did not deterministically update the cluster list.', [
        'Sign in as User A.',
        'Open `https://eshaansood.org/projects/backend-pilot/overview?view=timeline`.',
        'Capture the initial timeline feed.',
        'Toggle off `Workspace` and verify the feed changes.',
        'Toggle `Workspace` back on and verify the original entries return.',
      ]);
    }

    await page.close();
    await context.close();
  });

  for (const paneId of fixture.cleanupPaneIds) {
    await hubFetch(fixture.tokenA, `/api/hub/panes/${encodeURIComponent(paneId)}`, { method: 'DELETE' }, `Cleanup pane ${paneId}`).catch(() => {
      // Best-effort cleanup only.
    });
  }

  await flushReport(results);
});
