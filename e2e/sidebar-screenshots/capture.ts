import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Locator, type Page } from 'playwright';
import { loadEnvFilesIntoProcess } from '../../scripts/dev/lib/env.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const screenshotDir = resolve(__dirname);
const appBaseUrl = 'http://127.0.0.1:5173';
const sidebarStorageKey = 'hub-sidebar-collapsed';
const requestedCapture = String(process.env.SIDEBAR_CAPTURE_FILE || '').trim();

const wait = (ms: number): Promise<void> => new Promise((resolveWait) => setTimeout(resolveWait, ms));

const readRequiredEnv = (name: string): string => {
  const value = String(process.env[name] || '').trim();
  if (!value) {
    throw new Error(`Missing required environment variable ${name}.`);
  }
  return value;
};

const navigation = (page: Page): Locator => page.locator('nav[aria-label="Primary workspace navigation"]');

const waitForShell = async (page: Page): Promise<void> => {
  await navigation(page).waitFor({ state: 'visible', timeout: 60_000 });
  await page.waitForFunction(
    () => {
      const body = document.body;
      if (!body) {
        return false;
      }
      const text = body.innerText;
      return !text.includes('Initializing secure session...') && !text.includes('Loading route...');
    },
    null,
    { timeout: 60_000 },
  );
  await wait(600);
};

const setSidebarCollapsed = async (page: Page, collapsed: boolean): Promise<void> => {
  await page.evaluate(
    ({ key, value }) => {
      window.localStorage.setItem(key, value);
    },
    { key: sidebarStorageKey, value: String(collapsed) },
  );
};

const loginWithLocalKeycloak = async (page: Page): Promise<void> => {
  const username = readRequiredEnv('LOCAL_OWNER_USERNAME');
  const password = readRequiredEnv('LOCAL_OWNER_PASSWORD');

  await page.goto(`${appBaseUrl}/projects`, { waitUntil: 'domcontentloaded' });
  const continueButton = page.getByRole('button', { name: 'Continue with Keycloak' });
  if (await continueButton.isVisible().catch(() => false)) {
    await continueButton.click();
  }

  await page.locator('input[name="username"], input#username').first().waitFor({ state: 'visible', timeout: 30_000 });
  await page.locator('input[name="username"], input#username').first().fill(username);
  await page.locator('input[name="password"], input#password').first().fill(password);
  await Promise.all([
    page.waitForURL((url) => url.origin === appBaseUrl, { timeout: 60_000 }),
    page.locator('input#kc-login, button#kc-login, button[type="submit"], input[type="submit"]').first().click(),
  ]);

  await waitForShell(page);
};

const openHomeExpanded = async (page: Page): Promise<void> => {
  await page.goto(`${appBaseUrl}/projects?view=project-lens`, { waitUntil: 'domcontentloaded' });
  await waitForShell(page);
  await setSidebarCollapsed(page, false);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForShell(page);
};

const captureSidebar = async (page: Page, fileName: string): Promise<void> => {
  await wait(350);
  await navigation(page).screenshot({
    path: resolve(screenshotDir, fileName),
  });
};

const readProjectDisclosureLabels = async (page: Page): Promise<string[]> => {
  return navigation(page).locator('button[aria-label]').evaluateAll((elements) =>
    elements
      .map((element) => String(element.getAttribute('aria-label') || '').trim())
      .filter((label) => /^(Expand|Collapse) [A-Z]/.test(label)),
  );
};

const ensureProjectsExpanded = async (page: Page): Promise<void> => {
  const toggle = navigation(page).getByRole('button', { name: 'Projects', exact: true });
  if ((await readProjectDisclosureLabels(page)).length > 0) {
    return;
  }
  await toggle.click();
  await page.waitForFunction(
    () =>
      Array.from(document.querySelectorAll('nav[aria-label="Primary workspace navigation"] button[aria-label]'))
        .map((element) => String(element.getAttribute('aria-label') || '').trim())
        .some((label) => /^(Expand|Collapse) [A-Z]/.test(label)),
    null,
    { timeout: 15_000 },
  );
  await wait(300);
};

const resolveSidebarProjectLabel = async (page: Page): Promise<string> => {
  await ensureProjectsExpanded(page);
  const disclosureLabels = await readProjectDisclosureLabels(page);

  const preferredPrefixes = ['Sidebar Primary ', 'Local Secure Dev', 'KanBan Test'];
  for (const prefix of preferredPrefixes) {
    const label = disclosureLabels
      .find((entry) => entry.startsWith(`Expand ${prefix}`) || entry.startsWith(`Collapse ${prefix}`))
      ?.replace(/^Expand\s+/, '')
      .replace(/^Collapse\s+/, '')
      .trim() || null;
    if (label) {
      return label;
    }
  }

  const ariaLabel = disclosureLabels[0] || '';
  const label = ariaLabel.replace(/^Expand\s+/, '').replace(/^Collapse\s+/, '').trim();
  if (!label) {
    throw new Error('Unable to find a sidebar project to capture.');
  }
  return label;
};

const ensureProjectExpanded = async (page: Page, projectLabel: string): Promise<void> => {
  const nav = navigation(page);
  const disclosure = nav.locator(`button[aria-label="Expand ${projectLabel}"], button[aria-label="Collapse ${projectLabel}"]`).first();
  await disclosure.waitFor({ state: 'visible', timeout: 15_000 });
  const ariaLabel = String((await disclosure.getAttribute('aria-label')) || '');
  if (ariaLabel.startsWith('Expand ')) {
    await disclosure.click();
    await wait(500);
  }
};

const openProjectPane = async (page: Page, projectLabel: string): Promise<void> => {
  const nav = navigation(page);
  await ensureProjectsExpanded(page);
  await ensureProjectExpanded(page, projectLabel);

  const preferredPaneLabels = ['Main Work', 'Sidebar Alpha', 'Sidebar Beta'];
  for (const prefix of preferredPaneLabels) {
    const paneButton = nav.locator('button').filter({ hasText: new RegExp(`^${prefix}`) }).first();
    if (await paneButton.count() && await paneButton.isVisible().catch(() => false)) {
      await paneButton.scrollIntoViewIfNeeded();
      await paneButton.click({ force: true });
      await page.waitForURL(/\/projects\/[^/]+\/work\/[^/]+/, { timeout: 30_000 });
      await waitForShell(page);
      return;
    }
  }

  throw new Error(`Unable to find a pane button for ${projectLabel}.`);
};

const captureSteps = (page: Page): Record<string, () => Promise<void>> => ({
  'sidebar-expanded-hub.png': async () => {
    await openHomeExpanded(page);
    await ensureProjectsExpanded(page);
    await captureSidebar(page, 'sidebar-expanded-hub.png');
  },
  'sidebar-expanded-project.png': async () => {
    await openHomeExpanded(page);
    const projectLabel = await resolveSidebarProjectLabel(page);
    await openProjectPane(page, projectLabel);
    await captureSidebar(page, 'sidebar-expanded-project.png');
  },
  'sidebar-rail-mode.png': async () => {
    await openHomeExpanded(page);
    await navigation(page).getByRole('button', { name: 'Collapse sidebar' }).click();
    await wait(450);
    await captureSidebar(page, 'sidebar-rail-mode.png');
  },
  'sidebar-search-active.png': async () => {
    await openHomeExpanded(page);
    const projectLabel = await resolveSidebarProjectLabel(page);
    const nav = navigation(page);
    await nav.getByRole('button').filter({ hasText: 'Search' }).first().click();
    const searchBox = nav.getByRole('combobox', { name: 'Search across Hub OS' });
    await searchBox.waitFor({ state: 'visible', timeout: 10_000 });
    await searchBox.fill(projectLabel.split(' ').slice(0, 2).join(' '));
    await nav.locator('#sidebar-search-results').waitFor({ state: 'visible', timeout: 10_000 });
    await wait(600);
    await captureSidebar(page, 'sidebar-search-active.png');
  },
  'sidebar-capture-active.png': async () => {
    await openHomeExpanded(page);
    const nav = navigation(page);
    const captureInput = nav.locator('input[placeholder*="Capture"]').first();
    await captureInput.waitFor({ state: 'visible', timeout: 10_000 });
    await captureInput.click();
    await captureInput.fill('Motion polish');
    await wait(200);
    await captureSidebar(page, 'sidebar-capture-active.png');
  },
  'sidebar-projects-expanded.png': async () => {
    await openHomeExpanded(page);
    const projectLabel = await resolveSidebarProjectLabel(page);
    await ensureProjectsExpanded(page);
    await ensureProjectExpanded(page, projectLabel);
    await captureSidebar(page, 'sidebar-projects-expanded.png');
  },
});

await loadEnvFilesIntoProcess(['.env.local.users.local'], { override: true });
await mkdir(screenshotDir, { recursive: true });

const browser = await chromium.launch({ headless: true });

try {
  const context = await browser.newContext({
    baseURL: appBaseUrl,
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  await loginWithLocalKeycloak(page);

  const steps = captureSteps(page);
  if (requestedCapture) {
    const captureStep = steps[requestedCapture];
    if (!captureStep) {
      throw new Error(`Unknown SIDEBAR_CAPTURE_FILE: ${requestedCapture}`);
    }
    console.log(`capture: ${requestedCapture}`);
    await captureStep();
  } else {
    for (const fileName of Object.keys(steps)) {
      console.log(`capture: ${fileName}`);
      await steps[fileName]();
    }
  }
} finally {
  await browser.close();
}
