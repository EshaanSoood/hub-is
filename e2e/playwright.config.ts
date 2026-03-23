import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  tsconfig: './tsconfig.json',
  testDir: './tests',
  timeout: 30_000,
  retries: 1,
  reporter: 'html',
  globalSetup: './global-setup.ts',
  outputDir: './test-results',
  use: {
    baseURL: 'https://eshaansood.org',
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
