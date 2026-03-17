import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const scanTargets = [path.join(root, 'src'), path.join(root, 'globals.css'), path.join(root, 'tokens.css')];
const tailwindDefaultColorRegex = /\b(?:bg|text|border)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:-\d{2,3})?\b/g;
const hexRegex = /#[0-9a-fA-F]{3,8}\b/

const walk = async (target) => {
  const stats = await stat(target);
  if (stats.isFile()) {
    return [target];
  }

  const entries = await readdir(target, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(target, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
      continue;
    }
    if (/\.(tsx|ts|css)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
};

const files = [];
for (const target of scanTargets) {
  files.push(...(await walk(target)));
}

const failures = [];

for (const file of files) {
  const content = await readFile(file, 'utf8');
  if (hexRegex.test(content)) {
    failures.push(`${path.relative(root, file)}: raw hex color detected`);
  }

  const defaultColorClassMatches = content.match(tailwindDefaultColorRegex);
  if (defaultColorClassMatches) {
    failures.push(`${path.relative(root, file)}: default Tailwind colors used (${defaultColorClassMatches.join(', ')})`);
  }
}

if (failures.length > 0) {
  console.error('Token compliance check failed.');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Token compliance check passed.');
