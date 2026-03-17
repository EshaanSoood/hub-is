
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, request } from '@playwright/test';
import { requireWorkflowAccounts, workflowConfig } from './workflowEnv.mjs';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));

let mintedTokens = null;
const JWT_PATTERN = /eyJ[0-9A-Za-z_-]+\.[0-9A-Za-z_-]+\.[0-9A-Za-z_-]+/g;
const TOKEN_ASSIGNMENT_PATTERN = /(TOKEN_[A-Z_]+=)([^\s]+)/g;
const ACCESS_TOKEN_JSON_PATTERN = /("access_token"\s*:\s*")([^"]+)"/g;
const BEARER_PATTERN = /(Bearer\s+)([^\s]+)/gi;
const MAX_ERROR_DETAIL_CHARS = 2_000;

const redactSecrets = (value, secrets = []) => {
  let output = String(value || '');
  output = output.replace(JWT_PATTERN, '[REDACTED_JWT]');
  output = output.replace(TOKEN_ASSIGNMENT_PATTERN, '$1[REDACTED_SECRET]');
  output = output.replace(ACCESS_TOKEN_JSON_PATTERN, '$1[REDACTED_SECRET]"');
  output = output.replace(BEARER_PATTERN, '$1[REDACTED_SECRET]');
  for (const secretRaw of secrets) {
    const secret = String(secretRaw || '').trim();
    if (secret) {
      output = output.split(secret).join('[REDACTED_SECRET]');
    }
  }
  return output.length > MAX_ERROR_DETAIL_CHARS ? `${output.slice(0, MAX_ERROR_DETAIL_CHARS)}...[truncated]` : output;
};

const parseEnvLine = (line) => {
  const trimmed = String(line || '').trim();
  if (!trimmed || trimmed.startsWith('#')) {
    return null;
  }

  const separator = trimmed.indexOf('=');
  if (separator <= 0) {
    return null;
  }

  const key = trimmed.slice(0, separator).trim();
  let value = trimmed.slice(separator + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"'))
    || (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return { key, value };
};

const mintWorkflowTokens = () => {
  if (mintedTokens) {
    return mintedTokens;
  }

  requireWorkflowAccounts();

  const tempDirectory = mkdtempSync(join(tmpdir(), 'workflow-e2e-tokens-'));
  const outputFile = join(tempDirectory, '.env.workflow.tokens.local');

  const environment = {
    ...process.env,
    HUB_SMOKE_USER_A_USERNAME: workflowConfig.accountA.email,
    HUB_SMOKE_USER_A_PASSWORD: workflowConfig.accountA.password,
    HUB_SMOKE_USER_B_USERNAME: workflowConfig.accountB.email,
    HUB_SMOKE_USER_B_PASSWORD: workflowConfig.accountB.password,
    HUB_SMOKE_TOKENS_FILE: outputFile,
  };

  let raw;
  try {
    try {
      execFileSync('node', ['scripts/mint-contract-smoke-tokens.mjs'], {
        cwd: repoRoot,
        env: environment,
        stdio: 'pipe',
        encoding: 'utf8',
        timeout: 90_000,
        killSignal: 'SIGKILL',
        maxBuffer: 2 * 1024 * 1024,
      });
    } catch (error) {
      const secrets = [
        workflowConfig.accountA.email,
        workflowConfig.accountA.password,
        workflowConfig.accountB.email,
        workflowConfig.accountB.password,
      ];
      const stdout = error && typeof error === 'object' && 'stdout' in error
        ? redactSecrets(String(error.stdout || '').trim(), secrets)
        : '';
      const stderr = error && typeof error === 'object' && 'stderr' in error
        ? redactSecrets(String(error.stderr || '').trim(), secrets)
        : '';
      const details = [stdout ? `stdout=${stdout}` : '', stderr ? `stderr=${stderr}` : ''].filter(Boolean).join(' ');
      throw new Error(`Token mint script execution failed.${details ? ` ${details}` : ''}`);
    }

    raw = readFileSync(outputFile, 'utf8');
  } finally {
    rmSync(tempDirectory, { recursive: true, force: true });
  }
  const entries = new Map();

  for (const line of raw.split(/\r?\n/)) {
    const parsed = parseEnvLine(line);
    if (parsed) {
      entries.set(parsed.key, parsed.value);
    }
  }

  const tokenA = String(entries.get('TOKEN_A') || '').trim();
  const tokenB = String(entries.get('TOKEN_B') || '').trim();

  if (!tokenA || !tokenB) {
    throw new Error('Token mint script did not output TOKEN_A/TOKEN_B as expected.');
  }

  mintedTokens = {
    a: {
      email: workflowConfig.accountA.email,
      password: workflowConfig.accountA.password,
      token: tokenA,
    },
    b: {
      email: workflowConfig.accountB.email,
      password: workflowConfig.accountB.password,
      token: tokenB,
    },
  };

  return mintedTokens;
};

export const mintToken = (email, password) => {
  const tokens = mintWorkflowTokens();
  const normalizedEmail = String(email || '').trim().toLowerCase();

  if (normalizedEmail === tokens.a.email.toLowerCase() && password === tokens.a.password) {
    return tokens.a.token;
  }

  if (normalizedEmail === tokens.b.email.toLowerCase() && password === tokens.b.password) {
    return tokens.b.token;
  }

  throw new Error('mintToken requested unsupported credentials. Use TEST_EMAIL_A/TEST_EMAIL_B credentials.');
};

export const bootstrapAuth = async (page, token) => {
  const apiContext = await request.newContext({
    baseURL: workflowConfig.baseUrl,
    extraHTTPHeaders: {
      Authorization: `Bearer ${String(token || '')}`,
    },
  });
  try {
    const response = await apiContext.get('/api/hub/me');
    expect(response.status(), 'Minted bearer token failed /api/hub/me preflight.').toBe(200);
  } finally {
    await apiContext.dispose();
  }
};

const completeKeycloakLogin = async (page, account) => {
  const usernameInput = page.locator('input[name="username"], input#username').first();
  await expect(usernameInput).toBeVisible({ timeout: 30_000 });
  await usernameInput.fill(account.email);

  const passwordInput = page.locator('input[name="password"], input#password').first();
  await expect(passwordInput).toBeVisible({ timeout: 10_000 });
  await passwordInput.fill(account.password);

  const submitButton = page.locator('input#kc-login, button#kc-login, button[type="submit"], input[type="submit"]').first();
  await expect(submitButton).toBeVisible({ timeout: 10_000 });

  await Promise.all([
    page.waitForURL((url) => !/auth\.eshaansood\.org$/i.test(url.hostname), { timeout: 60_000 }),
    submitButton.click(),
  ]);
};

const ensureProjectsIndexReady = async (page) => {
  const projectsHeading = page.getByRole('heading', { name: 'Projects' }).first();
  const projectList = page.getByRole('list', { name: 'Project list' });

  await page.goto('/projects', { waitUntil: 'domcontentloaded' });
  await expect(projectsHeading).toBeVisible({ timeout: 30_000 });
  await expect(projectList).toBeVisible({ timeout: 30_000 });
};

export const reopenStableProjectsPage = async (page) => {
  const context = page.context();
  const nextPage = await context.newPage();
  await ensureProjectsIndexReady(nextPage);
  await page.close().catch(() => {});
  return nextPage;
};

export const loginWithMintedToken = async (page, account) => {
  const token = mintToken(account.email, account.password);
  await bootstrapAuth(page, token);

  await page.goto('/projects', { waitUntil: 'domcontentloaded' });
  const projectsHeading = page.getByRole('heading', { name: 'Projects' }).first();
  const projectList = page.getByRole('list', { name: 'Project list' });
  if ((await projectsHeading.isVisible().catch(() => false)) && (await projectList.isVisible().catch(() => false))) {
    return;
  }

  const loginButton = page.getByRole('button', { name: /continue with keycloak|sign in with keycloak/i });
  await expect(loginButton).toBeVisible({ timeout: 20_000 });

  await loginButton.click();

  if (await projectsHeading.isVisible({ timeout: 10_000 }).catch(() => false)) {
    await ensureProjectsIndexReady(page);
    return;
  }

  await completeKeycloakLogin(page, account);
  await ensureProjectsIndexReady(page);
};

export const loginThroughBrowser = async (page, account) => {
  const token = mintToken(account.email, account.password);
  await bootstrapAuth(page, token);

  await page.goto('/projects', { waitUntil: 'domcontentloaded' });
  const projectsHeading = page.getByRole('heading', { name: 'Projects' }).first();
  const projectList = page.getByRole('list', { name: 'Project list' });
  if ((await projectsHeading.isVisible().catch(() => false)) && (await projectList.isVisible().catch(() => false))) {
    return;
  }

  const loginButton = page.getByRole('button', { name: /continue with keycloak|sign in with keycloak/i });
  await expect(loginButton).toBeVisible({ timeout: 20_000 });
  await loginButton.click();

  await completeKeycloakLogin(page, account);
  await ensureProjectsIndexReady(page);
};
