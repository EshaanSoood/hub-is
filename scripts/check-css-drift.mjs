import { readdir } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const allowed = new Set([
  path.join(root, 'globals.css'),
  path.join(root, 'tokens.css'),
]);
const ignoredDirs = new Set(['node_modules', 'dist', '.git', 'working files']);

const walk = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name)) {
        files.push(...(await walk(path.join(directory, entry.name))));
      }
      continue;
    }

    if (entry.name.endsWith('.css')) {
      files.push(path.join(directory, entry.name));
    }
  }

  return files;
};

const cssFiles = await walk(root);
const disallowed = cssFiles.filter((file) => !allowed.has(file));

if (disallowed.length > 0) {
  console.error('CSS drift detected. Only globals.css and tokens.css are allowed.');
  disallowed.forEach((file) => console.error(`- ${path.relative(root, file)}`));
  process.exit(1);
}

console.log('CSS drift check passed.');
