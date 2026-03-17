/* global fetch, URLSearchParams */

const keycloakUrl = (process.env.KEYCLOAK_URL || 'https://auth.eshaansood.org').replace(/\/$/, '');
const realm = process.env.KEYCLOAK_REALM || 'eshaan-os';
const adminUsername = process.env.KEYCLOAK_ADMIN_USERNAME || '';
const adminPassword = process.env.KEYCLOAK_ADMIN_PASSWORD || '';
const nonInvitedToken = process.env.HUB_NON_INVITED_ACCESS_TOKEN || '';
const hubBaseUrl = (process.env.HUB_BASE_URL || 'https://eshaansood.org').replace(/\/$/, '');

const fail = (message) => {
  console.error(message);
  process.exit(1);
};

if (!adminUsername || !adminPassword) {
  fail('BLOCKING INPUTS REQUIRED: KEYCLOAK_ADMIN_USERNAME and KEYCLOAK_ADMIN_PASSWORD are required.');
}

const tokenBody = new URLSearchParams({
  grant_type: 'password',
  client_id: 'admin-cli',
  username: adminUsername,
  password: adminPassword,
});

const tokenResponse = await fetch(`${keycloakUrl}/realms/master/protocol/openid-connect/token`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body: tokenBody,
});

if (!tokenResponse.ok) {
  fail(`Failed to obtain Keycloak admin token (${tokenResponse.status}).`);
}

const tokenPayload = await tokenResponse.json();
const accessToken = tokenPayload?.access_token;
if (!accessToken) {
  fail('Failed to parse Keycloak admin token.');
}

const realmResponse = await fetch(`${keycloakUrl}/admin/realms/${encodeURIComponent(realm)}`, {
  method: 'GET',
  headers: {
    Authorization: `Bearer ${accessToken}`,
  },
});

if (!realmResponse.ok) {
  fail(`Failed to load realm config (${realmResponse.status}).`);
}

const realmRepresentation = await realmResponse.json();
if (realmRepresentation?.registrationAllowed !== false) {
  fail(`registrationAllowed is not false for realm '${realm}'.`);
}

if (nonInvitedToken) {
  const hubResponse = await fetch(`${hubBaseUrl}/api/hub/me`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${nonInvitedToken}`,
    },
  });

  if (hubResponse.status !== 403) {
    fail(`Expected hub backstop to deny non-invited token with 403, got ${hubResponse.status}.`);
  }
}

console.log(`Keycloak closure verified for realm '${realm}' at ${new Date().toISOString()}.`);
