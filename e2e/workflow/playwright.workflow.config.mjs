
import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { workflowConfig } from './helpers/workflowEnv.mjs';

const testDirectory = fileURLToPath(new URL('./', import.meta.url));

export default defineConfig({
  testDir: testDirectory,
  testMatch: 'workflow.spec.mjs',
  timeout: 120_000,
  expect: {
    timeout: 15_000,
  },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: workflowConfig.baseUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
});
