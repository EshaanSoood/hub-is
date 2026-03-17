/* global fetch */

const hubBaseUrl = (process.env.HUB_BASE_URL || 'https://eshaansood.org').replace(/\/$/, '');
const accessToken = process.env.HUB_OWNER_ACCESS_TOKEN || process.env.HUB_ACCESS_TOKEN || '';
const projectId = (process.env.HUB_NEXTCLOUD_PROJECT_ID || process.env.HUB_PROJECT_ID || '').trim();
const testPrefix = 'TEST-nextcloud-';

const fail = (message) => {
  console.error(message);
  process.exit(1);
};

if (!accessToken) {
  fail('BLOCKING INPUTS REQUIRED: set HUB_OWNER_ACCESS_TOKEN or HUB_ACCESS_TOKEN.');
}

if (!projectId) {
  fail('BLOCKING INPUTS REQUIRED: set HUB_NEXTCLOUD_PROJECT_ID to a mapped hub project id.');
}

const requestJson = async (path, { method = 'GET' } = {}) => {
  const response = await fetch(`${hubBaseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const payload = await response.json().catch(() => null);
  return { status: response.status, payload };
};

const basename = (pathValue) => {
  if (typeof pathValue !== 'string') {
    return '';
  }

  const parts = pathValue.split('/').filter(Boolean);
  return parts[parts.length - 1] || '';
};

const encodedProjectId = encodeURIComponent(projectId);
const listPath = `/api/hub/projects/${encodedProjectId}/nextcloud/files`;
const deletePath = `/api/hub/projects/${encodedProjectId}/nextcloud/files`;

const listed = await requestJson(listPath);
if (listed.status !== 200 || !Array.isArray(listed.payload)) {
  fail(`Nextcloud list failed (${listed.status}): ${JSON.stringify(listed.payload)}`);
}

const candidates = listed.payload.filter((entry) => {
  if (!entry || entry.isDir === true || typeof entry.path !== 'string') {
    return false;
  }

  return basename(entry.path).startsWith(testPrefix);
});

let deleted = 0;
let failed = 0;
let skipped = listed.payload.length - candidates.length;

for (const entry of candidates) {
  const relativePath = entry.path;
  const response = await requestJson(`${deletePath}?path=${encodeURIComponent(relativePath)}`, {
    method: 'DELETE',
  });

  if (response.status === 200 && response.payload?.ok === true) {
    deleted += 1;
    console.log(`deleted ${relativePath}`);
    continue;
  }

  failed += 1;
  console.error(`failed ${relativePath} (${response.status}): ${JSON.stringify(response.payload)}`);
}

console.log(`summary deleted=${deleted} skipped=${skipped} failed=${failed}`);

if (failed > 0) {
  process.exit(1);
}
