import { defineConfig } from '@playwright/test';
import { OWNER_STORAGE_STATE_PATH } from './e2e/support/paths';

const rawBaseUrl = String(
  process.env.E2E_BASE_URL
  || process.env.PLAYWRIGHT_BASE_URL
  || process.env.BASE_URL
  || process.env.HUB_BASE_URL
  || '',
);
const trimmedBaseUrl = rawBaseUrl.trim();
const baseURL = (trimmedBaseUrl || 'https://eshaansood.org').replace(/\/+$/, '');

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  outputDir: './playwright-results',
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['./e2e/reporters/audit-reporter.ts'],
  ],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'chromium',
      dependencies: ['setup'],
      testIgnore: /auth\.setup\.ts/,
      use: {
        browserName: 'chromium',
        storageState: OWNER_STORAGE_STATE_PATH,
      },
    },
  ],
});
