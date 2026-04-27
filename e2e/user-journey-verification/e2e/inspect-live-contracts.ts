import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium, devices, expect, type BrowserContext, type BrowserContextOptions, type Locator, type Page, type Response } from '@playwright/test';
import { loginThroughKeycloak } from '../../support/audit.ts';
import { resolveLinkedTestAccounts } from '../../utils/tokenMint.ts';
import { readJourneyContext, withRunTag } from '../utils/stateTags.ts';

const LIVE_TIMEOUT_MS = 20_000;
const RAW_CAPTURE_REDACTED = '[redacted; set ENABLE_RAW_CAPTURE=true to include raw capture]';
const RAW_CAPTURE_ENABLED = /^(1|true|yes)$/i.test(String(process.env.ENABLE_RAW_CAPTURE || '').trim());

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeWhitespace = (value: string): string => value.replace(/\s+/g, ' ').trim();

const toRepoRelativePath = (absolutePath: string): string => {
  const normalizedCwd = process.cwd().replace(/\\/g, '/').replace(/\/$/, '');
  const normalizedPath = absolutePath.replace(/\\/g, '/');
  if (normalizedPath.startsWith(`${normalizedCwd}/`)) {
    return normalizedPath.slice(normalizedCwd.length + 1);
  }
  return normalizedPath;
};

const timestampLabel = (): string => new Date().toISOString().replace(/[:.]/g, '-');

const captureRawValue = (value: string | null | undefined, maxLength: number): string | null => {
  const normalized = normalizeWhitespace(value || '');
  if (!normalized) {
    return null;
  }

  if (!RAW_CAPTURE_ENABLED) {
    return RAW_CAPTURE_REDACTED;
  }

  return normalized.slice(0, maxLength);
};

interface PhaseDump {
  status: 'passed' | 'failed' | 'skipped';
  url: string;
  details?: Record<string, unknown>;
  error?: string;
  page?: Record<string, unknown>;
}

interface InspectionReport {
  runId: string;
  outputPath: string;
  scenario: string;
  projectId: string;
  projectId: string;
  generatedAt: string;
  phases: Record<string, PhaseDump>;
  network: {
    relevantResponses: Array<Record<string, unknown>>;
  };
}

const waitForProjectsHome = async (page: Page): Promise<void> => {
  await page.goto('/projects', { waitUntil: 'domcontentloaded', timeout: LIVE_TIMEOUT_MS });
  await expect(page.getByRole('navigation', { name: 'Home tabs' })).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
};

const navigateToSeededProject = async (
  page: Page,
  context: Awaited<ReturnType<typeof readJourneyContext>>,
): Promise<void> => {
  await waitForProjectsHome(page);
  await page.goto(`/projects/${context.project.id}/work/${context.projects.primaryId}`, {
    waitUntil: 'domcontentloaded',
    timeout: LIVE_TIMEOUT_MS,
  });

  await expect(page).toHaveURL(new RegExp(`/projects/${escapeRegExp(context.project.id)}/work/${escapeRegExp(context.projects.primaryId)}(?:\\?|$)`), {
    timeout: LIVE_TIMEOUT_MS,
  });
};

const openAddModuleDialog = async (page: Page): Promise<void> => {
  const addModuleButton = page.getByRole('button', { name: /Add module|Add a module/i }).first();
  await expect(addModuleButton).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
  await addModuleButton.click();
  await expect(page.getByRole('heading', { name: /^Add Module$/i })).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
};

const snapshotLocator = async (locator: Locator, payload: Record<string, unknown> = {}) => {
  const target = locator.first();
  if ((await target.count()) === 0) {
    return {
      missing: true,
      payload,
    };
  }

  try {
    return await target.evaluate((node, options: {
      payload: Record<string, unknown>;
      rawCaptureEnabled: boolean;
      redactedValue: string;
    }) => {
      const root = node as HTMLElement;
      const normalize = (value: string): string => value.replace(/\s+/g, ' ').trim();
      const getButtonState = (button: Element) => ({
        text: (button.textContent || '').trim(),
        ariaLabel: button.getAttribute('aria-label'),
        pressed: button.getAttribute('aria-pressed'),
      });
      const getInputState = (input: Element) => {
        const element = input as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
        return {
          tag: input.tagName,
          type: 'type' in element ? (element as HTMLInputElement).type || null : null,
          ariaLabel: input.getAttribute('aria-label'),
          placeholder: 'placeholder' in element ? (element as HTMLInputElement | HTMLTextAreaElement).placeholder || null : null,
          value: 'value' in element ? (element as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value : null,
        };
      };

      return {
        tag: root.tagName,
        text: normalize(root.innerText || root.textContent || ''),
        buttons: Array.from(root.querySelectorAll('button')).slice(0, 30).map(getButtonState),
        inputs: Array.from(root.querySelectorAll('input, textarea, select')).slice(0, 30).map(getInputState),
        alerts: Array.from(root.querySelectorAll('[role="alert"]')).map((element) => normalize(element.textContent || '')),
        html: options.rawCaptureEnabled ? root.outerHTML.slice(0, 100_000) : options.redactedValue,
        payload: options.payload,
      };
    }, {
      payload,
      rawCaptureEnabled: RAW_CAPTURE_ENABLED,
      redactedValue: RAW_CAPTURE_REDACTED,
    });
  } catch (error) {
    return {
      missing: true,
      error: error instanceof Error ? error.message : String(error),
      payload,
    };
  }
};

const snapshotPage = async (page: Page): Promise<Record<string, unknown>> => {
  const bodyHtml = await page.locator('body').evaluate((node) => (node as HTMLElement).outerHTML).catch(() => null);
  const bodyText = await page.locator('body').innerText().catch(() => '');
  const normalizedBodyText = normalizeWhitespace(bodyText);
  const normalizedBodyHtml = bodyHtml ? normalizeWhitespace(bodyHtml) : '';

  return {
    url: page.url(),
    bodyText: captureRawValue(normalizedBodyText, 30_000),
    bodyTextLength: normalizedBodyText.length,
    bodyHtml: captureRawValue(normalizedBodyHtml, 100_000),
    bodyHtmlLength: normalizedBodyHtml.length,
  };
};

const recordRelevantResponse = async (response: Response) => {
  const url = response.url();
  if (!/\/api\/hub\/(projects\/[^/]+\/records|projects\/[^/]+\/tasks|projects\/[^/]+\/views|projects\/[^/]+\/collections|reminders|files|records\/[^/]+\/values)/.test(url)) {
    return null;
  }

  const request = response.request();
  const contentType = String(response.headers()['content-type'] || '');
  let bodySnippet: string | null = null;
  try {
    if (contentType.includes('application/json')) {
      bodySnippet = JSON.stringify(await response.json());
    } else {
      bodySnippet = await response.text();
    }
  } catch {
    bodySnippet = null;
  }

  return {
    url,
    method: request.method(),
    status: response.status(),
    requestBody: captureRawValue(request.postData(), 2_000),
    requestBodyLength: normalizeWhitespace(request.postData() || '').length,
    responseBody: captureRawValue(bodySnippet, 4_000),
    responseBodyLength: normalizeWhitespace(bodySnippet || '').length,
  };
};

const getFilesModule = (page: Page): Locator => page.getByRole('region', { name: 'Files module' }).first();
const getTableModule = (page: Page): Locator => page.getByRole('region', { name: 'Table module' }).first();
const getTasksModule = (page: Page): Locator => page.getByRole('region', { name: 'Tasks module' }).first();
const getRemindersModule = (page: Page): Locator => page.getByRole('region', { name: 'Reminders module' }).first();

const getKanbanModuleCard = (page: Page): Locator => {
  return page
    .locator('[data-testid="module-card"]')
    .filter({ has: page.getByRole('button', { name: /Kanban module actions/i }) })
    .first();
};

const getCalendarModuleCard = (page: Page): Locator => {
  return page
    .locator('article')
    .filter({
      has: page.getByRole('button', { name: /Calendar module actions|New Event|Previous week|Previous day/i }).first(),
    })
    .first();
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

  const selectButton = page.getByRole('button', {
    name: new RegExp(`^Select ${escapeRegExp(moduleLabel)} module$`, 'i'),
  }).first();
  await expect(selectButton).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
  await selectButton.click();

  const sizeButton = page.getByRole('button', {
    name: new RegExp(`^Add ${escapeRegExp(moduleLabel)} at ${sizeTier} size$`, 'i'),
  }).first();
  await expect(sizeButton).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
  await sizeButton.click();

  await expect(visibleLocator.first()).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
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

const createResponsiveContext = async (
  browser: Awaited<ReturnType<typeof chromium.launch>>,
  options: BrowserContextOptions,
): Promise<BrowserContext> => {
  return browser.newContext({
    ...options,
    baseURL: process.env.E2E_BASE_URL || process.env.PLAYWRIGHT_BASE_URL,
  });
};

const runPhase = async (
  report: InspectionReport,
  page: Page,
  phaseName: string,
  action: () => Promise<Record<string, unknown> | void>,
): Promise<void> => {
  try {
    const details = (await action()) || {};
    report.phases[phaseName] = {
      status: 'passed',
      url: page.url(),
      details,
      page: await snapshotPage(page),
    };
  } catch (error) {
    report.phases[phaseName] = {
      status: 'failed',
      url: page.url(),
      error: error instanceof Error ? error.stack || error.message : String(error),
      page: await snapshotPage(page),
    };
  }
};

const main = async (): Promise<void> => {
  const context = await readJourneyContext();
  const runId = `inspection-${timestampLabel()}`;
  const outputDir = path.resolve(process.cwd(), 'e2e', 'user-journey-verification', 'runs', runId);
  const outputPath = path.join(outputDir, `${context.scenario}-live-contracts.json`);

  await mkdir(outputDir, { recursive: true });
  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
  let desktopContext: BrowserContext | null = null;
  let page: Page | null = null;
  const responses: Array<Record<string, unknown>> = [];
  const responseCaptureTasks: Array<Promise<void>> = [];
  let responseListener: ((response: Response) => void) | null = null;

  const report: InspectionReport = {
    runId,
    outputPath: toRepoRelativePath(outputPath),
    scenario: context.scenario,
    projectId: context.project.id,
    projectId: context.projects.primaryId,
    generatedAt: new Date().toISOString(),
    phases: {},
    network: {
      relevantResponses: [],
    },
  };

  const artifacts = {
    tableTitle: withRunTag(context, `${context.scenario}-table-record`),
    kanbanTitle: withRunTag(context, `${context.scenario}-kanban-card`),
    calendarTitle: withRunTag(context, `${context.scenario}-calendar-event`),
    taskTitle: withRunTag(context, `${context.scenario}-task-item`),
    reminderTokenA: withRunTag(context, `${context.scenario}-reminder-a`),
    reminderTokenB: withRunTag(context, `${context.scenario}-reminder-b`),
    quickThoughtText: `${withRunTag(context, `${context.scenario}-quick-thought`)} captured in journey verification`,
    workspaceDocText: withRunTag(context, `${context.scenario}-workspace-doc`),
    uploadFileName: `${context.scenario}-${context.runId}-upload.txt`,
  };
  const uploadFilePath = path.join(outputDir, artifacts.uploadFileName);
  await writeFile(uploadFilePath, `journey upload ${context.runId}\n`, 'utf8');

  try {
    browser = await chromium.launch({ headless: true });
    desktopContext = await createResponsiveContext(browser, { ...devices['Desktop Chrome'] });
    const desktopPage = await desktopContext.newPage();
    page = desktopPage;

    responseListener = (response: Response) => {
      responseCaptureTasks.push(
        recordRelevantResponse(response).then((entry) => {
          if (entry) {
            responses.push(entry);
          }
        }),
      );
    };
    desktopPage.on('response', responseListener);

    const { accountA } = await resolveLinkedTestAccounts();

    await runPhase(report, desktopPage, 'navigation', async () => {
      await loginThroughKeycloak(desktopPage, accountA);
      await navigateToSeededProject(desktopPage, context);
      return {
        toolbar: await snapshotLocator(desktopPage.getByRole('toolbar', { name: 'Open projects' })),
        pageHeader: await snapshotLocator(desktopPage.getByRole('heading', { name: new RegExp(`^${escapeRegExp(context.project.name)}$`, 'i') })),
      };
    });

    await runPhase(report, desktopPage, 'modules', async () => {
      await ensureModuleAdded(desktopPage, 'Files', 'S', getFilesModule(desktopPage));
      await ensureModuleAdded(desktopPage, 'Table', 'M', getTableModule(desktopPage));
      await ensureModuleAdded(desktopPage, 'Kanban', 'M', getKanbanModuleCard(desktopPage));
      await ensureModuleAdded(desktopPage, 'Calendar', 'L', getCalendarModuleCard(desktopPage));
      await ensureModuleAdded(desktopPage, 'Tasks', 'M', getTasksModule(desktopPage));
      await ensureModuleAdded(desktopPage, 'Reminders', 'M', getRemindersModule(desktopPage));
      await ensureModuleAdded(desktopPage, 'Quick Thoughts', 'M', desktopPage.getByLabel('Quick Thought editor').first());

      return {
        files: await snapshotLocator(getFilesModule(desktopPage)),
        table: await snapshotLocator(getTableModule(desktopPage)),
        kanban: await snapshotLocator(getKanbanModuleCard(desktopPage)),
        calendar: await snapshotLocator(getCalendarModuleCard(desktopPage)),
        tasks: await snapshotLocator(getTasksModule(desktopPage)),
        reminders: await snapshotLocator(getRemindersModule(desktopPage)),
        quickThought: await snapshotLocator(desktopPage.getByLabel('Quick Thought editor').first()),
        workspaceDoc: await snapshotLocator(desktopPage.getByLabel('Project note editor').first()),
      };
    });

    await runPhase(report, desktopPage, 'motion_targets', async () => {
      await openAddModuleDialog(desktopPage);
      const dialogSnapshot = await snapshotLocator(desktopPage.getByRole('dialog').first());
      await desktopPage.keyboard.press('Escape');

      const tableActionsButton = desktopPage.getByRole('button', { name: /Open Table module actions/i }).first();
      await expect(tableActionsButton).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
      await tableActionsButton.click();
      const menuSnapshot = await snapshotLocator(desktopPage.getByRole('menu').first());
      await desktopPage.keyboard.press('Escape');

      return {
        addModuleDialog: dialogSnapshot,
        tableActionsMenu: menuSnapshot,
      };
    });

    await runPhase(report, desktopPage, 'table', async () => {
      const tableModule = getTableModule(desktopPage);
      const createRowInput = tableModule.getByRole('textbox', { name: 'New record...' }).first();
      await expect(createRowInput).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
      await createRowInput.fill(artifacts.tableTitle);
      await tableModule.getByRole('button', { name: /^Add$/i }).first().click();

      const openRecordButton = tableModule.getByRole('button', {
        name: new RegExp(`^Open record ${escapeRegExp(artifacts.tableTitle)}$`, 'i'),
      }).first();
      await expect(openRecordButton).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
      await openRecordButton.click();

      const inspector = desktopPage.getByRole('dialog', { name: 'Record Inspector' });
      await expect(inspector).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
      const inspectorSnapshot = await snapshotLocator(inspector);
      await desktopPage.keyboard.press('Escape');

      return {
        table: await snapshotLocator(tableModule, { tableTitle: artifacts.tableTitle }),
        inspector: inspectorSnapshot,
      };
    });

    await runPhase(report, desktopPage, 'kanban', async () => {
      const kanbanModule = getKanbanModuleCard(desktopPage);
      const firstColumn = kanbanModule.locator('section[aria-label$=" column"]').first();
      await expect(firstColumn).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
      await firstColumn.getByRole('button', { name: /^Create card$/i }).click();

      const titleInput = firstColumn.getByLabel('Card title').first();
      await expect(titleInput).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
      await titleInput.fill(artifacts.kanbanTitle);
      await firstColumn.getByRole('button', { name: /^Create$/i }).first().click();

      const openRecordButton = kanbanModule.getByRole('button', {
        name: new RegExp(`^Open record:\\s*${escapeRegExp(artifacts.kanbanTitle)}$`, 'i'),
      }).first();
      await expect(openRecordButton).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
      await openRecordButton.focus();
      await desktopPage.keyboard.press('Enter');
      const inspector = desktopPage.getByRole('dialog', { name: 'Record Inspector' });
      await expect(inspector).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
      const inspectorSnapshot = await snapshotLocator(inspector);
      await desktopPage.keyboard.press('Escape');

      const columnSelect = kanbanModule.getByLabel(`Column for ${artifacts.kanbanTitle}`).first();
      await expect(columnSelect).toBeVisible({ timeout: LIVE_TIMEOUT_MS });

      return {
        kanban: await snapshotLocator(kanbanModule, { kanbanTitle: artifacts.kanbanTitle }),
        inspector: inspectorSnapshot,
      };
    });

    await runPhase(report, desktopPage, 'calendar', async () => {
      const calendarModule = getCalendarModuleCard(desktopPage);
      await ensureCalendarReadyForCreate(calendarModule);

      let newEventButton = calendarModule.getByRole('button', { name: /^New Event$/i }).first();
      if ((await newEventButton.count()) === 0) {
        newEventButton = calendarModule.getByRole('button', { name: /^Create event for /i }).first();
      }
      await expect(newEventButton).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
      await newEventButton.click();

      const titleInput = calendarModule.getByLabel(/Event title|Write an event in natural language/i).first();
      await expect(titleInput).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
      await titleInput.fill(artifacts.calendarTitle);
      await calendarModule.getByLabel('Start time').first().fill('09:30');
      await calendarModule.getByLabel('End time').first().fill('10:30');
      await calendarModule.getByRole('button', { name: /^Create$/i }).first().click();
      await desktopPage.waitForTimeout(3_000);

      return {
        calendar: await snapshotLocator(calendarModule, { calendarTitle: artifacts.calendarTitle }),
        matchingButtons: await calendarModule.getByRole('button', {
          name: new RegExp(escapeRegExp(artifacts.calendarTitle), 'i'),
        }).allTextContents(),
      };
    });

    await runPhase(report, desktopPage, 'tasks', async () => {
      const tasksModule = getTasksModule(desktopPage);
      let titleInput = tasksModule.getByLabel(/New task title|Write a task in natural language/i).first();
      if (!(await titleInput.isVisible().catch(() => false))) {
        const openComposerButton = tasksModule.getByRole('button', { name: /^New Task$/i }).first();
        await expect(openComposerButton).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
        await openComposerButton.click();
        titleInput = tasksModule.getByLabel(/New task title|Write a task in natural language/i).first();
      }
      await expect(titleInput).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
      await titleInput.fill(artifacts.taskTitle);
      await tasksModule.getByRole('button', { name: /^(Add|Create task|Create)$/i }).first().click();
      await desktopPage.waitForTimeout(3_000);

      const toggleButton = tasksModule.getByRole('button', {
        name: new RegExp(`^Mark ${escapeRegExp(artifacts.taskTitle)} as`, 'i'),
      }).first();

      return {
        tasks: await snapshotLocator(tasksModule, { taskTitle: artifacts.taskTitle }),
        matchingTexts: await desktopPage.getByText(artifacts.taskTitle, { exact: false }).allTextContents(),
        matchingButtons: await desktopPage.getByRole('button', {
          name: new RegExp(escapeRegExp(artifacts.taskTitle), 'i'),
        }).allTextContents(),
        toggleButtonVisible: await toggleButton.isVisible().catch(() => false),
        globalAlerts: (await desktopPage.locator('[role="alert"]').allTextContents()).map((entry) => normalizeWhitespace(entry)),
      };
    });

    await runPhase(report, desktopPage, 'reminders', async () => {
      const remindersModule = getRemindersModule(desktopPage);
      const input = remindersModule.getByLabel(/Reminder|Write a reminder in natural language/i).first();
      await expect(input).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
      await input.fill(`${artifacts.reminderTokenA} tomorrow at 9am`);
      await remindersModule.getByRole('button', { name: /^Add$/i }).first().click();
      await input.fill(`${artifacts.reminderTokenB} next friday at 2pm`);
      await remindersModule.getByRole('button', { name: /^Add$/i }).first().click();
      await desktopPage.waitForTimeout(3_000);

      return {
        reminders: await snapshotLocator(remindersModule, {
          reminderTokenA: artifacts.reminderTokenA,
          reminderTokenB: artifacts.reminderTokenB,
        }),
        matchingTexts: await desktopPage.getByText(new RegExp(escapeRegExp(artifacts.reminderTokenA), 'i')).allTextContents(),
      };
    });

    await runPhase(report, desktopPage, 'files', async () => {
      const filesModule = getFilesModule(desktopPage);
      const input = filesModule.locator('input[type="file"]').first();
      await input.setInputFiles(uploadFilePath);
      await desktopPage.waitForTimeout(3_000);

      let popupOpened = false;
      const openButton = filesModule.getByRole('button', {
        name: new RegExp(`^Open ${escapeRegExp(artifacts.uploadFileName)}$`, 'i'),
      }).first();
      if (await openButton.isVisible().catch(() => false)) {
        const popupPromise = desktopPage.waitForEvent('popup', { timeout: 15_000 }).catch(() => null);
        await openButton.click();
        const popup = await popupPromise;
        if (popup) {
          popupOpened = true;
          await popup.waitForLoadState('domcontentloaded', { timeout: 15_000 }).catch(() => undefined);
          await popup.close();
        }
      }

      return {
        files: await snapshotLocator(filesModule, { uploadFileName: artifacts.uploadFileName }),
        popupOpened,
      };
    });

    await runPhase(report, desktopPage, 'quick_thoughts', async () => {
      const input = desktopPage.getByLabel('Quick Thought editor').first();
      await expect(input).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
      await input.fill(artifacts.quickThoughtText);
      await desktopPage.getByRole('button', { name: /^Save Thought$/i }).first().click();
      await desktopPage.waitForTimeout(2_000);

      return {
        quickThought: await snapshotLocator(input, { quickThoughtText: artifacts.quickThoughtText }),
        matchingTexts: await desktopPage.getByText(new RegExp(escapeRegExp(artifacts.quickThoughtText), 'i')).allTextContents(),
      };
    });

    await runPhase(report, desktopPage, 'workspace_doc', async () => {
      const editor = desktopPage.getByLabel('Project note editor').first();
      await expect(editor).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
      await editor.click();
      await desktopPage.keyboard.type(` ${artifacts.workspaceDocText}`);
      await desktopPage.waitForTimeout(1_500);

      return {
        workspaceDoc: await snapshotLocator(editor, { workspaceDocText: artifacts.workspaceDocText }),
      };
    });

    await runPhase(report, desktopPage, 'persistence_reload', async () => {
      await desktopPage.reload({ waitUntil: 'domcontentloaded', timeout: LIVE_TIMEOUT_MS });
      await expect(desktopPage.getByRole('toolbar', { name: 'Open projects' })).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
      return {
        matches: {
          table: await desktopPage.getByText(artifacts.tableTitle).allTextContents(),
          kanban: await desktopPage.getByText(artifacts.kanbanTitle).allTextContents(),
          task: await desktopPage.getByText(artifacts.taskTitle).allTextContents(),
          reminder: await desktopPage.getByText(new RegExp(escapeRegExp(artifacts.reminderTokenA), 'i')).allTextContents(),
          quickThought: await desktopPage.getByText(new RegExp(escapeRegExp(artifacts.quickThoughtText), 'i')).allTextContents(),
          file: await desktopPage.getByText(artifacts.uploadFileName).allTextContents(),
        },
        workspaceDoc: await snapshotLocator(desktopPage.getByLabel('Project note editor').first()),
      };
    });

    const responsiveTargets: Array<{ name: 'tablet_checkpoint' | 'mobile_checkpoint'; device: BrowserContextOptions }> = [
      { name: 'tablet_checkpoint', device: { ...devices['iPad Pro 11'] } },
      { name: 'mobile_checkpoint', device: { ...devices['iPhone 14'] } },
    ];

    for (const target of responsiveTargets) {
      const responsiveContext = await createResponsiveContext(browser, target.device);
      const responsivePage = await responsiveContext.newPage();
      try {
        await loginThroughKeycloak(responsivePage, accountA);
        await navigateToSeededProject(responsivePage, context);

        let modulesDialog = null;
        const modulesButton = responsivePage.getByRole('button', { name: /^Modules$/i }).first();
        if (await modulesButton.isVisible().catch(() => false)) {
          await modulesButton.click();
          modulesDialog = await snapshotPage(responsivePage);
        }

        report.phases[target.name] = {
          status: 'passed',
          url: responsivePage.url(),
          details: {
            modulesButtonVisible: await modulesButton.isVisible().catch(() => false),
            modulesDialog,
          },
          page: await snapshotPage(responsivePage),
        };
      } catch (error) {
        report.phases[target.name] = {
          status: 'failed',
          url: responsivePage.url(),
          error: error instanceof Error ? error.stack || error.message : String(error),
          page: await snapshotPage(responsivePage),
        };
      } finally {
        await responsiveContext.close();
      }
    }
  } finally {
    if (page && responseListener) {
      page.off('response', responseListener);
    }
    await Promise.allSettled(responseCaptureTasks);
    report.network.relevantResponses = responses;
    await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    await page?.close().catch(() => undefined);
    await desktopContext?.close().catch(() => undefined);
    await browser?.close().catch(() => undefined);
  }

  process.stdout.write(`${toRepoRelativePath(outputPath)}\n`);
  if (Object.values(report.phases).some((phase) => phase.status === 'failed')) {
    process.exitCode = 1;
  }
};

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exitCode = 1;
});
