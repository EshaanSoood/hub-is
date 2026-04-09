import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const repoRoot = resolve(__dirname, '../../..');

export const resolveRepoPath = (...segments) => resolve(repoRoot, ...segments);

export const repoFileExists = (relativePath) => existsSync(resolveRepoPath(relativePath));

export const ensureRepoDir = (relativePath) => {
  mkdirSync(resolveRepoPath(relativePath), { recursive: true });
};

export const parseEnvLine = (line) => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) {
    return null;
  }

  const equalsIndex = trimmed.indexOf('=');
  if (equalsIndex <= 0) {
    return null;
  }

  const key = trimmed.slice(0, equalsIndex).trim();
  let value = trimmed.slice(equalsIndex + 1).trim();

  if (value.startsWith('"') && value.endsWith('"')) {
    try {
      value = JSON.parse(value);
    } catch {
      value = value.slice(1, -1);
    }
  } else if (value.startsWith("'") && value.endsWith("'")) {
    value = value.slice(1, -1);
  }

  return { key, value };
};

export const loadEnvFileIntoProcess = async (relativePath, { override = true } = {}) => {
  const absolutePath = resolveRepoPath(relativePath);
  if (!existsSync(absolutePath)) {
    return;
  }

  const raw = await readFile(absolutePath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const parsed = parseEnvLine(line);
    if (!parsed) {
      continue;
    }

    if (override || process.env[parsed.key] === undefined) {
      process.env[parsed.key] = parsed.value;
    }
  }
};

export const loadEnvFilesIntoProcess = async (relativePaths, options = {}) => {
  for (const relativePath of relativePaths) {
    await loadEnvFileIntoProcess(relativePath, options);
  }
};

const formatEnvValue = (value) => {
  const text = String(value);
  if (/^[A-Za-z0-9_./:@,+-]+$/.test(text)) {
    return text;
  }
  return JSON.stringify(text);
};

export const envContent = (sections) =>
  sections
    .map((section) => {
      const lines = [];
      if (section.title) {
        lines.push(`# ${section.title}`);
      }
      for (const entry of section.entries) {
        if (entry.comment) {
          lines.push(`# ${entry.comment}`);
        }
        lines.push(`${entry.key}=${formatEnvValue(entry.value)}`);
      }
      return lines.join('\n');
    })
    .join('\n\n')
    .concat('\n');

export const writeRepoFile = async (relativePath, content, { overwrite = false, mode = 0o600 } = {}) => {
  const absolutePath = resolveRepoPath(relativePath);
  if (!overwrite && existsSync(absolutePath)) {
    return false;
  }

  mkdirSync(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content, { mode });
  return true;
};

export const randomSecret = (length = 32) =>
  randomBytes(Math.max(length, 24))
    .toString('base64url')
    .replace(/[-_]/g, '')
    .slice(0, length);
