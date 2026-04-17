import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import {
  collectSurfaceAuditReport,
  installAnnouncementRecorder,
  type SurfaceAuditReport,
  waitForSurfaceShell,
  writeSurfaceAuditArtifacts,
} from './surfaceAudit.ts';

const DEFAULT_ROUTE = '/projects';
const OUTPUT_DIR_NAME = 'hub-home-audit';
const OUTPUT_DIR_LABEL = 'e2e/artifacts/hub-home-audit';
const FILE_PREFIX = 'hub-home';

export type HubHomeAuditReport = SurfaceAuditReport;

export const waitForHubHomeAuditReady = async (page: Page): Promise<void> => {
  await waitForSurfaceShell(page);
  await expect(page.getByRole('button', { name: /Project Lens|Stream/i }).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeAttached({ timeout: 30_000 });
};

export const collectHubHomeAudit = async (page: Page): Promise<HubHomeAuditReport> => {
  return collectSurfaceAuditReport(page, {
    route: DEFAULT_ROUTE,
    surfaceLabel: 'Hub Home',
  });
};

export const writeHubHomeAuditArtifacts = async (report: HubHomeAuditReport): Promise<string> => {
  return writeSurfaceAuditArtifacts(report, {
    outputDirName: OUTPUT_DIR_NAME,
    outputDirLabel: OUTPUT_DIR_LABEL,
    filePrefix: FILE_PREFIX,
  });
};

export const runHubHomeAudit = async (page: Page): Promise<{ outputDir: string; report: HubHomeAuditReport }> => {
  await installAnnouncementRecorder(page);
  await page.goto(DEFAULT_ROUTE, { waitUntil: 'domcontentloaded' });
  await waitForHubHomeAuditReady(page);
  const report = await collectHubHomeAudit(page);
  const outputDir = await writeHubHomeAuditArtifacts(report);
  return { outputDir, report };
};
