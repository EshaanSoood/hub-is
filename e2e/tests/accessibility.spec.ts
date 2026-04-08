import { expect, test, type Page } from '@playwright/test';
import { authenticateAsUserA } from '../helpers/auth';

const LIVE_TIMEOUT_MS = 60_000;

const openHubHome = async (page: Page): Promise<void> => {
  await page.goto('/projects', { waitUntil: 'domcontentloaded', timeout: LIVE_TIMEOUT_MS });
  await page.waitForLoadState('networkidle', { timeout: LIVE_TIMEOUT_MS }).catch(() => undefined);
  await expect(page.getByRole('heading', { name: /^Hub$/i }).first()).toBeVisible({ timeout: 15_000 });
};

test('quick-add menu focus management', async ({ page }) => {
  await authenticateAsUserA(page);
  await openHubHome(page);

  const quickAddTrigger = page.getByRole('button', { name: /Open quick add menu/i });
  await quickAddTrigger.click();

  const menu = page.locator('[role="menu"]');
  await expect(menu).toBeVisible({ timeout: LIVE_TIMEOUT_MS });

  const menuItems = menu.getByRole('menuitem');
  const itemCount = await menuItems.count();
  expect(itemCount).toBeGreaterThanOrEqual(3);
  await expect(menuItems.first()).toBeFocused();

  if (itemCount > 0) {
    await page.keyboard.press('ArrowDown');
  }

  if (itemCount > 1) {
    await expect(menuItems.nth(1)).toBeFocused();
    await page.keyboard.press('ArrowDown');
  }

  if (itemCount > 2) {
    await expect(menuItems.nth(2)).toBeFocused();
    await page.keyboard.press('ArrowDown');
  }

  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden({ timeout: LIVE_TIMEOUT_MS });
  await expect(quickAddTrigger).toBeFocused();
});

test('task dialog focus and keyboard flow', async ({ page }) => {
  await authenticateAsUserA(page);
  await openHubHome(page);

  const quickAddTrigger = page.getByRole('button', { name: /Open quick add menu/i });
  await quickAddTrigger.click();
  await page.getByRole('menuitem', { name: /task/i }).first().click();

  const titleInput = page.getByLabel(/^Title$/i);
  if (await titleInput.count()) {
    await expect(titleInput).toBeFocused();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Escape');
  } else {
    const quickCaptureInput = page.getByLabel(/Capture text/i);
    await expect(quickCaptureInput).toBeFocused();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Escape');
  }

  await expect(quickAddTrigger).toBeFocused();
});

test('thought pile opens and closes correctly', async ({ page }) => {
  await authenticateAsUserA(page);
  await openHubHome(page);

  const trigger = page.getByRole('button', { name: /^Thought Pile$/i }).first();
  await expect(trigger).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
  await trigger.click();

  const thoughtPileDialog = page.getByRole('dialog', { name: /^Thought Pile$/i });
  await expect(thoughtPileDialog).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
  await expect(thoughtPileDialog.getByRole('heading', { name: /^Thought Pile$/i })).toBeVisible();
  await expect(thoughtPileDialog.getByLabel(/Capture text/i)).toBeVisible();

  await thoughtPileDialog.press('Escape');
  await expect(thoughtPileDialog).toBeHidden({ timeout: LIVE_TIMEOUT_MS });
  await expect(trigger).toBeFocused();
});

test('myHub headings are correct level', async ({ page }) => {
  await authenticateAsUserA(page);
  await openHubHome(page);

  const headingMeta = await page.locator('h1, h2, h3, h4, h5, h6').evaluateAll((nodes) =>
    nodes.map((node) => {
      const level = Number.parseInt(node.tagName.replace('H', ''), 10);
      return {
        level,
        text: (node.textContent || '').trim(),
      };
    }),
  );

  expect(headingMeta.some((entry) => /^Hub$/i.test(entry.text))).toBeTruthy();
  expect(headingMeta.some((entry) => entry.level === 3 && /^Calendar$/i.test(entry.text))).toBeTruthy();
  expect(headingMeta.some((entry) => entry.level === 3 && /^Tasks$/i.test(entry.text))).toBeTruthy();
  expect(headingMeta.some((entry) => entry.level === 3 && /^Reminders$/i.test(entry.text))).toBeTruthy();
});
