import { expect, test, type Page } from '@playwright/test';
import { authenticateAsUserA } from '../helpers/auth';
import { archiveMostRecentTaskByTitleIncludes } from '../helpers/db';

const LIVE_TIMEOUT_MS = 60_000;

const openHubHome = async (page: Page): Promise<void> => {
  await page.goto('/projects', { waitUntil: 'domcontentloaded', timeout: LIVE_TIMEOUT_MS });
  await page.waitForLoadState('networkidle', { timeout: LIVE_TIMEOUT_MS }).catch(() => undefined);
  await expect(page.getByRole('heading', { name: /^Hub$/i }).first()).toBeVisible({ timeout: 15_000 });
};

const openQuickAddMenu = async (page: Page): Promise<void> => {
  const trigger = page.getByRole('button', { name: /Open quick add menu/i });
  await expect(trigger).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
  await trigger.click();
  await expect(page.locator('[role="menu"]')).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
};

const chooseQuickAddTask = async (page: Page) => {
  await openQuickAddMenu(page);
  const taskItem = page.getByRole('menuitem', { name: /^Task$/i });
  await expect(taskItem).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
  await taskItem.click();
  const dialog = page
    .locator('[role="dialog"]:visible')
    .filter({ has: page.locator('#task-create-title:visible') })
    .first();
  await expect(dialog).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
  await expect(dialog.locator('#task-create-title:visible')).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
  return dialog;
};

const toTodayDateTimeLocal = (): string => {
  const now = new Date();
  now.setHours(9, 0, 0, 0);
  const offsetMs = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 16);
};

test('create task from quick-add menu with NLP', async ({ page }) => {
  const token = await authenticateAsUserA(page);
  await openHubHome(page);

  const uniqueToken = Math.random().toString(36).replace(/[^a-z]+/g, '').slice(0, 8);
  const taskTitle = `nlp smoke ${uniqueToken} today at 5pm`;

  const dialog = await chooseQuickAddTask(page);
  const titleInput = dialog.locator('#task-create-title:visible');
  await titleInput.fill(taskTitle);

  const dueDateField = dialog.locator('#task-create-due-date:visible');
  await expect(dueDateField).not.toHaveValue('');

  let createdTask = false;
  try {
    const createRequest = page.waitForResponse(
      (response) => response.url().includes('/api/hub/tasks') && response.request().method() === 'POST',
      { timeout: LIVE_TIMEOUT_MS },
    );
    await dialog.getByRole('button', { name: /^Create Task$/i }).click();
    const createResponse = await createRequest;
    expect([200, 201]).toContain(createResponse.status());
    createdTask = true;

    await expect(dialog).toBeHidden({ timeout: LIVE_TIMEOUT_MS });
    await page.waitForLoadState('networkidle', { timeout: LIVE_TIMEOUT_MS }).catch(() => undefined);

    await page.goto('/projects', { waitUntil: 'domcontentloaded', timeout: LIVE_TIMEOUT_MS });
    await page.waitForLoadState('networkidle', { timeout: LIVE_TIMEOUT_MS }).catch(() => undefined);

    await expect(page.getByText(new RegExp(uniqueToken, 'i')).first()).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
  } finally {
    if (createdTask) {
      await archiveMostRecentTaskByTitleIncludes(token, uniqueToken).catch(() => undefined);
    }
  }
});

test('create task with manual field entry', async ({ page }) => {
  const token = await authenticateAsUserA(page);
  await openHubHome(page);

  const uniqueToken = Math.random().toString(36).replace(/[^a-z]+/g, '').slice(0, 8);
  const taskTitle = `manual smoke ${uniqueToken}`;

  const dialog = await chooseQuickAddTask(page);
  const titleInput = dialog.locator('#task-create-title:visible');
  await titleInput.fill(taskTitle);

  const dueDateInput = dialog.locator('#task-create-due-date:visible');
  await dueDateInput.fill(toTodayDateTimeLocal());

  const prioritySelect = dialog.locator('#task-create-priority:visible');
  await prioritySelect.selectOption('high');

  const createRequest = page.waitForResponse(
    (response) => response.url().includes('/api/hub/tasks') && response.request().method() === 'POST',
    { timeout: LIVE_TIMEOUT_MS },
  );
  await dialog.getByRole('button', { name: /^Create Task$/i }).click();
  await createRequest;

  await expect(dialog).toBeHidden({ timeout: LIVE_TIMEOUT_MS });
  await page.waitForLoadState('networkidle', { timeout: LIVE_TIMEOUT_MS }).catch(() => undefined);
  await page.waitForTimeout(2_000);
  await page.goto('/projects', { waitUntil: 'domcontentloaded', timeout: LIVE_TIMEOUT_MS });
  await page.waitForLoadState('networkidle', { timeout: LIVE_TIMEOUT_MS }).catch(() => undefined);

  await expect(page.getByText(new RegExp(uniqueToken, 'i')).first()).toBeVisible({ timeout: LIVE_TIMEOUT_MS });

  await archiveMostRecentTaskByTitleIncludes(token, uniqueToken).catch(() => undefined);
});

test('task defaults are populated on dialog open', async ({ page }) => {
  await authenticateAsUserA(page);
  await openHubHome(page);

  const dialog = await chooseQuickAddTask(page);

  const dueDateInput = dialog.locator('#task-create-due-date:visible');
  await expect(dueDateInput).not.toHaveValue('');

  const priorityValue = await dialog.locator('#task-create-priority:visible').inputValue();
  expect(['', 'medium']).toContain(priorityValue);

  const statusValue = await dialog.locator('#task-create-status:visible').inputValue();
  expect(statusValue).toBe('todo');
});
