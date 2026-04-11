import { expect, test, type Page } from '@playwright/test';
import { authenticateAsUserA } from '../helpers/auth';
import {
  archiveRecordViaApi,
  createPaneViaApi,
  createProjectViaApi,
  waitForHomeEventByTitleIncludes,
} from '../helpers/db';

const LIVE_TIMEOUT_MS = 60_000;
const TEST_TIMEOUT_MS = 120_000;

const openCalendarWorkPane = async (
  page: Page,
  token: string,
): Promise<{ projectId: string; paneId: string }> => {
  const runId = `calendar-e2e-${Date.now().toString(36)}`;
  const project = await createProjectViaApi(token, `Calendar Submit ${runId}`);
  const pane = await createPaneViaApi(token, project.project_id, {
    name: 'Calendar Pane',
    member_user_ids: [],
    layout_config: {
      modules_enabled: true,
      workspace_enabled: false,
      doc_binding_mode: 'owned',
      modules: [
        {
          module_instance_id: `calendar-${runId}`,
          module_type: 'calendar',
          size_tier: 'M',
          lens: 'project',
        },
      ],
    },
  });

  await page.goto(`/projects/${encodeURIComponent(project.project_id)}/work/${encodeURIComponent(pane.pane_id)}`, {
    waitUntil: 'domcontentloaded',
    timeout: LIVE_TIMEOUT_MS,
  });
  await page.waitForLoadState('networkidle', { timeout: LIVE_TIMEOUT_MS }).catch(() => undefined);
  await expect(page.getByRole('button', { name: /^New Event$/i }).first()).toBeVisible({ timeout: LIVE_TIMEOUT_MS });

  return {
    projectId: project.project_id,
    paneId: pane.pane_id,
  };
};

test('calendar inline create submits from the Create button', async ({ page }) => {
  test.setTimeout(TEST_TIMEOUT_MS);
  const token = await authenticateAsUserA(page);
  await openCalendarWorkPane(page, token);

  const uniqueToken = Math.random().toString(36).replace(/[^a-z]+/g, '').slice(0, 8);
  const eventTitle = `inline click ${uniqueToken}`;
  let createdRecordId: string | null = null;

  try {
    await page.getByRole('button', { name: /^New Event$/i }).first().click();

    const titleInput = page.getByLabel(/^Event title$/i).last();
    await expect(titleInput).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
    await titleInput.fill(eventTitle);
    await page.getByLabel(/^Start time$/i).last().fill('09:00');
    await page.getByLabel(/^End time$/i).last().fill('10:00');

    const createRequest = page.waitForResponse(
      (response) =>
        response.url().includes('/api/hub/projects/')
        && response.url().includes('/events/from-nlp')
        && response.request().method() === 'POST',
      { timeout: LIVE_TIMEOUT_MS },
    );
    await page.getByRole('button', { name: /^Create$/i }).last().click();
    const createResponse = await createRequest;
    const createPayload = await createResponse.json().catch(() => null);
    createdRecordId = createPayload?.data?.record?.record_id || createPayload?.data?.record_id || null;

    expect(createResponse.ok()).toBeTruthy();
    if (!createdRecordId) {
      const createdEvent = await waitForHomeEventByTitleIncludes(token, uniqueToken, LIVE_TIMEOUT_MS);
      expect(createdEvent).not.toBeNull();
    }
  } finally {
    if (createdRecordId) {
      await archiveRecordViaApi(token, createdRecordId).catch(() => undefined);
    }
  }
});

test('calendar inline create submits when Enter is pressed in the form', async ({ page }) => {
  test.setTimeout(TEST_TIMEOUT_MS);
  const token = await authenticateAsUserA(page);
  await openCalendarWorkPane(page, token);

  const uniqueToken = Math.random().toString(36).replace(/[^a-z]+/g, '').slice(0, 8);
  const eventTitle = `inline enter ${uniqueToken}`;
  let createdRecordId: string | null = null;

  try {
    await page.getByRole('button', { name: /^New Event$/i }).first().click();

    const titleInput = page.getByLabel(/^Event title$/i).last();
    await expect(titleInput).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
    await titleInput.fill(eventTitle);
    await page.getByLabel(/^Start time$/i).last().fill('11:00');
    await page.getByLabel(/^End time$/i).last().fill('12:00');

    const createRequest = page.waitForResponse(
      (response) =>
        response.url().includes('/api/hub/projects/')
        && response.url().includes('/events/from-nlp')
        && response.request().method() === 'POST',
      { timeout: LIVE_TIMEOUT_MS },
    );
    await titleInput.press('Enter');
    const createResponse = await createRequest;
    const createPayload = await createResponse.json().catch(() => null);
    createdRecordId = createPayload?.data?.record?.record_id || createPayload?.data?.record_id || null;

    expect(createResponse.ok()).toBeTruthy();
    if (!createdRecordId) {
      const createdEvent = await waitForHomeEventByTitleIncludes(token, uniqueToken, LIVE_TIMEOUT_MS);
      expect(createdEvent).not.toBeNull();
    }
  } finally {
    if (createdRecordId) {
      await archiveRecordViaApi(token, createdRecordId).catch(() => undefined);
    }
  }
});
