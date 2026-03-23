import { expect, test, type Page } from '@playwright/test';
import { authenticateAsUserA } from '../helpers/auth';

const LIVE_TIMEOUT_MS = 45_000;

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const openHubHome = async (page: Page): Promise<void> => {
  await authenticateAsUserA(page);
  await page.goto('/projects', { waitUntil: 'domcontentloaded', timeout: LIVE_TIMEOUT_MS });
  await page.waitForLoadState('networkidle', { timeout: LIVE_TIMEOUT_MS }).catch(() => undefined);
  await expect(page.getByRole('heading', { name: /^Hub$/i }).first()).toBeVisible({ timeout: 15_000 });
};

const openHubView = async (page: Page, viewName: 'Project Lens' | 'Stream'): Promise<void> => {
  const viewTrigger = page.locator('button[aria-haspopup="listbox"]').first();
  await expect(viewTrigger).toBeVisible({ timeout: LIVE_TIMEOUT_MS });

  const triggerText = (await viewTrigger.textContent()) || '';
  if (new RegExp(escapeRegExp(viewName), 'i').test(triggerText)) {
    return;
  }

  await viewTrigger.click();
  const viewOption = page.locator('[role="listbox"] [role="option"]').filter({ hasText: viewName }).first();
  await expect(viewOption).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
  await viewOption.click();
};

test('Daily Brief renders greeting and summary counts', async ({ page }) => {
  await openHubHome(page);

  await expect(page.getByRole('heading', { name: /^Hub$/i }).first()).toBeVisible();

  const greetingVisible = await page.getByText(/^Hey\b/i).first().isVisible().catch(() => false);
  if (!greetingVisible) {
    await expect(page.getByRole('button', { name: /Account menu/i })).toBeVisible();
  }

  const hasTaskCount = await page.getByText(/\d+\s+task/i).first().isVisible().catch(() => false);
  const hasEventCount = await page.getByText(/\d+\s+event/i).first().isVisible().catch(() => false);
  const hasReminderCount = await page.getByText(/\d+\s+reminder/i).first().isVisible().catch(() => false);
  const hasSummarySignals = hasTaskCount || hasEventCount || hasReminderCount;
  expect(hasSummarySignals).toBeTruthy();

  for (const label of ['Timeline', 'Calendar', 'Tasks', 'Reminders']) {
    const tab = page.getByRole('tab', { name: new RegExp(`^${escapeRegExp(label)}$`, 'i') }).first();
    if (await tab.count()) {
      await expect(tab).toBeVisible();
      continue;
    }
    await expect(page.getByText(new RegExp(label, 'i')).first()).toBeVisible();
  }
});

test('Daily Brief tab filtering works', async ({ page }) => {
  await openHubHome(page);

  const timelineTab = page.getByRole('tab', { name: /^Timeline$/i }).first();
  const calendarTab = page.getByRole('tab', { name: /^Calendar$/i }).first();
  const tasksTab = page.getByRole('tab', { name: /^Tasks$/i }).first();
  const remindersTab = page.getByRole('tab', { name: /^Reminders$/i }).first();

  const hasExpectedTabs = (await timelineTab.count()) && (await calendarTab.count()) && (await tasksTab.count()) && (await remindersTab.count());
  if (hasExpectedTabs) {
    await calendarTab.click();
    await expect(calendarTab).toHaveAttribute('aria-selected', 'true');

    await tasksTab.click();
    await expect(tasksTab).toHaveAttribute('aria-selected', 'true');

    await remindersTab.click();
    await expect(remindersTab).toHaveAttribute('aria-selected', 'true');

    await timelineTab.click();
    await expect(timelineTab).toHaveAttribute('aria-selected', 'true');
    return;
  }

  await expect(page.getByRole('heading', { name: /Calendar/i }).first()).toBeVisible();
  await expect(page.getByText(/Tasks/i).first()).toBeVisible();
  await expect(page.getByText(/Reminders/i).first()).toBeVisible();
});

test('Project Lens renders and excludes personal project', async ({ page }) => {
  await openHubHome(page);
  await openHubView(page, 'Project Lens');

  const projectList = page.getByLabel('Project list');
  await expect(projectList).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
  await expect(projectList.getByText(/\(Personal\)/i)).toHaveCount(0);
  await expect(projectList.getByText(/^Hub$/i)).toHaveCount(0);

  await expect(page.getByRole('heading', { name: /Create Project/i })).toBeVisible();
});

test('Stream view renders', async ({ page }) => {
  await openHubHome(page);
  await openHubView(page, 'Stream');

  const dueSortControl = page.getByRole('button', { name: /By due date/i }).first();
  const emptyState = page.getByText(/Nothing here\./i).first();
  const hasSort = await dueSortControl.isVisible().catch(() => false);

  if (hasSort) {
    await expect(dueSortControl).toBeVisible();
  } else {
    await expect(emptyState).toBeVisible();
  }
});
