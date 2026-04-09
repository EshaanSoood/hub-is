import { writeFile } from 'node:fs/promises';
import { expect, test, type BrowserContext, type Locator, type Page, type TestInfo } from '@playwright/test';
import { loginThroughKeycloak } from '../support/audit.ts';
import { resolveLinkedTestAccounts } from '../utils/tokenMint.ts';
import { captureCheckpoint } from './utils/screenshotPlan.ts';
import { createCoverageTracker } from './utils/networkCoverage.ts';
import {
  readJourneyContext,
  resolveScenario,
  toDateTimeLocalInput,
  withRunTag,
  type JourneyScenario,
  type JourneySeedContext,
} from './utils/stateTags.ts';

const LIVE_TIMEOUT_MS = 120_000;

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const viewportLabelForProject = (projectName: string): string => {
  if (projectName === 'tablet') {
    return 'tablet';
  }
  if (projectName === 'mobile') {
    return 'mobile';
  }
  return 'desktop';
};

const waitForProjectsHome = async (page: Page): Promise<void> => {
  await page.goto('/projects', { waitUntil: 'domcontentloaded', timeout: LIVE_TIMEOUT_MS });
  await expect(page.getByRole('link', { name: /^Go To Project /i }).first()).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
};

const openProjectOverview = async (page: Page, context: JourneySeedContext): Promise<void> => {
  const overviewLink = page.locator(`a[href="/projects/${context.project.id}/overview"]`).first();
  await expect(overviewLink).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
  await overviewLink.click();

  await expect(page).toHaveURL(new RegExp(`/projects/${escapeRegExp(context.project.id)}/overview`), {
    timeout: LIVE_TIMEOUT_MS,
  });
};

const navigateToSeededPane = async (page: Page, context: JourneySeedContext): Promise<void> => {
  await waitForProjectsHome(page);
  await openProjectOverview(page, context);

  const workTab = page.getByRole('tab', { name: /^Work$/i }).first();
  await expect(workTab).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
  await workTab.click();

  await expect(page).toHaveURL(new RegExp(`/projects/${escapeRegExp(context.project.id)}/work`), {
    timeout: LIVE_TIMEOUT_MS,
  });

  const paneToolbar = page.getByRole('toolbar', { name: 'Open panes' });
  await expect(paneToolbar).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
  const paneButton = page.getByRole('button', {
    name: new RegExp(`^${escapeRegExp(context.panes.primaryName)}(?:, pane \\d+)?$`, 'i'),
  }).first();
  await expect(paneButton).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
  await paneButton.click();
  await expect(page).toHaveURL(new RegExp(`/projects/${escapeRegExp(context.project.id)}/work/${escapeRegExp(context.panes.primaryId)}(?:\\?|$)`), {
    timeout: LIVE_TIMEOUT_MS,
  });
};

const openAddModuleDialog = async (page: Page): Promise<void> => {
  const addModuleButton = page.getByRole('button', { name: /Add module|Add a module/i }).first();
  await expect(addModuleButton).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
  await addModuleButton.click();
  await expect(page.getByRole('heading', { name: /^Add Module$/i })).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
};

const ensureModuleAdded = async (
  page: Page,
  moduleLabel: string,
  sizeTier: 'S' | 'M' | 'L',
  visibleLocator: Locator,
): Promise<void> => {
  if (await visibleLocator.first().isVisible().catch(() => false)) {
    return;
  }

  await openAddModuleDialog(page);

  const selectButton = page.getByRole('button', { name: new RegExp(`^Select ${escapeRegExp(moduleLabel)} module$`, 'i') }).first();
  await expect(selectButton).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
  await selectButton.click();

  const sizeButton = page.getByRole('button', { name: new RegExp(`^Add ${escapeRegExp(moduleLabel)} at ${sizeTier} size$`, 'i') }).first();
  await expect(sizeButton).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
  await sizeButton.click();

  await expect(visibleLocator.first()).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
};

const getKanbanModuleCard = (page: Page): Locator => {
  return page
    .locator('[data-testid="module-card"]')
    .filter({ has: page.getByRole('button', { name: /Kanban module actions/i }) })
    .first();
};

const getFilesModule = (page: Page): Locator => page.getByRole('region', { name: 'Files module' }).first();

const getTableModule = (page: Page): Locator => page.getByRole('region', { name: 'Table module' }).first();

const getTasksModule = (page: Page): Locator => page.getByRole('region', { name: 'Tasks module' }).first();

const getRemindersModule = (page: Page): Locator => page.getByRole('region', { name: 'Reminders module' }).first();

const getCalendarModuleCard = (page: Page): Locator => {
  return page
    .locator('article')
    .filter({
      has: page.getByRole('button', { name: /Calendar module actions|New Event|Previous week|Previous day/i }).first(),
    })
    .first();
};

const verifyPersistenceOnPage = async (
  page: Page,
  expected: {
    tableTitle: string;
    kanbanTitle: string;
    taskTitle: string;
    reminderToken: string;
    quickThoughtToken: string;
    docToken: string;
    fileName: string;
  },
): Promise<void> => {
  await expect(page.getByText(expected.tableTitle).first()).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
  await expect(page.getByText(expected.kanbanTitle).first()).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
  await expect(page.getByText(expected.taskTitle).first()).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
  await expect(page.getByText(new RegExp(escapeRegExp(expected.reminderToken), 'i')).first()).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
  await expect(page.getByText(new RegExp(escapeRegExp(expected.quickThoughtToken), 'i')).first()).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
  await expect(page.getByLabel('Project note editor')).toContainText(expected.docToken, { timeout: LIVE_TIMEOUT_MS });
  await expect(page.getByText(expected.fileName).first()).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
};

const expectCellContentToStayWithinBounds = async (cellButton: Locator): Promise<void> => {
  const metrics = await cellButton.evaluate((node) => {
    const cell = node.closest('[role="gridcell"]');
    if (!(node instanceof HTMLElement) || !(cell instanceof HTMLElement)) {
      return null;
    }

    const style = window.getComputedStyle(node);
    const cellRect = cell.getBoundingClientRect();
    const nodeRect = node.getBoundingClientRect();

    return {
      textOverflow: style.textOverflow,
      overflowX: style.overflowX,
      whiteSpace: style.whiteSpace,
      clientWidth: node.clientWidth,
      scrollWidth: node.scrollWidth,
      nodeRight: nodeRect.right,
      cellRight: cellRect.right,
    };
  });

  expect(metrics).not.toBeNull();
  expect(metrics?.textOverflow).toBe('ellipsis');
  expect(metrics?.overflowX).toBe('hidden');
  expect(metrics?.whiteSpace).toBe('nowrap');
  expect(metrics?.scrollWidth ?? 0).toBeGreaterThan(metrics?.clientWidth ?? 0);
  expect(metrics?.nodeRight ?? 0).toBeLessThanOrEqual((metrics?.cellRight ?? 0) + 1);
};

const ensureCalendarReadyForCreate = async (calendarModule: Locator): Promise<void> => {
  const newEventButton = calendarModule.getByRole('button', { name: /^New Event$/i }).first();
  if ((await newEventButton.count()) > 0) {
    await expect(newEventButton).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
    return;
  }

  const showAllButton = calendarModule.getByRole('button', { name: /^Show All$/i }).first();
  if (await showAllButton.isVisible().catch(() => false)) {
    await showAllButton.click();
    await expect(calendarModule.getByText('Loading calendar')).toHaveCount(0, { timeout: LIVE_TIMEOUT_MS });
    return;
  }

  const allScopeButton = calendarModule.getByRole('button', { name: /^All$/i }).first();
  if ((await allScopeButton.count()) > 0) {
    await allScopeButton.click();
    await expect(calendarModule.getByText('Loading calendar')).toHaveCount(0, { timeout: LIVE_TIMEOUT_MS });
  }
};

const withFreshContext = async (
  browserContext: BrowserContext,
  testInfo: TestInfo,
): Promise<BrowserContext> => {
  const browser = browserContext.browser();
  if (!browser) {
    throw new Error('Browser handle unavailable for persistence context creation.');
  }
  const storageState = await browserContext.storageState();
  return browser.newContext({
    storageState,
    viewport: testInfo.project.use?.viewport,
  });
};

test.describe('User Journey Verification', () => {
  test('full journey + persistence + endpoint coverage (desktop)', async ({ page }, testInfo) => {
    test.slow();

    if (testInfo.project.name !== 'desktop') {
      test.skip();
    }

    const scenario = resolveScenario();
    const context = await readJourneyContext();
    const viewport = viewportLabelForProject(testInfo.project.name);
    const coverage = await createCoverageTracker(scenario);
    coverage.attachContext(page.context());

    const { accountA } = await resolveLinkedTestAccounts();
    await loginThroughKeycloak(page, accountA);

    await captureCheckpoint({ page, scenario, phase: 'navigation', state: 'before_action', viewport });
    await navigateToSeededPane(page, context);
    await captureCheckpoint({ page, scenario, phase: 'navigation', state: 'post_submit', viewport });

    await captureCheckpoint({ page, scenario, phase: 'modules', state: 'before_action', viewport });

    await ensureModuleAdded(page, 'Files', 'S', getFilesModule(page));
    await ensureModuleAdded(page, 'Table', 'M', getTableModule(page));
    await ensureModuleAdded(page, 'Kanban', 'M', getKanbanModuleCard(page));
    await ensureModuleAdded(
      page,
      'Calendar',
      'L',
      getCalendarModuleCard(page),
    );
    await ensureModuleAdded(page, 'Tasks', 'M', getTasksModule(page));
    await ensureModuleAdded(page, 'Reminders', 'M', getRemindersModule(page));
    await ensureModuleAdded(page, 'Quick Thoughts', 'M', page.getByLabel('Quick Thought editor').first());

    await captureCheckpoint({ page, scenario, phase: 'modules', state: 'post_submit', viewport });

    const tableTitle = withRunTag(
      context,
      `${scenario}-table-record-with-an-intentionally-long-title-that-should-truncate-within-the-table-cell`,
    );
    const tableModule = getTableModule(page);
    await captureCheckpoint({ page, scenario, phase: 'table', state: 'before_action', viewport });
    const createRowInput = tableModule.getByRole('textbox', { name: 'New record...' }).first();
    await expect(createRowInput).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
    await createRowInput.fill(tableTitle);
    await captureCheckpoint({ page, scenario, phase: 'table', state: 'input_filled', viewport });
    await tableModule.getByRole('button', { name: /^Add$/i }).first().click();

    const tableOpenButton = tableModule.getByRole('button', { name: new RegExp(`^Open record ${escapeRegExp(tableTitle)}$`, 'i') }).first();
    await expect(tableOpenButton).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
    await expect(tableOpenButton).toHaveAttribute('title', tableTitle);
    await expectCellContentToStayWithinBounds(tableOpenButton);
    await tableOpenButton.click();
    await expect(page.getByRole('dialog', { name: 'Record Inspector' })).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
    await expect(page.getByRole('heading', { name: new RegExp(`^${escapeRegExp(tableTitle)}$`, 'i') })).toBeVisible({
      timeout: LIVE_TIMEOUT_MS,
    });
    await page.keyboard.press('Escape');
    await captureCheckpoint({ page, scenario, phase: 'table', state: 'post_submit', viewport });

    const kanbanModule = getKanbanModuleCard(page);
    const kanbanTitle = withRunTag(context, `${scenario}-kanban-card`);
    await captureCheckpoint({ page, scenario, phase: 'kanban', state: 'before_action', viewport });
    const firstColumn = kanbanModule.locator('section[aria-label$=" column"]').first();
    await expect(firstColumn).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
    await firstColumn.getByRole('button', { name: /^Create card$/i }).click();
    await captureCheckpoint({ page, scenario, phase: 'kanban', state: 'dialog_open', viewport });
    const kanbanTitleInput = firstColumn.getByLabel('Card title').first();
    await expect(kanbanTitleInput).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
    await kanbanTitleInput.fill(kanbanTitle);
    await captureCheckpoint({ page, scenario, phase: 'kanban', state: 'input_filled', viewport });
    await firstColumn.getByRole('button', { name: /^Create$/i }).first().click();

    const kanbanRecordOpenButton = kanbanModule.getByRole('button', {
      name: new RegExp(`^Open record:\\s*${escapeRegExp(kanbanTitle)}$`, 'i'),
    }).first();
    await expect(kanbanRecordOpenButton).toBeVisible({ timeout: LIVE_TIMEOUT_MS });

    await kanbanRecordOpenButton.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: 'Record Inspector' })).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
    await page.keyboard.press('Escape');

    const columnSelect = kanbanModule.getByLabel(`Column for ${kanbanTitle}`).first();
    await expect(columnSelect).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
    const currentValue = await columnSelect.inputValue();
    const targetValue = await columnSelect.evaluate((node) => {
      const options = Array.from(node.options).map((option) => option.value).filter(Boolean);
      return options.find((value) => value !== node.value) || node.value;
    });

    await columnSelect.focus();
    await page.keyboard.press('ArrowDown');
    if (targetValue && targetValue !== currentValue) {
      await columnSelect.selectOption(targetValue);
      await expect(columnSelect).toHaveValue(targetValue);
    }
    await captureCheckpoint({ page, scenario, phase: 'kanban', state: 'post_submit', viewport });

    await captureCheckpoint({ page, scenario, phase: 'calendar', state: 'before_action', viewport });
    const calendarModule = getCalendarModuleCard(page);
    await ensureCalendarReadyForCreate(calendarModule);
    let calendarNewEventButton: Locator;
    if ((await calendarModule.getByRole('button', { name: /^New Event$/i }).count()) > 0) {
      calendarNewEventButton = calendarModule.getByRole('button', { name: /^New Event$/i }).first();
    } else {
      calendarNewEventButton = calendarModule.getByRole('button', { name: /^Create event for /i }).first();
    }
    await expect(calendarNewEventButton).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
    await calendarNewEventButton.click();

    const calendarTitle = withRunTag(context, `${scenario}-calendar-event`);
    const calendarTitleInput = calendarModule.getByLabel('Event title').first();
    await expect(calendarTitleInput).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
    await calendarTitleInput.fill(calendarTitle);
    await calendarModule.getByLabel('Start time').first().fill('09:30');
    await calendarModule.getByLabel('End time').first().fill('10:30');
    await captureCheckpoint({ page, scenario, phase: 'calendar', state: 'input_filled', viewport });
    await calendarModule.getByRole('button', { name: /^Create$/i }).first().click();

    let calendarEventButton = calendarModule.getByRole('button', { name: new RegExp(escapeRegExp(calendarTitle), 'i') }).first();
    if (!(await calendarEventButton.isVisible({ timeout: 5_000 }).catch(() => false))) {
      const dayViewButton = calendarModule.getByRole('button', { name: /^Day$/i }).first();
      if (await dayViewButton.isVisible().catch(() => false)) {
        await dayViewButton.click();
      }
      calendarEventButton = calendarModule.getByRole('button', { name: new RegExp(escapeRegExp(calendarTitle), 'i') }).first();
    }
    await expect(calendarEventButton).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
    await captureCheckpoint({ page, scenario, phase: 'calendar', state: 'post_submit', viewport });

    const taskTitle = withRunTag(context, `${scenario}-task-item`);
    const tasksModule = getTasksModule(page);
    await captureCheckpoint({ page, scenario, phase: 'tasks', state: 'before_action', viewport });
    let newTaskInput = tasksModule.getByLabel('New task title').first();
    if (!(await newTaskInput.isVisible().catch(() => false))) {
      const openComposerButton = tasksModule.getByRole('button', { name: /^New Task$/i }).first();
      await expect(openComposerButton).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
      await openComposerButton.click();
      newTaskInput = tasksModule.getByLabel('New task title').first();
    }
    await expect(newTaskInput).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
    await newTaskInput.fill(taskTitle);
    await captureCheckpoint({ page, scenario, phase: 'tasks', state: 'input_filled', viewport });
    const createTaskButton = tasksModule.getByRole('button', { name: /^(Add|Create task|Create)$/i }).first();
    await expect(createTaskButton).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
    await createTaskButton.click();
    await expect(page.getByText(taskTitle).first()).toBeVisible({ timeout: LIVE_TIMEOUT_MS });

    const taskToggleButton = tasksModule.getByRole('button', {
      name: new RegExp(`^Mark ${escapeRegExp(taskTitle)} as`, 'i'),
    }).first();
    await expect(taskToggleButton).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
    await taskToggleButton.click();
    await expect(taskToggleButton).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
    await captureCheckpoint({ page, scenario, phase: 'tasks', state: 'post_submit', viewport });

    const reminderTokenA = withRunTag(context, `${scenario}-reminder-a`);
    const reminderTokenB = withRunTag(context, `${scenario}-reminder-b`);
    const remindersModule = getRemindersModule(page);
    await captureCheckpoint({ page, scenario, phase: 'reminders', state: 'before_action', viewport });
    const reminderInput = remindersModule.getByLabel('Add a reminder').first();
    await expect(reminderInput).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
    await reminderInput.fill(`${reminderTokenA} tomorrow at 9am`);
    await captureCheckpoint({ page, scenario, phase: 'reminders', state: 'input_filled', viewport });
    await remindersModule.getByRole('button', { name: /^Add$/i }).first().click();
    await reminderInput.fill(`${reminderTokenB} next friday at 2pm`);
    await remindersModule.getByRole('button', { name: /^Add$/i }).first().click();
    await expect(page.getByText(new RegExp(escapeRegExp(reminderTokenA), 'i')).first()).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
    await captureCheckpoint({ page, scenario, phase: 'reminders', state: 'post_submit', viewport });

    const filesModule = getFilesModule(page);
    await expect(filesModule).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
    await captureCheckpoint({ page, scenario, phase: 'files', state: 'files-empty', viewport });
    const uploadButton = filesModule.getByRole('button', { name: /^Upload files$/i }).first();
    await expect(uploadButton).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
    await uploadButton.click();
    await captureCheckpoint({ page, scenario, phase: 'files', state: 'files-upload-dialog', viewport });

    const uploadFileName = `${scenario}-${context.runId}-upload.txt`;
    const uploadFilePath = testInfo.outputPath(uploadFileName);
    await writeFile(uploadFilePath, `journey upload ${context.runId}\n`, 'utf8');

    const fileInput = filesModule.locator('input[type="file"]').first();
    await fileInput.setInputFiles(uploadFilePath);
    await expect(filesModule.getByText(uploadFileName).first()).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
    await captureCheckpoint({ page, scenario, phase: 'files', state: 'files-uploaded', viewport });

    const openUploadedFileButton = filesModule.getByRole('button', {
      name: new RegExp(`^Open ${escapeRegExp(uploadFileName)}$`, 'i'),
    }).first();
    await expect(openUploadedFileButton).toBeVisible({ timeout: LIVE_TIMEOUT_MS });

    const popupPromise = page.waitForEvent('popup', { timeout: LIVE_TIMEOUT_MS });
    await openUploadedFileButton.click();
    const popup = await popupPromise;
    await popup.waitForLoadState('domcontentloaded', { timeout: LIVE_TIMEOUT_MS }).catch(() => undefined);
    await popup.close();
    await captureCheckpoint({ page, scenario, phase: 'files', state: 'files-post-download', viewport });

    const quickThoughtToken = withRunTag(context, `${scenario}-quick-thought`);
    await captureCheckpoint({ page, scenario, phase: 'quick-thoughts', state: 'before_action', viewport });
    const thoughtInput = page.getByLabel('Quick Thought editor').first();
    await expect(thoughtInput).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
    await thoughtInput.fill(`${quickThoughtToken} captured in journey verification`);
    await captureCheckpoint({ page, scenario, phase: 'quick-thoughts', state: 'input_filled', viewport });
    await page.getByRole('button', { name: /^Save Thought$/i }).first().click();
    await expect(page.getByText(new RegExp(escapeRegExp(quickThoughtToken), 'i')).first()).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
    await captureCheckpoint({ page, scenario, phase: 'quick-thoughts', state: 'post_submit', viewport });

    const docToken = withRunTag(context, `${scenario}-workspace-doc`);
    await captureCheckpoint({ page, scenario, phase: 'workspace-doc', state: 'before_action', viewport });
    const workspaceEditor = page.getByLabel('Project note editor');
    await expect(workspaceEditor).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
    await workspaceEditor.click();
    await page.keyboard.type(` ${docToken}`);
    await expect(workspaceEditor).toContainText(docToken, { timeout: LIVE_TIMEOUT_MS });
    await captureCheckpoint({ page, scenario, phase: 'workspace-doc', state: 'post_submit', viewport });

    await page.reload({ waitUntil: 'domcontentloaded', timeout: LIVE_TIMEOUT_MS });
    await expect(page.getByRole('toolbar', { name: 'Open panes' })).toBeVisible({ timeout: LIVE_TIMEOUT_MS });

    await verifyPersistenceOnPage(page, {
      tableTitle,
      kanbanTitle,
      taskTitle,
      reminderToken: reminderTokenA,
      quickThoughtToken,
      docToken,
      fileName: uploadFileName,
    });

    await captureCheckpoint({ page, scenario, phase: 'persistence', state: 'post_reload', viewport });

    const secondContext = await withFreshContext(page.context(), testInfo);
    try {
      coverage.attachContext(secondContext);
      const secondPage = await secondContext.newPage();
      await navigateToSeededPane(secondPage, context);

      await verifyPersistenceOnPage(secondPage, {
        tableTitle,
        kanbanTitle,
        taskTitle,
        reminderToken: reminderTokenA,
        quickThoughtToken,
        docToken,
        fileName: uploadFileName,
      });

      const thirdContext = await withFreshContext(secondContext, testInfo);
      try {
        coverage.attachContext(thirdContext);
        const thirdPage = await thirdContext.newPage();
        await navigateToSeededPane(thirdPage, context);

        await verifyPersistenceOnPage(thirdPage, {
          tableTitle,
          kanbanTitle,
          taskTitle,
          reminderToken: reminderTokenA,
          quickThoughtToken,
          docToken,
          fileName: uploadFileName,
        });

        await captureCheckpoint({ page: thirdPage, scenario, phase: 'files', state: 'files-post-reopen', viewport });
        await captureCheckpoint({ page: thirdPage, scenario, phase: 'persistence', state: 'post_reopen', viewport });
      } finally {
        await thirdContext.close();
      }
    } finally {
      await secondContext.close();
    }

    await coverage.writeArtifacts();
  });

  test('checkpoint captures for tablet/mobile', async ({ page }, testInfo) => {
    if (testInfo.project.name === 'desktop') {
      test.skip();
    }

    const scenario: JourneyScenario = resolveScenario();
    const context = await readJourneyContext();
    const viewport = viewportLabelForProject(testInfo.project.name);

    const { accountA } = await resolveLinkedTestAccounts();
    await loginThroughKeycloak(page, accountA);
    await captureCheckpoint({ page, scenario, phase: 'checkpoint', state: 'before_action', viewport });

    await navigateToSeededPane(page, context);
    await captureCheckpoint({ page, scenario, phase: 'checkpoint', state: 'post_submit', viewport });

    if (await page.getByRole('button', { name: /^Modules$/i }).isVisible().catch(() => false)) {
      await page.getByRole('button', { name: /^Modules$/i }).click();
      await captureCheckpoint({ page, scenario, phase: 'checkpoint', state: 'dialog_open', viewport });
    }

    const now = new Date();
    const localDateInput = toDateTimeLocalInput(now);
    await expect(localDateInput.length).toBeGreaterThan(0);
  });
});
