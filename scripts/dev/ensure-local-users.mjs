/* global fetch, URLSearchParams */

import { loadEnvFilesIntoProcess } from './lib/env.mjs';

await loadEnvFilesIntoProcess(['.env.keycloak.local', '.env.local.users.local'], { override: true });

const keycloakPort = String(process.env.KEYCLOAK_PORT || '8081').trim();
const keycloakUrl = String(process.env.KEYCLOAK_URL || `http://127.0.0.1:${keycloakPort}`).trim().replace(/\/+$/, '');
const keycloakRealm = String(process.env.KEYCLOAK_REALM || 'hub-os-local').trim();
const appClientId = String(process.env.KEYCLOAK_CLIENT_ID || 'hub-os-local').trim();
const smokeClientId = String(process.env.KEYCLOAK_SMOKE_CLIENT_ID || 'hub-os-local-smoke').trim();
const adminUsername = String(process.env.KEYCLOAK_ADMIN_USERNAME || '').trim();
const adminPassword = String(process.env.KEYCLOAK_ADMIN_PASSWORD || '');

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

const missing = [
  ...(adminUsername ? [] : ['KEYCLOAK_ADMIN_USERNAME']),
  ...(adminPassword ? [] : ['KEYCLOAK_ADMIN_PASSWORD']),
  ...required.filter((name) => !String(process.env[name] || '').trim()),
];

if (missing.length > 0) {
  console.error(`Missing required env vars: ${missing.join(', ')}`);
  process.exit(1);
}

const adminForm = new URLSearchParams({
  grant_type: 'password',
  client_id: 'admin-cli',
  username: adminUsername,
  password: adminPassword,
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

const ensureClientSubjectMapper = async (clientId) => {
  const lookup = await adminRequest(
    `/admin/realms/${encodeURIComponent(keycloakRealm)}/clients?clientId=${encodeURIComponent(clientId)}`,
    { method: 'GET' },
  );
  const client = Array.isArray(lookup.data) ? lookup.data.find((entry) => String(entry?.clientId || '') === clientId) : null;
  if (!client?.id) {
    throw new Error(`Failed to resolve Keycloak client: ${clientId}`);
  }

  const mapperPayload = {
    name: 'subject',
    protocol: 'openid-connect',
    protocolMapper: 'oidc-usermodel-property-mapper',
    consentRequired: false,
    config: {
      'user.attribute': 'id',
      'claim.name': 'sub',
      'jsonType.label': 'String',
      'id.token.claim': 'true',
      'access.token.claim': 'true',
      'userinfo.token.claim': 'true',
    },
  };

  const mapperLookup = await adminRequest(
    `/admin/realms/${encodeURIComponent(keycloakRealm)}/clients/${encodeURIComponent(client.id)}/protocol-mappers/models`,
    { method: 'GET' },
  );
  const existing = Array.isArray(mapperLookup.data)
    ? mapperLookup.data.find((entry) => String(entry?.name || '') === 'subject')
    : null;

  if (existing?.id) {
    await adminRequest(
      `/admin/realms/${encodeURIComponent(keycloakRealm)}/clients/${encodeURIComponent(client.id)}/protocol-mappers/models/${encodeURIComponent(existing.id)}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: existing.id,
          ...mapperPayload,
        }),
      },
    );
    console.log(`Verified subject mapper for client ${clientId}`);
    return;
  }

  await adminRequest(
    `/admin/realms/${encodeURIComponent(keycloakRealm)}/clients/${encodeURIComponent(client.id)}/protocol-mappers/models`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(mapperPayload),
    },
  );
  console.log(`Added subject mapper for client ${clientId}`);
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
  }

  if (!user?.id) {
    throw new Error(`Failed to resolve Keycloak user: ${username}`);
  }

  await adminRequest(`/admin/realms/${encodeURIComponent(keycloakRealm)}/users/${encodeURIComponent(user.id)}`, {
    method: 'PUT',
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

  console.log(`Ready: ${username}`);
};

const users = [
  {
    username: String(process.env.LOCAL_OWNER_USERNAME),
    password: String(process.env.LOCAL_OWNER_PASSWORD),
    email: String(process.env.LOCAL_OWNER_EMAIL),
    firstName: String(process.env.LOCAL_OWNER_FIRST_NAME || 'Local'),
    lastName: String(process.env.LOCAL_OWNER_LAST_NAME || 'Owner'),
  },
  {
    username: String(process.env.LOCAL_MEMBER_USERNAME),
    password: String(process.env.LOCAL_MEMBER_PASSWORD),
    email: String(process.env.LOCAL_MEMBER_EMAIL),
    firstName: String(process.env.LOCAL_MEMBER_FIRST_NAME || 'Local'),
    lastName: String(process.env.LOCAL_MEMBER_LAST_NAME || 'Member'),
  },
  {
    username: String(process.env.LOCAL_COLLAB_USERNAME),
    password: String(process.env.LOCAL_COLLAB_PASSWORD),
    email: String(process.env.LOCAL_COLLAB_EMAIL),
    firstName: String(process.env.LOCAL_COLLAB_FIRST_NAME || 'Local'),
    lastName: String(process.env.LOCAL_COLLAB_LAST_NAME || 'Collab'),
  },
  {
    username: String(process.env.LOCAL_OUTSIDER_USERNAME),
    password: String(process.env.LOCAL_OUTSIDER_PASSWORD),
    email: String(process.env.LOCAL_OUTSIDER_EMAIL),
    firstName: String(process.env.LOCAL_OUTSIDER_FIRST_NAME || 'Local'),
    lastName: String(process.env.LOCAL_OUTSIDER_LAST_NAME || 'Outsider'),
  },
];

await ensureClientSubjectMapper(appClientId);
await ensureClientSubjectMapper(smokeClientId);

for (const user of users) {
  await ensureUser(user);
}

console.log('Local Keycloak users are ready.');
