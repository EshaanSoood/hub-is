import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = fileURLToPath(new URL('.', import.meta.url));
const storageStatePath = resolve(currentDir, '..', '..', '.playwright', 'project-space-owner-storage-state.json');

const baseURL = (
  process.env.E2E_BASE_URL
  || process.env.PLAYWRIGHT_BASE_URL
  || process.env.BASE_URL
  || process.env.HUB_PUBLIC_APP_URL
  || 'http://127.0.0.1:5173'
).trim().replace(/\/+$/, '');

export default defineConfig({
  testDir: '.',
  testMatch: /verify-project-space-workspace\.spec\.ts$/,
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  retries: 0,
  outputDir: './test-results',
  globalSetup: './seed.ts',
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL,
    browserName: 'chromium',
    storageState: storageStatePath,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: {
        viewport: { width: 1280, height: 800 },
      },
    },
  ],
});
