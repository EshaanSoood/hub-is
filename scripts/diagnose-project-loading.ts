import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium, type ConsoleMessage, type Page, type Request, type Response } from 'playwright';

type ProjectCandidate = {
  id: string;
  name: string;
  url: string;
  isPersonal: boolean | null;
};

type ConsoleEntry = {
  timestamp: string;
  type: string;
  text: string;
};

type ExceptionEntry = {
  timestamp: string;
  message: string;
  stack: string;
};

type NetworkErrorEntry = {
  timestamp: string;
  url: string;
  method: string;
  status: number;
  body: string;
};

type NetworkRequestEntry = {
  timestamp: string;
  url: string;
  method: string;
};

type NetworkResponseEntry = {
  timestamp: string;
  url: string;
  method: string;
  status: number;
};

const APP_URL = 'https://eshaansood.org';
const AUTH_HOST = 'auth.eshaansood.org';
const ARTIFACTS_DIR = resolve(process.cwd(), '.artifacts', 'project-loading');
const REPORT_PATH = resolve(ARTIFACTS_DIR, 'project-loading-diagnostic.md');
const SCREENSHOT_PATH = resolve(ARTIFACTS_DIR, 'project-loading-screenshot.png');
const INCLUDE_SENSITIVE_OUTPUT = process.env.HUB_DIAGNOSTIC_INCLUDE_SENSITIVE === '1';
const INCLUDE_SCREENSHOT = process.env.HUB_DIAGNOSTIC_INCLUDE_SCREENSHOT === '1';

const nowIso = (): string => new Date().toISOString();

const collapseWhitespace = (value: string): string => value.replace(/\s+/g, ' ').trim();

const truncate = (value: string, maxChars: number): string => {
  if (value.length <= maxChars) {
    return value;
  }
  return `${value.slice(0, maxChars)}\n...[truncated]`;
};

const escapeCodeBlock = (value: string): string => value.replace(/```/g, '\\`\\`\\`');

const ensureArtifactsDir = (): void => {
  mkdirSync(ARTIFACTS_DIR, { recursive: true });
};

const formatUrlForReport = (value: string): string => {
  if (!value || value === 'N/A') {
    return value || 'N/A';
  }
  if (INCLUDE_SENSITIVE_OUTPUT) {
    return value;
  }
  try {
    const url = new URL(value);
    return `${url.origin}/[redacted]`;
  } catch {
    return '[redacted-url]';
  }
};

const formatSensitiveText = (value: string, label: string): string => {
  if (!value) {
    return '(none captured)';
  }
  if (INCLUDE_SENSITIVE_OUTPUT) {
    return value;
  }
  return `[redacted ${label}; set HUB_DIAGNOSTIC_INCLUDE_SENSITIVE=1 to include]`;
};

const formatProjectLabel = (project: ProjectCandidate, index: number): string => {
  if (INCLUDE_SENSITIVE_OUTPUT) {
    return project.name || project.id;
  }
  return `Project ${index + 1}`;
};

const normalizeProjectUrl = (origin: string, projectId: string): string => {
  return new URL(`/projects/${encodeURIComponent(projectId)}/overview`, origin).toString();
};

const looksPersonal = (name: string, url: string): boolean => {
  const lower = `${name} ${url}`.toLowerCase();
  return lower.includes('(personal)') || lower.includes(' personal') || lower.includes('/personal');
};

const waitForHubShell = async (page: Page): Promise<void> => {
  const markers = [
    page.getByRole('heading', { name: /hub/i }).first(),
    page.getByRole('button', { name: /account menu/i }).first(),
    page.locator('#main-content').first(),
    page.locator('main').first(),
  ];

  await Promise.any(markers.map(async (locator) => {
    await locator.waitFor({ state: 'visible', timeout: 30_000 });
  })).catch(async () => {
    await page.waitForLoadState('domcontentloaded', { timeout: 30_000 });
  });
};

const extractProjectsFromDom = async (page: Page): Promise<ProjectCandidate[]> => {
  const raw = await page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'));
    return anchors
      .map((anchor) => {
        const href = anchor.getAttribute('href') || '';
        if (!href) {
          return null;
        }

        let absolute: URL;
        try {
          absolute = new URL(href, window.location.href);
        } catch {
          return null;
        }

        const match = absolute.pathname.match(/^\/projects\/([^/?#]+)/i);
        if (!match) {
          return null;
        }

        const projectId = decodeURIComponent(match[1] || '').trim();
        if (!projectId) {
          return null;
        }

        const text = (anchor.textContent || '').replace(/\s+/g, ' ').trim();
        const ariaLabel = (anchor.getAttribute('aria-label') || '').trim();
        const sectionTitle = (anchor.closest('section')?.querySelector('h3')?.textContent || '').replace(/\s+/g, ' ').trim();
        return {
          projectId,
          href: absolute.toString(),
          text,
          ariaLabel,
          sectionTitle,
        };
      })
      .filter((entry): entry is { projectId: string; href: string; text: string; ariaLabel: string; sectionTitle: string } => Boolean(entry));
  });

  const byId = new Map<string, ProjectCandidate>();

  for (const entry of raw) {
    let preferredName = collapseWhitespace(entry.text);
    if (!preferredName || /^go\s+to\s+project$/i.test(preferredName)) {
      preferredName = collapseWhitespace(entry.ariaLabel).replace(/^go\s+to\s+project\s+/i, '').trim();
    }
    if (!preferredName || /^go\s+to\s+project$/i.test(preferredName)) {
      preferredName = collapseWhitespace(entry.sectionTitle);
    }

    const normalizedName = preferredName || entry.projectId;
    const existing = byId.get(entry.projectId);
    if (!existing) {
      byId.set(entry.projectId, {
        id: entry.projectId,
        name: normalizedName,
        url: entry.href,
        isPersonal: looksPersonal(normalizedName, entry.href) ? true : null,
      });
      continue;
    }

    const currentScore = existing.name === existing.id ? 0 : existing.name.length;
    const candidateScore = normalizedName === entry.projectId ? 0 : normalizedName.length;
    if (candidateScore > currentScore) {
      existing.name = normalizedName;
    }
    if (!existing.url) {
      existing.url = entry.href;
    }
  }

  return Array.from(byId.values());
};

const parseProjectsFromApiPayload = (payload: unknown, origin: string): ProjectCandidate[] => {
  const list = Array.isArray(payload)
    ? payload
    : payload && typeof payload === 'object' && Array.isArray((payload as { projects?: unknown }).projects)
      ? (payload as { projects: unknown[] }).projects
      : [];

  const parsed: ProjectCandidate[] = [];
  for (const entry of list) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }
    const source = entry as Record<string, unknown>;
    const id = String(source.id || source.project_id || '').trim();
    const name = collapseWhitespace(String(source.name || source.project_name || id || ''));
    if (!id) {
      continue;
    }

    const isPersonalRaw = typeof source.isPersonal === 'boolean'
      ? source.isPersonal
      : typeof source.is_personal === 'boolean'
        ? source.is_personal
        : null;
    const isPersonal = typeof isPersonalRaw === 'boolean' ? isPersonalRaw : null;

    parsed.push({
      id,
      name: name || id,
      url: normalizeProjectUrl(origin, id),
      isPersonal,
    });
  }

  return parsed;
};

const formatMarkdownList = (items: string[]): string => {
  if (items.length === 0) {
    return '- None';
  }
  return items.map((item) => `- ${item}`).join('\n');
};

const main = async (): Promise<void> => {
  ensureArtifactsDir();

  const username = (process.env.HUB_TEST_USER || '').trim();
  const password = (process.env.HUB_TEST_PASSWORD || '').trim();

  if (!username || !password) {
    console.error('Missing credentials: set HUB_TEST_USER and HUB_TEST_PASSWORD.');
    process.exit(1);
  }

  const consoleEntries: ConsoleEntry[] = [];
  const exceptionEntries: ExceptionEntry[] = [];
  const networkErrorEntries: NetworkErrorEntry[] = [];
  const networkRequestEntries: NetworkRequestEntry[] = [];
  const networkResponseEntries: NetworkResponseEntry[] = [];
  const projectApiEntries: ProjectCandidate[] = [];

  let authSummary = 'Login flow did not complete.';
  let postLoginUrl = 'N/A';
  let selectedProjectUrl = 'N/A';
  let movedPastLoading = false;
  let finalVisibleText = '';
  let projectCandidates: ProjectCandidate[] = [];
  let fatalError: string | null = null;

  const browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  const onProjectApiResponse = async (response: Response): Promise<void> => {
    const url = response.url();
    if (!url.includes('/api/hub/projects')) {
      return;
    }

    if (response.status() >= 400) {
      return;
    }

    try {
      const payload = await response.json();
      const origin = new URL(url).origin;
      const parsed = parseProjectsFromApiPayload(payload, origin);
      if (parsed.length > 0) {
        projectApiEntries.push(...parsed);
      }
    } catch {
      // Ignore API parsing issues for best-effort diagnostics.
    }
  };

  page.on('response', (response) => {
    void onProjectApiResponse(response);
  });

  try {
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });

    if (page.url().includes(AUTH_HOST)) {
      await page.waitForSelector('input[name="username"], input#username', { timeout: 30_000 });
    } else {
      const reachedAuth = await page
        .waitForURL((url) => url.hostname === AUTH_HOST, { timeout: 10_000 })
        .then(() => true)
        .catch(() => false);

      if (!reachedAuth) {
        const loginButton = page.getByRole('button', { name: /continue with keycloak|sign in with keycloak/i }).first();
        if (await loginButton.isVisible({ timeout: 8_000 }).catch(() => false)) {
          await Promise.all([
            page.waitForURL((url) => url.hostname === AUTH_HOST, { timeout: 60_000 }),
            loginButton.click(),
          ]);
        }
      }

      await page.waitForSelector('input[name="username"], input#username', { timeout: 30_000 });
    }

    const usernameInput = page.locator('input[name="username"], input#username').first();
    const passwordInput = page.locator('input[name="password"], input#password').first();
    const submitButton = page.locator('input#kc-login, button#kc-login, button[type="submit"], input[type="submit"]').first();

    await usernameInput.fill(username);
    await passwordInput.fill(password);

    await Promise.all([
      page.waitForURL((url) => url.hostname !== AUTH_HOST, { timeout: 60_000 }),
      submitButton.click(),
    ]);

    await waitForHubShell(page);
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);

    postLoginUrl = page.url();
    authSummary = 'Keycloak login form submitted successfully.';

    await page.goto(`${APP_URL}/projects`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await waitForHubShell(page);
    await page.waitForSelector('a[href*="/projects/"]', { timeout: 20_000 }).catch(() => undefined);

    const domProjects = await extractProjectsFromDom(page);

    const merged = new Map<string, ProjectCandidate>();
    for (const project of projectApiEntries) {
      merged.set(project.id, { ...project });
    }

    for (const project of domProjects) {
      const existing = merged.get(project.id);
      if (!existing) {
        merged.set(project.id, { ...project });
        continue;
      }

      if (!existing.name || existing.name === existing.id) {
        existing.name = project.name;
      }
      if (!existing.url) {
        existing.url = project.url;
      }
      if (existing.isPersonal === null) {
        existing.isPersonal = project.isPersonal;
      }
    }

    const appOrigin = new URL(page.url()).origin;
    projectCandidates = Array.from(merged.values()).map((project) => ({
      ...project,
      url: project.url || normalizeProjectUrl(appOrigin, project.id),
      isPersonal: project.isPersonal ?? (looksPersonal(project.name, project.url) ? true : null),
    }));

    const firstNonPersonal = projectCandidates.find((project) => project.isPersonal === false)
      || projectCandidates.find((project) => project.isPersonal !== true && !looksPersonal(project.name, project.url))
      || projectCandidates[0];

    if (!firstNonPersonal) {
      throw new Error('No projects were discovered on the Hub home page.');
    }

    selectedProjectUrl = firstNonPersonal.url;

    const onConsole = (message: ConsoleMessage): void => {
      consoleEntries.push({
        timestamp: nowIso(),
        type: message.type(),
        text: collapseWhitespace(message.text()),
      });
    };

    const onPageError = (error: Error): void => {
      exceptionEntries.push({
        timestamp: nowIso(),
        message: error.message,
        stack: error.stack || '',
      });
    };

    const onRequestFailed = (request: Request): void => {
      networkErrorEntries.push({
        timestamp: nowIso(),
        url: request.url(),
        method: request.method(),
        status: 0,
        body: `Request failed: ${request.failure()?.errorText || 'Unknown request failure'}`,
      });
    };

    const onRequest = (request: Request): void => {
      networkRequestEntries.push({
        timestamp: nowIso(),
        url: request.url(),
        method: request.method(),
      });
    };

    const onResponse = async (response: Response): Promise<void> => {
      const status = response.status();
      const request = response.request();

      networkResponseEntries.push({
        timestamp: nowIso(),
        url: response.url(),
        method: request.method(),
        status,
      });

      if (status < 400 || status > 599) {
        return;
      }

      let body = '';
      try {
        body = await response.text();
      } catch {
        body = '[unable to read response body]';
      }

      networkErrorEntries.push({
        timestamp: nowIso(),
        url: response.url(),
        method: request.method(),
        status,
        body: truncate(body, 4_000),
      });
    };

    page.on('request', onRequest);
    page.on('console', onConsole);
    page.on('pageerror', onPageError);
    page.on('requestfailed', onRequestFailed);
    page.on('response', (response) => {
      void onResponse(response);
    });

    await page.goto(selectedProjectUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });

    const startedAt = Date.now();
    while (Date.now() - startedAt < 15_000) {
      const loadingStillVisible = await page
        .getByText('Loading project space...', { exact: false })
        .first()
        .isVisible()
        .catch(() => false);

      if (!loadingStillVisible) {
        movedPastLoading = true;
        break;
      }

      await page.waitForTimeout(300);
    }

    if (!movedPastLoading) {
      const loadingStillVisible = await page
        .getByText('Loading project space...', { exact: false })
        .first()
        .isVisible()
        .catch(() => false);
      movedPastLoading = !loadingStillVisible;
    }

    finalVisibleText = truncate(collapseWhitespace(await page.locator('body').innerText().catch(() => '')), 8_000);

    if (INCLUDE_SCREENSHOT) {
      await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true });
    }
  } catch (error) {
    fatalError = error instanceof Error ? `${error.message}\n${error.stack || ''}` : String(error);
    exceptionEntries.push({
      timestamp: nowIso(),
      message: 'Diagnostic script failed before completion.',
      stack: fatalError,
    });
  } finally {
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }

  const projectsFound = projectCandidates.map((project, index) => {
    const personalFlag = project.isPersonal === true ? ' (personal)' : project.isPersonal === false ? '' : ' (personal status unknown)';
    return `${formatProjectLabel(project, index)}${personalFlag} — ${formatUrlForReport(project.url)}`;
  });

  const consoleLines = consoleEntries.map(
    (entry) => `[${entry.timestamp}] (${entry.type}) ${formatSensitiveText(entry.text || '(empty message)', 'console output')}`,
  );

  const networkLines = networkErrorEntries.map((entry) => {
    return [
      `- [${entry.timestamp}] ${entry.method} ${formatUrlForReport(entry.url)}`,
      `  - Status: ${entry.status}`,
      `  - Response body:`,
      '```text',
      escapeCodeBlock(formatSensitiveText(entry.body || '(empty body)', 'response body')),
      '```',
    ].join('\n');
  });

  const exceptionLines = exceptionEntries.map((entry) => {
    const detail = entry.stack ? `${entry.message}\n${entry.stack}` : entry.message;
    return [
      `- [${entry.timestamp}]`,
      '```text',
      escapeCodeBlock(formatSensitiveText(detail, 'exception details')),
      '```',
    ].join('\n');
  });

  const report = [
    '# Project Loading Diagnostic Report',
    '',
    '## Auth flow',
    `- ${authSummary}`,
    `- Final URL after login: ${formatUrlForReport(postLoginUrl)}`,
    '',
    '## Projects found',
    formatMarkdownList(projectsFound),
    '',
    '## Project navigation',
    `- Navigated to: ${formatUrlForReport(selectedProjectUrl)}`,
    '',
    '## Console output',
    formatMarkdownList(consoleLines),
    '',
    '## Network errors',
    networkLines.length > 0 ? networkLines.join('\n\n') : '- None (no 4xx/5xx responses or request failures captured).',
    '',
    '## Uncaught exceptions',
    exceptionLines.length > 0 ? exceptionLines.join('\n\n') : '- None.',
    '',
    '## Final state',
    `- Moved past "Loading project space..." within 15 seconds: ${movedPastLoading ? 'Yes' : 'No'}`,
    `- Requests captured during project loading: ${networkRequestEntries.length}`,
    `- Responses captured during project loading: ${networkResponseEntries.length}`,
    '- Visible page text at end:',
    '```text',
    escapeCodeBlock(formatSensitiveText(finalVisibleText || '(no visible text captured)', 'page text')),
    '```',
    '',
    '## Screenshot',
    INCLUDE_SCREENSHOT
      ? `- Saved \`${SCREENSHOT_PATH}\`.`
      : '- Screenshot capture skipped by default. Set `HUB_DIAGNOSTIC_INCLUDE_SCREENSHOT=1` to include it.',
    '',
  ].join('\n');

  writeFileSync(REPORT_PATH, report, 'utf8');

  console.log(`Diagnostic report written to ${REPORT_PATH}`);
  console.log(
    INCLUDE_SCREENSHOT
      ? `Screenshot written to ${SCREENSHOT_PATH}`
      : 'Screenshot skipped. Set HUB_DIAGNOSTIC_INCLUDE_SCREENSHOT=1 to capture it.',
  );

  if (fatalError) {
    process.exitCode = 1;
  }
};

await main();
