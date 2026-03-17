import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();

const read = (relativePath) => readFile(path.join(root, relativePath), 'utf8');

const authzContext = await read('src/context/AuthzContext.tsx');
const dashboardPanel = await read('src/features/PersonalizedDashboardPanel.tsx');
const profilePanel = await read('src/components/auth/ProfilePanel.tsx');
const serverRoutes = await read('src/server/routes.ts');

const checks = [
  {
    label: 'Session summary includes derived capabilities',
    pass:
      /sessionSummary/.test(authzContext) &&
      /projectCapabilities/.test(authzContext) &&
      /globalCapabilities/.test(authzContext),
  },
  {
    label: 'Home dashboard cards are capability-filtered',
    pass: /dashboardCardRegistry\.filter/.test(dashboardPanel) && /requiredGlobalCapabilities/.test(dashboardPanel),
  },
  {
    label: 'Profile panel trigger is labeled and uses focus-return dialog',
    pass:
      /aria-label="Open profile panel"/.test(profilePanel) &&
      /AccessibleDialog/.test(profilePanel),
  },
  {
    label: 'Server-side policy gate wrappers exist on API routes',
    pass: /withPolicyGate\(/.test(serverRoutes),
  },
];

const failures = checks.filter((check) => !check.pass);

if (failures.length > 0) {
  console.error('Authorization validation failed.');
  failures.forEach((failure) => console.error(`- ${failure.label}`));
  process.exit(1);
}

console.log('Authorization validation passed.');
