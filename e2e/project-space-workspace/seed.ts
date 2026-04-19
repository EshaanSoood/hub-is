import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { loadEnvFilesIntoProcess } from '../../scripts/dev/lib/env.mjs';

const execFileAsync = promisify(execFile);

interface Fixture {
  baseUrl: string;
  apiBaseUrl: string;
  project: {
    id: string;
    name: string;
  };
  paneIds: {
    main: string;
    private: string;
  };
  viewIds: {
    table: string;
    kanban: string;
  };
  recordTitle: string;
  eventTitle: string;
}

interface HubEnvelope<T> {
  ok: boolean;
  data: T | null;
  error?: {
    code?: string;
    message?: string;
  } | null;
}

const currentDir = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = resolve(currentDir, '..', '..');
const fixturePath = resolve(currentDir, 'fixture.json');
const playwrightStateDir = resolve(repoRoot, '.playwright');
const ownerStatePath = resolve(playwrightStateDir, 'project-space-owner-storage-state.json');

const normalizeUrl = (value: string): string => value.trim().replace(/\/+$/, '');

const parseJson = <T>(raw: string): T | null => {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const hubRequest = async <T>(
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
  const parsed = parseJson<HubEnvelope<T> | T>(raw);
  const envelope = parsed && typeof parsed === 'object' && 'ok' in parsed ? (parsed as HubEnvelope<T>) : null;

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

const createProject = async (baseUrl: string, token: string, name: string) =>
  hubRequest<{ project: { project_id: string; name: string } }>(baseUrl, token, '/api/hub/projects', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });

const createCollection = async (baseUrl: string, token: string, projectId: string, name: string) =>
  hubRequest<{ collection_id: string }>(baseUrl, token, `/api/hub/projects/${encodeURIComponent(projectId)}/collections`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });

const createField = async (baseUrl: string, token: string, collectionId: string, payload: Record<string, unknown>) =>
  hubRequest<{ field_id: string }>(baseUrl, token, `/api/hub/collections/${encodeURIComponent(collectionId)}/fields`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

const createView = async (baseUrl: string, token: string, projectId: string, payload: Record<string, unknown>) =>
  hubRequest<{ view_id: string }>(baseUrl, token, `/api/hub/projects/${encodeURIComponent(projectId)}/views`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

const createPane = async (
  baseUrl: string,
  token: string,
  projectId: string,
  payload: { name: string; member_user_ids: string[]; layout_config: Record<string, unknown> },
) =>
  hubRequest<{ pane: { pane_id: string; doc_id: string | null } }>(baseUrl, token, `/api/hub/projects/${encodeURIComponent(projectId)}/panes`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

const createRecord = async (baseUrl: string, token: string, projectId: string, payload: Record<string, unknown>) =>
  hubRequest<{ record_id: string }>(baseUrl, token, `/api/hub/projects/${encodeURIComponent(projectId)}/records`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

const createEventFromNlp = async (
  baseUrl: string,
  token: string,
  projectId: string,
  payload: Record<string, unknown>,
) =>
  hubRequest<{ record: { record_id: string } }>(baseUrl, token, `/api/hub/projects/${encodeURIComponent(projectId)}/events/from-nlp`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

async function globalSetup(): Promise<void> {
  await loadEnvFilesIntoProcess(['.env.hub-api.local', '.env.local.users.local'], { override: true });
  await execFileAsync('node', ['scripts/dev/ensure-local-users.mjs'], { cwd: repoRoot });
  await execFileAsync('node', ['scripts/dev/mint-local-tokens.mjs'], { cwd: repoRoot });
  await loadEnvFilesIntoProcess(['.env.local.tokens.local'], { override: true });

  const baseUrl = normalizeUrl(process.env.HUB_PUBLIC_APP_URL || process.env.E2E_BASE_URL || 'http://127.0.0.1:5173');
  const apiBaseUrl = normalizeUrl(process.env.HUB_API_BASE_URL || 'http://127.0.0.1:3001');
  const ownerToken = String(process.env.HUB_OWNER_ACCESS_TOKEN || '').trim();

  if (!ownerToken) {
    throw new Error('HUB_OWNER_ACCESS_TOKEN missing after minting local tokens.');
  }

  const runId = `workspace-${Date.now().toString(36)}`;
  const projectName = `ProjectSpace Workspace ${runId}`;

  const project = await createProject(apiBaseUrl, ownerToken, projectName);
  const collection = await createCollection(apiBaseUrl, ownerToken, project.project.project_id, `Workspace Records ${runId}`);
  const statusField = await createField(apiBaseUrl, ownerToken, collection.collection_id, {
    name: 'Status',
    type: 'select',
    sort_order: 1,
    config: { options: ['todo', 'doing', 'done'] },
  });

  const tableView = await createView(apiBaseUrl, ownerToken, project.project.project_id, {
    collection_id: collection.collection_id,
    type: 'table',
    name: `Workspace Table ${runId}`,
    config: { visible_field_ids: [statusField.field_id] },
  });
  const kanbanView = await createView(apiBaseUrl, ownerToken, project.project.project_id, {
    collection_id: collection.collection_id,
    type: 'kanban',
    name: `Workspace Kanban ${runId}`,
    config: { group_by_field_id: statusField.field_id },
  });

  const mainPane = await createPane(apiBaseUrl, ownerToken, project.project.project_id, {
    name: `Verify Main Pane ${runId}`,
    member_user_ids: [],
    layout_config: {
      modules_enabled: true,
      workspace_enabled: true,
      modules: [
        {
          module_instance_id: `table-${runId}`,
          module_type: 'table',
          size_tier: 'L',
          lens: 'project',
          binding: { view_id: tableView.view_id },
        },
        {
          module_instance_id: `kanban-${runId}`,
          module_type: 'kanban',
          size_tier: 'L',
          lens: 'project',
          binding: { view_id: kanbanView.view_id },
        },
      ],
    },
  });

  const privatePane = await createPane(apiBaseUrl, ownerToken, project.project.project_id, {
    name: `Verify Private Pane ${runId}`,
    member_user_ids: [],
    layout_config: {
      modules_enabled: true,
      workspace_enabled: true,
      modules: [
        {
          module_instance_id: `table-private-${runId}`,
          module_type: 'table',
          size_tier: 'M',
          lens: 'project',
          binding: { view_id: tableView.view_id },
        },
      ],
    },
  });

  const recordTitle = `Workspace Task ${runId}`;
  await createRecord(apiBaseUrl, ownerToken, project.project.project_id, {
    collection_id: collection.collection_id,
    title: recordTitle,
    source_pane_id: mainPane.pane.pane_id,
    values: {
      [statusField.field_id]: 'todo',
    },
    capability_types: ['task'],
    task_state: {
      status: 'todo',
      priority: 'medium',
      due_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    },
  });

  const eventTitle = `Workspace Event ${runId}`;
  const eventStart = new Date(Date.now() + 2 * 60 * 60 * 1000);
  const eventEnd = new Date(Date.now() + 3 * 60 * 60 * 1000);
  await createEventFromNlp(apiBaseUrl, ownerToken, project.project.project_id, {
    source_pane_id: mainPane.pane.pane_id,
    title: eventTitle,
    start_dt: eventStart.toISOString(),
    end_dt: eventEnd.toISOString(),
    timezone: 'America/New_York',
    location: 'Workspace Calendar',
    participants_user_ids: [],
  });

  const fixture: Fixture = {
    baseUrl,
    apiBaseUrl,
    project: {
      id: project.project.project_id,
      name: project.project.name,
    },
    paneIds: {
      main: mainPane.pane.pane_id,
      private: privatePane.pane.pane_id,
    },
    viewIds: {
      table: tableView.view_id,
      kanban: kanbanView.view_id,
    },
    recordTitle,
    eventTitle,
  };

  await mkdir(playwrightStateDir, { recursive: true });
  await writeFile(ownerStatePath, JSON.stringify(buildStorageStateForToken(baseUrl, ownerToken), null, 2), 'utf8');
  await writeFile(fixturePath, JSON.stringify(fixture, null, 2), 'utf8');
}

export default globalSetup;
