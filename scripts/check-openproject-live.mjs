/* global fetch */

const hubBaseUrl = (process.env.HUB_BASE_URL || 'https://eshaansood.org').replace(/\/$/, '');
const memberToken = process.env.HUB_ACCESS_TOKEN || '';
const projectId = (process.env.HUB_OPENPROJECT_PROJECT_ID || process.env.HUB_PROJECT_ID || '').trim();
const shouldCleanup = process.env.HUB_OPENPROJECT_CLEANUP === '1';

const fail = (message) => {
  console.error(message);
  process.exit(1);
};

const assert = (condition, message) => {
  if (!condition) {
    fail(message);
  }
};

const request = async (path, { method = 'GET', body } = {}) => {
  const response = await fetch(`${hubBaseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${memberToken}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await response.json().catch(() => null);
  return { status: response.status, payload };
};

if (!memberToken) {
  fail('BLOCKING INPUTS REQUIRED: set HUB_ACCESS_TOKEN to run OpenProject live checks.');
}

if (!projectId) {
  fail('BLOCKING INPUTS REQUIRED: set HUB_OPENPROJECT_PROJECT_ID to a hub project id mapped to OpenProject.');
}

const encodedProjectId = encodeURIComponent(projectId);
const workPackagesPath = `/api/hub/spaces/${encodedProjectId}/openproject/work-packages`;

const health = await request('/api/hub/integrations/openproject/health');
assert(health.status === 200, `OpenProject health endpoint failed (${health.status}).`);
assert(health.payload?.ok === true, `OpenProject health reported not ok: ${JSON.stringify(health.payload)}`);

const listBefore = await request(workPackagesPath);
assert(listBefore.status === 200, `List work packages failed (${listBefore.status}).`);
assert(Array.isArray(listBefore.payload), 'List work packages payload must be an array.');

const testSubject = `TEST: openproject-live ${new Date().toISOString()}`;
const create = await request(workPackagesPath, {
  method: 'POST',
  body: {
    subject: testSubject,
    description: 'Created by scripts/check-openproject-live.mjs',
  },
});

assert(create.status === 200, `Create work package failed (${create.status}): ${JSON.stringify(create.payload)}`);
assert(create.payload && typeof create.payload === 'object', 'Create work package payload must be an object.');
assert(create.payload.id, 'Create work package payload missing id.');
assert(create.payload.subject === testSubject, 'Created work package subject mismatch.');

const listAfter = await request(workPackagesPath);
assert(listAfter.status === 200, `List-after-create failed (${listAfter.status}).`);
assert(Array.isArray(listAfter.payload), 'List-after-create payload must be an array.');

const createdId = String(create.payload.id);
const appearsInList = listAfter.payload.some((item) => String(item?.id || '') === createdId);
assert(appearsInList, `Created work package id=${createdId} not found in post-create listing.`);

if (shouldCleanup) {
  const deleted = await request(`${workPackagesPath}/${encodeURIComponent(createdId)}`, {
    method: 'DELETE',
  });
  assert(
    deleted.status === 200,
    `Delete work package failed (${deleted.status}): ${JSON.stringify(deleted.payload)}`,
  );
  assert(deleted.payload?.deleted === true, 'Delete work package response missing deleted=true.');

  const listAfterDelete = await request(workPackagesPath);
  assert(listAfterDelete.status === 200, `List-after-delete failed (${listAfterDelete.status}).`);
  assert(Array.isArray(listAfterDelete.payload), 'List-after-delete payload must be an array.');
  const stillExists = listAfterDelete.payload.some((item) => String(item?.id || '') === createdId);
  assert(!stillExists, `Deleted work package id=${createdId} is still present in listing.`);

  console.log(`OpenProject live checks passed. Created and cleaned up TEST work package id=${createdId}.`);
} else {
  console.log(`OpenProject live checks passed. Created TEST work package id=${createdId}.`);
  console.log('Cleanup skipped by default; set HUB_OPENPROJECT_CLEANUP=1 to auto-delete the created TEST item.');
}
