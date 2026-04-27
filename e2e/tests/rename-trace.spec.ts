import { test, type Page } from '@playwright/test';
import { rm, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { authenticateAsUserA, readTokenAFromFile } from '../helpers/auth';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPORT_DIR = process.env.RENAME_TRACE_REPORT_DIR
  ? resolve(process.cwd(), process.env.RENAME_TRACE_REPORT_DIR)
  : resolve(__dirname, '..', '..', 'test-results', 'rename-trace');
const STRICT_TASK_RECORD_QUERY = process.env.RENAME_TRACE_STRICT_TASK_RECORD_QUERY === 'true';
const LIVE_TIMEOUT_MS = 60_000;

interface IdConfusionFinding {
  path: string;
  value: string;
  expected: 'space ID' | 'work-project ID';
}

interface ReportFinding extends IdConfusionFinding {
  source: string;
}

interface EndpointReport {
  name: string;
  method: 'GET' | 'POST';
  path: string;
  dumpFile: string;
  status: number;
  ok: boolean;
  unavailable: boolean;
  findings: IdConfusionFinding[];
}

interface UiStepReport {
  name: string;
  dumpFile: string;
  passed: boolean;
  findings: string[];
}

interface HubEnvelope<T> {
  ok: boolean;
  data: T | null;
  error?: {
    code?: string;
    message?: string;
  } | null;
}

interface SpacePayload {
  space?: {
    space_id?: string;
    name?: string;
  };
}

interface WorkProjectPayload {
  project?: {
    project_id?: string;
    space_id?: string;
    name?: string;
    doc_id?: string | null;
  };
}

interface CollectionCreatePayload {
  collection_id?: string;
}

interface ViewCreatePayload {
  view_id?: string;
}

interface RecordCreatePayload {
  record_id?: string;
}

interface TaskCreatePayload {
  task?: {
    record_id?: string;
  };
}

interface ReminderCreatePayload {
  reminder?: {
    reminder_id?: string;
    record_id?: string;
  };
}

const reportName = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'dump';

const writeJson = async (filename: string, value: unknown): Promise<void> => {
  await writeFile(resolve(REPORT_DIR, filename), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

const writeText = async (filename: string, value: string): Promise<void> => {
  await writeFile(resolve(REPORT_DIR, filename), value, 'utf8');
};

const asObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

const unwrapEnvelope = <T,>(payload: unknown): T => {
  const envelope = asObject(payload) as Partial<HubEnvelope<T>>;
  if (envelope.ok !== true || envelope.data === null || envelope.data === undefined) {
    throw new Error(`Unexpected Hub API envelope: ${JSON.stringify(payload).slice(0, 400)}`);
  }
  return envelope.data;
};

const getString = (value: unknown, path: string): string => {
  if (typeof value !== 'string' || !value) {
    throw new Error(`Missing string at ${path}.`);
  }
  return value;
};

const normalizeApiBaseUrl = (): string => {
  const explicit = String(process.env.HUB_API_BASE_URL || '').trim();
  if (explicit) {
    return explicit.replace(/\/+$/, '');
  }
  const appBaseUrl = String(process.env.E2E_BASE_URL || process.env.PLAYWRIGHT_BASE_URL || '').trim();
  if (!appBaseUrl) {
    throw new Error('Missing HUB_API_BASE_URL or E2E_BASE_URL/PLAYWRIGHT_BASE_URL.');
  }
  const url = new URL(appBaseUrl);
  if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') {
    url.port = '3001';
  }
  return url.toString().replace(/\/+$/, '');
};

class TraceApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
  ) {}

  async request(
    method: 'GET' | 'POST' | 'PATCH' | 'PUT',
    path: string,
    body?: Record<string, unknown>,
  ): Promise<{ status: number; ok: boolean; payload: unknown }> {
    const response = await fetch(new URL(path, this.baseUrl).toString(), {
      method,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${this.token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const text = await response.text();
    let payload: unknown = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = { parse_error: true, raw: text };
      }
    }
    return { status: response.status, ok: response.ok, payload };
  }

  async expectData<T>(method: 'GET' | 'POST' | 'PATCH' | 'PUT', path: string, body?: Record<string, unknown>): Promise<T> {
    const response = await this.request(method, path, body);
    if (!response.ok) {
      throw new Error(`${method} ${path} failed with ${response.status}: ${JSON.stringify(response.payload).slice(0, 400)}`);
    }
    return unwrapEnvelope<T>(response.payload);
  }
}

export const findIdConfusion = (obj: unknown, spaceId: string, projectIds: string[]): IdConfusionFinding[] => {
  const projectIdSet = new Set(projectIds);
  const findings: IdConfusionFinding[] = [];

  const visit = (value: unknown, path: string): void => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${path}[${index}]`));
      return;
    }
    if (!value || typeof value !== 'object') {
      return;
    }

    for (const [key, child] of Object.entries(value)) {
      const childPath = `${path}.${key}`;
      if (typeof child === 'string') {
        if (key === 'space_id' && projectIdSet.has(child)) {
          findings.push({ path: childPath, value: child, expected: 'space ID' });
        }
        if ((key === 'project_id' || key === 'source_project_id') && child === spaceId) {
          findings.push({ path: childPath, value: child, expected: 'work-project ID' });
        }
      }
      visit(child, childPath);
    }
  };

  visit(obj, 'response');
  return findings;
};

const makeLexicalSnapshot = (plainText: string): Record<string, unknown> => ({
  lexical_state: {
    root: {
      children: [
        {
          children: [
            {
              detail: 0,
              format: 0,
              mode: 'normal',
              style: '',
              text: plainText,
              type: 'text',
              version: 1,
            },
          ],
          direction: null,
          format: '',
          indent: 0,
          type: 'paragraph',
          version: 1,
          textFormat: 0,
          textStyle: '',
        },
      ],
      direction: null,
      format: '',
      indent: 0,
      type: 'root',
      version: 1,
    },
  },
  plain_text: plainText,
  node_keys: [],
});

const createFixture = async (client: TraceApiClient): Promise<{
  runId: string;
  spaceId: string;
  spaceName: string;
  firstProjectId: string;
  firstProjectName: string;
  firstDocId: string;
  secondProjectId: string;
  secondProjectName: string;
  taskRecordId: string;
  taskTitle: string;
  reminderTitle: string;
  reminderRecordId: string;
  collectionId: string;
  collectionName: string;
  recordId: string;
  recordTitle: string;
  viewId: string;
  docText: string;
}> => {
  const runId = `rename-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const idSuffix = runId.replace(/[^A-Za-z0-9_-]/g, '_');
  const spaceId = `SPACE_${idSuffix}`;
  const spaceName = `Rename Trace Space ${runId}`;
  const firstProjectName = `Rename Trace Work Alpha ${runId}`;
  const secondProjectName = `Rename Trace Work Beta ${runId}`;
  const taskTitle = `Rename Trace Task ${runId}`;
  const reminderTitle = `Rename Trace Reminder ${runId}`;
  const collectionName = `Rename Trace Table ${runId}`;
  const recordTitle = `Rename Trace Record ${runId}`;
  const docText = `Rename Trace Doc ${runId}`;

  const spaceData = await client.expectData<SpacePayload>('POST', '/api/hub/spaces', {
    space_id: spaceId,
    name: spaceName,
  });
  const createdSpaceId = getString(spaceData.space?.space_id, 'space.space_id');

  const firstProjectData = await client.expectData<WorkProjectPayload>('POST', `/api/hub/spaces/${encodeURIComponent(createdSpaceId)}/projects`, {
    name: firstProjectName,
    layout_config: {
      modules_enabled: true,
      workspace_enabled: true,
      doc_binding_mode: 'owned',
      modules: [
        { module_instance_id: `tasks-${idSuffix}`, module_type: 'tasks', size_tier: 'M', lens: 'project' },
        { module_instance_id: `reminders-${idSuffix}`, module_type: 'reminders', size_tier: 'M', lens: 'project' },
        { module_instance_id: `files-${idSuffix}`, module_type: 'files', size_tier: 'M', lens: 'project' },
      ],
    },
  });
  const secondProjectData = await client.expectData<WorkProjectPayload>('POST', `/api/hub/spaces/${encodeURIComponent(createdSpaceId)}/projects`, {
    name: secondProjectName,
    layout_config: {
      modules_enabled: true,
      workspace_enabled: true,
      doc_binding_mode: 'owned',
      modules: [
        { module_instance_id: `tasks-beta-${idSuffix}`, module_type: 'tasks', size_tier: 'M', lens: 'project' },
      ],
    },
  });

  const firstProjectId = getString(firstProjectData.project?.project_id, 'project.project_id');
  const secondProjectId = getString(secondProjectData.project?.project_id, 'project.project_id');
  const firstDocId = getString(firstProjectData.project?.doc_id, 'project.doc_id');

  if (createdSpaceId === firstProjectId || createdSpaceId === secondProjectId) {
    throw new Error(`Seeded space_id collides with work project_id: ${createdSpaceId}`);
  }

  const taskData = await client.expectData<TaskCreatePayload>('POST', '/api/hub/tasks', {
    project_id: createdSpaceId,
    source_project_id: firstProjectId,
    title: taskTitle,
    status: 'todo',
    priority: 'high',
    due_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    category: 'rename-trace',
  });
  const taskRecordId = getString(taskData.task?.record_id, 'task.record_id');

  const reminderData = await client.expectData<ReminderCreatePayload>('POST', '/api/hub/reminders', {
    scope: 'project',
    project_id: createdSpaceId,
    source_project_id: firstProjectId,
    title: reminderTitle,
    remind_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
  });
  const reminderRecordId = getString(reminderData.reminder?.record_id, 'reminder.record_id');

  await client.expectData<{ doc_id: string; snapshot_version: number }>('PUT', `/api/hub/docs/${encodeURIComponent(firstDocId)}`, {
    snapshot_payload: makeLexicalSnapshot(docText),
  });

  const collectionData = await client.expectData<CollectionCreatePayload>('POST', `/api/hub/spaces/${encodeURIComponent(createdSpaceId)}/collections`, {
    name: collectionName,
  });
  const collectionId = getString(collectionData.collection_id, 'collection_id');
  const recordData = await client.expectData<RecordCreatePayload>('POST', `/api/hub/spaces/${encodeURIComponent(createdSpaceId)}/records`, {
    collection_id: collectionId,
    title: recordTitle,
    source_project_id: firstProjectId,
  });
  const recordId = getString(recordData.record_id, 'record_id');
  const viewData = await client.expectData<ViewCreatePayload>('POST', `/api/hub/spaces/${encodeURIComponent(createdSpaceId)}/views`, {
    collection_id: collectionId,
    type: 'table',
    name: collectionName,
    mutation_context_project_id: firstProjectId,
  });
  const viewId = getString(viewData.view_id, 'view_id');

  await client.expectData<WorkProjectPayload>('PATCH', `/api/hub/projects/${encodeURIComponent(firstProjectId)}`, {
    layout_config: {
      modules_enabled: true,
      workspace_enabled: true,
      doc_binding_mode: 'owned',
      modules: [
        { module_instance_id: `tasks-${idSuffix}`, module_type: 'tasks', size_tier: 'M', lens: 'project' },
        { module_instance_id: `reminders-${idSuffix}`, module_type: 'reminders', size_tier: 'M', lens: 'project' },
        { module_instance_id: `files-${idSuffix}`, module_type: 'files', size_tier: 'M', lens: 'project' },
        {
          module_instance_id: `table-${idSuffix}`,
          module_type: 'table',
          size_tier: 'M',
          lens: 'project',
          binding: { view_id: viewId },
        },
      ],
    },
  });

  const assetRoots = await client.expectData<{ asset_roots: Array<{ asset_root_id?: string }> }>(
    'GET',
    `/api/hub/spaces/${encodeURIComponent(createdSpaceId)}/asset-roots`,
  );
  const assetRootId = getString(assetRoots.asset_roots[0]?.asset_root_id, 'asset_roots[0].asset_root_id');
  await client.expectData<unknown>('POST', '/api/hub/attachments', {
    space_id: createdSpaceId,
    source_project_id: firstProjectId,
    entity_type: 'record',
    entity_id: recordId,
    provider: 'nextcloud',
    asset_root_id: assetRootId,
    asset_path: `References/${runId}.txt`,
    name: `rename-trace-${runId}.txt`,
    mime_type: 'text/plain',
    size_bytes: 32,
    metadata: {
      scope: 'project',
      project_id: firstProjectId,
    },
  });

  await client.expectData<unknown>('POST', '/api/hub/chat/snapshots', {
    space_id: createdSpaceId,
    conversation_room_id: `!rename-trace-${idSuffix}:local`,
    message_sender_display_name: 'Rename Trace',
    message_text: `Rename trace chat ${runId}`,
    message_timestamp: new Date().toISOString(),
  });

  return {
    runId,
    spaceId: createdSpaceId,
    spaceName,
    firstProjectId,
    firstProjectName,
    firstDocId,
    secondProjectId,
    secondProjectName,
    taskRecordId,
    taskTitle,
    reminderTitle,
    reminderRecordId,
    collectionId,
    collectionName,
    recordId,
    recordTitle,
    viewId,
    docText,
  };
};

const endpoint = (
  name: string,
  method: 'GET' | 'POST',
  path: string,
  body?: Record<string, unknown>,
): { name: string; method: 'GET' | 'POST'; path: string; body?: Record<string, unknown> } => ({ name, method, path, body });

const traceEndpoint = async (
  client: TraceApiClient,
  item: { name: string; method: 'GET' | 'POST'; path: string; body?: Record<string, unknown> },
  spaceId: string,
  projectIds: string[],
): Promise<EndpointReport> => {
  const response = await client.request(item.method, item.path, item.body);
  const dumpFile = `${reportName(item.name)}.json`;
  await writeJson(dumpFile, response.payload);
  const findings = response.ok ? findIdConfusion(response.payload, spaceId, projectIds) : [];
  return {
    name: item.name,
    method: item.method,
    path: item.path,
    dumpFile,
    status: response.status,
    ok: response.ok,
    unavailable: response.status === 404 || response.status === 405,
    findings,
  };
};

const dumpUiStep = async (page: Page, name: string, checks: Array<() => Promise<string | null>>): Promise<UiStepReport> => {
  const dumpFile = `${reportName(name)}.html`;
  await writeText(dumpFile, await page.content());
  const findings: string[] = [];
  for (const check of checks) {
    const finding = await check();
    if (finding) {
      findings.push(finding);
    }
  }
  return {
    name,
    dumpFile,
    passed: findings.length === 0,
    findings,
  };
};

const pageContains = async (page: Page, text: string): Promise<boolean> => {
  const content = await page.content();
  return content.includes(text);
};

const waitForSettledPage = async (page: Page): Promise<void> => {
  await page.waitForLoadState('domcontentloaded', { timeout: LIVE_TIMEOUT_MS }).catch(() => undefined);
  await page.waitForLoadState('networkidle', { timeout: LIVE_TIMEOUT_MS }).catch(() => undefined);
};

const navigateOrClick = async (page: Page, href: string): Promise<void> => {
  const link = page.locator(`a[href="${href}"]`).first();
  if (await link.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await link.click();
  } else {
    await page.goto(href, { waitUntil: 'domcontentloaded', timeout: LIVE_TIMEOUT_MS });
  }
  await waitForSettledPage(page);
};

const parseProjectRouteIds = (pathname: string): { spaceId: string | null; projectId: string | null } => {
  const match = pathname.match(/^\/projects\/([^/]+)\/work\/([^/?#]+)/);
  return {
    spaceId: match ? decodeURIComponent(match[1]) : null,
    projectId: match ? decodeURIComponent(match[2]) : null,
  };
};

const writeSummary = async (
  endpoints: EndpointReport[],
  uiSteps: UiStepReport[],
  findings: ReportFinding[],
): Promise<void> => {
  const lines: string[] = [
    '# Rename Trace Summary',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## API Endpoints',
    '',
    '| Endpoint | Status | Dump | Findings |',
    '|---|---:|---|---:|',
  ];

  for (const item of endpoints) {
    const status = item.unavailable ? `${item.status} unavailable` : `${item.status}${item.ok ? '' : ' failed'}`;
    lines.push(`| ${item.method} ${item.path} | ${status} | ${item.dumpFile} | ${item.findings.length} |`);
  }

  lines.push('', '## UI Steps', '', '| Step | Result | Dump | Findings |', '|---|---|---|---:|');
  for (const item of uiSteps) {
    lines.push(`| ${item.name} | ${item.passed ? 'passed' : 'failed'} | ${item.dumpFile} | ${item.findings.length} |`);
  }

  lines.push('', '## Findings', '');
  if (findings.length === 0 && uiSteps.every((step) => step.findings.length === 0)) {
    lines.push('No ID confusion findings.');
  } else {
    for (const finding of findings) {
      lines.push(`- ${finding.source}: ${finding.path} = \`${finding.value}\`; expected ${finding.expected}.`);
    }
    for (const step of uiSteps) {
      for (const finding of step.findings) {
        lines.push(`- ${step.name}: ${finding}`);
      }
    }
  }

  await writeText('SUMMARY.md', lines.join('\n'));
};

test('rename refactor space/project ID trace reporter', async ({ page }) => {
  test.setTimeout(180_000);
  await rm(REPORT_DIR, { recursive: true, force: true });
  await mkdir(REPORT_DIR, { recursive: true });

  const token = readTokenAFromFile();
  const client = new TraceApiClient(normalizeApiBaseUrl(), token);
  const fixture = await createFixture(client);
  const projectIds = [fixture.firstProjectId, fixture.secondProjectId];
  const endpoints: EndpointReport[] = [];
  const uiSteps: UiStepReport[] = [];
  const allFindings: ReportFinding[] = [];

  const endpointItems = [
    endpoint('space list', 'GET', '/api/hub/spaces'),
    endpoint('space detail', 'GET', `/api/hub/spaces/${encodeURIComponent(fixture.spaceId)}`),
    endpoint('project list', 'GET', `/api/hub/spaces/${encodeURIComponent(fixture.spaceId)}/projects`),
    endpoint('requested project detail', 'GET', `/api/hub/projects/${encodeURIComponent(fixture.firstProjectId)}`),
    endpoint('actual project doc detail', 'GET', `/api/hub/docs/${encodeURIComponent(fixture.firstDocId)}`),
    endpoint('search project', 'GET', `/api/hub/search?q=${encodeURIComponent(fixture.firstProjectName)}&type=project`),
    endpoint('search record', 'GET', `/api/hub/search?q=${encodeURIComponent(fixture.recordTitle)}&type=record`),
    endpoint('requested project tasks', 'GET', `/api/hub/projects/${encodeURIComponent(fixture.firstProjectId)}/tasks`),
    endpoint('actual project tasks', 'GET', `/api/hub/tasks?lens=project&space_id=${encodeURIComponent(fixture.spaceId)}&project_id=${encodeURIComponent(fixture.firstProjectId)}&limit=50`),
    endpoint('space task list', 'GET', `/api/hub/spaces/${encodeURIComponent(fixture.spaceId)}/tasks?limit=50`),
    endpoint('requested project reminders', 'GET', `/api/hub/projects/${encodeURIComponent(fixture.firstProjectId)}/reminders`),
    endpoint('actual project reminders', 'GET', `/api/hub/reminders?scope=project&space_id=${encodeURIComponent(fixture.spaceId)}&project_id=${encodeURIComponent(fixture.firstProjectId)}&limit=50`),
    endpoint('requested project collections', 'GET', `/api/hub/projects/${encodeURIComponent(fixture.firstProjectId)}/collections`),
    endpoint('actual collections', 'GET', `/api/hub/spaces/${encodeURIComponent(fixture.spaceId)}/collections`),
    endpoint('requested collection records', 'GET', `/api/hub/projects/${encodeURIComponent(fixture.firstProjectId)}/collections/${encodeURIComponent(fixture.collectionId)}/records`),
    endpoint('actual view records', 'POST', '/api/hub/views/query', { view_id: fixture.viewId, pagination: { limit: 50 } }),
    endpoint('requested project docs', 'GET', `/api/hub/projects/${encodeURIComponent(fixture.firstProjectId)}/docs`),
    endpoint('requested project files', 'GET', `/api/hub/projects/${encodeURIComponent(fixture.firstProjectId)}/files`),
    endpoint('actual project files', 'GET', `/api/hub/spaces/${encodeURIComponent(fixture.spaceId)}/files?scope=project&project_id=${encodeURIComponent(fixture.firstProjectId)}`),
    endpoint('requested space chat snapshots', 'GET', `/api/hub/spaces/${encodeURIComponent(fixture.spaceId)}/chat/snapshots`),
    endpoint('actual chat snapshots', 'GET', `/api/hub/chat/snapshots?space_id=${encodeURIComponent(fixture.spaceId)}&limit=50`),
    endpoint('me', 'GET', '/api/hub/me'),
    endpoint('notifications', 'GET', '/api/hub/notifications?limit=100'),
    endpoint('timeline', 'GET', `/api/hub/spaces/${encodeURIComponent(fixture.spaceId)}/timeline?limit=100`),
    endpoint('record detail with attachment', 'GET', `/api/hub/records/${encodeURIComponent(fixture.recordId)}`),
    endpoint('task record detail', 'GET', `/api/hub/records/${encodeURIComponent(fixture.taskRecordId)}`),
    endpoint('reminder record detail', 'GET', `/api/hub/records/${encodeURIComponent(fixture.reminderRecordId)}`),
  ];

  for (const item of endpointItems) {
    const report = await traceEndpoint(client, item, fixture.spaceId, projectIds);
    endpoints.push(report);
    for (const finding of report.findings) {
      allFindings.push({ ...finding, source: report.name });
    }
  }

  await writeJson('api-findings.json', endpoints.map(({ name, path, status, findings }) => ({ name, path, status, findings })));

  await authenticateAsUserA(page);
  await page.goto('/projects', { waitUntil: 'domcontentloaded', timeout: LIVE_TIMEOUT_MS });
  await waitForSettledPage(page);
  uiSteps.push(await dumpUiStep(page, 'sidebar', [
    async () => (await pageContains(page, fixture.spaceName) ? null : `Expected sidebar/page HTML to include ${fixture.spaceName}.`),
  ]));

  await navigateOrClick(page, `/projects/${encodeURIComponent(fixture.spaceId)}/overview`);
  uiSteps.push(await dumpUiStep(page, 'space detail', [
    async () => (await pageContains(page, fixture.firstProjectName) ? null : `Expected first work project ${fixture.firstProjectName}.`),
    async () => (await pageContains(page, fixture.secondProjectName) ? null : `Expected second work project ${fixture.secondProjectName}.`),
  ]));

  await navigateOrClick(page, `/projects/${encodeURIComponent(fixture.spaceId)}/work/${encodeURIComponent(fixture.firstProjectId)}`);
  uiSteps.push(await dumpUiStep(page, 'first project', [
    async () => (await pageContains(page, fixture.firstProjectName) ? null : `Expected active project ${fixture.firstProjectName}.`),
    async () => (await pageContains(page, fixture.taskTitle) ? null : `Expected task content ${fixture.taskTitle}.`),
    async () => (await pageContains(page, fixture.reminderTitle) ? null : `Expected reminder content ${fixture.reminderTitle}.`),
    async () => (await pageContains(page, fixture.recordTitle) ? null : `Expected table record content ${fixture.recordTitle}.`),
    async () => (await pageContains(page, fixture.docText) ? null : `Expected doc content ${fixture.docText}.`),
  ]));

  await page.goto(`/projects/${encodeURIComponent(fixture.spaceId)}/work/${encodeURIComponent(fixture.secondProjectId)}`, {
    waitUntil: 'domcontentloaded',
    timeout: LIVE_TIMEOUT_MS,
  });
  await waitForSettledPage(page);
  uiSteps.push(await dumpUiStep(page, 'second project', [
    async () => (await pageContains(page, fixture.secondProjectName) ? null : `Expected active project ${fixture.secondProjectName}.`),
    async () => (await pageContains(page, fixture.taskTitle) ? `First project task leaked into second project: ${fixture.taskTitle}.` : null),
    async () => (await pageContains(page, fixture.reminderTitle) ? `First project reminder leaked into second project: ${fixture.reminderTitle}.` : null),
    async () => (await pageContains(page, fixture.recordTitle) ? `First project table record leaked into second project: ${fixture.recordTitle}.` : null),
  ]));

  await page.goto(
    `/projects/${encodeURIComponent(fixture.spaceId)}/work/${encodeURIComponent(fixture.firstProjectId)}?record_id=${encodeURIComponent(fixture.taskRecordId)}`,
    { waitUntil: 'domcontentloaded', timeout: LIVE_TIMEOUT_MS },
  );
  await waitForSettledPage(page);
  uiSteps.push(await dumpUiStep(page, 'task route', [
    async () => {
      const ids = parseProjectRouteIds(new URL(page.url()).pathname);
      if (ids.spaceId !== fixture.spaceId || ids.projectId !== fixture.firstProjectId) {
        return `Expected URL /projects/${fixture.spaceId}/work/${fixture.firstProjectId}; got ${new URL(page.url()).pathname}.`;
      }
      return null;
    },
    async () => {
      if (!STRICT_TASK_RECORD_QUERY) {
        return null;
      }
      const actualRecordId = new URL(page.url()).searchParams.get('record_id');
      return actualRecordId === fixture.taskRecordId ? null : `Expected record_id=${fixture.taskRecordId} in task URL.`;
    },
  ]));

  const notificationsVisible = await page.getByText(/notification/i).first().isVisible({ timeout: 1_000 }).catch(() => false);
  if (notificationsVisible) {
    uiSteps.push(await dumpUiStep(page, 'notifications', [
      async () => {
        const html = await page.content();
        const wrongSpaceSegment = projectIds.some((projectId) => html.includes(`/projects/${encodeURIComponent(projectId)}/work`));
        if (wrongSpaceSegment) {
          return 'Notification links include a work-project ID in the space route segment.';
        }
        const wrongProjectSegment = html.includes(`/projects/${encodeURIComponent(fixture.spaceId)}/work/${encodeURIComponent(fixture.spaceId)}`);
        return wrongProjectSegment ? 'Notification links include the space ID in the work-project route segment.' : null;
      },
    ]));
  } else {
    const dumpFile = 'notifications.html';
    await writeText(dumpFile, await page.content());
    uiSteps.push({ name: 'notifications', dumpFile, passed: true, findings: [] });
  }

  await writeSummary(endpoints, uiSteps, allFindings);

  const uiFindingCount = uiSteps.reduce((count, step) => count + step.findings.length, 0);
  if (allFindings.length > 0 || uiFindingCount > 0) {
    throw new Error(`Rename trace found ${allFindings.length} API ID findings and ${uiFindingCount} UI findings. See ${REPORT_DIR}/SUMMARY.md.`);
  }
});
