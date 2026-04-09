import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { Page } from '@playwright/test';
import type { JourneyScenario } from './stateTags.ts';

export interface CaptureInput {
  page: Page;
  scenario: JourneyScenario;
  phase: string;
  state: string;
  viewport: string;
  screenshotsDir?: string;
  fullPage?: boolean;
}

const sanitize = (value: string): string => {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
};

export const resolveScreenshotsDir = (): string => {
  return path.resolve(
    process.cwd(),
    process.env.JOURNEY_SCREENSHOT_DIR || path.join('e2e', 'user-journey-verification', 'screenshots'),
  );
};

export const screenshotFileName = (
  scenario: JourneyScenario,
  phase: string,
  state: string,
  viewport: string,
): string => {
  return `${sanitize(scenario)}-${sanitize(phase)}-${sanitize(state)}-${sanitize(viewport)}.png`;
};

export const captureCheckpoint = async ({
  page,
  scenario,
  phase,
  state,
  viewport,
  screenshotsDir = resolveScreenshotsDir(),
  fullPage = true,
}: CaptureInput): Promise<string> => {
  await mkdir(screenshotsDir, { recursive: true });
  const fileName = screenshotFileName(scenario, phase, state, viewport);
  const filePath = path.join(screenshotsDir, fileName);
  await page.screenshot({ path: filePath, fullPage });
  return filePath;
};
