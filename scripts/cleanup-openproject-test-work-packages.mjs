/* global fetch */

const hubBaseUrl = (process.env.HUB_BASE_URL || 'https://eshaansood.org').replace(/\/$/, '');
const token = process.env.HUB_OWNER_ACCESS_TOKEN || process.env.HUB_ACCESS_TOKEN || '';
const projectId = (process.env.HUB_OPENPROJECT_PROJECT_ID || process.env.HUB_PROJECT_ID || '').trim();

const fail = (message) => {
  console.error(message);
  process.exit(1);
};

const request = async (path, { method = 'GET', body } = {}) => {
  const response = await fetch(`${hubBaseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await response.json().catch(() => null);
  return { status: response.status, payload };
};

if (!token) {
  fail('BLOCKING INPUTS REQUIRED: set HUB_OWNER_ACCESS_TOKEN or HUB_ACCESS_TOKEN.');
}

if (!projectId) {
  fail('BLOCKING INPUTS REQUIRED: set HUB_OPENPROJECT_PROJECT_ID.');
}

const encodedProjectId = encodeURIComponent(projectId);
const workPackagesPath = `/api/hub/spaces/${encodedProjectId}/openproject/work-packages`;

const listed = await request(workPackagesPath);
if (listed.status !== 200 || !Array.isArray(listed.payload)) {
  fail(`List work packages failed (${listed.status}): ${JSON.stringify(listed.payload)}`);
}

let deleted = 0;
let skipped = 0;
let failed = 0;
const failures = [];

for (const item of listed.payload) {
  const id = String(item?.id || '').trim();
  const subject = typeof item?.subject === 'string' ? item.subject : '';

  if (!subject.startsWith('TEST:')) {
    skipped += 1;
    continue;
  }

  if (!id) {
    failed += 1;
    failures.push({ id: null, error: 'Missing work package id in list payload.' });
    continue;
  }

  const response = await request(`${workPackagesPath}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });

  if (response.status === 200 && response.payload?.deleted === true) {
    deleted += 1;
    continue;
  }

  failed += 1;
  failures.push({ id, status: response.status, error: response.payload?.error || 'Delete failed.' });
}

console.log(
  `OpenProject TEST cleanup finished. project=${projectId} deleted=${String(deleted)} skipped=${String(skipped)} failed=${String(failed)}`,
);

if (failures.length) {
  for (const entry of failures) {
    console.error(`delete_failure id=${entry.id || 'unknown'} status=${String(entry.status || 'n/a')} error=${entry.error}`);
  }
  process.exit(1);
}
