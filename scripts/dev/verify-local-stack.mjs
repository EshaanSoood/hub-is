import { spawn } from 'node:child_process';
import { loadEnvFilesIntoProcess, repoFileExists, resolveRepoPath } from './lib/env.mjs';

const requiredFiles = [
  '.env.hub-api.local',
  '.env.hub-collab.local',
  '.env.keycloak.local',
  '.env.local.users.local',
];

const missingFiles = requiredFiles.filter((relativePath) => !repoFileExists(relativePath));
if (missingFiles.length > 0) {
  console.error(`Missing required local env files: ${missingFiles.join(', ')}`);
  console.error('Run npm run dev:secure:bootstrap first.');
  process.exit(1);
}

const run = (label, command, args, env) =>
  new Promise((resolve, reject) => {
    console.log(`\n== ${label} ==`);
    const child = spawn(command, args, {
      cwd: resolveRepoPath(),
      stdio: 'inherit',
      env,
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${label} failed with exit code ${String(code ?? 'unknown')}.`));
    });
  });

await loadEnvFilesIntoProcess(
  ['.env.hub-api.local', '.env.hub-collab.local', '.env.keycloak.local', '.env.local.users.local'],
  { override: true },
);

await run('Ensure local Keycloak users', 'node', ['scripts/dev/ensure-local-users.mjs'], process.env);
await run('Mint local smoke tokens', 'node', ['scripts/dev/mint-local-tokens.mjs'], process.env);
await run('Ensure local fixture project', 'node', ['scripts/dev/ensure-local-project-fixture.mjs'], process.env);

await loadEnvFilesIntoProcess(['.env.local.tokens.local'], { override: true });

const verifyEnv = {
  ...process.env,
  HUB_BASE_URL: 'http://127.0.0.1:3001',
  HUB_API_BASE_URL: 'http://127.0.0.1:3001',
  HUB_COLLAB_WS_URL: 'ws://127.0.0.1:1234',
  HUB_COLLAB_WS_URL_EXPECTED: 'ws://127.0.0.1:1234',
  HUB_COLLAB_READY_URL: 'http://127.0.0.1:1234/readyz',
  HUB_PROJECT_ID: String(process.env.LOCAL_PROJECT_ID || 'local-secure-dev'),
  HUB_PROJECT_NAME: String(process.env.LOCAL_PROJECT_NAME || 'Local Secure Dev'),
  HUB_OWNER_ACCESS_TOKEN: String(process.env.HUB_OWNER_ACCESS_TOKEN || ''),
  HUB_ACCESS_TOKEN: String(process.env.HUB_ACCESS_TOKEN || ''),
  HUB_COLLAB_ACCESS_TOKEN: String(process.env.HUB_COLLAB_ACCESS_TOKEN || ''),
  HUB_NON_MEMBER_ACCESS_TOKEN: String(process.env.HUB_NON_MEMBER_ACCESS_TOKEN || ''),
  HUB_OWNER_EMAIL_EXPECTED: String(process.env.LOCAL_OWNER_EMAIL || ''),
  TOKEN_A: String(process.env.TOKEN_A || ''),
  TOKEN_B: String(process.env.TOKEN_B || ''),
};

await run('Local hub policy checks', 'node', ['scripts/check-hub-policy-live.mjs'], verifyEnv);
await run('Local authz runtime checks', 'node', ['scripts/check-authz-runtime.mjs'], verifyEnv);
await run('Local collab preflight', 'node', ['scripts/check-collab-preflight.mjs'], verifyEnv);
await run('Local contract smoke', 'node', ['scripts/contract_smoke_test.mjs'], verifyEnv);

console.log('\nPASS: local secure stack verification completed.');
