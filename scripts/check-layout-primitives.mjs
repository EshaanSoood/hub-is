import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const layoutDir = path.join(root, 'src', 'components', 'layout');
const pagesDir = path.join(root, 'src', 'pages');

const canonicalProjectSpacePage = 'ProjectSpacePage.tsx';
const requiredProjectSpaceImports = [
  'components/project-space/TopNavTabs',
  'components/project-space/OverviewView',
  'components/project-space/WorkView',
  'components/project-space/ToolsView',
];
const requiredProjectTabs = ['overview', 'work', 'tools'];

const allowedLayoutFiles = new Set([
  'AppShell.tsx',
  'ProjectShell.tsx',
  'PageHeader.tsx',
  'Grid.tsx',
  'Panel.tsx',
  'SectionHeader.tsx',
  'Stack.tsx',
  'Cluster.tsx',
  'DataList.tsx',
  'DataTable.tsx',
]);

const layoutFiles = await readdir(layoutDir);
const unexpectedLayoutFiles = layoutFiles.filter((file) => !allowedLayoutFiles.has(file));

const pageFiles = (await readdir(pagesDir)).filter((file) => file.endsWith('.tsx'));
const pagesMissingLayoutImports = [];
const pagesImportingUiDirectly = [];
const projectSpaceContractErrors = [];

for (const pageFile of pageFiles) {
  const content = await readFile(path.join(pagesDir, pageFile), 'utf8');

  if (/components\/ui\//.test(content)) {
    pagesImportingUiDirectly.push(pageFile);
  }

  if (pageFile === canonicalProjectSpacePage) {
    const missingImports = requiredProjectSpaceImports.filter((importPath) => !content.includes(importPath));
    if (missingImports.length > 0) {
      projectSpaceContractErrors.push(
        `- ${pageFile} missing required project-space imports: ${missingImports.join(', ')}`,
      );
    }

    const missingTabs = requiredProjectTabs.filter((tabId) => !new RegExp(`['"]${tabId}['"]`).test(content));
    if (missingTabs.length > 0) {
      projectSpaceContractErrors.push(`- ${pageFile} missing canonical tab ids: ${missingTabs.join(', ')}`);
    }
    continue;
  }

  if (!/components\/layout\//.test(content)) {
    pagesMissingLayoutImports.push(pageFile);
  }
}

if (
  unexpectedLayoutFiles.length > 0 ||
  pagesMissingLayoutImports.length > 0 ||
  pagesImportingUiDirectly.length > 0 ||
  projectSpaceContractErrors.length > 0
) {
  console.error('Layout primitive contract check failed.');

  if (unexpectedLayoutFiles.length > 0) {
    console.error('Unexpected layout primitives detected:');
    unexpectedLayoutFiles.forEach((file) => {
      console.error(`- ${file}`);
    });
  }

  if (pagesMissingLayoutImports.length > 0) {
    console.error('Non-project pages must import from components/layout. Missing imports in:');
    pagesMissingLayoutImports.forEach((file) => {
      console.error(`- ${file}`);
    });
  }

  if (pagesImportingUiDirectly.length > 0) {
    console.error('Pages must not import components/ui directly. Violations in:');
    pagesImportingUiDirectly.forEach((file) => {
      console.error(`- ${file}`);
    });
  }

  if (projectSpaceContractErrors.length > 0) {
    console.error('ProjectSpacePage contract violations:');
    projectSpaceContractErrors.forEach((line) => {
      console.error(line);
    });
  }

  process.exit(1);
}

console.log('Layout primitive check passed.');
