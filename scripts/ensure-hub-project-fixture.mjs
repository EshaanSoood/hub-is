/* global fetch */

const baseUrl = (process.env.HUB_BASE_URL || 'https://eshaansood.org').replace(/\/$/, '');
const fixtureToken = (process.env.HUB_OWNER_ACCESS_TOKEN || process.env.HUB_ACCESS_TOKEN || '').trim();
const spaceId = (process.env.HUB_PROJECT_ID || process.env.HUB_SPACE_ID || '').trim();
const spaceName = (process.env.HUB_PROJECT_NAME || process.env.HUB_SPACE_NAME || '').trim();
const requestTimeoutMsRaw = Number(process.env.HUB_REQUEST_TIMEOUT_MS || '15000');
const requestTimeoutMs = Number.isFinite(requestTimeoutMsRaw) && requestTimeoutMsRaw > 0 ? Math.floor(requestTimeoutMsRaw) : 15000;

if (!fixtureToken) {
  console.error('BLOCKING INPUTS REQUIRED: HUB_OWNER_ACCESS_TOKEN or HUB_ACCESS_TOKEN is required.');
  process.exit(1);
}

if (!spaceId) {
  console.error('BLOCKING INPUTS REQUIRED: HUB_PROJECT_ID or HUB_SPACE_ID is required.');
  process.exit(1);
}

if (!spaceName) {
  console.error('BLOCKING INPUTS REQUIRED: HUB_PROJECT_NAME or HUB_SPACE_NAME is required.');
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

const spaces = await requestJson('/api/hub/spaces');
if (spaces.status !== 200) {
  fail(`GET /api/hub/spaces failed (${spaces.status})${spaces.networkError ? `: ${spaces.networkError}` : ''}.`);
}

const list = Array.isArray(spaces.payload?.data?.spaces) ? spaces.payload.data.spaces : [];
const existing = list.find((space) => {
  const id = String(space?.id || space?.space_id || '').trim();
  return id === spaceId;
});

if (existing) {
  console.log(`Fixture space already exists: ${spaceId}`);
  process.exit(0);
}

const created = await requestJson('/api/hub/spaces', {
  method: 'POST',
  body: {
    space_id: spaceId,
    name: spaceName,
  },
});

if (created.status === 409) {
  console.log(`Fixture space already exists (conflict): ${spaceId}`);
  process.exit(0);
}

if (!(created.status === 200 || created.status === 201)) {
  fail(`POST /api/hub/spaces failed (${created.status})${created.networkError ? `: ${created.networkError}` : ''}.`);
}

console.log(`Fixture space created: ${spaceId}`);
