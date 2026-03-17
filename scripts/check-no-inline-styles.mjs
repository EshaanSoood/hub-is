import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const srcRoot = path.join(root, 'src');

const walk = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
      continue;
    }

    if (entry.name.endsWith('.tsx')) {
      files.push(fullPath);
    }
  }

  return files;
};

const files = await walk(srcRoot);
const offenders = [];

for (const file of files) {
  const content = await readFile(file, 'utf8');
  if (/\bstyle\s*=\s*\{/.test(content)) {
    offenders.push(path.relative(root, file));
  }
}

if (offenders.length > 0) {
  console.error('Inline style attributes are forbidden.');
  offenders.forEach((file) => console.error(`- ${file}`));
  process.exit(1);
}

console.log('Inline style check passed.');
