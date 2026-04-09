/* global fetch */

import { loadEnvFilesIntoProcess } from './lib/env.mjs';

await loadEnvFilesIntoProcess(
  ['.env.hub-api.local', '.env.local.users.local', '.env.local.tokens.local'],
  { override: true },
);

const baseUrl = String(process.env.HUB_BASE_URL || process.env.HUB_API_BASE_URL || 'http://127.0.0.1:3001').trim().replace(/\/+$/, '');
const ownerToken = String(process.env.HUB_OWNER_ACCESS_TOKEN || process.env.LOCAL_OWNER_ACCESS_TOKEN || '').trim();
const memberToken = String(process.env.HUB_ACCESS_TOKEN || process.env.LOCAL_MEMBER_ACCESS_TOKEN || '').trim();
const collabToken = String(process.env.HUB_COLLAB_ACCESS_TOKEN || process.env.LOCAL_COLLAB_ACCESS_TOKEN || '').trim();
const projectId = String(process.env.LOCAL_PROJECT_ID || 'local-secure-dev').trim();
const projectName = String(process.env.LOCAL_PROJECT_NAME || 'Local Secure Dev').trim();

const memberEmail = String(process.env.LOCAL_MEMBER_EMAIL || '').trim().toLowerCase();
const collabEmail = String(process.env.LOCAL_COLLAB_EMAIL || '').trim().toLowerCase();

if (!ownerToken || !memberToken || !collabToken) {
  console.error('Missing local tokens. Run npm run dev:secure:tokens first.');
  process.exit(1);
}

const requestJson = async (path, { method = 'GET', token = '', body } = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const payload = await response.json().catch(() => null);
  return { status: response.status, payload };
};

const fail = (message) => {
  console.error(message);
  process.exit(1);
};

const ownerMe = await requestJson('/api/hub/me', { token: ownerToken });
if (ownerMe.status !== 200) {
  fail(`Owner /api/hub/me failed (${ownerMe.status}).`);
}

const projectsResponse = await requestJson('/api/hub/projects', { token: ownerToken });
if (projectsResponse.status !== 200) {
  fail(`Owner /api/hub/projects failed (${projectsResponse.status}).`);
}

const projects = Array.isArray(projectsResponse.payload?.data?.projects)
  ? projectsResponse.payload.data.projects
  : [];

const existing = projects.find((project) => {
  const id = String(project?.project_id || project?.id || '').trim();
  return id === projectId;
});

if (!existing) {
  const createResponse = await requestJson('/api/hub/projects', {
    method: 'POST',
    token: ownerToken,
    body: {
      project_id: projectId,
      name: projectName,
    },
  });

  if (![200, 201, 409].includes(createResponse.status)) {
    fail(`Project create failed (${createResponse.status}).`);
  }
}

const ensureMember = async (email) => {
  const response = await requestJson(`/api/hub/projects/${encodeURIComponent(projectId)}/members`, {
    method: 'POST',
    token: ownerToken,
    body: {
      email,
      role: 'member',
    },
  });

  if (![200, 201, 409].includes(response.status)) {
    fail(`Member attach failed for ${email} (${response.status}).`);
  }
};

await ensureMember(memberEmail);
await ensureMember(collabEmail);

const memberMe = await requestJson('/api/hub/me', { token: memberToken });
if (memberMe.status !== 200) {
  fail(`Member /api/hub/me failed (${memberMe.status}).`);
}

const collabMe = await requestJson('/api/hub/me', { token: collabToken });
if (collabMe.status !== 200) {
  fail(`Collaborator /api/hub/me failed (${collabMe.status}).`);
}

console.log(`Local fixture ready: ${projectId}`);
