import type { Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnvFile } from './env';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const tokensPath = resolve(__dirname, '..', '.env.tokens.local');

const E2E_ACCESS_TOKEN_KEY = 'hub:e2e:access-token';
const readTokenFromFile = (tokenKey: 'TOKEN_A' | 'TOKEN_B'): string => {
  const envMap = parseEnvFile(readFileSync(tokensPath, 'utf8'));
  const token = (envMap[tokenKey] || '').trim();
  if (!token) {
    throw new Error(`${tokenKey} missing in ${tokensPath}`);
  }
  return token;
};

export const readTokenAFromFile = (): string => {
  return readTokenFromFile('TOKEN_A');
};

export const readTokenBFromFile = (): string => {
  return readTokenFromFile('TOKEN_B');
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
