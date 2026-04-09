import { execFile } from 'node:child_process';
import { readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const JWT_PATTERN = /eyJ[0-9A-Za-z_-]+\.[0-9A-Za-z_-]+\.[0-9A-Za-z_-]+/g;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '..', '..');
const mintScriptPath = resolve(repoRoot, 'scripts/mint-contract-smoke-tokens.mjs');
const smokeUsersEnvFile = resolve(repoRoot, '.env.contract-smoke.users.local');
const e2eSmokeUsersEnvFile = resolve(repoRoot, 'e2e', '.env.users.local');

const redactSecrets = (value: string, secrets: string[] = []): string => {
  let output = value.replace(JWT_PATTERN, '[REDACTED_JWT]');
  for (const secretRaw of secrets) {
    const secret = String(secretRaw || '').trim();
    if (secret) {
      output = output.split(secret).join('[REDACTED_SECRET]');
    }
  }
  return output;
};
const firstNonEmpty = (...values: Array<string | undefined>): string =>
  values.find((value) => Boolean(String(value || '').trim()))?.trim() || '';

const parseEnvLine = (line: string): { key: string; value: string } | null => {
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
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  return { key, value };
};

const readOptionalEnvFile = async (filePath: string): Promise<Record<string, string>> => {
  try {
    const raw = await readFile(filePath, 'utf8');
    const output: Record<string, string> = {};
    for (const line of raw.split(/\r?\n/)) {
      const parsed = parseEnvLine(line);
      if (parsed) {
        output[parsed.key] = parsed.value;
      }
    }
    return output;
  } catch {
    return {};
  }
};

const parseEnvValue = (raw: string, key: string): string => {
  for (const line of raw.split(/\r?\n/)) {
    const parsed = parseEnvLine(line);
    if (parsed?.key === key) {
      return parsed.value;
    }
  }
  return '';
};

interface TestAccount {
  email: string;
  password: string;
}

export const resolveLinkedTestAccounts = async (): Promise<{ accountA: TestAccount; accountB: TestAccount }> => {
  const rootFileEnv = await readOptionalEnvFile(smokeUsersEnvFile);
  const e2eFileEnv = await readOptionalEnvFile(e2eSmokeUsersEnvFile);

  const accountA = {
    email: firstNonEmpty(
      process.env.TEST_EMAIL_A,
      process.env.HUB_SMOKE_USER_A_USERNAME,
      e2eFileEnv.TEST_EMAIL_A,
      e2eFileEnv.HUB_SMOKE_USER_A_USERNAME,
      rootFileEnv.TEST_EMAIL_A,
      rootFileEnv.HUB_SMOKE_USER_A_USERNAME,
    ),
    password: firstNonEmpty(
      process.env.TEST_PASSWORD_A,
      process.env.HUB_SMOKE_USER_A_PASSWORD,
      e2eFileEnv.TEST_PASSWORD_A,
      e2eFileEnv.HUB_SMOKE_USER_A_PASSWORD,
      rootFileEnv.TEST_PASSWORD_A,
      rootFileEnv.HUB_SMOKE_USER_A_PASSWORD,
    ),
  };
  const accountB = {
    email: firstNonEmpty(
      process.env.TEST_EMAIL_B,
      process.env.HUB_SMOKE_USER_B_USERNAME,
      e2eFileEnv.TEST_EMAIL_B,
      e2eFileEnv.HUB_SMOKE_USER_B_USERNAME,
      rootFileEnv.TEST_EMAIL_B,
      rootFileEnv.HUB_SMOKE_USER_B_USERNAME,
    ),
    password: firstNonEmpty(
      process.env.TEST_PASSWORD_B,
      process.env.HUB_SMOKE_USER_B_PASSWORD,
      e2eFileEnv.TEST_PASSWORD_B,
      e2eFileEnv.HUB_SMOKE_USER_B_PASSWORD,
      rootFileEnv.TEST_PASSWORD_B,
      rootFileEnv.HUB_SMOKE_USER_B_PASSWORD,
    ),
  };

  const missing: string[] = [];
  if (!accountA.email) {
    missing.push('TEST_EMAIL_A (or HUB_SMOKE_USER_A_USERNAME)');
  }
  if (!accountA.password) {
    missing.push('TEST_PASSWORD_A (or HUB_SMOKE_USER_A_PASSWORD)');
  }
  if (!accountB.email) {
    missing.push('TEST_EMAIL_B (or HUB_SMOKE_USER_B_USERNAME)');
  }
  if (!accountB.password) {
    missing.push('TEST_PASSWORD_B (or HUB_SMOKE_USER_B_PASSWORD)');
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing account credentials: ${missing.join(', ')}. You can set TEST_* vars, HUB_SMOKE_USER_* vars, or populate .env.contract-smoke.users.local or e2e/.env.users.local.`,
    );
  }

  return { accountA, accountB };
};

const mintTokensWithScript = async (
  accountA: TestAccount,
  accountB: TestAccount,
): Promise<{ tokenA: string; tokenB: string }> => {
  const outputFile = join(
    tmpdir(),
    `hub-e2e-token-${Date.now()}-${Math.random().toString(16).slice(2)}.env`,
  );

  try {
    await execFileAsync('node', [mintScriptPath], {
      cwd: repoRoot,
      timeout: 90_000,
      killSignal: 'SIGKILL',
      maxBuffer: 2 * 1024 * 1024,
      env: {
        ...process.env,
        HUB_SMOKE_USER_A_USERNAME: accountA.email,
        HUB_SMOKE_USER_A_PASSWORD: accountA.password,
        HUB_SMOKE_USER_B_USERNAME: accountB.email,
        HUB_SMOKE_USER_B_PASSWORD: accountB.password,
        HUB_SMOKE_TOKENS_FILE: outputFile,
      },
    });

    const raw = await readFile(outputFile, 'utf8');
    const tokenA = parseEnvValue(raw, 'TOKEN_A');
    const tokenB = parseEnvValue(raw, 'TOKEN_B');
    if (!tokenA || !tokenB) {
      throw new Error('Mint script completed but TOKEN_A/TOKEN_B were missing from output.');
    }
    return { tokenA, tokenB };
  } catch (error) {
    if (error && typeof error === 'object' && 'stderr' in error) {
      const secrets = [accountA.email, accountA.password, accountB.email, accountB.password];
      const stderr = redactSecrets(String((error as { stderr?: string }).stderr || ''), secrets);
      const stdout = redactSecrets(String((error as { stdout?: string }).stdout || ''), secrets);
      throw new Error(`Token mint failed. stdout=${stdout} stderr=${stderr}`.trim());
    }
    throw error;
  } finally {
    await rm(outputFile, { force: true }).catch(() => {
      // no-op
    });
  }
};

export const mintTokenForAccount = async (email: string, password: string): Promise<string> => {
  const minted = await mintTokensWithScript({ email, password }, { email, password });
  return minted.tokenA;
};

export const mintTokensForAccounts = async (
  accountA: TestAccount,
  accountB: TestAccount,
): Promise<{ tokenA: string; tokenB: string }> => {
  return mintTokensWithScript(accountA, accountB);
};
