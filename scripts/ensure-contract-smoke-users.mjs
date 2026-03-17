/* global fetch, URLSearchParams */

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '..');

const parseEnvLine = (line) => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) {
    return null;
  }

  const equalsIndex = trimmed.indexOf('=');
  if (equalsIndex <= 0) {
    return null;
  }

  const key = trimmed.slice(0, equalsIndex).trim();
  let value = trimmed.slice(equalsIndex + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }

  return { key, value };
};

const loadEnvFile = async (path) => {
  if (!existsSync(path)) {
    return;
  }

  const raw = await readFile(path, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const parsed = parseEnvLine(line);
    if (!parsed) {
      continue;
    }

    if (process.env[parsed.key] === undefined) {
      process.env[parsed.key] = parsed.value;
    }
  }
};

await loadEnvFile(resolve(repoRoot, '.env.contract-smoke.admin.local'));
await loadEnvFile(resolve(repoRoot, '.env.contract-smoke.users.local'));

const required = [
  'KEYCLOAK_ADMIN_USERNAME',
  'KEYCLOAK_ADMIN_PASSWORD',
  'HUB_SMOKE_USER_A_USERNAME',
  'HUB_SMOKE_USER_A_PASSWORD',
  'HUB_SMOKE_USER_B_USERNAME',
  'HUB_SMOKE_USER_B_PASSWORD',
];

const missing = required.filter((name) => !String(process.env[name] || '').trim());
if (missing.length > 0) {
  console.error(`Missing required env vars: ${missing.join(', ')}`);
  console.error('Expected via environment or .env.contract-smoke.admin.local + .env.contract-smoke.users.local');
  process.exit(1);
}

const keycloakUrl = String(process.env.KEYCLOAK_URL || 'https://auth.eshaansood.org').trim().replace(/\/+$/, '');
const keycloakRealm = String(process.env.KEYCLOAK_REALM || 'eshaan-os').trim();
const resetPasswords = String(process.env.HUB_SMOKE_RESET_PASSWORDS || 'false').trim().toLowerCase() === 'true';

const adminForm = new URLSearchParams({
  grant_type: 'password',
  client_id: 'admin-cli',
  username: String(process.env.KEYCLOAK_ADMIN_USERNAME),
  password: String(process.env.KEYCLOAK_ADMIN_PASSWORD),
});

const adminTokenResponse = await fetch(`${keycloakUrl}/realms/master/protocol/openid-connect/token`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body: adminForm,
});

const adminTokenPayload = await adminTokenResponse.json().catch(() => null);
if (!adminTokenResponse.ok || !adminTokenPayload?.access_token) {
  console.error(`Failed to acquire Keycloak admin token (${adminTokenResponse.status}).`);
  process.exit(1);
}

const adminToken = adminTokenPayload.access_token;

const adminRequest = async (path, options = {}) => {
  const response = await fetch(`${keycloakUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${adminToken}`,
      ...(options.headers || {}),
    },
  });

  if (response.status === 204) {
    return { status: response.status, data: null };
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`${options.method || 'GET'} ${path} failed (${response.status}).`);
  }

  return { status: response.status, data };
};

const ensureUser = async ({ username, password, email, firstName, lastName }) => {
  const lookup = await adminRequest(
    `/admin/realms/${encodeURIComponent(keycloakRealm)}/users?username=${encodeURIComponent(username)}&exact=true`,
    { method: 'GET' },
  );

  let user = Array.isArray(lookup.data) ? lookup.data[0] : null;

  if (!user?.id) {
    await adminRequest(`/admin/realms/${encodeURIComponent(keycloakRealm)}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username,
        email,
        firstName,
        lastName,
        enabled: true,
        emailVerified: true,
      }),
    });

    const createdLookup = await adminRequest(
      `/admin/realms/${encodeURIComponent(keycloakRealm)}/users?username=${encodeURIComponent(username)}&exact=true`,
      { method: 'GET' },
    );

    user = Array.isArray(createdLookup.data) ? createdLookup.data[0] : null;
    if (!user?.id) {
      throw new Error(`Failed to resolve created user: ${username}`);
    }

    await adminRequest(`/admin/realms/${encodeURIComponent(keycloakRealm)}/users/${encodeURIComponent(user.id)}/reset-password`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'password',
        value: password,
        temporary: false,
      }),
    });

    console.log(`Created Keycloak user ${username}`);
    return;
  }

  if (resetPasswords) {
    await adminRequest(`/admin/realms/${encodeURIComponent(keycloakRealm)}/users/${encodeURIComponent(user.id)}/reset-password`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'password',
        value: password,
        temporary: false,
      }),
    });

    console.log(`User ${username} already exists; password reset due to HUB_SMOKE_RESET_PASSWORDS=true`);
    return;
  }

  console.log(`User ${username} already exists; left unchanged`);
};

const userA = {
  username: String(process.env.HUB_SMOKE_USER_A_USERNAME),
  password: String(process.env.HUB_SMOKE_USER_A_PASSWORD),
  email: String(process.env.HUB_SMOKE_USER_A_EMAIL || `${String(process.env.HUB_SMOKE_USER_A_USERNAME)}@example.com`),
  firstName: String(process.env.HUB_SMOKE_USER_A_FIRST_NAME || 'Hub'),
  lastName: String(process.env.HUB_SMOKE_USER_A_LAST_NAME || 'SmokeA'),
};

const userB = {
  username: String(process.env.HUB_SMOKE_USER_B_USERNAME),
  password: String(process.env.HUB_SMOKE_USER_B_PASSWORD),
  email: String(process.env.HUB_SMOKE_USER_B_EMAIL || `${String(process.env.HUB_SMOKE_USER_B_USERNAME)}@example.com`),
  firstName: String(process.env.HUB_SMOKE_USER_B_FIRST_NAME || 'Hub'),
  lastName: String(process.env.HUB_SMOKE_USER_B_LAST_NAME || 'SmokeB'),
};

await ensureUser(userA);
await ensureUser(userB);

console.log('Persistent smoke users are ready.');
