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
const spaceId = String(process.env.LOCAL_PROJECT_ID || process.env.LOCAL_SPACE_ID || 'local-secure-dev').trim();
const spaceName = String(process.env.LOCAL_PROJECT_NAME || process.env.LOCAL_SPACE_NAME || 'Local Secure Dev').trim();

const memberEmail = String(process.env.LOCAL_MEMBER_EMAIL || '').trim().toLowerCase();
const collabEmail = String(process.env.LOCAL_COLLAB_EMAIL || '').trim().toLowerCase();

if (!ownerToken || !memberToken || !collabToken || !memberEmail || !collabEmail) {
  console.error('Missing local tokens or secondary-account emails. Run npm run dev:secure:tokens first.');
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

const getSessionEmail = (payload) => String(payload?.data?.user?.email || '').trim().toLowerCase();
const hasSpaceMembership = (payload) =>
  Array.isArray(payload?.data?.memberships)
  && payload.data.memberships.some((membership) => String(membership?.space_id || '').trim() === spaceId);

const ownerMe = await requestJson('/api/hub/me', { token: ownerToken });
if (ownerMe.status !== 200) {
  fail(`Owner /api/hub/me failed (${ownerMe.status}).`);
}

const spacesResponse = await requestJson('/api/hub/spaces', { token: ownerToken });
if (spacesResponse.status !== 200) {
  fail(`Owner /api/hub/spaces failed (${spacesResponse.status}).`);
}

const spaces = Array.isArray(spacesResponse.payload?.data?.spaces)
  ? spacesResponse.payload.data.spaces
  : [];

const existing = spaces.find((space) => {
  const id = String(space?.space_id || space?.id || '').trim();
  return id === spaceId;
});

if (!existing) {
  const createResponse = await requestJson('/api/hub/spaces', {
    method: 'POST',
    token: ownerToken,
    body: {
      space_id: spaceId,
      name: spaceName,
    },
  });

  if (![200, 201, 409].includes(createResponse.status)) {
    fail(`Space create failed (${createResponse.status}).`);
  }
}

const ensureMember = async (email) => {
  const response = await requestJson(`/api/hub/spaces/${encodeURIComponent(spaceId)}/members`, {
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
if (getSessionEmail(memberMe.payload) !== memberEmail) {
  fail(`Member /api/hub/me returned ${getSessionEmail(memberMe.payload) || 'no email'}, expected ${memberEmail}.`);
}
if (!hasSpaceMembership(memberMe.payload)) {
  fail(`Member /api/hub/me does not include membership for ${spaceId}.`);
}

const collabMe = await requestJson('/api/hub/me', { token: collabToken });
if (collabMe.status !== 200) {
  fail(`Collaborator /api/hub/me failed (${collabMe.status}).`);
}
if (getSessionEmail(collabMe.payload) !== collabEmail) {
  fail(`Collaborator /api/hub/me returned ${getSessionEmail(collabMe.payload) || 'no email'}, expected ${collabEmail}.`);
}
if (!hasSpaceMembership(collabMe.payload)) {
  fail(`Collaborator /api/hub/me does not include membership for ${spaceId}.`);
}

console.log(`Local fixture ready: ${spaceId}`);
