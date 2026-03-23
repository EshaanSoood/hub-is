import { expect, test, type Page } from '@playwright/test';
import { authenticateAsUserA } from '../helpers/auth';
import {
  archiveRecordViaApi,
  createReminderViaApi,
  createTaskInPersonalProject,
  dismissReminderViaApi,
} from '../helpers/db';

const LIVE_TIMEOUT_MS = 60_000;

const openHubHome = async (page: Page): Promise<void> => {
  await page.goto('/projects', { waitUntil: 'domcontentloaded', timeout: LIVE_TIMEOUT_MS });
  await page.waitForLoadState('networkidle', { timeout: LIVE_TIMEOUT_MS }).catch(() => undefined);
  await expect(page.getByRole('heading', { name: /^Hub$/i }).first()).toBeVisible({ timeout: 15_000 });
};

test('task created in personal project appears in Daily Brief', async ({ page }) => {
  const token = await authenticateAsUserA(page);

  const title = `task-created-personal-${Date.now()}`;
  const due = new Date();
  due.setMinutes(due.getMinutes() + 30);

  const created = await createTaskInPersonalProject(token, {
    title,
    due_at: due.toISOString(),
    status: 'todo',
    priority: 'medium',
  });

  try {
    await openHubHome(page);
    await expect(page.getByText(title).first()).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
  } finally {
    await archiveRecordViaApi(token, created.record_id).catch(() => undefined);
  }
});

test('overdue task from yesterday still visible', async ({ page }) => {
  const token = await authenticateAsUserA(page);

  const title = `overdue-yesterday-${Date.now()}`;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(9, 0, 0, 0);

  const created = await createTaskInPersonalProject(token, {
    title,
    due_at: yesterday.toISOString(),
    status: 'todo',
    priority: 'high',
  });

  try {
    await openHubHome(page);
    await expect(page.getByText(title).first()).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
  } finally {
    await archiveRecordViaApi(token, created.record_id).catch(() => undefined);
  }
});

test('dismissed reminder disappears', async ({ page }) => {
  const token = await authenticateAsUserA(page);

  const title = `dismiss-reminder-${Date.now()}`;
  const remindAt = new Date();
  remindAt.setMinutes(remindAt.getMinutes() + 15);

  const created = await createReminderViaApi(token, {
    title,
    remind_at: remindAt.toISOString(),
  });

  try {
    await openHubHome(page);

    await expect(page.getByRole('heading', { name: /^Reminders$/i })).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
    await expect(page.getByText(title).first()).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
    await dismissReminderViaApi(token, created.reminder_id);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: LIVE_TIMEOUT_MS }).catch(() => undefined);
    await expect(page.getByText(title)).toHaveCount(0, { timeout: LIVE_TIMEOUT_MS });
  } finally {
    await dismissReminderViaApi(token, created.reminder_id).catch(() => undefined);
  }
});
