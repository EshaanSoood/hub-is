import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const pagesDir = path.join(root, 'src', 'pages');
const pageFiles = (await readdir(pagesDir)).filter((file) => file.endsWith('.tsx'));
const failures = [];

for (const pageFile of pageFiles) {
  const content = await readFile(path.join(pagesDir, pageFile), 'utf8');
  const headingMatches = [...content.matchAll(/<h([1-6])\b/g)].map((match) => Number(match[1]));

  const usesProjectShell = /<ProjectShell\b/.test(content);
  const usesPageHeader = /<PageHeader\b/.test(content);
  const h1Count =
    headingMatches.filter((level) => level === 1).length +
    (usesProjectShell ? 1 : 0) +
    (usesPageHeader ? 1 : 0);

  if (h1Count !== 1) {
    failures.push(`${pageFile}: expected exactly one h1, found ${h1Count}`);
  }

  for (let index = 1; index < headingMatches.length; index += 1) {
    const prev = headingMatches[index - 1];
    const current = headingMatches[index];
    if (current - prev > 1) {
      failures.push(`${pageFile}: heading level jumps from h${prev} to h${current}`);
      break;
    }
  }
}

if (failures.length > 0) {
  console.error('Heading structure check failed.');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Heading structure check passed.');
