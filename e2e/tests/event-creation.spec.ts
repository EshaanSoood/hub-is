import { expect, test, type Page } from '@playwright/test';
import { authenticateAsUserA } from '../helpers/auth';
import { getHubHome } from '../helpers/db';

const LIVE_TIMEOUT_MS = 60_000;

const openHubHome = async (page: Page): Promise<void> => {
  await page.goto('/projects', { waitUntil: 'domcontentloaded', timeout: LIVE_TIMEOUT_MS });
  await page.waitForLoadState('networkidle', { timeout: LIVE_TIMEOUT_MS }).catch(() => undefined);
  await expect(page.getByRole('heading', { name: /^Hub$/i }).first()).toBeVisible({ timeout: 15_000 });
};

const hhmm = (date: Date): string => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
const isoDate = (date: Date): string => date.toISOString().slice(0, 10);
const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const openCalendarEventDialog = async (page: Page) => {
  await page.getByRole('button', { name: /Open quick add menu/i }).click();
  await page.getByRole('menuitem', { name: /^Calendar Event$/i }).click();
  const dialog = page
    .locator('[role="dialog"]:visible')
    .filter({ has: page.locator('#quick-add-event-title:visible') })
    .first();
  await expect(dialog).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
  await expect(dialog.locator('#quick-add-event-title:visible')).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
  return dialog;
};

test('create event from quick-add menu', async ({ page }) => {
  const token = await authenticateAsUserA(page);
  await openHubHome(page);

  const uniqueToken = Math.random().toString(36).replace(/[^a-z]+/g, '').slice(0, 8);
  const eventTitle = `event smoke ${uniqueToken} team meeting`;

  const dialog = await openCalendarEventDialog(page);
  const titleInput = dialog.locator('#quick-add-event-title:visible');
  await titleInput.click();
  await titleInput.fill(eventTitle);

  const start = new Date();
  start.setHours(start.getHours() + 1, 0, 0, 0);
  const end = new Date();
  end.setHours(end.getHours() + 2, 0, 0, 0);

  const startInput = dialog.locator('#quick-add-event-start:visible');
  const endInput = dialog.locator('#quick-add-event-end:visible');
  const eventDate = isoDate(start);
  await startInput.fill(`${eventDate}T${hhmm(start)}`);
  await endInput.fill(`${eventDate}T${hhmm(end)}`);

  const createRequest = page.waitForResponse(
    (response) => response.url().includes('/api/hub/projects/') && response.url().includes('/events/from-nlp') && response.request().method() === 'POST',
    { timeout: LIVE_TIMEOUT_MS },
  );
  await dialog.getByRole('button', { name: /^Create$/i }).click();
  const createResponse = await createRequest;
  const createPayload = await createResponse.json().catch(() => null);
  const createdRecordId: string | undefined = createPayload?.data?.record?.record_id || createPayload?.data?.record_id || undefined;
  await page.waitForLoadState('networkidle', { timeout: LIVE_TIMEOUT_MS }).catch(() => undefined);
  await page.waitForTimeout(2_000);

  await expect(dialog).toBeHidden({ timeout: LIVE_TIMEOUT_MS });

  if (createdRecordId) {
    let found = false;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const home = await getHubHome(token, { events_limit: 50, tasks_limit: 5, captures_limit: 5, notifications_limit: 5 });
      found = home.events.some((event) => {
        const withId = event as { record_id?: unknown };
        return typeof withId.record_id === 'string' && withId.record_id === createdRecordId;
      });
      if (found) {
        break;
      }
      await sleep(300);
    }
    expect(found).toBeTruthy();
  } else {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: LIVE_TIMEOUT_MS }).catch(() => undefined);
    await expect(page.getByText(new RegExp(uniqueToken, 'i')).first()).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
  }
});
