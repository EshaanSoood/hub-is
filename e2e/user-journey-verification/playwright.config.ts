import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const baseURL = (process.env.E2E_BASE_URL || process.env.PLAYWRIGHT_BASE_URL || '').trim();
if (!baseURL) {
  throw new Error('Missing E2E_BASE_URL (or PLAYWRIGHT_BASE_URL) for user journey verification.');
}

const suiteRoot = __dirname;
const configuredOutputDir = process.env.JOURNEY_PLAYWRIGHT_OUTPUT_DIR || path.join('test-results');
const outputDir = path.isAbsolute(configuredOutputDir)
  ? configuredOutputDir
  : path.resolve(process.cwd(), configuredOutputDir);
const tsconfigPath = path.resolve(__dirname, '..', 'tsconfig.json');

export default defineConfig({
  tsconfig: tsconfigPath,
  testDir: suiteRoot,
  testMatch: ['verify-user-journey.spec.ts', 'verify-motion.spec.ts'],
  timeout: 180_000,
  expect: {
    timeout: 20_000,
  },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [
    ['list'],
    [path.join(suiteRoot, 'reporters', 'journey-reporter.ts')],
  ],
  outputDir,
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    {
      name: 'tablet',
      use: {
        ...devices['iPad Pro 11'],
      },
    },
    {
      name: 'mobile',
      use: {
        ...devices['iPhone 14'],
      },
    },
  ],
});
