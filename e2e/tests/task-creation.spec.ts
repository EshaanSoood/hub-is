import { expect, test, type Page } from '@playwright/test';
import { authenticateAsUserA } from '../helpers/auth';
import {
  archiveMostRecentTaskByTitleIncludes,
  waitForHomeTaskByTitleIncludes,
} from '../helpers/db';

const LIVE_TIMEOUT_MS = 60_000;

const openHubHome = async (page: Page): Promise<void> => {
  await page.goto('/projects', { waitUntil: 'domcontentloaded', timeout: LIVE_TIMEOUT_MS });
  await page.waitForLoadState('networkidle', { timeout: LIVE_TIMEOUT_MS }).catch(() => undefined);
  await expect(page.getByRole('heading', { name: /^myHub$/i }).first()).toBeVisible({ timeout: 15_000 });
};

const openTasksSurface = async (page: Page): Promise<void> => {
  const primaryNav = page.getByRole('navigation', { name: /^Primary$/i });
  const tasksButton = primaryNav.getByRole('button', { name: /^Tasks$/i });
  await expect(tasksButton).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
  await tasksButton.click();
  await expect(page).toHaveURL(/\/projects\?surface=tasks(?:&|$)/, { timeout: LIVE_TIMEOUT_MS });
};

const openTaskCaptureDialog = async (page: Page, draft: string) => {
  const captureInput = page.getByPlaceholder(/Capture for tasks/i);
  await expect(captureInput).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
  await captureInput.fill(draft);
  await captureInput.press('Enter');

  const dialog = page.getByRole('dialog', { name: /Confirm Task/i });
  await expect(dialog).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
  return dialog;
};

test('sidebar Tasks quick-input creates a task and updates home state without reload', async ({ page }) => {
  test.setTimeout(LIVE_TIMEOUT_MS);
  const token = await authenticateAsUserA(page);
  await openHubHome(page);
  await openTasksSurface(page);

  const uniqueToken = Math.random().toString(36).replace(/[^a-z]+/g, '').slice(0, 8);
  const dialog = await openTaskCaptureDialog(page, `sidebar task ${uniqueToken} today at 5pm`);
  await expect(dialog.getByLabel(/^Task title$/i)).toHaveValue(new RegExp(uniqueToken, 'i'), { timeout: LIVE_TIMEOUT_MS });
  await expect(dialog.getByLabel(/^Due$/i)).not.toHaveValue('', { timeout: LIVE_TIMEOUT_MS });

  try {
    const createRequest = page.waitForResponse(
      (response) => response.url().includes('/api/hub/tasks') && response.request().method() === 'POST',
      { timeout: LIVE_TIMEOUT_MS },
    );
    await dialog.getByRole('button', { name: /^Save$/i }).click({ force: true });
    await createRequest;
    await expect(dialog).toBeHidden({ timeout: LIVE_TIMEOUT_MS });

    const createdTask = await waitForHomeTaskByTitleIncludes(token, uniqueToken, LIVE_TIMEOUT_MS);
    expect(createdTask).not.toBeNull();
  } finally {
    await archiveMostRecentTaskByTitleIncludes(token, uniqueToken).catch(() => undefined);
  }
});

test('Tasks surface forces task routing for ambiguous natural-language drafts', async ({ page }) => {
  test.setTimeout(LIVE_TIMEOUT_MS);
  await authenticateAsUserA(page);
  await openHubHome(page);
  await openTasksSurface(page);

  const dialog = await openTaskCaptureDialog(page, 'Lunch with Maya tomorrow at 1pm');
  await expect(dialog).toContainText(/Type/i);
  await expect(dialog.getByText(/^Task$/i).first()).toBeVisible();
  await expect(dialog.getByLabel(/^Due$/i)).not.toHaveValue('', { timeout: LIVE_TIMEOUT_MS });

  await dialog.getByRole('button', { name: /^Cancel$/i }).click({ force: true });
  await expect(dialog).toBeHidden({ timeout: LIVE_TIMEOUT_MS });
});
