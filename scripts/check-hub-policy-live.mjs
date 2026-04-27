/* global fetch */

const baseUrl = (process.env.HUB_BASE_URL || 'https://eshaansood.org').replace(/\/$/, '');
const ownerToken = process.env.HUB_OWNER_ACCESS_TOKEN || '';
const collaboratorToken = process.env.HUB_COLLAB_ACCESS_TOKEN || '';
const projectId = (process.env.HUB_PROJECT_ID || '').trim();
const expectedOwnerEmail = (process.env.HUB_OWNER_EMAIL_EXPECTED || '').trim().toLowerCase();
const expectEdgeGate = process.env.HUB_EXPECT_EDGE_GATE === 'true';
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

const request = async (path, { method = 'GET', token = '', body } = {}) => {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => {
    controller.abort();
  }, requestTimeoutMs);

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      signal: controller.signal,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const payload = await response.json().catch(() => ({}));
    return { status: response.status, payload };
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'AbortError';
    return {
      status: -1,
      payload: {},
      networkError: timedOut ? `request timed out after ${String(requestTimeoutMs)}ms` : error instanceof Error ? error.message : 'unknown network error',
    };
  } finally {
    clearTimeout(timeoutHandle);
  }
};

const requestExternal = async (target) => {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => {
    controller.abort();
  }, requestTimeoutMs);

  try {
    const response = await fetch(target, { method: 'GET', redirect: 'manual', signal: controller.signal });
    return { status: response.status };
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'AbortError';
    return {
      status: -1,
      networkError: timedOut ? `request timed out after ${String(requestTimeoutMs)}ms` : error instanceof Error ? error.message : 'unknown network error',
    };
  } finally {
    clearTimeout(timeoutHandle);
  }
};

const responseData = (response) => response?.payload?.data ?? response?.payload ?? {};

const requestInviteSurface = async (token) => {
  const topLevel = await request('/api/hub/invites', { token });
  if (topLevel.status !== 404 || !projectId) {
    return { mode: 'top-level', response: topLevel };
  }

  const projectMembers = await request(`/api/hub/spaces/${encodeURIComponent(projectId)}/members`, { token });
  return { mode: 'project-members', response: projectMembers };
};

if (!ownerToken) {
  fail('BLOCKING INPUTS REQUIRED: set HUB_OWNER_ACCESS_TOKEN to run owner policy checks.');
}

const ownerMe = await request('/api/hub/me', { token: ownerToken });
const ownerMeData = responseData(ownerMe);
assert(ownerMe.status === 200, `Owner /api/hub/me failed (${ownerMe.status})`);
assert(ownerMeData?.sessionSummary?.role === 'Owner', 'Owner token did not resolve to Owner role.');
if (expectedOwnerEmail) {
  assert(
    String(ownerMeData?.sessionSummary?.email || '').toLowerCase() === expectedOwnerEmail,
    `Owner email mismatch. expected=${expectedOwnerEmail} actual=${ownerMeData?.sessionSummary?.email || 'unknown'}`,
  );
}

const ownerInviteSurface = await requestInviteSurface(ownerToken);
assert(ownerInviteSurface.response.status === 200, `Owner invite list failed (${ownerInviteSurface.response.status})`);
if (ownerInviteSurface.mode === 'project-members') {
  const ownerInviteData = responseData(ownerInviteSurface.response);
  assert(Array.isArray(ownerInviteData?.pending_invites), 'Owner project member surface did not include pending_invites.');
}

const ownerCreateProbe = await request('/api/hub/spaces', {
  method: 'POST',
  token: ownerToken,
  body: { id: 'x', name: '', summary: '' },
});
assert(
  ownerCreateProbe.status === 400,
  `Owner project create probe should fail validation with 400, got ${ownerCreateProbe.status}`,
);

if (collaboratorToken) {
  const collaboratorMe = await request('/api/hub/me', { token: collaboratorToken });
  assert(
    collaboratorMe.status === 200 || collaboratorMe.status === 403,
    `Collaborator /api/hub/me expected 200 or 403, got ${collaboratorMe.status}`,
  );

  if (collaboratorMe.status === 200) {
    const collaboratorMeData = responseData(collaboratorMe);
    assert(
      collaboratorMeData?.sessionSummary?.role !== 'Owner',
      'Collaborator token unexpectedly resolved to Owner role.',
    );

    const collaboratorInviteSurface = await requestInviteSurface(collaboratorToken);
    if (collaboratorInviteSurface.mode === 'top-level') {
      assert(
        collaboratorInviteSurface.response.status === 403,
        `Collaborator invite list should be 403, got ${collaboratorInviteSurface.response.status}`,
      );
    } else {
      assert(
        collaboratorInviteSurface.response.status === 200,
        `Collaborator project member surface should be 200, got ${collaboratorInviteSurface.response.status}`,
      );
      const collaboratorInviteData = responseData(collaboratorInviteSurface.response);
      assert(
        Array.isArray(collaboratorInviteData?.pending_invites) && collaboratorInviteData.pending_invites.length === 0,
        'Collaborator project member surface unexpectedly exposed non-empty pending_invites.',
      );
    }

    const collaboratorProjectCreate = await request('/api/hub/spaces', {
      method: 'POST',
      token: collaboratorToken,
      body: { id: 'x', name: '', summary: '' },
    });
    assert(
      [400, 403].includes(collaboratorProjectCreate.status),
      `Collaborator project create should be 400 or 403, got ${collaboratorProjectCreate.status}`,
    );
  }
}

if (expectEdgeGate) {
  const edgeTargets = ['https://cloud.eshaansood.org', 'https://projects.eshaansood.org'];
  for (const target of edgeTargets) {
    const response = await requestExternal(target);
    assert(
      [401, 403].includes(response.status),
      `Edge gate expected 401/403 for ${target}, got ${response.status}${response.networkError ? ` (${response.networkError})` : ''}`,
    );
  }
}

console.log('Live hub policy checks passed.');
