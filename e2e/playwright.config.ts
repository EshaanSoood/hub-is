import { defineConfig, devices } from '@playwright/test';

const baseURL = (process.env.E2E_BASE_URL || process.env.PLAYWRIGHT_BASE_URL || '').trim();
if (!baseURL) {
  throw new Error('Missing E2E_BASE_URL (or PLAYWRIGHT_BASE_URL) for Playwright E2E tests.');
}

export default defineConfig({
  tsconfig: './tsconfig.json',
  testDir: './tests',
  timeout: 30_000,
  retries: 1,
  reporter: 'html',
  globalSetup: './global-setup.ts',
  outputDir: './test-results',
  use: {
    baseURL,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
});
