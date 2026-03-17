/* global fetch, URLSearchParams */

const keycloakUrl = (process.env.KEYCLOAK_URL || 'https://auth.eshaansood.org').replace(/\/$/, '');
const realm = process.env.KEYCLOAK_REALM || 'eshaan-os';
const adminUsername = process.env.KEYCLOAK_ADMIN_USERNAME || '';
const adminPassword = process.env.KEYCLOAK_ADMIN_PASSWORD || '';

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
const updatedRealmRepresentation = {
  ...realmRepresentation,
  registrationAllowed: false,
};

const updateResponse = await fetch(`${keycloakUrl}/admin/realms/${encodeURIComponent(realm)}`, {
  method: 'PUT',
  headers: {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(updatedRealmRepresentation),
});

if (!updateResponse.ok) {
  fail(`Failed to update realm config (${updateResponse.status}).`);
}

console.log(`Closed registration for realm '${realm}' at ${new Date().toISOString()}.`);
