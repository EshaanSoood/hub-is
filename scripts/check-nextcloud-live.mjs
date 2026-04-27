/* global fetch, FormData, Blob */

import { TextEncoder } from 'node:util';

const hubBaseUrl = (process.env.HUB_BASE_URL || 'https://eshaansood.org').replace(/\/$/, '');
const memberToken = process.env.HUB_ACCESS_TOKEN || '';
const projectId = (process.env.HUB_NEXTCLOUD_PROJECT_ID || process.env.HUB_PROJECT_ID || '').trim();
const cleanupRequested = process.env.HUB_NEXTCLOUD_CLEANUP === '1';

const fail = (message) => {
  console.error(message);
  process.exit(1);
};

const assert = (condition, message) => {
  if (!condition) {
    fail(message);
  }
};

const requestJson = async (path, { method = 'GET', headers = {}, body } = {}) => {
  const response = await fetch(`${hubBaseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${memberToken}`,
      ...headers,
    },
    body,
  });

  const payload = await response.json().catch(() => null);
  return { status: response.status, payload };
};

if (!memberToken) {
  fail('BLOCKING INPUTS REQUIRED: set HUB_ACCESS_TOKEN to run Nextcloud live checks.');
}

if (!projectId) {
  fail('BLOCKING INPUTS REQUIRED: set HUB_NEXTCLOUD_PROJECT_ID to a hub project id mapped to Nextcloud.');
}

const encodedProjectId = encodeURIComponent(projectId);
const listFilesPath = `/api/hub/spaces/${encodedProjectId}/nextcloud/files`;
const uploadPath = `/api/hub/spaces/${encodedProjectId}/nextcloud/upload`;
const deletePath = `/api/hub/spaces/${encodedProjectId}/nextcloud/files`;

const health = await requestJson('/api/hub/integrations/nextcloud/health');
assert(health.status === 200, `Nextcloud health endpoint failed (${health.status}).`);
assert(health.payload?.ok === true, `Nextcloud health reported not ok: ${JSON.stringify(health.payload)}`);

const listBefore = await requestJson(listFilesPath);
assert(listBefore.status === 200, `Nextcloud list files failed (${listBefore.status}).`);
assert(Array.isArray(listBefore.payload), 'Nextcloud list files payload must be an array.');

const invalidTraversal = await requestJson(`${listFilesPath}?path=${encodeURIComponent('../')}`);
assert(invalidTraversal.status === 400, `Nextcloud traversal path should return 400, got ${invalidTraversal.status}.`);
assert(
  invalidTraversal.payload?.error === 'invalid_path',
  `Nextcloud traversal path should return error=invalid_path, got ${JSON.stringify(invalidTraversal.payload)}.`,
);

const timestamp = Date.now();
const testFilename = `TEST-nextcloud-${timestamp}.txt`;
const testContent = `nextcloud live test ${new Date(timestamp).toISOString()}\n`;

const form = new FormData();
form.append('file', new Blob([testContent], { type: 'text/plain' }), testFilename);

const upload = await requestJson(uploadPath, {
  method: 'POST',
  body: form,
});

assert(upload.status === 200, `Nextcloud upload failed (${upload.status}): ${JSON.stringify(upload.payload)}`);
assert(upload.payload && typeof upload.payload === 'object', 'Nextcloud upload payload must be an object.');
assert(upload.payload.ok === true, `Nextcloud upload payload missing ok=true: ${JSON.stringify(upload.payload)}`);

const uploadedPath = typeof upload.payload.path === 'string' ? upload.payload.path : testFilename;
const expectedSize = new TextEncoder().encode(testContent).byteLength;
if (typeof upload.payload.size === 'number') {
  assert(upload.payload.size === expectedSize, `Uploaded size mismatch: expected ${expectedSize}, got ${upload.payload.size}.`);
}

const listAfter = await requestJson(listFilesPath);
assert(listAfter.status === 200, `Nextcloud list-after-upload failed (${listAfter.status}).`);
assert(Array.isArray(listAfter.payload), 'Nextcloud list-after-upload payload must be an array.');

const found = listAfter.payload.some(
  (entry) => entry?.name === testFilename || entry?.path === uploadedPath,
);
assert(found, `Uploaded test file not found in listing (name=${testFilename}, path=${uploadedPath}).`);

if (cleanupRequested) {
  const remove = await requestJson(`${deletePath}?path=${encodeURIComponent(uploadedPath)}`, {
    method: 'DELETE',
  });
  assert(remove.status === 200, `Nextcloud cleanup delete failed (${remove.status}): ${JSON.stringify(remove.payload)}`);
  assert(remove.payload?.ok === true, `Nextcloud cleanup payload missing ok=true: ${JSON.stringify(remove.payload)}`);

  const listAfterDelete = await requestJson(listFilesPath);
  assert(listAfterDelete.status === 200, `Nextcloud list-after-delete failed (${listAfterDelete.status}).`);
  assert(Array.isArray(listAfterDelete.payload), 'Nextcloud list-after-delete payload must be an array.');
  const stillPresent = listAfterDelete.payload.some(
    (entry) => entry?.name === testFilename || entry?.path === uploadedPath,
  );
  assert(!stillPresent, `Cleanup delete did not remove uploaded test file path=${uploadedPath}.`);

  console.log(`Nextcloud live checks passed. Created and cleaned up TEST file path=${uploadedPath}.`);
} else {
  console.log(`Nextcloud live checks passed. Uploaded TEST file path=${uploadedPath}.`);
  console.log('Cleanup skipped by default; leave TEST file for manual cleanup if needed.');
}
