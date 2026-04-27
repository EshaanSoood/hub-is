/* global fetch, Headers, setTimeout */

import { workflowConfig } from './workflowEnv.mjs';

const sleep = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const parseJson = (raw) => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const hubRequest = async (accessToken, path, init = {}) => {
  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bearer ${String(accessToken || '')}`);
  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(new URL(path, workflowConfig.baseUrl).toString(), {
    ...init,
    headers,
  });

  const raw = await response.text();
  const parsed = parseJson(raw);
  const envelope = parsed && typeof parsed === 'object' && 'ok' in parsed ? parsed : null;

  return {
    status: response.status,
    ok: response.ok,
    envelope,
    raw,
  };
};

export const hubRequestOk = async (accessToken, path, init = {}) => {
  const result = await hubRequest(accessToken, path, init);
  if (!result.ok || !result.envelope?.ok || result.envelope.data === null) {
    const message = result.envelope?.error?.message || result.raw || `Request failed for ${path} (${result.status}).`;
    throw new Error(message);
  }
  return result.envelope.data;
};

export const loadSessionSummary = async (accessToken) => {
  const data = await hubRequestOk(accessToken, '/api/hub/me', { method: 'GET' });
  if (data?.sessionSummary?.userId) {
    return data.sessionSummary;
  }
  if (data?.user?.user_id) {
    return {
      userId: data.user.user_id,
    };
  }
  throw new Error('Unexpected /api/hub/me response shape.');
};

export const listProjectProjects = async (accessToken, projectId) => {
  const data = await hubRequestOk(accessToken, `/api/hub/spaces/${encodeURIComponent(projectId)}/projects`, {
    method: 'GET',
  });
  return Array.isArray(data?.projects) ? data.projects : [];
};

export const waitForProjectProject = async (accessToken, projectId, predicate, label, timeoutMs = 15_000, intervalMs = 250) => {
  const deadline = Date.now() + timeoutMs;
  let lastProjects = [];

  while (Date.now() < deadline) {
    lastProjects = await listProjectProjects(accessToken, projectId);
    const match = lastProjects.find(predicate);
    if (match) {
      return match;
    }
    await sleep(intervalMs);
  }

  const match = lastProjects.find(predicate);
  if (match) {
    return match;
  }

  throw new Error(`Timed out waiting for ${label}.`);
};

export const listProjectMembers = async (accessToken, projectId) => {
  const data = await hubRequestOk(accessToken, `/api/hub/spaces/${encodeURIComponent(projectId)}/members`, {
    method: 'GET',
  });
  return {
    members: Array.isArray(data?.members) ? data.members : [],
    pendingInvites: Array.isArray(data?.pending_invites) ? data.pending_invites : [],
  };
};

export const collabAuthorizeStatus = async (accessToken, docId) =>
  hubRequest(accessToken, `/api/hub/collab/authorize?doc_id=${encodeURIComponent(docId)}`, {
    method: 'GET',
  });
