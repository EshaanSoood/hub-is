import { spawn } from 'node:child_process';

const requiredAuthzEnv = [
  'HUB_BASE_URL',
  'HUB_OWNER_ACCESS_TOKEN',
  'HUB_ACCESS_TOKEN',
  'HUB_NON_MEMBER_ACCESS_TOKEN',
  'HUB_PROJECT_ID',
  'HUB_OTHER_PROJECT_ID',
];

const run = (label, command, args, { env = process.env } = {}) =>
  new Promise((resolve, reject) => {
    console.log(`\n== ${label} ==`);
    const child = spawn(command, args, {
      stdio: 'inherit',
      env,
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('exit', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      const detail = code !== null ? `exit code ${code}` : `signal ${signal || 'unknown'}`;
      reject(new Error(`${label} failed with ${detail}.`));
    });
  });

const missing = requiredAuthzEnv.filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error(
    `BLOCKING INPUTS REQUIRED: set ${missing.join(', ')} to run strict SQLite lock gate (includes live authz runtime).`,
  );
  process.exit(1);
}

await run('Syntax check: hub-api', 'node', ['--check', 'apps/hub-api/hub-api.mjs']);
await run('Syntax check: sqlite local harness', 'node', ['--check', 'scripts/check-hub-tasks-local.mjs']);
await run('SQLite local harness (tasks/calendar/timeline/notifications/ICS)', 'node', ['scripts/check-hub-tasks-local.mjs']);
await run(
  'Live authz runtime checks (strict, no skipped rows)',
  'node',
  ['scripts/check-authz-runtime.mjs'],
  {
    env: {
      ...process.env,
      HUB_AUTHZ_FAIL_ON_SKIPPED: 'true',
    },
  },
);

console.log('\nPASS: strict SQLite lock gate completed.');
