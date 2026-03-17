/* global fetch */

const baseUrl = (process.env.HUB_BASE_URL || 'https://eshaansood.org').replace(/\/$/, '');
const fixtureToken = (process.env.HUB_OWNER_ACCESS_TOKEN || process.env.HUB_ACCESS_TOKEN || '').trim();
const projectId = (process.env.HUB_PROJECT_ID || '').trim();
const projectName = (process.env.HUB_PROJECT_NAME || '').trim();
const requestTimeoutMsRaw = Number(process.env.HUB_REQUEST_TIMEOUT_MS || '15000');
const requestTimeoutMs = Number.isFinite(requestTimeoutMsRaw) && requestTimeoutMsRaw > 0 ? Math.floor(requestTimeoutMsRaw) : 15000;

if (!fixtureToken) {
  console.error('BLOCKING INPUTS REQUIRED: HUB_OWNER_ACCESS_TOKEN or HUB_ACCESS_TOKEN is required.');
  process.exit(1);
}

if (!projectId) {
  console.error('BLOCKING INPUTS REQUIRED: HUB_PROJECT_ID is required.');
  process.exit(1);
}

if (!projectName) {
  console.error('BLOCKING INPUTS REQUIRED: HUB_PROJECT_NAME is required.');
  process.exit(1);
}

const requestJson = async (path, { method = 'GET', body } = {}) => {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${fixtureToken}`,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const payload = await response.json().catch(() => null);
    return {
      status: response.status,
      payload,
      contentType: (response.headers.get('content-type') || '').toLowerCase(),
    };
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'AbortError';
    return {
      status: -1,
      payload: null,
      contentType: '',
      networkError: timedOut ? `request timed out after ${String(requestTimeoutMs)}ms` : error instanceof Error ? error.message : 'unknown network error',
    };
  } finally {
    clearTimeout(timeoutHandle);
  }
};

const fail = (message) => {
  console.error(message);
  process.exit(1);
};

const projects = await requestJson('/api/hub/projects');
if (projects.status !== 200) {
  fail(`GET /api/hub/projects failed (${projects.status})${projects.networkError ? `: ${projects.networkError}` : ''}.`);
}

const list = Array.isArray(projects.payload?.data?.projects) ? projects.payload.data.projects : [];
const existing = list.find((project) => {
  const id = String(project?.id || project?.project_id || '').trim();
  return id === projectId;
});

if (existing) {
  console.log(`Fixture project already exists: ${projectId}`);
  process.exit(0);
}

const created = await requestJson('/api/hub/projects', {
  method: 'POST',
  body: {
    project_id: projectId,
    name: projectName,
  },
});

if (created.status === 409) {
  console.log(`Fixture project already exists (conflict): ${projectId}`);
  process.exit(0);
}

if (!(created.status === 200 || created.status === 201)) {
  fail(`POST /api/hub/projects failed (${created.status})${created.networkError ? `: ${created.networkError}` : ''}.`);
}

console.log(`Fixture project created: ${projectId}`);
