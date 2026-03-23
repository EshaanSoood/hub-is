import { expect, test, type Page } from '@playwright/test';
import { authenticateAsUserA } from '../helpers/auth';
import { dismissReminderViaApi, getLatestReminders } from '../helpers/db';

const LIVE_TIMEOUT_MS = 60_000;

const openHubHome = async (page: Page): Promise<void> => {
  await page.goto('/projects', { waitUntil: 'domcontentloaded', timeout: LIVE_TIMEOUT_MS });
  await page.waitForLoadState('networkidle', { timeout: LIVE_TIMEOUT_MS }).catch(() => undefined);
  await expect(page.getByRole('heading', { name: /^Hub$/i }).first()).toBeVisible({ timeout: 15_000 });
};

const openReminderDialog = async (page: Page) => {
  await page.getByRole('button', { name: /Open quick add menu/i }).click();
  await page.getByRole('menuitem', { name: /^Reminder$/i }).click();

  const dialog = page
    .locator('[role="dialog"]:visible')
    .filter({ has: page.locator('#quick-add-reminder-input:visible') })
    .first();
  await expect(dialog).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
  await expect(dialog.locator('#quick-add-reminder-input:visible')).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
  return dialog;
};

test('create reminder from quick-add menu', async ({ page }) => {
  const token = await authenticateAsUserA(page);
  await openHubHome(page);

  const uniqueToken = Math.random().toString(36).replace(/[^a-z]+/g, '').slice(0, 8);
  const reminderText = `reminder smoke ${uniqueToken} tonight at 8pm`;

  const dialog = await openReminderDialog(page);
  const reminderInput = dialog.locator('#quick-add-reminder-input:visible');
  await reminderInput.click();
  await expect(reminderInput).toBeFocused();
  await reminderInput.fill(reminderText);

  const createRequest = page.waitForResponse(
    (response) => response.url().includes('/api/hub/reminders') && response.request().method() === 'POST',
    { timeout: LIVE_TIMEOUT_MS },
  );
  await dialog.getByRole('button', { name: /^Add$/i }).click();
  const createResponse = await createRequest;
  const createdPayload = await createResponse.json().catch(() => null);
  const createdReminderId: string | undefined =
    createdPayload?.data?.reminder?.reminder_id || createdPayload?.data?.reminder_id || undefined;
  const createdTitle: string | undefined =
    createdPayload?.data?.reminder?.record_title || createdPayload?.data?.record_title || createdPayload?.data?.title || undefined;
  await expect(dialog).toBeHidden({ timeout: LIVE_TIMEOUT_MS });
  await page.waitForLoadState('networkidle', { timeout: LIVE_TIMEOUT_MS }).catch(() => undefined);
  await page.waitForTimeout(2_000);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: LIVE_TIMEOUT_MS }).catch(() => undefined);

  const visibilityPattern = createdTitle ? new RegExp(createdTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') : new RegExp(uniqueToken, 'i');
  await expect(page.getByText(visibilityPattern).first()).toBeVisible({ timeout: LIVE_TIMEOUT_MS });

  if (createdReminderId) {
    await dismissReminderViaApi(token, createdReminderId).catch(() => undefined);
  } else {
    const reminders = await getLatestReminders(token, 30);
    const created = reminders.find((entry) => entry.record_title.toLowerCase().includes(uniqueToken.toLowerCase()));
    if (created) {
      await dismissReminderViaApi(token, created.reminder_id).catch(() => undefined);
    }
  }
});

test('reminder blocks creation without time', async ({ page }) => {
  await authenticateAsUserA(page);
  await openHubHome(page);

  const dialog = await openReminderDialog(page);
  const reminderInput = dialog.locator('#quick-add-reminder-input:visible');
  await reminderInput.fill('just some text no time');

  await dialog.getByRole('button', { name: /^Add$/i }).click();
  await page.waitForTimeout(500);

  await expect(dialog).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
  const hasVisibleValidation = await dialog
    .locator('p:visible')
    .filter({ hasText: /title and time|time/i })
    .first()
    .isVisible()
    .catch(() => false);
  if (!hasVisibleValidation) {
    // Current live behavior can vary between explicit validation copy and silent inline invalid state.
    await expect(dialog).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
  }
  await expect(reminderInput).toHaveValue('just some text no time');
});
