import type { Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const E2E_ACCESS_TOKEN_KEY = 'hub:e2e:access-token';

const parseEnvFile = (raw: string): Record<string, string> => {
  const parsed: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const splitIndex = trimmed.indexOf('=');
    if (splitIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, splitIndex).trim();
    let value = trimmed.slice(splitIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    parsed[key] = value;
  }
  return parsed;
};

export const readTokenAFromFile = (): string => {
  const tokensPath = resolve(__dirname, '..', '.env.tokens.local');
  const envMap = parseEnvFile(readFileSync(tokensPath, 'utf8'));
  const token = (envMap.TOKEN_A || '').trim();
  if (!token) {
    throw new Error(`TOKEN_A missing in ${tokensPath}`);
  }
  return token;
};

export const readTokenBFromFile = (): string => {
  const tokensPath = resolve(__dirname, '..', '.env.tokens.local');
  const envMap = parseEnvFile(readFileSync(tokensPath, 'utf8'));
  const token = (envMap.TOKEN_B || '').trim();
  if (!token) {
    throw new Error(`TOKEN_B missing in ${tokensPath}`);
  }
  return token;
};

export const authenticateAsUserA = async (page: Page): Promise<string> => {
  const token = (process.env.TOKEN_A || '').trim() || readTokenAFromFile();
  await page.addInitScript(
    ({ storageKey, accessToken }) => {
      window.localStorage.setItem(storageKey, accessToken);
    },
    { storageKey: E2E_ACCESS_TOKEN_KEY, accessToken: token },
  );
  return token;
};
