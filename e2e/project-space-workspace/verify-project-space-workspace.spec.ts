import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

interface Fixture {
  project: {
    id: string;
    name: string;
  };
  projectIds: {
    main: string;
    private: string;
  };
  viewIds: {
    table: string;
    kanban: string;
  };
  recordTitle: string;
  eventTitle: string;
}

const currentDir = fileURLToPath(new URL('.', import.meta.url));
const fixturePath = resolve(currentDir, 'fixture.json');

let fixture: Fixture;

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const waitForWorkspace = async (page: Page, tabName: 'Overview' | 'Work') => {
  await expect(page.getByRole('button', { name: tabName, exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Loading project space...')).toHaveCount(0, { timeout: 20_000 });
};

test.beforeAll(async () => {
  fixture = JSON.parse(await readFile(fixturePath, 'utf8')) as Fixture;
});

test.describe('ProjectSpaceWorkspace local characterization', () => {
  test('tools tab keeps asset and automation surfaces reachable on the local realm', async ({ page }) => {
    await page.goto(`/projects/${fixture.project.id}/overview`, { waitUntil: 'domcontentloaded' });
    await waitForWorkspace(page, 'Overview');

    await page.getByRole('button', { name: 'Tools' }).click();
    await expect(page.getByRole('button', { name: 'Tools' })).toHaveAttribute('aria-current', 'page');
    await expect(page).toHaveURL(new RegExp(`/projects/${escapeRegExp(fixture.project.id)}/tools$`));

    await expect(page.getByRole('heading', { name: 'Asset Library Roots' })).toBeVisible();
    await expect(page.getByLabel('Asset root path')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add root' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Automations' })).toBeVisible();
  });

  test('overview sub-view switching preserves query semantics and calendar behavior', async ({ page }) => {
    await page.goto(`/projects/${fixture.project.id}/overview`, { waitUntil: 'domcontentloaded' });
    await waitForWorkspace(page, 'Overview');

    await page.getByRole('tab', { name: 'Calendar' }).click();
    await expect(page).toHaveURL(new RegExp(`/projects/${escapeRegExp(fixture.project.id)}/overview\\?view=calendar$`));
    const calendarPanel = page.getByRole('tabpanel', { name: 'Calendar' });
    await expect(calendarPanel).toBeVisible();
    await expect(calendarPanel.getByRole('heading', { name: /No project events yet\.|Project Calendar/i })).toBeVisible();
  });

  test('work project navigation and workspace landmarks remain available', async ({ page }) => {
    await page.goto(`/projects/${fixture.project.id}/work/${fixture.projectIds.main}`, { waitUntil: 'domcontentloaded' });
    await waitForWorkspace(page, 'Work');

    await expect(page.getByRole('toolbar', { name: 'Open projects' })).toBeVisible();
    await expect(page.getByText('Work Projects')).toBeVisible();
    await expect(page.getByLabel('Project note editor')).toBeVisible();

    await page
      .getByRole('toolbar', { name: 'Open projects' })
      .getByRole('button', { name: new RegExp(`^Verify Private Project`, 'i') })
      .click();
    await expect(page).toHaveURL(new RegExp(`/projects/${escapeRegExp(fixture.project.id)}/work/${escapeRegExp(fixture.projectIds.private)}`));
  });

  test('table inspector and focused view open-close behavior remain functional', async ({ page }) => {
    await page.goto(
      `/projects/${fixture.project.id}/work/${fixture.projectIds.main}?view_id=${fixture.viewIds.table}`,
      { waitUntil: 'domcontentloaded' },
    );
    await waitForWorkspace(page, 'Work');

    await expect(page.getByText(/Focused View:/i)).toContainText('Focused View:');

    const tableModule = page.getByLabel('Table module').first();
    await tableModule.getByRole('button', { name: new RegExp(`Open record ${escapeRegExp(fixture.recordTitle)}`, 'i') }).click();
    await expect(page.getByRole('dialog', { name: 'Record Inspector' })).toBeVisible();
    await page.getByRole('button', { name: /Close inspector/i }).first().click();
    await expect(page.getByRole('dialog', { name: 'Record Inspector' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Close focused view' }).click();
    await expect(page).not.toHaveURL(/view_id=/);
  });

  test('kanban focused view remains operable from the work route', async ({ page }) => {
    await page.goto(
      `/projects/${fixture.project.id}/work/${fixture.projectIds.main}?view_id=${fixture.viewIds.kanban}`,
      { waitUntil: 'domcontentloaded' },
    );
    await waitForWorkspace(page, 'Work');

    const todoColumn = page.getByLabel(/column$/i).first();
    await expect(todoColumn).toBeVisible();
    await expect(page.getByText(fixture.recordTitle).first()).toBeVisible();
  });
});
