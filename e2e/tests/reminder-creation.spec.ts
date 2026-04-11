import { expect, test, type Page } from '@playwright/test';
import { authenticateAsUserA } from '../helpers/auth';
import { dismissReminderViaApi, waitForReminderByTitleIncludes } from '../helpers/db';

const LIVE_TIMEOUT_MS = 60_000;

const openHubHome = async (page: Page): Promise<void> => {
  await page.goto('/projects', { waitUntil: 'domcontentloaded', timeout: LIVE_TIMEOUT_MS });
  await page.waitForLoadState('networkidle', { timeout: LIVE_TIMEOUT_MS }).catch(() => undefined);
  await expect(page.getByRole('heading', { name: /^(Hub|myHub)$/i }).first()).toBeVisible({ timeout: 15_000 });
};

const openSidebarSurface = async (page: Page, label: 'Reminders', queryValue: 'reminders') => {
  const primaryNav = page.getByRole('navigation', { name: /^Primary$/i });
  const trigger = primaryNav.getByRole('button', { name: new RegExp(`^${label}$`, 'i') });
  await expect(trigger).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
  await trigger.click();
  await expect(page).toHaveURL(new RegExp(`/projects\\?surface=${queryValue}(?:&|$)`), { timeout: LIVE_TIMEOUT_MS });
};

test('sidebar Reminders quick-input shows parsed preview and creates without reload', async ({ page }) => {
  test.setTimeout(LIVE_TIMEOUT_MS);
  const token = await authenticateAsUserA(page);
  await openHubHome(page);
  await openSidebarSurface(page, 'Reminders', 'reminders');

  const uniqueToken = Math.random().toString(36).replace(/[^a-z]+/g, '').slice(0, 8);
  const captureInput = page.getByPlaceholder(/Capture for reminders/i);
  await expect(captureInput).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
  await captureInput.fill(`reminder smoke ${uniqueToken} tomorrow at 8pm`);
  await captureInput.press('Enter');

  const dialog = page.getByRole('dialog', { name: /Confirm Reminder/i });
  await expect(dialog).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
  await expect(dialog.getByLabel(/^Reminder title$/i)).toHaveValue(new RegExp(uniqueToken, 'i'), { timeout: LIVE_TIMEOUT_MS });
  await expect(dialog.getByLabel(/^Remind at$/i)).not.toHaveValue('', { timeout: LIVE_TIMEOUT_MS });

  let createdReminderId: string | null = null;

  try {
    const createRequest = page.waitForResponse(
      (response) => response.url().includes('/api/hub/reminders') && response.request().method() === 'POST',
      { timeout: LIVE_TIMEOUT_MS },
    );
    await dialog.getByRole('button', { name: /^Save$/i }).click({ force: true });
    const createResponse = await createRequest;
    const createPayload = await createResponse.json().catch(() => null);
    createdReminderId = createPayload?.data?.reminder?.reminder_id || createPayload?.data?.reminder_id || null;

    expect([200, 201]).toContain(createResponse.status());
    await expect(dialog).toBeHidden({ timeout: LIVE_TIMEOUT_MS });

    if (!createdReminderId) {
      const createdReminder = await waitForReminderByTitleIncludes(token, uniqueToken, LIVE_TIMEOUT_MS);
      expect(createdReminder).not.toBeNull();
      createdReminderId = createdReminder?.reminder_id || null;
    }
  } finally {
    if (createdReminderId) {
      await dismissReminderViaApi(token, createdReminderId).catch(() => undefined);
    }
  }
});

test('sidebar Reminders quick-input keeps the parsed form open when time is missing', async ({ page }) => {
  test.setTimeout(LIVE_TIMEOUT_MS);
  await authenticateAsUserA(page);
  await openHubHome(page);
  await openSidebarSurface(page, 'Reminders', 'reminders');

  const captureInput = page.getByPlaceholder(/Capture for reminders/i);
  await expect(captureInput).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
  await captureInput.fill('just some text no time');
  await captureInput.press('Enter');

  const dialog = page.getByRole('dialog', { name: /Confirm Reminder/i });
  await expect(dialog).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
  await expect(dialog.getByLabel(/^Reminder title$/i)).toHaveValue(/just some text no time/i);
  await expect(dialog.getByLabel(/^Remind at$/i)).toHaveValue('');

  await dialog.getByRole('button', { name: /^Save$/i }).click({ force: true });
  await expect(dialog.getByRole('alert')).toContainText(/title and time|time is invalid/i, { timeout: LIVE_TIMEOUT_MS });
  await expect(dialog).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
});
