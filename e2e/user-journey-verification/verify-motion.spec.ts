import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { loginThroughKeycloak } from '../support/audit.ts';
import { resolveLinkedTestAccounts } from '../utils/tokenMint.ts';
import { readJourneyContext, resolveScenario } from './utils/stateTags.ts';

const LIVE_TIMEOUT_MS = 120_000;

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const routeSurfaceSelector = 'main#main-content .mx-auto.w-full.max-w-7xl.px-4.py-6';

interface MotionProbeResult {
  sampleCount: number;
  maxAnimations: number;
  sawStyleDelta: boolean;
  firstOpacity: string | null;
  lastOpacity: string | null;
  firstTransform: string | null;
  lastTransform: string | null;
}

interface MotionCheckResult extends MotionProbeResult {
  check: string;
  selector: string;
  pass: boolean;
  note: string;
}

interface MotionReport {
  scenario: string;
  generated_at: string;
  checks: MotionCheckResult[];
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

const ensureTableModuleAdded = async (page: Page): Promise<void> => {
  const tableModule = page.getByRole('region', { name: 'Table module' }).first();
  if (await tableModule.isVisible().catch(() => false)) {
    return;
  }

  await openAddModuleDialog(page);
  await page.getByRole('button', { name: /^Select Table module$/i }).first().click();
  await page.getByRole('button', { name: /^Add Table at M size$/i }).first().click();
  await expect(tableModule).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
};

const resolveMotionReportPath = (): string => {
  return path.resolve(
    process.cwd(),
    process.env.JOURNEY_MOTION_REPORT_PATH || path.join('e2e', 'user-journey-verification', 'motion-report.json'),
  );
};

const probeMotion = async (page: Page, selector: string, durationMs = 1_400): Promise<MotionProbeResult> => {
  return page.evaluate(
    async ({ selector: targetSelector, durationMs: targetDurationMs }) => {
      const readSnapshot = (): { opacity: string; transform: string } | null => {
        const element = document.querySelector(targetSelector);
        if (!element) {
          return null;
        }
        const style = window.getComputedStyle(element);
        return {
          opacity: style.opacity,
          transform: style.transform,
        };
      };

      let maxAnimations = 0;
      const snapshots: Array<{ opacity: string; transform: string }> = [];
      const start = performance.now();

      while (performance.now() - start <= targetDurationMs) {
        const element = document.querySelector(targetSelector);
        if (element) {
          const animations = element.getAnimations({ subtree: true }).length;
          if (animations > maxAnimations) {
            maxAnimations = animations;
          }
        }

        const snapshot = readSnapshot();
        if (snapshot) {
          snapshots.push(snapshot);
        }

        await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      }

      let sawStyleDelta = false;
      for (let index = 1; index < snapshots.length; index += 1) {
        const previous = snapshots[index - 1];
        const current = snapshots[index];
        if (!previous || !current) {
          continue;
        }
        const opacityDelta = Math.abs(Number.parseFloat(previous.opacity) - Number.parseFloat(current.opacity));
        const transformChanged = previous.transform !== current.transform;
        if (opacityDelta > 0.001 || transformChanged) {
          sawStyleDelta = true;
          break;
        }
      }

      return {
        sampleCount: snapshots.length,
        maxAnimations,
        sawStyleDelta,
        firstOpacity: snapshots[0]?.opacity ?? null,
        lastOpacity: snapshots[snapshots.length - 1]?.opacity ?? null,
        firstTransform: snapshots[0]?.transform ?? null,
        lastTransform: snapshots[snapshots.length - 1]?.transform ?? null,
      };
    },
    { selector, durationMs },
  );
};

const runMotionCheck = async (
  page: Page,
  check: string,
  selector: string,
  action: () => Promise<void>,
): Promise<MotionCheckResult> => {
  const probePromise = probeMotion(page, selector);
  await action();
  const probe = await probePromise;
  const pass = probe.maxAnimations > 0 && probe.sawStyleDelta;

  return {
    check,
    selector,
    pass,
    note: pass
      ? 'Observed active animations and transform/opacity deltas during transition.'
      : 'No qualifying animation detected (requires getAnimations>0 and style deltas).',
    ...probe,
  };
};

test.describe('Motion Verification', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('required transitions animate in normal motion mode', async ({ page }, testInfo) => {
    if (testInfo.project.name !== 'desktop') {
      test.skip();
    }

    const scenario = resolveScenario();
    const context = await readJourneyContext();
    const checks: MotionCheckResult[] = [];

    const { accountA } = await resolveLinkedTestAccounts();
    await loginThroughKeycloak(page, accountA);

    await waitForProjectsHome(page);
    await navigateToSeededProject(page, context);
    const overviewButton = page.getByRole('button', { name: /^Overview$/i }).first();
    await expect(overviewButton).toBeVisible({ timeout: LIVE_TIMEOUT_MS });

    checks.push(
      await runMotionCheck(page, 'route_transition_projects_to_overview', routeSurfaceSelector, async () => {
        await overviewButton.click();
        await expect(page).toHaveURL(new RegExp(`/projects/${escapeRegExp(context.project.id)}/overview`), {
          timeout: LIVE_TIMEOUT_MS,
        });
      }),
    );

    await navigateToSeededProject(page, context);

    checks.push(
      await runMotionCheck(page, 'dialog_open_add_module', '.dialog-panel-size, [role="dialog"]', async () => {
        await openAddModuleDialog(page);
      }),
    );

    checks.push(
      await runMotionCheck(page, 'dialog_close_add_module', '.bg-overlay', async () => {
        await page.keyboard.press('Escape');
        await expect(page.getByRole('heading', { name: /^Add Module$/i })).toHaveCount(0, { timeout: LIVE_TIMEOUT_MS });
      }),
    );

    const secondaryProjectButton = page
      .getByRole('button', {
        name: new RegExp(`^${escapeRegExp(context.projects.secondaryName)}(?:, project \\d+)?$`, 'i'),
      })
      .first();
    await expect(secondaryProjectButton).toBeVisible({ timeout: LIVE_TIMEOUT_MS });

    checks.push(
      await runMotionCheck(page, 'project_transition_primary_to_secondary', routeSurfaceSelector, async () => {
        await secondaryProjectButton.click();
        await expect(page).toHaveURL(new RegExp(`/work/${escapeRegExp(context.projects.secondaryId)}$`), {
          timeout: LIVE_TIMEOUT_MS,
        });
      }),
    );

    await navigateToSeededProject(page, context);
    await ensureTableModuleAdded(page);

    const tableActionsButton = page.getByRole('button', { name: /Open Table module actions/i }).first();
    await expect(tableActionsButton).toBeVisible({ timeout: LIVE_TIMEOUT_MS });

    checks.push(
      await runMotionCheck(page, 'module_actions_open', '[role="menu"][aria-label$="module actions"], [role="menu"]', async () => {
        await tableActionsButton.click();
        await expect(page.getByRole('menu', { name: /Table module actions/i })).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
      }),
    );

    checks.push(
      await runMotionCheck(page, 'module_actions_close', '[role="menu"][aria-label$="module actions"], [role="menu"]', async () => {
        await page.keyboard.press('Escape');
        await expect(page.getByRole('menu', { name: /Table module actions/i })).toHaveCount(0, { timeout: LIVE_TIMEOUT_MS });
      }),
    );

    const report: MotionReport = {
      scenario,
      generated_at: new Date().toISOString(),
      checks,
    };

    const reportPath = resolveMotionReportPath();
    await mkdir(path.dirname(reportPath), { recursive: true });
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

    const failedChecks = checks.filter((entry) => !entry.pass);
    expect(
      failedChecks,
      failedChecks.map((entry) => `${entry.check}: ${entry.note} selector=${entry.selector}`).join('\n') || 'all checks passed',
    ).toHaveLength(0);
  });
});
