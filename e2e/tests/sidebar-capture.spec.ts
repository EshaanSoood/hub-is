import { expect, test, type Page } from '@playwright/test';
import { authenticateAsUserA } from '../helpers/auth';
import {
  archiveMostRecentTaskByTitleIncludes,
  archiveRecordViaApi,
  waitForHomeEventByTitleIncludes,
  waitForHomeTaskByTitleIncludes,
} from '../helpers/db';

const LIVE_TIMEOUT_MS = 60_000;

const openHubHome = async (page: Page): Promise<void> => {
  await page.goto('/projects', { waitUntil: 'domcontentloaded', timeout: LIVE_TIMEOUT_MS });
  await page.waitForLoadState('networkidle', { timeout: LIVE_TIMEOUT_MS }).catch(() => undefined);
  await expect(page.getByRole('heading', { name: /^(Hub|myHub)$/i }).first()).toBeVisible({ timeout: 15_000 });
};

const openSidebarSurface = async (page: Page, label: 'Tasks' | 'Calendar', queryValue: 'tasks' | 'calendar') => {
  const primaryNav = page.getByRole('navigation', { name: /^Primary$/i });
  const trigger = primaryNav.getByRole('button', { name: new RegExp(`^${label}$`, 'i') });
  await expect(trigger).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
  await trigger.click();
  await expect(page).toHaveURL(new RegExp(`/projects\\?surface=${queryValue}(?:&|$)`), { timeout: LIVE_TIMEOUT_MS });
};

test('sidebar Tasks quick-input creates a task that appears without reload', async ({ page }) => {
  const token = await authenticateAsUserA(page);
  await openHubHome(page);
  await openSidebarSurface(page, 'Tasks', 'tasks');

  const uniqueToken = Math.random().toString(36).replace(/[^a-z]+/g, '').slice(0, 8);
  const captureInput = page.getByPlaceholder(/Capture for tasks/i);
  await expect(captureInput).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
  await captureInput.fill(`sidebar task ${uniqueToken} today at 5pm`);
  await captureInput.press('Enter');

  const dialog = page.getByRole('dialog', { name: /Confirm Task/i });
  await expect(dialog).toBeVisible({ timeout: LIVE_TIMEOUT_MS });

  try {
    const saveButton = dialog.getByRole('button', { name: /^Save$/i });
    await expect(saveButton).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
    await expect(saveButton).toBeEnabled({ timeout: LIVE_TIMEOUT_MS });
    const createRequest = page.waitForResponse(
      (response) => response.url().includes('/api/hub/tasks') && response.request().method() === 'POST',
      { timeout: LIVE_TIMEOUT_MS },
    );
    await saveButton.click();
    await createRequest;

    await expect(dialog).toBeHidden({ timeout: LIVE_TIMEOUT_MS });
    const createdTask = await waitForHomeTaskByTitleIncludes(token, uniqueToken, LIVE_TIMEOUT_MS);
    expect(createdTask).not.toBeNull();
  } finally {
    await archiveMostRecentTaskByTitleIncludes(token, uniqueToken).catch(() => undefined);
  }
});

test('sidebar Calendar quick-input creates an event that appears without reload', async ({ page }) => {
  test.setTimeout(60_000);
  const token = await authenticateAsUserA(page);
  await openHubHome(page);
  await openSidebarSurface(page, 'Calendar', 'calendar');

  const uniqueToken = Math.random().toString(36).replace(/[^a-z]+/g, '').slice(0, 8);
  const captureInput = page.getByPlaceholder(/Capture for calendar/i);
  await expect(captureInput).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
  await captureInput.fill(`sidebar calendar ${uniqueToken} tomorrow 9am to 10am`);
  await captureInput.press('Enter');

  const dialog = page.getByRole('dialog', { name: /Confirm Calendar Event/i });
  await expect(dialog).toBeVisible({ timeout: LIVE_TIMEOUT_MS });

  let createdRecordId: string | null = null;

  try {
    const startInput = dialog.locator('input[type="datetime-local"]').nth(0);
    const endInput = dialog.locator('input[type="datetime-local"]').nth(1);
    await expect(startInput).not.toHaveValue('', { timeout: LIVE_TIMEOUT_MS });
    await expect(endInput).not.toHaveValue('', { timeout: LIVE_TIMEOUT_MS });
    await dialog.getByLabel(/^Event title$/i).fill(`sidebar calendar ${uniqueToken}`);

    const saveButton = dialog.getByRole('button', { name: /^Save$/i });
    await expect(saveButton).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
    await expect(saveButton).toBeEnabled({ timeout: LIVE_TIMEOUT_MS });
    const createRequest = page.waitForResponse(
      (response) =>
        response.url().includes('/api/hub/projects/')
        && response.url().includes('/events/from-nlp')
        && response.request().method() === 'POST',
      { timeout: 15_000 },
    );
    await saveButton.click();
    const createResponse = await createRequest;
    const createPayload = await createResponse.json().catch(() => null);
    createdRecordId = createPayload?.data?.record?.record_id || createPayload?.data?.record_id || null;

    expect(createResponse.ok()).toBeTruthy();
    if (!createdRecordId) {
      const createdEvent = await waitForHomeEventByTitleIncludes(token, uniqueToken, 15_000);
      expect(createdEvent).not.toBeNull();
      createdRecordId = typeof (createdEvent as { record_id?: unknown }).record_id === 'string'
        ? (createdEvent as { record_id: string }).record_id
        : null;
    }

    await expect(dialog).toBeHidden({ timeout: LIVE_TIMEOUT_MS });
  } finally {
    if (createdRecordId) {
      await archiveRecordViaApi(token, createdRecordId).catch(() => undefined);
    }
  }
});
