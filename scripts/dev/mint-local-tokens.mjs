/* global fetch, URLSearchParams */

import { envContent, loadEnvFilesIntoProcess, writeRepoFile } from './lib/env.mjs';

await loadEnvFilesIntoProcess(['.env.keycloak.local', '.env.local.users.local'], { override: true });

const keycloakPort = String(process.env.KEYCLOAK_PORT || '8081').trim();
const keycloakUrl = String(process.env.KEYCLOAK_URL || `http://127.0.0.1:${keycloakPort}`).trim().replace(/\/+$/, '');
const keycloakRealm = String(process.env.KEYCLOAK_REALM || 'hub-os-local').trim();
const smokeClientId = String(process.env.KEYCLOAK_SMOKE_CLIENT_ID || 'hub-os-local-smoke').trim();

const required = [
  'LOCAL_OWNER_USERNAME',
  'LOCAL_OWNER_PASSWORD',
  'LOCAL_OWNER_EMAIL',
  'LOCAL_MEMBER_USERNAME',
  'LOCAL_MEMBER_PASSWORD',
  'LOCAL_MEMBER_EMAIL',
  'LOCAL_COLLAB_USERNAME',
  'LOCAL_COLLAB_PASSWORD',
  'LOCAL_COLLAB_EMAIL',
  'LOCAL_OUTSIDER_USERNAME',
  'LOCAL_OUTSIDER_PASSWORD',
  'LOCAL_OUTSIDER_EMAIL',
];

const missing = required.filter((name) => !String(process.env[name] || '').trim());
if (missing.length > 0) {
  console.error(`Missing required env vars: ${missing.join(', ')}`);
  process.exit(1);
}

const mintAccessToken = async ({ username, password }) => {
  const body = new URLSearchParams({
    grant_type: 'password',
    client_id: smokeClientId,
    username,
    password,
    scope: 'openid profile email',
  });

  const response = await fetch(`${keycloakUrl}/realms/${encodeURIComponent(keycloakRealm)}/protocol/openid-connect/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.access_token) {
    throw new Error(`Failed to mint token for ${username} (${response.status}).`);
  }

  return payload.access_token;
};

const ownerToken = await mintAccessToken({
  username: String(process.env.LOCAL_OWNER_USERNAME),
  password: String(process.env.LOCAL_OWNER_PASSWORD),
});
const memberToken = await mintAccessToken({
  username: String(process.env.LOCAL_MEMBER_USERNAME),
  password: String(process.env.LOCAL_MEMBER_PASSWORD),
});
const collabToken = await mintAccessToken({
  username: String(process.env.LOCAL_COLLAB_USERNAME),
  password: String(process.env.LOCAL_COLLAB_PASSWORD),
});
const outsiderToken = await mintAccessToken({
  username: String(process.env.LOCAL_OUTSIDER_USERNAME),
  password: String(process.env.LOCAL_OUTSIDER_PASSWORD),
});

await writeRepoFile(
  '.env.local.tokens.local',
  envContent([
    {
      title: 'Local smoke tokens',
      entries: [
        { key: 'LOCAL_OWNER_ACCESS_TOKEN', value: ownerToken },
        { key: 'LOCAL_MEMBER_ACCESS_TOKEN', value: memberToken },
        { key: 'LOCAL_COLLAB_ACCESS_TOKEN', value: collabToken },
        { key: 'LOCAL_OUTSIDER_ACCESS_TOKEN', value: outsiderToken },
        { key: 'HUB_OWNER_ACCESS_TOKEN', value: ownerToken },
        { key: 'HUB_ACCESS_TOKEN', value: memberToken },
        { key: 'HUB_COLLAB_ACCESS_TOKEN', value: collabToken },
        { key: 'HUB_NON_MEMBER_ACCESS_TOKEN', value: outsiderToken },
        { key: 'HUB_OWNER_EMAIL_EXPECTED', value: String(process.env.LOCAL_OWNER_EMAIL) },
        { key: 'TOKEN_A', value: ownerToken },
        { key: 'TOKEN_B', value: memberToken },
      ],
    },
  ]),
  { overwrite: true },
);

await writeRepoFile(
  '.env.contract-smoke.tokens.local',
  envContent([
    {
      title: 'Compatibility tokens for existing smoke scripts',
      entries: [
        { key: 'TOKEN_A', value: ownerToken },
        { key: 'TOKEN_B', value: memberToken },
      ],
    },
  ]),
  { overwrite: true },
);

console.log('Minted local smoke tokens.');
