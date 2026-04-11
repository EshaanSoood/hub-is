import { expect, test, type Locator, type Page } from '@playwright/test';
import { authenticateAsUserA, readTokenAFromFile } from '../helpers/auth';
import { archiveRecordViaApi, createProjectViaApi, deleteProjectViaApi, waitForHomeTaskByTitleIncludes } from '../helpers/db';
import { createTaskInProject } from '../helpers/hub-home-daily-brief';

const LIVE_TIMEOUT_MS = 45_000;
const HOUR_MS = 60 * 60 * 1000;
const HUB_HOME_REFRESH_EVENT = 'hub:home-refresh-requested';

const isoFromNow = (offsetMs: number): string => new Date(Date.now() + offsetMs).toISOString();

const openHubHome = async (page: Page): Promise<void> => {
  await authenticateAsUserA(page);
  await page.goto('/projects', { waitUntil: 'domcontentloaded', timeout: LIVE_TIMEOUT_MS });
  await page.waitForLoadState('networkidle', { timeout: LIVE_TIMEOUT_MS }).catch(() => undefined);
  await expect(page.getByTestId('daily-brief')).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
};

const requestHubHomeRefresh = async (page: Page): Promise<void> => {
  await page.evaluate((eventName) => {
    window.dispatchEvent(new CustomEvent(eventName));
  }, HUB_HOME_REFRESH_EVENT);
};

const selectDailyBriefProject = async (page: Page, projectName: string): Promise<void> => {
  const projectFilter = page.getByLabel('Filter timeline by project');
  await expect(projectFilter).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
  await projectFilter.click();
  const option = page.getByRole('option', { name: projectName }).first();
  await expect(option).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
  await option.click();
};

const dailyBrief = (page: Page): Locator => page.getByTestId('daily-brief');

test.describe.serial('Hub Home Daily Brief states', () => {
  const token = readTokenAFromFile();
  const createdRecordIds: string[] = [];
  const createdProjectIds: string[] = [];
  const runTag = `daily-brief-${Date.now()}`;
  test.setTimeout(60_000);

  test.beforeAll(async () => {
    const anchorProject = await createProjectViaApi(token, `${runTag}-anchor`);
    createdProjectIds.push(anchorProject.project_id);
    const anchorTask = await createTaskInProject(token, anchorProject.project_id, {
      title: `${runTag} anchor task`,
      due_at: isoFromNow(2 * HOUR_MS),
    });
    createdRecordIds.push(anchorTask.record_id);
  });

  test.afterAll(async () => {
    await Promise.all(
      createdRecordIds.map(async (recordId) => {
        await archiveRecordViaApi(token, recordId);
      }),
    );
    await Promise.all(
      createdProjectIds.map(async (projectId) => {
        await deleteProjectViaApi(token, projectId).catch(() => undefined);
      }),
    );
  });

  test('renders Active Day, Empty+Backlog, and True Zero with the correct structure and collapsed height', async ({ page }) => {
    const testTag = `${runTag}-states-${Date.now()}`;
    const activeProject = await createProjectViaApi(token, `${testTag}-active-state`);
    const backlogProject = await createProjectViaApi(token, `${testTag}-backlog-state`);
    const zeroProject = await createProjectViaApi(token, `${testTag}-zero-state`);
    createdProjectIds.push(activeProject.project_id, backlogProject.project_id, zeroProject.project_id);
    const activeTitle = `${testTag} active task`;
    const backlogTitle = `${testTag} overdue task`;

    const activeTask = await createTaskInProject(token, activeProject.project_id, {
      title: activeTitle,
      due_at: isoFromNow(2 * HOUR_MS),
    });
    const backlogTask = await createTaskInProject(token, backlogProject.project_id, {
      title: backlogTitle,
      due_at: isoFromNow(-1 * HOUR_MS),
    });
    createdRecordIds.push(activeTask.record_id, backlogTask.record_id);

    await openHubHome(page);

    await selectDailyBriefProject(page, activeProject.name);
    await expect(dailyBrief(page)).toHaveAttribute('data-daily-brief-state', 'active-day');
    await expect(page.getByTestId('daily-brief-timeline')).toBeVisible();
    await expect(page.getByTestId('daily-brief-backlog')).toBeVisible();
    await expect(page.getByTestId('daily-brief-quote')).toHaveCount(0);
    const activeHeight = (await dailyBrief(page).boundingBox())?.height ?? 0;

    await selectDailyBriefProject(page, backlogProject.name);
    await expect(dailyBrief(page)).toHaveAttribute('data-daily-brief-state', 'empty-backlog');
    await expect(page.getByTestId('daily-brief-timeline')).toBeVisible();
    await expect(page.getByTestId('daily-brief-backlog')).toBeVisible();
    await expect(page.getByTestId('daily-brief-backlog').getByText(backlogTitle)).toBeVisible();
    await expect(page.getByTestId('daily-brief-quote')).toHaveCount(0);
    const backlogHeight = (await dailyBrief(page).boundingBox())?.height ?? 0;

    await selectDailyBriefProject(page, zeroProject.name);
    await expect(dailyBrief(page)).toHaveAttribute('data-daily-brief-state', 'true-zero');
    await expect(page.getByTestId('daily-brief-quote')).toBeVisible();
    await expect(page.getByTestId('daily-brief-timeline')).toHaveCount(0);
    await expect(page.getByTestId('daily-brief-backlog')).toHaveCount(0);
    const zeroHeight = (await dailyBrief(page).boundingBox())?.height ?? 0;

    expect(activeHeight).toBeGreaterThan(0);
    expect(backlogHeight).toBeGreaterThan(0);
    expect(zeroHeight).toBeGreaterThan(0);
    expect(zeroHeight).toBeLessThan(activeHeight);
    expect(zeroHeight).toBeLessThan(backlogHeight);
  });

  test('reactively transitions from True Zero to Active Day when a task enters the forward window', async ({ page }) => {
    const testTag = `${runTag}-zero-active-${Date.now()}`;
    const targetProject = await createProjectViaApi(token, `${testTag}-project`);
    createdProjectIds.push(targetProject.project_id);
    const taskTitle = `${testTag} transition active task`;

    await openHubHome(page);
    await selectDailyBriefProject(page, targetProject.name);
    await expect(dailyBrief(page)).toHaveAttribute('data-daily-brief-state', 'true-zero');

    const createdTask = await createTaskInProject(token, targetProject.project_id, {
      title: taskTitle,
      due_at: isoFromNow(2 * HOUR_MS),
    });
    createdRecordIds.push(createdTask.record_id);

    await requestHubHomeRefresh(page);

    await expect(dailyBrief(page)).toHaveAttribute('data-daily-brief-state', 'active-day');
    await expect(page.getByTestId('daily-brief-timeline')).toBeVisible();
  });

  test('reactively transitions from Empty+Backlog to Active Day when a backlog item is dropped onto the timeline', async ({ page }) => {
    const testTag = `${runTag}-drop-${Date.now()}`;
    const targetProject = await createProjectViaApi(token, `${testTag}-project`);
    createdProjectIds.push(targetProject.project_id);
    const taskTitle = `${testTag} drag task`;
    const createdTask = await createTaskInProject(token, targetProject.project_id, {
      title: taskTitle,
      due_at: isoFromNow(-1 * HOUR_MS),
    });
    createdRecordIds.push(createdTask.record_id);

    await openHubHome(page);
    await selectDailyBriefProject(page, targetProject.name);
    await expect(dailyBrief(page)).toHaveAttribute('data-daily-brief-state', 'empty-backlog');

    const backlogItem = page.getByTestId('daily-brief-backlog').getByRole('button', { name: new RegExp(taskTitle, 'i') }).first();
    const timeline = page.getByTestId('daily-brief-timeline');

    await backlogItem.dragTo(timeline, {
      targetPosition: { x: 320, y: 52 },
    });

    await expect(dailyBrief(page)).toHaveAttribute('data-daily-brief-state', 'active-day');

    const updatedTask = await waitForHomeTaskByTitleIncludes(token, taskTitle, 15_000);
    expect(updatedTask?.task_state.due_at).toBeTruthy();
    expect(new Date(updatedTask?.task_state.due_at || 0).getTime()).toBeGreaterThan(Date.now());
  });

  test('supports keyboard pickup, timeline movement, and drop for backlog scheduling', async ({ page }) => {
    const testTag = `${runTag}-keyboard-${Date.now()}`;
    const targetProject = await createProjectViaApi(token, `${testTag}-project`);
    createdProjectIds.push(targetProject.project_id);
    const taskTitle = `${testTag} keyboard task`;
    const createdTask = await createTaskInProject(token, targetProject.project_id, {
      title: taskTitle,
      due_at: isoFromNow(-1 * HOUR_MS),
    });
    createdRecordIds.push(createdTask.record_id);

    await openHubHome(page);
    await selectDailyBriefProject(page, targetProject.name);
    await expect(dailyBrief(page)).toHaveAttribute('data-daily-brief-state', 'empty-backlog');

    const backlogItem = page.getByTestId('daily-brief-backlog').getByRole('button', { name: new RegExp(taskTitle, 'i') }).first();
    await backlogItem.focus();
    await page.keyboard.press('Enter');

    const keyboardDropzone = page.getByTestId('daily-brief-keyboard-dropzone');
    await expect(keyboardDropzone).toBeVisible();
    await expect(keyboardDropzone.locator('button[aria-current="true"]').first()).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');

    await expect(dailyBrief(page)).toHaveAttribute('data-daily-brief-state', 'active-day');

    const updatedTask = await waitForHomeTaskByTitleIncludes(token, taskTitle, 15_000);
    expect(updatedTask?.task_state.due_at).toBeTruthy();
    expect(new Date(updatedTask?.task_state.due_at || 0).getTime()).toBeGreaterThan(Date.now() + (30 * 60 * 1000));
  });
});
