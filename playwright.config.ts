import { defineConfig } from '@playwright/test';
import { DEFAULT_BASE_URL } from './e2e/utils/auth-state';

const baseURL = (process.env.BASE_URL || '').trim();
const hubBaseUrl = (process.env.HUB_BASE_URL || '').trim();
const resolvedBaseUrl = (baseURL || hubBaseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: {
    timeout: 20_000,
  },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: resolvedBaseUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
});
