import { expect, test } from '@playwright/test';
import { resolveLinkedTestAccounts } from './utils/tokenMint';
import {
  annotateKnownGap,
  flushPageAudit,
  getHubHome,
  gotoReady,
  hubRequest,
  loadAuditFixture,
  loginThroughKeycloak,
  openAuditedPage,
  registerPageAudit,
  waitForHubHome,
  type AuditFixture,
} from './support/audit';
import { VIEWER_STORAGE_STATE_PATH, OWNER_STORAGE_STATE_PATH } from './support/paths';

let fixture: AuditFixture;

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

test.beforeAll(async () => {
  fixture = await loadAuditFixture();
});

test.beforeEach(async ({ page }, testInfo) => {
  registerPageAudit(page, testInfo, 'owner');
});

test.afterEach(async ({ page }) => {
  await flushPageAudit(page);
});

test.describe('Authentication & Session', () => {
  test('Keycloak login flow completes successfully', async ({ browser }, testInfo) => {
    const { accountA } = await resolveLinkedTestAccounts();
    const { context, page } = await openAuditedPage(browser, testInfo, 'keycloak-login', {
      baseURL: fixture.baseUrl,
    });
    try {
      await loginThroughKeycloak(page, accountA);
      await waitForHubHome(page);
    } finally {
      await flushPageAudit(page);
      await context.close();
    }
  });

  test('/api/hub/me returns a valid session with capabilities', async () => {
    const me = await hubRequest<{ sessionSummary: AuditFixture['owner']['session'] }>(
      fixture.apiBaseUrl,
      fixture.owner.token,
      '/api/hub/me',
      { method: 'GET' },
    );

    expect(me.sessionSummary.userId).toBe(fixture.owner.session.userId);
    expect(me.sessionSummary.globalCapabilities.length).toBeGreaterThan(0);
    expect(Object.keys(me.sessionSummary.projectCapabilities).length).toBeGreaterThan(0);
  });

  test('Authenticated user has a personal project provisioned automatically', async ({ page }, testInfo) => {
    annotateKnownGap(
      testInfo,
      'Brand-new user provisioning is not isolated in this environment; this assertion verifies the server returns an already-provisioned personal project for the authenticated test user.',
    );
    await gotoReady(page, '/projects');
    await waitForHubHome(page);

    const home = await getHubHome(fixture.apiBaseUrl, fixture.owner.token);
    expect(home.personal_space_id).toBeTruthy();
    await expect(page.locator(`a[href="/projects/${home.personal_space_id}/overview"]`)).toBeVisible();
  });

  test('Session persists across navigation', async ({ page }) => {
    await gotoReady(page, '/projects');
    await waitForHubHome(page);
    await page.goto(`/projects/${fixture.project.id}/overview`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('tab', { name: 'Overview' })).toBeVisible();
    await page.goto('/projects', { waitUntil: 'domcontentloaded' });
    await waitForHubHome(page);
    await expect(page.getByRole('button', { name: /Continue with Keycloak/i })).toHaveCount(0);
  });
});

test.describe('myHub', () => {
  test('myHub page loads', async ({ page }) => {
    await gotoReady(page, '/projects');
    await waitForHubHome(page);
  });

  test('Personal project appears in the project list', async ({ page }) => {
    await gotoReady(page, '/projects');
    await expect(page.locator(`a[href="/projects/${fixture.owner.personalProjectId}/overview"]`)).toBeVisible();
  });

  test('Tasks and events sections render on myHub', async ({ page }) => {
    await gotoReady(page, '/projects');
    const dailyBrief = page.getByRole('tabpanel', { name: 'Daily Brief' });
    await expect(dailyBrief.getByText('Tasks', { exact: true })).toBeVisible();
    await expect(dailyBrief.getByText('Events', { exact: true })).toBeVisible();
    await expect(dailyBrief.getByText(fixture.tasks.todoTitle)).toBeVisible();
    await expect(dailyBrief.getByText(fixture.event.title)).toBeVisible();
  });
});

test.describe('Projects', () => {
  test('Project list loads and displays at least one project', async ({ page }) => {
    await gotoReady(page, '/projects');
    const projectItems = page.getByRole('list', { name: 'Project list' }).getByRole('listitem');
    await expect(projectItems.first()).toBeVisible();
    expect(await projectItems.count()).toBeGreaterThan(0);
  });

  test('Can navigate into a project', async ({ page }) => {
    await gotoReady(page, '/projects');
    await page.locator(`a[href="/projects/${fixture.project.id}/overview"]`).click();
    await expect(page).toHaveURL(new RegExp(`/projects/${fixture.project.id}/overview$`));
  });

  test('Project space page renders with the projects sidebar', async ({ page }) => {
    await gotoReady(page, `/projects/${fixture.project.id}/work/${fixture.projects.sharedId}`);
    await expect(page.getByRole('toolbar', { name: 'Open projects' })).toBeVisible();
    await expect(page.getByText('Work Projects')).toBeVisible();
  });
});

test.describe('Projects', () => {
  test('Project list renders inside a project and can navigate to another project', async ({ page }) => {
    await gotoReady(page, `/projects/${fixture.project.id}/work/${fixture.projects.sharedId}`);
    const projectToolbar = page.getByRole('toolbar', { name: 'Open projects' });
    await expect(projectToolbar).toBeVisible();
    await page.getByRole('button', { name: /Audit Private/i }).click();
    await expect(page).toHaveURL(new RegExp(`/projects/${fixture.project.id}/work/${fixture.projects.privateId}`));
  });

  test('Project content area loads', async ({ page }) => {
    await gotoReady(page, `/projects/${fixture.project.id}/work/${fixture.projects.sharedId}`);
    await expect(page.getByLabel('Table widget')).toBeVisible();
    await expect(page.getByLabel('Project note editor')).toBeVisible();
  });

  test('Create project form appears for users with write permission', async ({ page }) => {
    await gotoReady(page, `/projects/${fixture.project.id}/work/${fixture.projects.sharedId}`);
    await expect(page.getByLabel('New project name')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create project' })).toBeVisible();
  });

  test('Create project form is hidden for users without write permission', async ({ browser }, testInfo) => {
    const { context, page } = await openAuditedPage(browser, testInfo, 'viewer-project-permissions', {
      baseURL: fixture.baseUrl,
      storageState: VIEWER_STORAGE_STATE_PATH,
    });
    try {
      await gotoReady(page, `/projects/${fixture.project.id}/work/${fixture.projects.sharedId}`);
      await expect(page.getByLabel('New project name')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Create project' })).toHaveCount(0);
    } finally {
      await flushPageAudit(page);
      await context.close();
    }
  });
});

test.describe('Document Editor (Collaborative Lexical Editor)', () => {
  test('Doc project loads the editor', async ({ page }) => {
    await gotoReady(page, `/projects/${fixture.project.id}/work/${fixture.projects.sharedId}`);
    await expect(page.getByLabel('Project note editor')).toBeVisible();
  });

  test('Editor is interactive and the collab WebSocket connects', async ({ browser }, testInfo) => {
    const first = await openAuditedPage(browser, testInfo, 'owner-doc-a', {
      baseURL: fixture.baseUrl,
      storageState: OWNER_STORAGE_STATE_PATH,
    });
    const second = await openAuditedPage(browser, testInfo, 'owner-doc-b', {
      baseURL: fixture.baseUrl,
      storageState: OWNER_STORAGE_STATE_PATH,
    });
    const token = `pw-doc-${Date.now()}`;

    try {
      await Promise.all([
        gotoReady(first.page, `/projects/${fixture.project.id}/work/${fixture.projects.sharedId}`),
        gotoReady(second.page, `/projects/${fixture.project.id}/work/${fixture.projects.sharedId}`),
      ]);

      const editorA = first.page.getByLabel('Project note editor');
      const editorB = second.page.getByLabel('Project note editor');
      await expect(editorA).toBeVisible();
      await expect(editorB).toBeVisible();
      await expect(first.page.getByText('Failed to authorize collaboration.')).toHaveCount(0);
      await expect(second.page.getByText('Failed to authorize collaboration.')).toHaveCount(0);
      await expect(first.page.getByText('Reconnecting... edits pending')).toHaveCount(0);
      await expect(second.page.getByText('Reconnecting... edits pending')).toHaveCount(0);

      await editorA.click();
      await first.page.keyboard.type(` ${token}`);
      await expect(editorA).toContainText(token);
      await editorB.click();
      expect(
        first.audit.consoleErrors.filter((message) => /provider|awareness|yjs/i.test(message)),
      ).toEqual([]);
      expect(
        second.audit.consoleErrors.filter((message) => /provider|awareness|yjs/i.test(message)),
      ).toEqual([]);
    } finally {
      await flushPageAudit(first.page);
      await flushPageAudit(second.page);
      await first.context.close();
      await second.context.close();
    }
  });
});

test.describe('Collections & Records', () => {
  test('Collection records list renders in a project table view', async ({ page }) => {
    await gotoReady(page, `/projects/${fixture.project.id}/work/${fixture.projects.sharedId}?view_id=${fixture.views.tableId}`);
    const tableWidget = page.getByLabel('Table widget').first();
    await expect(tableWidget).toBeVisible();
    await expect(tableWidget.getByRole('button', { name: `Open record ${fixture.tasks.todoTitle}` })).toBeVisible();
  });

  test('Record detail inspector opens from the table view', async ({ page }) => {
    await gotoReady(page, `/projects/${fixture.project.id}/work/${fixture.projects.sharedId}?view_id=${fixture.views.tableId}`);
    const tableWidget = page.getByLabel('Table widget').first();
    await tableWidget.getByRole('button', { name: `Open record ${fixture.tasks.todoTitle}` }).click();
    await expect(page.getByRole('dialog', { name: 'Record Inspector' })).toBeVisible();
  });

  test('Kanban view renders when configured', async ({ page }) => {
    await gotoReady(page, `/projects/${fixture.project.id}/work/${fixture.projects.sharedId}?view_id=${fixture.views.kanbanId}`);
    const todoColumn = page.getByLabel('todo column').first();
    await expect(todoColumn).toBeVisible();
    await expect(todoColumn.getByLabel(`Card ${fixture.tasks.todoTitle}`)).toBeVisible();
  });

  test('Table view renders when configured', async ({ page }) => {
    await gotoReady(page, `/projects/${fixture.project.id}/work/${fixture.projects.sharedId}?view_id=${fixture.views.tableId}`);
    await expect(page.getByLabel('Table widget').first().getByRole('grid')).toBeVisible();
  });
});

test.describe('Calendar & Events', () => {
  test('Calendar view renders inside a project', async ({ page }) => {
    await gotoReady(page, `/projects/${fixture.project.id}/overview?view=calendar`);
    const calendarSection = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Project Calendar' }) }).first();
    await expect(calendarSection.getByRole('heading', { name: 'Project Calendar' })).toBeVisible();
    await calendarSection.getByRole('button', { name: 'All', exact: true }).click();
    await expect(calendarSection.getByText(fixture.event.title)).toBeVisible();
  });

  test('Calendar is display-only and does not expose a create button', async ({ page }) => {
    await gotoReady(page, `/projects/${fixture.project.id}/overview?view=calendar`);
    await expect(page.getByRole('button', { name: 'Create event' })).toHaveCount(0);
  });
});

test.describe('Tasks', () => {
  test('Tasks appear in myHub', async ({ page }) => {
    await gotoReady(page, '/projects');
    await page.getByRole('tab', { name: 'Project Lens' }).click();
    const projectLens = page.getByRole('tabpanel', { name: 'Project Lens' });
    await expect(projectLens.getByText(fixture.tasks.todoTitle)).toBeVisible();
  });

  test('Task statuses are visible', async ({ page }) => {
    await gotoReady(page, `/projects/${fixture.project.id}/overview?view=tasks`);
    await expect(page.getByRole('button', { name: new RegExp(escapeRegExp(fixture.tasks.todoTitle)) })).toContainText('todo');
    await expect(page.getByRole('button', { name: new RegExp(escapeRegExp(fixture.tasks.inProgressTitle)) })).toContainText('in-progress');
    await expect(page.getByRole('button', { name: new RegExp(escapeRegExp(fixture.tasks.doneTitle)) })).toContainText('done');
  });

  test('Aggregated view shows tasks from multiple projects', async ({ page }) => {
    await gotoReady(page, '/projects');
    await page.getByRole('tab', { name: 'Project Lens' }).click();
    const projectLens = page.getByRole('tabpanel', { name: 'Project Lens' });
    await expect(
      projectLens.getByRole('button', { name: new RegExp(`^${escapeRegExp(fixture.project.name)} \\d+ item`) }),
    ).toBeVisible();
    await expect(
      projectLens.getByRole('button', { name: new RegExp(`^${escapeRegExp(fixture.auxProject.name)} \\d+ item`) }),
    ).toBeVisible();
    await expect(projectLens.getByText(fixture.tasks.todoTitle)).toBeVisible();
    await expect(projectLens.getByText(fixture.tasks.auxTitle)).toBeVisible();
  });
});

test.describe('Files', () => {
  test('Files widget renders in a project, the file list loads, and upload controls exist', async ({ page }) => {
    await gotoReady(page, `/projects/${fixture.project.id}/work/${fixture.projects.sharedId}`);
    const filesWidget = page.getByLabel('Files widget');
    await expect(filesWidget).toBeVisible();
    await expect(filesWidget.getByRole('list', { name: 'Files' })).toBeVisible();
    await expect(filesWidget.getByRole('button', { name: 'Upload files' })).toBeVisible();
  });
});

test.describe('Notifications', () => {
  test('Notification bell is present, opens, and renders without errors', async ({ page }) => {
    await gotoReady(page, '/projects');
    const bell = page.getByRole('button', { name: /Notifications|unread notifications/i });
    await expect(bell).toBeVisible();
    await bell.click();
    const panel = page.getByRole('dialog', { name: 'Notifications' });
    await expect(panel).toBeVisible();
    await expect(panel).toContainText(/caught up|No notifications yet|Unread|All/i);
  });
});

test.describe('Permissions & Role Gating', () => {
  test('Owner sees create and edit controls', async ({ page }) => {
    await gotoReady(page, `/projects/${fixture.project.id}/work/${fixture.projects.sharedId}`);
    await expect(page.getByRole('button', { name: 'Create project' })).toBeVisible();
    await expect(page.locator('#project-name-input')).toBeEnabled();
    await expect(page.getByTestId('add-widget-table')).toBeVisible();
  });

  test('Member sees only the controls appropriate to the role and project membership', async ({ browser }, testInfo) => {
    const { context, page } = await openAuditedPage(browser, testInfo, 'viewer-role-gating', {
      baseURL: fixture.baseUrl,
      storageState: VIEWER_STORAGE_STATE_PATH,
    });
    try {
      await gotoReady(page, `/projects/${fixture.project.id}/work/${fixture.projects.sharedId}`);
      annotateKnownGap(
        testInfo,
        'This fixture grants the secondary user project member access plus explicit membership on the shared project, so project-title editing remains enabled while project-level create/widget controls stay hidden.',
      );
      await expect(page.locator('#project-name-input')).toBeEnabled();
      await expect(page.getByRole('button', { name: 'Create project' })).toHaveCount(0);
      await expect(page.getByText('Editable project management')).toHaveCount(0);
      await expect(page.getByTestId('add-widget-table')).toHaveCount(0);
    } finally {
      await flushPageAudit(page);
      await context.close();
    }
  });

  test('Pin button remains visible to all users', async ({ browser }, testInfo) => {
    const { context, page } = await openAuditedPage(browser, testInfo, 'viewer-pin-button', {
      baseURL: fixture.baseUrl,
      storageState: VIEWER_STORAGE_STATE_PATH,
    });
    try {
      await gotoReady(page, `/projects/${fixture.project.id}/work/${fixture.projects.sharedId}`);
      await expect(page.getByRole('button', { name: /Pin|Unpin/ })).toBeVisible();
    } finally {
      await flushPageAudit(page);
      await context.close();
    }
  });
});

test.describe('Quick Add / NLP', () => {
  test('Quick-add input is present and interactive', async ({ page }) => {
    await gotoReady(page, '/projects');
    await page.getByRole('button', { name: 'New Capture' }).click();
    const textarea = page.locator('textarea').first();
    await expect(textarea).toBeVisible();
    await textarea.fill('buy groceries tomorrow');
    await expect(textarea).toHaveValue('buy groceries tomorrow');
  });

  test('Calendar NLP parsing is not surfaced yet and reports the current expected state', async ({ page }, testInfo) => {
    annotateKnownGap(testInfo, 'Kalandar natural-language parsing does not surface a UI preview yet; the current expected state is the explicit "coming soon" message for calendar capture.');
    await gotoReady(page, '/projects');
    await page.getByRole('button', { name: 'New Capture' }).click();
    const dialog = page.getByRole('dialog', { name: 'New Capture' });
    await dialog.locator('textarea').first().fill('Lunch with Alex next Friday at noon');
    await dialog.getByRole('button', { name: 'Calendar' }).click();
    await dialog.getByRole('button', { name: 'Save Capture' }).click();
    await expect(dialog.getByRole('alert')).toContainText('Calendar capture is coming soon. Use Tasks for now.');
  });
});

test.describe('Navigation & Shell', () => {
  test('App shell renders', async ({ page }) => {
    await gotoReady(page, '/projects');
    await expect(page.getByRole('navigation', { name: 'App toolbar' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Go home' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Quick navigation' })).toBeVisible();
    await expect(page.getByLabel('Global search')).toBeDisabled();
  });

  test('Navigation between projects works', async ({ page }) => {
    await gotoReady(page, '/projects');
    await page.locator(`a[href="/projects/${fixture.project.id}/overview"]`).click();
    await expect(page).toHaveURL(new RegExp(`/projects/${fixture.project.id}/overview$`));
    await page.getByRole('button', { name: 'Go home' }).click();
    await page.locator(`a[href="/projects/${fixture.auxProject.id}/overview"]`).click();
    await expect(page).toHaveURL(new RegExp(`/projects/${fixture.auxProject.id}/overview$`));
  });

  test('Navigation between projects works and myHub is reachable from a project', async ({ page }) => {
    await gotoReady(page, `/projects/${fixture.project.id}/work/${fixture.projects.sharedId}`);
    await page.getByRole('button', { name: /Audit Private/i }).click();
    await expect(page).toHaveURL(new RegExp(`/projects/${fixture.project.id}/work/${fixture.projects.privateId}`));
    await page.getByRole('button', { name: 'Go home' }).click();
    await expect(page).toHaveURL(/\/projects$/);
  });
});

test.describe('Error States', () => {
  test('Visiting a nonexistent project path returns an error state', async ({ page }) => {
    await gotoReady(page, '/projects/nonexistent-audit-project/overview');
    await expect(page.getByRole('heading', { name: 'Access denied' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Policy Gate Blocked' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Return to Projects' })).toBeVisible();
  });

  test('Visiting a nonexistent project path returns an error state', async ({ page }) => {
    await gotoReady(page, `/projects/${fixture.project.id}/work/nonexistent-project`);
    await expect(page.getByRole('heading', { name: 'Access denied' })).toBeVisible();
    await expect(page.getByText('Project not found in this project.')).toBeVisible();
  });

  test('API errors do not crash the app shell', async ({ page }) => {
    await page.route('**/api/hub/home*', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: false,
          data: null,
          error: {
            code: 'injected_failure',
            message: 'Injected home failure',
          },
        }),
      });
    });
    await gotoReady(page, '/projects');
    await expect(page.getByText('Injected home failure')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'App toolbar' })).toBeVisible();
    await expect(page.getByRole('list', { name: 'Project list' })).toBeVisible();
  });
});
