/* global fetch */

const hubBaseUrl = (process.env.HUB_BASE_URL || 'https://eshaansood.org').replace(/\/$/, '');
const ownerToken = process.env.HUB_OWNER_ACCESS_TOKEN || '';
const memberToken = process.env.HUB_ACCESS_TOKEN || '';
const nonMemberToken = process.env.HUB_NON_MEMBER_ACCESS_TOKEN || '';
const memberProjectId = (process.env.HUB_PROJECT_ID || '').trim();
let otherProjectId = (process.env.HUB_OTHER_PROJECT_ID || '').trim();
const requestTimeoutMsRaw = Number(process.env.HUB_REQUEST_TIMEOUT_MS || '15000');
const requestTimeoutMs = Number.isFinite(requestTimeoutMsRaw) && requestTimeoutMsRaw > 0 ? Math.floor(requestTimeoutMsRaw) : 15000;
const failOnSkipped = process.env.HUB_AUTHZ_FAIL_ON_SKIPPED === 'true';

const requiredEnv = [
  ['HUB_OWNER_ACCESS_TOKEN', ownerToken],
  ['HUB_ACCESS_TOKEN', memberToken],
  ['HUB_NON_MEMBER_ACCESS_TOKEN', nonMemberToken],
  ['HUB_PROJECT_ID', memberProjectId],
];

const missing = requiredEnv.filter(([, value]) => !value).map(([name]) => name);
if (missing.length > 0) {
  console.error(`BLOCKING INPUTS REQUIRED: missing ${missing.join(', ')}.`);
  process.exit(1);
}

const rows = [];

const addRow = (result, check, detail) => {
  rows.push({ result, check, detail });
};

const pass = (check, detail) => addRow('PASS', check, detail);
const fail = (check, detail) => addRow('FAIL', check, detail);
const skip = (check, detail) => addRow('SKIPPED', check, detail);

const requestJson = async (path, { method = 'GET', token = '', body } = {}) => {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => {
    controller.abort();
  }, requestTimeoutMs);

  try {
    const response = await fetch(`${hubBaseUrl}${path}`, {
      method,
      signal: controller.signal,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const payload = await response.json().catch(() => null);
    return { status: response.status, payload };
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'AbortError';
    return {
      status: -1,
      payload: null,
      networkError: timedOut ? `request timed out after ${String(requestTimeoutMs)}ms` : error instanceof Error ? error.message : 'unknown network error',
    };
  } finally {
    clearTimeout(timeoutHandle);
  }
};

const expectStatus = (check, response, expectedStatuses) => {
  const expected = Array.isArray(expectedStatuses) ? expectedStatuses : [expectedStatuses];
  if (expected.includes(response.status)) {
    pass(check, `status=${response.status}`);
    return true;
  }

  if (response.status === -1) {
    fail(check, `network_error=${response.networkError || 'unknown'} expected=${expected.join('|')}`);
    return false;
  }

  fail(check, `status=${response.status} expected=${expected.join('|')}`);
  return false;
};

const expectCondition = (check, condition, passDetail, failDetail) => {
  if (condition) {
    pass(check, passDetail);
    return true;
  }

  fail(check, failDetail);
  return false;
};

const responseData = (response) => response?.payload?.data ?? response?.payload ?? {};

const encodedProjectId = encodeURIComponent(memberProjectId);

const health = await requestJson('/api/hub/health');
expectStatus('GET /api/hub/health (no auth)', health, 200);

const ownerMe = await requestJson('/api/hub/me', { token: ownerToken });
expectStatus('GET /api/hub/me (owner)', ownerMe, 200);

const memberMe = await requestJson('/api/hub/me', { token: memberToken });
expectStatus('GET /api/hub/me (member)', memberMe, 200);

const nonMemberMe = await requestJson('/api/hub/me', { token: nonMemberToken });
expectStatus('GET /api/hub/me (non-member)', nonMemberMe, [200, 403]);

const ownerInvites = await requestJson('/api/hub/invites', { token: ownerToken });
expectStatus('GET /api/hub/invites (owner)', ownerInvites, [200, 404]);

const memberInvites = await requestJson('/api/hub/invites', { token: memberToken });
expectStatus('GET /api/hub/invites (member)', memberInvites, [403, 404]);

const memberProjects = await requestJson('/api/hub/projects', { token: memberToken });
const hasProjectsPayload = expectStatus('GET /api/hub/projects (member)', memberProjects, 200);
const memberProjectsData = responseData(memberProjects);
const memberProjectRows = hasProjectsPayload && Array.isArray(memberProjectsData?.projects)
  ? memberProjectsData.projects
  : [];

expectCondition(
  'Member project list includes HUB_PROJECT_ID',
  memberProjectRows.some((project) => {
    const id = String(project?.project_id || project?.id || '').trim();
    return id === memberProjectId;
  }),
  `found=${memberProjectId}`,
  `missing=${memberProjectId}`,
);

const memberIntegrations = await requestJson(
  `/api/hub/projects/${encodedProjectId}/integrations/status`,
  { token: memberToken },
);
expectStatus(`GET /api/hub/projects/${memberProjectId}/integrations/status (member)`, memberIntegrations, [200, 404]);

if (!otherProjectId) {
  const ownerProjects = await requestJson('/api/hub/projects', { token: ownerToken });
  const ownerProjectsData = responseData(ownerProjects);
  if (ownerProjects.status === 200 && Array.isArray(ownerProjectsData?.projects)) {
    const memberProjectSet = new Set(memberProjectRows.map((project) => String(project?.project_id || project?.id || '')));
    const ownerOnly = ownerProjectsData.projects.find((project) => {
      const id = String(project?.project_id || project?.id || '');
      return Boolean(id) && !memberProjectSet.has(id);
    });
    if (ownerOnly?.project_id || ownerOnly?.id) {
      otherProjectId = String(ownerOnly?.project_id || ownerOnly?.id);
    }
  }
}

if (!otherProjectId) {
  const probeId = `authz-runtime-${Date.now().toString(36)}`;
  const createProbe = await requestJson('/api/hub/projects', {
    method: 'POST',
    token: ownerToken,
    body: {
      project_id: probeId,
      name: 'Authz Runtime Probe',
      summary: 'Owner-only project for runtime authorization verification.',
    },
  });

  if (createProbe.status === 200 || createProbe.status === 201) {
    otherProjectId = probeId;
    pass('Auto-create HUB_OTHER_PROJECT_ID', `created=${probeId} status=${createProbe.status}`);
  } else {
    skip(
      'Member denied from HUB_OTHER_PROJECT_ID integrations/status',
      `SKIPPED: missing HUB_OTHER_PROJECT_ID (auto-create failed status=${createProbe.status})`,
    );
  }
}

if (otherProjectId) {
  const encodedOtherProjectId = encodeURIComponent(otherProjectId);
  const otherProjectIsolation = await requestJson(
    `/api/hub/projects/${encodedOtherProjectId}/integrations/status`,
    { token: memberToken },
  );
  expectStatus(
    `GET /api/hub/projects/${otherProjectId}/integrations/status (member)`,
    otherProjectIsolation,
    [403, 404],
  );
}

const memberOpenProject = await requestJson(
  `/api/hub/projects/${encodedProjectId}/openproject/work-packages`,
  { token: memberToken },
);
expectStatus(
  `GET /api/hub/projects/${memberProjectId}/openproject/work-packages (member)`,
  memberOpenProject,
  [200, 404, 409],
);

const nonMemberOpenProject = await requestJson(
  `/api/hub/projects/${encodedProjectId}/openproject/work-packages`,
  { token: nonMemberToken },
);
expectStatus(
  `GET /api/hub/projects/${memberProjectId}/openproject/work-packages (non-member)`,
  nonMemberOpenProject,
  [403, 404],
);

const memberNextcloud = await requestJson(
  `/api/hub/projects/${encodedProjectId}/files`,
  { token: memberToken },
);
expectStatus(
  `GET /api/hub/projects/${memberProjectId}/files (member)`,
  memberNextcloud,
  [200, 409],
);

const nonMemberNextcloud = await requestJson(
  `/api/hub/projects/${encodedProjectId}/files`,
  { token: nonMemberToken },
);
expectStatus(
  `GET /api/hub/projects/${memberProjectId}/files (non-member)`,
  nonMemberNextcloud,
  403,
);

const resultWidth = Math.max('RESULT'.length, ...rows.map((row) => row.result.length));
const checkWidth = Math.max('CHECK'.length, ...rows.map((row) => row.check.length));

console.log(`${'RESULT'.padEnd(resultWidth)}  ${'CHECK'.padEnd(checkWidth)}  DETAIL`);
for (const row of rows) {
  console.log(`${row.result.padEnd(resultWidth)}  ${row.check.padEnd(checkWidth)}  ${row.detail}`);
}

const failCount = rows.filter((row) => row.result === 'FAIL').length;
const passCount = rows.filter((row) => row.result === 'PASS').length;
const skippedCount = rows.filter((row) => row.result === 'SKIPPED').length;
console.log(`Summary: pass=${passCount} fail=${failCount} skipped=${skippedCount}`);

if (failCount > 0) {
  process.exit(1);
}

if (failOnSkipped && skippedCount > 0) {
  console.error('Strict authz runtime mode enabled and skipped checks were detected.');
  process.exit(1);
}
