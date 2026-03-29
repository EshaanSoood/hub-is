import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium, type Page, type Request, type Response } from 'playwright';

type ProjectLink = {
  domIndex: number;
  projectId: string;
  text: string;
  href: string;
  isPersonal: boolean;
};

type RequestTrace = {
  id: number;
  startedAtMs: number;
  startedAtIso: string;
  method: string;
  url: string;
  responseStatus: number | null;
  responseAtIso: string | null;
  requestFailure: string | null;
  errorBody: string | null;
  hungTimedOut: boolean;
  hungAtIso: string | null;
};

type StateTransition = {
  offsetSeconds: number;
  url: string;
  text: string;
};

const APP_URL = 'https://eshaansood.org';
const AUTH_HOST = 'auth.eshaansood.org';
const REPORT_PATH = resolve(process.cwd(), 'project-loading-diagnostic-v2.md');
const SCREENSHOT_PATH = resolve(process.cwd(), 'project-loading-screenshot-v2.png');
const MAX_TRANSITION_TEXT = 500;
const MAX_BODY_TEXT = 4000;

const nowIso = (): string => new Date().toISOString();

const collapseWhitespace = (value: string): string => value.replace(/\s+/g, ' ').trim();

const truncate = (value: string, maxChars: number): string => {
  if (value.length <= maxChars) {
    return value;
  }
  return `${value.slice(0, maxChars)}\n...[truncated]`;
};

const escapeCodeBlock = (value: string): string => value.replace(/```/g, '\\`\\`\\`');

const isPlaceholderOnly = (text: string): boolean => {
  const lower = text.toLowerCase();
  if (!lower) {
    return true;
  }
  if (lower.includes('initializing secure session')) {
    return true;
  }
  if (lower.includes('redirecting to login')) {
    return true;
  }
  return false;
};

const isPersonalProject = (label: string): boolean => {
  const normalized = label.toLowerCase();
  if (normalized.includes('(personal)')) {
    return true;
  }
  if (/\bpersonal\b/i.test(label)) {
    return true;
  }
  if (/\b's hub\b/i.test(label)) {
    return true;
  }
  return false;
};

const waitForHubHomeReady = async (page: Page): Promise<string> => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 30_000) {
    const bodyText = collapseWhitespace(await page.locator('body').innerText().catch(() => ''));
    const headingCount = await page.locator('h1, h2').count().catch(() => 0);
    const projectLinkCount = await page.locator('a[href*="/projects/"]').count().catch(() => 0);

    const hasRealContent = headingCount > 0 || projectLinkCount > 0;
    if (hasRealContent && !isPlaceholderOnly(bodyText)) {
      return bodyText;
    }

    await page.waitForTimeout(500);
  }

  throw new Error('Timed out waiting for home page content to render after login.');
};

const extractProjectLinks = async (page: Page): Promise<ProjectLink[]> => {
  const raw = await page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'));
    return anchors
      .map((anchor, index) => {
        const hrefRaw = anchor.getAttribute('href') || '';
        if (!hrefRaw) {
          return null;
        }

        let hrefAbsolute: URL;
        try {
          hrefAbsolute = new URL(hrefRaw, window.location.href);
        } catch {
          return null;
        }

        const match = hrefAbsolute.pathname.match(/^\/projects\/([^/?#]+)/i);
        if (!match) {
          return null;
        }

        const projectId = decodeURIComponent(match[1] || '').trim();
        if (!projectId) {
          return null;
        }

        const text = (anchor.textContent || '').replace(/\s+/g, ' ').trim();
        const ariaLabel = (anchor.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim();
        const sectionTitle = (anchor.closest('section')?.querySelector('h3')?.textContent || '').replace(/\s+/g, ' ').trim();

        return {
          domIndex: index,
          projectId,
          href: hrefAbsolute.toString(),
          text,
          ariaLabel,
          sectionTitle,
        };
      })
      .filter((entry): entry is {
        domIndex: number;
        projectId: string;
        href: string;
        text: string;
        ariaLabel: string;
        sectionTitle: string;
      } => Boolean(entry));
  });

  const deduped = new Map<string, ProjectLink>();
  for (const entry of raw) {
    let label = collapseWhitespace(entry.text);
    if (!label || /^go\s+to\s+project$/i.test(label)) {
      label = collapseWhitespace(entry.ariaLabel).replace(/^go\s+to\s+project\s+/i, '').trim();
    }
    if (!label || /^go\s+to\s+project$/i.test(label)) {
      label = collapseWhitespace(entry.sectionTitle);
    }
    if (!label) {
      label = entry.projectId;
    }

    const item: ProjectLink = {
      domIndex: entry.domIndex,
      projectId: entry.projectId,
      text: label,
      href: entry.href,
      isPersonal: isPersonalProject(label),
    };

    const key = `${item.href}::${item.projectId}`;
    if (!deduped.has(key)) {
      deduped.set(key, item);
    }
  }

  return Array.from(deduped.values()).sort((a, b) => a.domIndex - b.domIndex);
};

const clickProjectLink = async (page: Page, project: ProjectLink): Promise<void> => {
  const allAnchors = page.locator('a[href]');
  const anchorCount = await allAnchors.count();
  if (project.domIndex < anchorCount) {
    const candidate = allAnchors.nth(project.domIndex);
    if (await candidate.isVisible().catch(() => false)) {
      await candidate.click({ timeout: 10_000 });
      return;
    }
  }

  const relativeHref = (() => {
    try {
      const url = new URL(project.href);
      return `${url.pathname}${url.search}${url.hash}`;
    } catch {
      return project.href;
    }
  })();

  const fallback = page.locator(`a[href="${relativeHref}"], a[href="${project.href}"]`).first();
  await fallback.click({ timeout: 10_000 });
};

const buildNetworkLogLines = (traces: RequestTrace[]): string[] => {
  if (traces.length === 0) {
    return ['- None captured.'];
  }

  const lines: string[] = [];
  for (const trace of traces) {
    lines.push(`- [${trace.startedAtIso}] #${trace.id} REQUEST ${trace.method} ${trace.url}`);

    if (trace.responseStatus !== null) {
      lines.push(`  - RESPONSE [${trace.responseAtIso}] status=${trace.responseStatus}`);
    }

    if (trace.requestFailure) {
      lines.push(`  - REQUEST FAILED: ${trace.requestFailure}`);
    }

    if (trace.hungTimedOut) {
      lines.push(`  - HUNG/TIMED OUT: no response within 10 seconds (recorded at ${trace.hungAtIso})`);
    }

    if (trace.responseStatus !== null && trace.responseStatus >= 400) {
      lines.push('  - 4xx/5xx response body:');
      lines.push('```text');
      lines.push(escapeCodeBlock(trace.errorBody || '(empty body)'));
      lines.push('```');
    }
  }

  return lines;
};

const main = async (): Promise<void> => {
  const username = (process.env.HUB_TEST_USER || '').trim();
  const password = (process.env.HUB_TEST_PASSWORD || '').trim();

  if (!username || !password) {
    console.error('Missing credentials: set HUB_TEST_USER and HUB_TEST_PASSWORD.');
    process.exit(1);
  }

  const stateTransitions: StateTransition[] = [];
  const requestTraces: RequestTrace[] = [];
  const requestToTraceId = new Map<Request, number>();
  const traceTimers = new Map<number, NodeJS.Timeout>();

  let projectLinks: ProjectLink[] = [];
  let clickedProject: ProjectLink | null = null;
  let authSuccess = false;
  let postLoginUrl = 'N/A';
  let homeVisibleText = '';
  let finalVisibleText = '';
  let movedPastLoading = false;
  let fatalError: string | null = null;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  let nextTraceId = 1;

  const onRequest = (request: Request): void => {
    const traceId = nextTraceId;
    nextTraceId += 1;

    const trace: RequestTrace = {
      id: traceId,
      startedAtMs: Date.now(),
      startedAtIso: nowIso(),
      method: request.method(),
      url: request.url(),
      responseStatus: null,
      responseAtIso: null,
      requestFailure: null,
      errorBody: null,
      hungTimedOut: false,
      hungAtIso: null,
    };

    requestTraces.push(trace);
    requestToTraceId.set(request, traceId);

    const timer = setTimeout(() => {
      if (trace.responseStatus === null && !trace.requestFailure) {
        trace.hungTimedOut = true;
        trace.hungAtIso = nowIso();
      }
    }, 10_000);

    traceTimers.set(traceId, timer);
  };

  const onResponse = async (response: Response): Promise<void> => {
    const request = response.request();
    const traceId = requestToTraceId.get(request);
    if (!traceId) {
      return;
    }

    const trace = requestTraces.find((entry) => entry.id === traceId);
    if (!trace) {
      return;
    }

    const timer = traceTimers.get(traceId);
    if (timer) {
      clearTimeout(timer);
      traceTimers.delete(traceId);
    }

    trace.responseStatus = response.status();
    trace.responseAtIso = nowIso();

    if (trace.responseStatus >= 400) {
      let body = '';
      try {
        body = await response.text();
      } catch {
        body = '[unable to read response body]';
      }
      trace.errorBody = truncate(body, MAX_BODY_TEXT);
    }
  };

  const onRequestFailed = (request: Request): void => {
    const traceId = requestToTraceId.get(request);
    if (!traceId) {
      return;
    }

    const trace = requestTraces.find((entry) => entry.id === traceId);
    if (!trace) {
      return;
    }

    const timer = traceTimers.get(traceId);
    if (timer) {
      clearTimeout(timer);
      traceTimers.delete(traceId);
    }

    trace.requestFailure = request.failure()?.errorText || 'Unknown request failure';
    trace.responseAtIso = nowIso();
  };

  const onResponseEvent = (response: Response): void => {
    void onResponse(response);
  };

  try {
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });

    if (!page.url().includes(AUTH_HOST)) {
      await page.waitForURL((url) => url.hostname === AUTH_HOST, { timeout: 30_000 }).catch(() => undefined);
    }

    const usernameInput = page.locator('input[name="username"], input#username').first();
    const passwordInput = page.locator('input[name="password"], input#password').first();
    const submitButton = page.locator('input#kc-login, button#kc-login, button[type="submit"], input[type="submit"]').first();

    await usernameInput.waitFor({ state: 'visible', timeout: 30_000 });
    await usernameInput.fill(username);
    await passwordInput.fill(password);

    await Promise.all([
      page.waitForURL((url) => url.hostname !== AUTH_HOST, { timeout: 60_000 }),
      submitButton.click(),
    ]);

    postLoginUrl = page.url();
    authSuccess = true;

    homeVisibleText = truncate(await waitForHubHomeReady(page), 2_000);

    projectLinks = await extractProjectLinks(page);
    if (projectLinks.length === 0) {
      throw new Error('No project links were found on the home page.');
    }

    clickedProject = projectLinks.find((link) => !link.isPersonal) || projectLinks[0] || null;
    if (!clickedProject) {
      throw new Error('Could not determine a project link to click.');
    }

    page.on('request', onRequest);
    page.on('response', onResponseEvent);
    page.on('requestfailed', onRequestFailed);

    await clickProjectLink(page, clickedProject);

    for (let second = 0; second <= 30; second += 2) {
      if (second > 0) {
        await page.waitForTimeout(2_000);
      }
      const text = collapseWhitespace(await page.locator('body').innerText().catch(() => ''));
      stateTransitions.push({
        offsetSeconds: second,
        url: page.url(),
        text: truncate(text, MAX_TRANSITION_TEXT),
      });
    }

    // End the capture window at 30s by blocking new tracked requests.
    page.off('request', onRequest);

    const hasOpenTraces = (): boolean =>
      requestTraces.some((trace) => trace.responseStatus === null && !trace.requestFailure && !trace.hungTimedOut);

    const settleDeadline = Date.now() + 10_500;
    while (hasOpenTraces() && Date.now() < settleDeadline) {
      await page.waitForTimeout(250);
    }

    page.off('response', onResponseEvent);
    page.off('requestfailed', onRequestFailed);

    finalVisibleText = truncate(collapseWhitespace(await page.locator('body').innerText().catch(() => '')), 4_000);
    const loadingVisible = await page.getByText('Loading project space...', { exact: false }).first().isVisible().catch(() => false);
    movedPastLoading = !loadingVisible;

    await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true });
  } catch (error) {
    fatalError = error instanceof Error ? `${error.message}\n${error.stack || ''}` : String(error);

    try {
      await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true });
    } catch {
      // Ignore screenshot fallback errors.
    }
  } finally {
    for (const timer of traceTimers.values()) {
      clearTimeout(timer);
    }

    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }

  const authLines: string[] = [
    `- Success: ${authSuccess ? 'Yes' : 'No'}`,
    `- Final URL after login: ${postLoginUrl}`,
  ];

  if (fatalError) {
    authLines.push('- Fatal script error encountered during run.');
  }

  const projectLinkLines = projectLinks.length > 0
    ? projectLinks.map((link) => `- ${link.text}${link.isPersonal ? ' (personal)' : ''} — ${link.href}`)
    : ['- None'];

  const transitionLines = stateTransitions.length > 0
    ? stateTransitions.map((entry) => [
      `- t+${entry.offsetSeconds}s | URL: ${entry.url}`,
      '```text',
      escapeCodeBlock(entry.text || '(no text)'),
      '```',
    ].join('\n'))
    : ['- None'];

  const networkLines = buildNetworkLogLines(requestTraces);

  const report = [
    '# Project Loading Diagnostic v2 Report',
    '',
    '## Auth flow',
    ...authLines,
    '',
    '## Home page content',
    '- Visible text when home page became ready:',
    '```text',
    escapeCodeBlock(homeVisibleText || '(none captured)'),
    '```',
    '- Project links found:',
    ...projectLinkLines,
    '',
    '## Project clicked',
    clickedProject
      ? `- Clicked: ${clickedProject.text}${clickedProject.isPersonal ? ' (personal)' : ''} — ${clickedProject.href}`
      : '- No link clicked.',
    '',
    '## Network log',
    ...networkLines,
    '',
    '## State transitions',
    ...transitionLines,
    '',
    '## Final state',
    `- Current URL: ${stateTransitions[stateTransitions.length - 1]?.url || page.url()}`,
    `- Moved past "Loading project space...": ${movedPastLoading ? 'Yes' : 'No'}`,
    '- Visible text at end:',
    '```text',
    escapeCodeBlock(finalVisibleText || '(none captured)'),
    '```',
    fatalError
      ? '- Script error detail:'
      : '',
    fatalError
      ? '```text'
      : '',
    fatalError
      ? escapeCodeBlock(fatalError)
      : '',
    fatalError
      ? '```'
      : '',
    '',
    '## Screenshot',
    '- Saved `project-loading-screenshot-v2.png` in the repository root.',
    '',
  ].filter(Boolean).join('\n');

  writeFileSync(REPORT_PATH, report, 'utf8');

  console.log(`Diagnostic report written to ${REPORT_PATH}`);
  console.log(`Screenshot written to ${SCREENSHOT_PATH}`);

  if (fatalError) {
    process.exitCode = 1;
  }
};

await main();
