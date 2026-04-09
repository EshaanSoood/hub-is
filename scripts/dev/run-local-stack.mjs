/* global fetch */

import { spawn } from 'node:child_process';
import { loadEnvFilesIntoProcess, repoFileExists, resolveRepoPath } from './lib/env.mjs';

const requiredFiles = [
  '.env.keycloak.local',
  '.env.local',
  '.env.hub-api.local',
  '.env.hub-collab.local',
  '.env.local.users.local',
];

const missingFiles = requiredFiles.filter((relativePath) => !repoFileExists(relativePath));
if (missingFiles.length > 0) {
  console.error(`Missing required local env files: ${missingFiles.join(', ')}`);
  console.error('Run npm run dev:secure:bootstrap first.');
  process.exit(1);
}

await loadEnvFilesIntoProcess(['.env.keycloak.local'], { override: true });

const keycloakPort = String(process.env.KEYCLOAK_PORT || '8081').trim();
const keycloakRealm = String(process.env.KEYCLOAK_REALM || 'hub-os-local').trim();
let keycloakStarted = false;
let keycloakStopped = false;

const runCommand = (command, args, { env = process.env } = {}) =>
  new Promise((resolve, reject) => {
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
      reject(new Error(`${command} ${args.join(' ')} failed with exit code ${String(code ?? 'unknown')}.`));
    });
  });

const waitForHttp = async (url, { timeoutMs = 60_000 } = {}) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // keep polling
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Timed out waiting for ${url}`);
};

const stopKeycloak = async () => {
  if (!keycloakStarted || keycloakStopped) {
    return;
  }
  keycloakStopped = true;
  await runCommand('docker', [
    'compose',
    '-f',
    'infra/local/keycloak/docker-compose.yml',
    '--env-file',
    '.env.keycloak.local',
    'down',
  ]).catch((error) => {
    console.error(error.message);
  });
};

const childProcesses = [];
let shuttingDown = false;

const stopChildren = async () => {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  for (const child of childProcesses) {
    if (!child.killed) {
      child.kill('SIGINT');
    }
  }
  await stopKeycloak();
};

const spawnLongRunning = (command, args) => {
  const child = spawn(command, args, {
    cwd: resolveRepoPath(),
    stdio: 'inherit',
    env: process.env,
  });
  childProcesses.push(child);
  child.on('exit', (code, signal) => {
    if (!shuttingDown && (code !== 0 || signal)) {
      console.error(`${command} ${args.join(' ')} exited unexpectedly.`);
      void stopChildren();
      process.exitCode = code ?? 1;
    }
  });
  return child;
};

process.on('SIGINT', () => {
  void stopChildren();
});
process.on('SIGTERM', () => {
  void stopChildren();
});

try {
  await runCommand('docker', [
    'compose',
    '-f',
    'infra/local/keycloak/docker-compose.yml',
    '--env-file',
    '.env.keycloak.local',
    'up',
    '-d',
  ]);
  keycloakStarted = true;

  await waitForHttp(`http://127.0.0.1:${keycloakPort}/realms/${keycloakRealm}/.well-known/openid-configuration`);
  await runCommand('node', ['scripts/dev/ensure-local-users.mjs']);

  spawnLongRunning('node', ['--env-file=.env.hub-api.local', 'apps/hub-api/hub-api.mjs']);
  spawnLongRunning('node', ['--env-file=.env.hub-collab.local', 'apps/hub-collab/collab-server.mjs']);
  spawnLongRunning('npm', ['run', 'dev', '--', '--host', '127.0.0.1']);

  await waitForHttp('http://127.0.0.1:3001/api/hub/health');
  await waitForHttp('http://127.0.0.1:1234/readyz');
  await runCommand('node', ['scripts/dev/mint-local-tokens.mjs']);
  await runCommand('node', ['scripts/dev/ensure-local-project-fixture.mjs']);

  console.log('');
  console.log('Secure local stack is ready.');
  console.log('- App: http://127.0.0.1:5173');
  console.log('- Keycloak: http://127.0.0.1:8081');
  console.log('- Users: .env.local.users.local');
  console.log('- Tokens: .env.local.tokens.local');

  await new Promise(() => {});
} catch (error) {
  await stopKeycloak();
  throw error;
}
