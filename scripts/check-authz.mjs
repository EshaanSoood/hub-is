import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();

const read = (relativePath) => readFile(path.join(root, relativePath), 'utf8');
const readFirstExisting = async (relativePaths) => {
  for (const relativePath of relativePaths) {
    try {
      return await read(relativePath);
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
  throw new Error(`Missing required file. Checked: ${relativePaths.join(', ')}`);
};

const authzContext = await read('src/context/AuthzContext.tsx');
const dashboardPanel = await readFirstExisting([
  'src/features/PersonalizedDashboardPanel.tsx',
  'src/features/PersonalizedDashboardPanel/index.tsx',
]);
const dashboardCards = await read('src/lib/dashboardCards.ts');
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
    pass:
      (/dashboardCardRegistry\.filter/.test(dashboardPanel) && /requiredGlobalCapabilities/.test(dashboardPanel)) ||
      (/filterDashboardCards\(/.test(dashboardPanel) &&
        /filterDashboardCards\s*=/.test(dashboardCards) &&
        /requiredGlobalCapabilities/.test(dashboardCards)),
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
