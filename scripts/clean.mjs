import { rm } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const targets = ['dist', 'tsconfig.app.tsbuildinfo'];

for (const target of targets) {
  const fullPath = path.join(root, target);
  await rm(fullPath, { recursive: true, force: true });
  console.log(`removed ${target}`);
}
