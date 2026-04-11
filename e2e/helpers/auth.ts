import type { Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnvFile } from './env';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '..', '..');
const defaultTokensPath = resolve(__dirname, '..', '.env.tokens.local');
const localDevTokensPath = resolve(__dirname, '..', '..', '.env.local.tokens.local');
const localTokenMintScriptPath = resolve(repoRoot, 'scripts', 'dev', 'mint-local-tokens.mjs');

const E2E_ACCESS_TOKEN_KEY = 'hub:e2e:access-token';
const LOCAL_TOKEN_REFRESH_LEEWAY_MS = 30_000;
const readBaseUrl = (): string =>
  String(
    process.env.E2E_BASE_URL
    || process.env.PLAYWRIGHT_BASE_URL
    || process.env.BASE_URL
    || process.env.HUB_BASE_URL
    || '',
  ).trim();

const shouldUseLocalDevTokens = (): boolean => {
  const baseUrl = readBaseUrl();
  if (!baseUrl) {
    return false;
  }
  try {
    const hostname = new URL(baseUrl).hostname;
    return hostname === '127.0.0.1' || hostname === 'localhost';
  } catch {
    return false;
  }
};

const resolveTokensPath = (): string => (shouldUseLocalDevTokens() ? localDevTokensPath : defaultTokensPath);

const decodeJwtExpiryMs = (token: string): number => {
  try {
    const [, payloadBase64] = token.split('.');
    if (!payloadBase64) {
      return 0;
    }
    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString('utf8')) as { exp?: unknown };
    return typeof payload.exp === 'number' ? payload.exp * 1000 : 0;
  } catch {
    return 0;
  }
};

const ensureFreshLocalDevTokens = (): void => {
  try {
    const envMap = parseEnvFile(readFileSync(localDevTokensPath, 'utf8'));
    const existingToken = String(envMap.TOKEN_A || '').trim();
    const expiresAt = decodeJwtExpiryMs(existingToken);
    if (existingToken && expiresAt > Date.now() + LOCAL_TOKEN_REFRESH_LEEWAY_MS) {
      return;
    }
  } catch {
    // Refresh below.
  }

  try {
    execFileSync('node', [localTokenMintScriptPath], {
      cwd: repoRoot,
      stdio: 'ignore',
    });
  } catch (error) {
    throw new Error(
      `Failed to refresh local dev tokens via ${localTokenMintScriptPath} from ${repoRoot}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
};

const readTokenFromFile = (tokenKey: 'TOKEN_A' | 'TOKEN_B'): string => {
  if (shouldUseLocalDevTokens()) {
    ensureFreshLocalDevTokens();
  }
  const tokensPath = resolveTokensPath();
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
  const token = shouldUseLocalDevTokens() ? readTokenAFromFile() : ((process.env.TOKEN_A || '').trim() || readTokenAFromFile());
  await page.addInitScript(
    ({ storageKey, accessToken }) => {
      window.localStorage.setItem(storageKey, accessToken);
    },
    { storageKey: E2E_ACCESS_TOKEN_KEY, accessToken: token },
  );
  return token;
};
