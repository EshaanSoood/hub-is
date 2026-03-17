/* global fetch */

import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const baseUrl = (process.env.HUB_BASE_URL || 'https://eshaansood.org').replace(/\/$/, '');
const expectedWsUrl = (process.env.HUB_COLLAB_WS_URL_EXPECTED || 'wss://collab.eshaansood.org').replace(/\/$/, '');
const projectId = (process.env.HUB_PROJECT_ID || 'backend-pilot').trim();
const collabReadyUrl = process.env.HUB_COLLAB_READY_URL || (() => {
  try {
    const parsed = new URL(expectedWsUrl.replace(/^ws/i, 'http'));
    return `${parsed.origin}/readyz`;
  } catch {
    return '';
  }
})();
const sidecarSecret = process.env.HUB_COLLAB_TOKEN_SECRET_SIDECAR || '';
const socketSecret = process.env.HUB_COLLAB_TOKEN_SECRET_SOCKET || '';
const requestTimeoutMsRaw = Number(process.env.HUB_REQUEST_TIMEOUT_MS || '15000');
const requestTimeoutMs = Number.isFinite(requestTimeoutMsRaw) && requestTimeoutMsRaw > 0 ? Math.floor(requestTimeoutMsRaw) : 15000;

const fail = (message) => {
  console.error(message);
  process.exit(1);
};

const assert = (condition, message) => {
  if (!condition) {
    fail(message);
  }
};

const readEnvValueFromFile = async (filename, key) => {
  try {
    const content = await readFile(path.join(root, filename), 'utf8');
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }
      const separatorIndex = trimmed.indexOf('=');
      if (separatorIndex <= 0) {
        continue;
      }
      const name = trimmed.slice(0, separatorIndex).trim();
      const rawValue = trimmed.slice(separatorIndex + 1).trim();
      const value = rawValue.replace(/^['"]|['"]$/g, '');
      if (name === key) {
        return value;
      }
    }
  } catch {
    return null;
  }

  return null;
};

const request = async (target) => {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => {
    controller.abort();
  }, requestTimeoutMs);

  try {
    const response = await fetch(target, { signal: controller.signal });
    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    const rawBody = await response.text();
    let payload = {};
    if (rawBody) {
      try {
        payload = JSON.parse(rawBody);
      } catch {
        payload = {};
      }
    }
    return { status: response.status, payload, contentType, rawBody };
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'AbortError';
    return {
      status: -1,
      payload: {},
      contentType: '',
      rawBody: '',
      networkError: timedOut ? `request timed out after ${String(requestTimeoutMs)}ms` : error instanceof Error ? error.message : 'unknown network error',
    };
  } finally {
    clearTimeout(timeoutHandle);
  }
};

const assertApiSurface = (label, response, allowedStatuses) => {
  const expected = allowedStatuses.join('|');
  assert(
    allowedStatuses.includes(response.status),
    `${label} returned status=${response.status}${response.networkError ? ` network_error=${response.networkError}` : ''} expected=${expected}.`,
  );
  assert(
    !response.contentType.includes('text/html'),
    `${label} returned HTML fallback (content-type=${response.contentType || 'missing'}).`,
  );
};

if ((sidecarSecret && !socketSecret) || (!sidecarSecret && socketSecret)) {
  fail('BLOCKING INPUTS REQUIRED: provide both HUB_COLLAB_TOKEN_SECRET_SIDECAR and HUB_COLLAB_TOKEN_SECRET_SOCKET to verify secret parity.');
}

if (!sidecarSecret || !socketSecret) {
  console.log('Secret parity check skipped: set HUB_COLLAB_TOKEN_SECRET_SIDECAR and HUB_COLLAB_TOKEN_SECRET_SOCKET to validate exact match.');
} else {
  assert(
    sidecarSecret === socketSecret,
    'Secret parity failed: HUB_COLLAB_TOKEN_SECRET differs between sidecar and collab service.',
  );
  console.log('Secret parity check passed.');
}

const health = await request(`${baseUrl}/api/hub/health`);
assertApiSurface('GET /api/hub/health', health, [200]);

const mintedWsUrl = String(
  health.payload?.collaborationWebsocketUrl
    || health.payload?.collaboration_ws_url
    || '',
).replace(/\/$/, '');
if (!mintedWsUrl) {
  console.log('Hub-side WS URL parity check skipped: /api/hub/health does not expose collaboration WS URL on this build.');
} else {
  assert(mintedWsUrl === expectedWsUrl, `Hub WS URL mismatch: expected=${expectedWsUrl} actual=${mintedWsUrl}`);
  console.log('Hub-side WS URL parity check passed.');
}

assert(collabReadyUrl, 'Collab ready URL is required. Set HUB_COLLAB_READY_URL or provide a valid HUB_COLLAB_WS_URL_EXPECTED.');
const collabReady = await request(collabReadyUrl);
assertApiSurface(`GET ${collabReadyUrl}`, collabReady, [200]);
console.log('Collab ready endpoint check passed.');

const me = await request(`${baseUrl}/api/hub/me`);
assertApiSurface('GET /api/hub/me', me, [200, 401, 403]);
console.log('/api/hub/me API surface check passed.');

const panes = await request(`${baseUrl}/api/hub/projects/${encodeURIComponent(projectId)}/panes`);
assertApiSurface(`GET /api/hub/projects/${projectId}/panes`, panes, [200, 401, 403]);
console.log(`/api/hub/projects/${projectId}/panes API surface check passed.`);

const envProductionWsUrl = (await readEnvValueFromFile('.env.production', 'VITE_HUB_COLLAB_WS_URL')) || '';
if (!envProductionWsUrl) {
  console.log('Frontend URL check skipped: .env.production missing VITE_HUB_COLLAB_WS_URL.');
} else {
  const normalized = envProductionWsUrl.replace(/\/$/, '');
  assert(
    normalized === expectedWsUrl,
    `Frontend WS URL mismatch in .env.production: expected=${expectedWsUrl} actual=${normalized}`,
  );
  console.log('Frontend .env.production WS URL parity check passed.');
}

console.log('Collab preflight checks passed.');
