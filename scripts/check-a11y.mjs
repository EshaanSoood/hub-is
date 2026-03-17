import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const appShellPath = path.join(root, 'src', 'components', 'layout', 'AppShell.tsx');
const globalsPath = path.join(root, 'globals.css');

const appShell = await readFile(appShellPath, 'utf8');
const globals = await readFile(globalsPath, 'utf8');

const checks = [
  {
    label: 'skip link',
    pass: /href="#main-content"/.test(appShell),
  },
  {
    label: 'header landmark',
    pass: /<header\b/.test(appShell),
  },
  {
    label: 'nav landmark',
    pass: /<nav\b/.test(appShell),
  },
  {
    label: 'main landmark',
    pass: /<main\b/.test(appShell),
  },
  {
    label: 'footer landmark',
    pass: /<footer\b/.test(appShell),
  },
  {
    label: 'global focus-visible rule',
    pass: /:focus-visible\s*\{[\s\S]*outline:\s*3px\s+solid\s+var\(--color-primary\)/.test(globals),
  },
];

const failures = checks.filter((check) => !check.pass);

if (failures.length > 0) {
  console.error('Accessibility baseline check failed.');
  failures.forEach((failure) => console.error(`- Missing ${failure.label}`));
  process.exit(1);
}

console.log('Accessibility baseline check passed.');
