import { spawn } from 'node:child_process';

const requiredAuthzEnv = ['HUB_BASE_URL', 'HUB_OWNER_ACCESS_TOKEN', 'HUB_ACCESS_TOKEN', 'HUB_NON_MEMBER_ACCESS_TOKEN', 'HUB_PROJECT_ID'];

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

    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${label} failed with exit code ${code ?? 'unknown'}.`));
    });
  });

const hasLiveAuthzInputs = requiredAuthzEnv.every((name) => Boolean(process.env[name]));
const includeCollabSmoke = process.env.HUB_INCLUDE_COLLAB_SMOKE === 'true';

await run('Syntax check: hub-api', 'node', ['--check', 'apps/hub-api/hub-api.mjs']);
await run('Syntax check: local harness', 'node', ['--check', 'scripts/check-hub-tasks-local.mjs']);
await run('Local hub harness (tasks/calendar/timeline/notifications/ICS)', 'node', ['scripts/check-hub-tasks-local.mjs']);

if (hasLiveAuthzInputs) {
  await run('Live authz runtime checks', 'node', ['scripts/check-authz-runtime.mjs']);
} else {
  console.log(
    `\n== Live authz runtime checks (skipped) ==\nSet ${requiredAuthzEnv.join(', ')} to include live authz checks.`,
  );
}

if (includeCollabSmoke) {
  await run('Collab preflight smoke', 'node', ['scripts/check-collab-preflight.mjs']);
} else {
  console.log('\n== Collab preflight smoke (skipped) ==\nSet HUB_INCLUDE_COLLAB_SMOKE=true to include collab preflight.');
}

console.log('\nPASS: hub core gate completed.');
