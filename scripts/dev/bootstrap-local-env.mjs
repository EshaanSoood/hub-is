import {
  ensureRepoDir,
  envContent,
  randomSecret,
  writeRepoFile,
} from './lib/env.mjs';

const force = process.argv.includes('--force');

ensureRepoDir('.local');
ensureRepoDir('.local/hub');
ensureRepoDir('.local/keycloak/data');

const keycloakPort = 8081;
const keycloakUrl = `http://127.0.0.1:${String(keycloakPort)}`;
const keycloakRealm = 'hub-os-local';
const appClientId = 'hub-os-local';
const smokeClientId = 'hub-os-local-smoke';

const adminUsername = 'hub-local-admin';
const adminPassword = randomSecret(32);
const ownerPassword = randomSecret(32);
const memberPassword = randomSecret(32);
const collabPassword = randomSecret(32);
const outsiderPassword = randomSecret(32);
const matrixKey = randomSecret(48);
const calendarFeedKey = randomSecret(48);

const ownerUsername = 'hub-local-owner';
const memberUsername = 'hub-local-member';
const collabUsername = 'hub-local-collab';
const outsiderUsername = 'hub-local-outsider';

const ownerEmail = 'owner@hub.local';
const memberEmail = 'member@hub.local';
const collabEmail = 'collab@hub.local';
const outsiderEmail = 'outsider@hub.local';

const fixtureProjectId = 'local-secure-dev';
const fixtureProjectName = 'Local Secure Dev';

const fileWrites = [
  {
    path: '.env.keycloak.local',
    content: envContent([
      {
        title: 'Local Keycloak',
        entries: [
          { key: 'KEYCLOAK_PORT', value: keycloakPort },
          { key: 'KEYCLOAK_ADMIN_USERNAME', value: adminUsername },
          { key: 'KEYCLOAK_ADMIN_PASSWORD', value: adminPassword },
          { key: 'KEYCLOAK_REALM', value: keycloakRealm },
          { key: 'KEYCLOAK_CLIENT_ID', value: appClientId },
          { key: 'KEYCLOAK_SMOKE_CLIENT_ID', value: smokeClientId },
        ],
      },
    ]),
  },
  {
    path: '.env.local',
    content: envContent([
      {
        title: 'Local Vite app',
        entries: [
          { key: 'VITE_DEV_PROXY_TARGET', value: 'http://127.0.0.1:3001' },
          { key: 'VITE_KEYCLOAK_URL', value: keycloakUrl },
          { key: 'VITE_KEYCLOAK_REALM', value: keycloakRealm },
          { key: 'VITE_KEYCLOAK_CLIENT_ID', value: appClientId },
          { key: 'VITE_HUB_COLLAB_WS_URL', value: 'ws://127.0.0.1:1234' },
          { key: 'VITE_HUB_LIVE_WS_URL', value: 'ws://127.0.0.1:3001/api/hub/live' },
          { key: 'VITE_USE_MOCKS', value: 'false' },
        ],
      },
    ]),
  },
  {
    path: '.env.hub-api.local',
    content: envContent([
      {
        title: 'Local hub-api',
        entries: [
          { key: 'PORT', value: 3001 },
          { key: 'NODE_ENV', value: 'development' },
          { key: 'HUB_DB_PATH', value: '.local/hub/hub.sqlite' },
          { key: 'HUB_API_BASE_URL', value: 'http://127.0.0.1:3001' },
          { key: 'HUB_BASE_URL', value: 'http://127.0.0.1:3001' },
          { key: 'HUB_PUBLIC_APP_URL', value: 'http://127.0.0.1:5173' },
          { key: 'POSTMARK_ALLOWED_ORIGIN', value: 'http://127.0.0.1:5173' },
          { key: 'KEYCLOAK_URL', value: keycloakUrl },
          { key: 'KEYCLOAK_REALM', value: keycloakRealm },
          { key: 'KEYCLOAK_CLIENT_ID', value: appClientId },
          { key: 'KEYCLOAK_REDIRECT_URI', value: 'http://127.0.0.1:5173/' },
          { key: 'KEYCLOAK_ISSUER', value: `${keycloakUrl}/realms/${keycloakRealm}` },
          { key: 'KEYCLOAK_AUDIENCE', value: `account,${appClientId},${smokeClientId}` },
          { key: 'KEYCLOAK_ADMIN_USERNAME', value: adminUsername },
          { key: 'KEYCLOAK_ADMIN_PASSWORD', value: adminPassword },
          { key: 'HUB_OWNER_EMAIL', value: ownerEmail },
          { key: 'MATRIX_ACCOUNT_ENCRYPTION_KEY', value: matrixKey },
          { key: 'HUB_CALENDAR_FEED_TOKEN_SECRET', value: calendarFeedKey },
          { key: 'HUB_API_ALLOW_SCHEMA_RESET', value: 'false' },
        ],
      },
    ]),
  },
  {
    path: '.env.hub-collab.local',
    content: envContent([
      {
        title: 'Local hub-collab',
        entries: [
          { key: 'PORT', value: 1234 },
          { key: 'HOST', value: '127.0.0.1' },
          { key: 'HUB_API_URL', value: 'http://127.0.0.1:3001' },
          { key: 'HUB_COLLAB_ALLOWED_ORIGINS', value: 'http://127.0.0.1:5173,http://localhost:5173' },
          { key: 'HUB_COLLAB_REQUIRE_ORIGIN', value: 'true' },
          { key: 'HUB_API_FETCH_TIMEOUT_MS', value: 8000 },
          { key: 'HUB_COLLAB_MAX_CONNECTIONS', value: 250 },
          { key: 'HUB_COLLAB_MAX_DOCUMENTS', value: 500 },
          { key: 'HUB_COLLAB_SAVE_DEBOUNCE_MS', value: 750 },
        ],
      },
    ]),
  },
  {
    path: '.env.local.users.local',
    content: envContent([
      {
        title: 'Synthetic local users',
        entries: [
          { key: 'LOCAL_OWNER_USERNAME', value: ownerUsername },
          { key: 'LOCAL_OWNER_PASSWORD', value: ownerPassword },
          { key: 'LOCAL_OWNER_EMAIL', value: ownerEmail },
          { key: 'LOCAL_OWNER_FIRST_NAME', value: 'Local' },
          { key: 'LOCAL_OWNER_LAST_NAME', value: 'Owner' },
          { key: 'LOCAL_MEMBER_USERNAME', value: memberUsername },
          { key: 'LOCAL_MEMBER_PASSWORD', value: memberPassword },
          { key: 'LOCAL_MEMBER_EMAIL', value: memberEmail },
          { key: 'LOCAL_MEMBER_FIRST_NAME', value: 'Local' },
          { key: 'LOCAL_MEMBER_LAST_NAME', value: 'Member' },
          { key: 'LOCAL_COLLAB_USERNAME', value: collabUsername },
          { key: 'LOCAL_COLLAB_PASSWORD', value: collabPassword },
          { key: 'LOCAL_COLLAB_EMAIL', value: collabEmail },
          { key: 'LOCAL_COLLAB_FIRST_NAME', value: 'Local' },
          { key: 'LOCAL_COLLAB_LAST_NAME', value: 'Collab' },
          { key: 'LOCAL_OUTSIDER_USERNAME', value: outsiderUsername },
          { key: 'LOCAL_OUTSIDER_PASSWORD', value: outsiderPassword },
          { key: 'LOCAL_OUTSIDER_EMAIL', value: outsiderEmail },
          { key: 'LOCAL_OUTSIDER_FIRST_NAME', value: 'Local' },
          { key: 'LOCAL_OUTSIDER_LAST_NAME', value: 'Outsider' },
          { key: 'LOCAL_PROJECT_ID', value: fixtureProjectId },
          { key: 'LOCAL_PROJECT_NAME', value: fixtureProjectName },
        ],
      },
    ]),
  },
  {
    path: '.env.contract-smoke.admin.local',
    content: envContent([
      {
        title: 'Compatibility admin env for existing smoke scripts',
        entries: [
          { key: 'KEYCLOAK_URL', value: keycloakUrl },
          { key: 'KEYCLOAK_REALM', value: keycloakRealm },
          { key: 'KEYCLOAK_CLIENT_ID', value: appClientId },
          { key: 'KEYCLOAK_REDIRECT_URI', value: 'http://127.0.0.1:5173/' },
          { key: 'KEYCLOAK_ADMIN_USERNAME', value: adminUsername },
          { key: 'KEYCLOAK_ADMIN_PASSWORD', value: adminPassword },
        ],
      },
    ]),
  },
  {
    path: '.env.contract-smoke.users.local',
    content: envContent([
      {
        title: 'Compatibility user env for existing smoke scripts',
        entries: [
          { key: 'HUB_SMOKE_USER_A_USERNAME', value: ownerUsername },
          { key: 'HUB_SMOKE_USER_A_PASSWORD', value: ownerPassword },
          { key: 'HUB_SMOKE_USER_A_EMAIL', value: ownerEmail },
          { key: 'HUB_SMOKE_USER_A_FIRST_NAME', value: 'Local' },
          { key: 'HUB_SMOKE_USER_A_LAST_NAME', value: 'Owner' },
          { key: 'HUB_SMOKE_USER_B_USERNAME', value: memberUsername },
          { key: 'HUB_SMOKE_USER_B_PASSWORD', value: memberPassword },
          { key: 'HUB_SMOKE_USER_B_EMAIL', value: memberEmail },
          { key: 'HUB_SMOKE_USER_B_FIRST_NAME', value: 'Local' },
          { key: 'HUB_SMOKE_USER_B_LAST_NAME', value: 'Member' },
        ],
      },
    ]),
  },
];

const created = [];
const skipped = [];

for (const fileWrite of fileWrites) {
  const wrote = await writeRepoFile(fileWrite.path, fileWrite.content, { overwrite: force });
  if (wrote) {
    created.push(fileWrite.path);
  } else {
    skipped.push(fileWrite.path);
  }
}

if (created.length > 0) {
  console.log('Created local secure-dev files:');
  created.forEach((filePath) => console.log(`- ${filePath}`));
}

if (skipped.length > 0) {
  console.log('Skipped existing local files:');
  skipped.forEach((filePath) => console.log(`- ${filePath}`));
}

console.log('Next step: npm run dev:secure');
