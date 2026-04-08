import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();

const read = (relativePath) => readFile(path.join(root, relativePath), 'utf8');

const collectSourceFiles = async (absoluteDir) => {
  const entries = await readdir(absoluteDir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const absolutePath = path.join(absoluteDir, entry.name);
      if (entry.isDirectory()) {
        return collectSourceFiles(absolutePath);
      }
      return /\.(ts|tsx)$/.test(entry.name) ? [absolutePath] : [];
    }),
  );
  return files.flat().sort();
};

const readModuleSource = async ({ flatFilePath, moduleDirPath }) => {
  const absoluteModuleDir = path.join(root, moduleDirPath);
  try {
    const sourceFiles = await collectSourceFiles(absoluteModuleDir);
    if (sourceFiles.length > 0) {
      const sources = await Promise.all(sourceFiles.map((sourceFile) => readFile(sourceFile, 'utf8')));
      return sources.join('\n');
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }

  return read(flatFilePath);
};

const authzContext = await read('src/context/AuthzContext.tsx');
const dashboardPanel = await readModuleSource({
  flatFilePath: 'src/features/PersonalizedDashboardPanel.tsx',
  moduleDirPath: 'src/features/PersonalizedDashboardPanel',
});
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
