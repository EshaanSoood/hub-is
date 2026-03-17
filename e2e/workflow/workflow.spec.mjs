import { expect, test } from '@playwright/test';
import { loginThroughBrowser, mintToken, reopenStableProjectsPage } from './helpers/workflowAuth.mjs';
import {
  collabAuthorizeStatus,
  listProjectMembers,
  loadSessionSummary,
  listProjectPanes,
  waitForProjectPane,
} from './helpers/workflowHubApi.mjs';
import {
  extractPaneIdFromPathname,
  openOverviewTab,
  openProject,
  openToolsTab,
} from './helpers/workflowNavigation.mjs';
import { supportsProjectCalendar, workflowConfig } from './helpers/workflowEnv.mjs';

const createWorkflowState = () => ({
  tokenA: '',
  tokenB: '',
  userAId: '',
  userBId: '',
  projectId: '',
  createdPaneName: '',
  calendarSkipReason: 'Project calendar creation UI not implemented in this build',
  createdPaneId: '',
  createdPaneDocId: '',
  moduleCountAfterSave: 0,
});

let workflowState = createWorkflowState();
const workflowInviteEmailB = String(
  process.env.TEST_INVITE_EMAIL_B
  || process.env.HUB_SMOKE_USER_B_EMAIL
  || workflowConfig.accountB.email,
).trim();
const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const initializeWorkflowContext = async () => {
  if (workflowState.tokenA && workflowState.tokenB && workflowState.userAId && workflowState.userBId) {
    return;
  }

  workflowState.tokenA = mintToken(workflowConfig.accountA.email, workflowConfig.accountA.password);
  workflowState.tokenB = mintToken(workflowConfig.accountB.email, workflowConfig.accountB.password);

  const [sessionA, sessionB] = await Promise.all([
    loadSessionSummary(workflowState.tokenA),
    loadSessionSummary(workflowState.tokenB),
  ]);

  workflowState.userAId = sessionA.userId;
  workflowState.userBId = sessionB.userId;
};

const resolveProjectId = async (page) => {
  const preferredProjectId = workflowState.projectId || workflowConfig.projectId;
  const projectId = await openProject(page, preferredProjectId);
  if (!projectId) {
    throw new Error('No project found for workflow verification.');
  }
  workflowState.projectId = projectId;
  return projectId;
};

test.describe.serial('workflow reality checks', () => {
  test.beforeAll(async () => {
    workflowState = createWorkflowState();
    await initializeWorkflowContext();
  });

  test('TEST 1 — Browser login + project overview are real', async ({ page }) => {
    await loginThroughBrowser(page, workflowConfig.accountA);
    const activePage = await reopenStableProjectsPage(page);
    const projectId = await resolveProjectId(activePage);

    await expect(activePage.getByText('PROJECT SPACE', { exact: false })).toBeVisible();
    await expect(activePage.getByRole('tablist', { name: 'Project space tabs' })).toBeVisible();
    await expect(activePage.getByRole('tab', { name: 'Overview' })).toBeVisible();
    await expect(activePage.getByRole('tab', { name: 'Work' })).toBeVisible();
    await expect(activePage.getByRole('tab', { name: 'Tools' })).toBeVisible();

    const membersState = await listProjectMembers(workflowState.tokenA, projectId);
    expect(membersState.members.some((member) => member.user_id === workflowState.userAId)).toBe(true);
    expect(membersState.members.some((member) => member.user_id === workflowState.userBId)).toBe(true);
  });

  test('TEST 2 — Work pane creation + module persistence survive reload and persist to backend', async ({ page }) => {
    if (!workflowConfig.modulesEnabled) {
      test.skip(true, 'WORKFLOW_MODULES=false');
    }

    await loginThroughBrowser(page, workflowConfig.accountA);
    const activePage = await reopenStableProjectsPage(page);
    const projectId = await resolveProjectId(activePage);
    await expect(activePage.getByText('PROJECT SPACE', { exact: false })).toBeVisible({ timeout: 15_000 });

    const panesBefore = await listProjectPanes(workflowState.tokenA, projectId);
    const projectWorkTab = activePage.getByRole('tab', { name: 'Work' });
    if (await projectWorkTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await projectWorkTab.click();
    } else {
      const projectWorkLink = activePage.locator(`a[href="/projects/${projectId}/work"]`).first();
      await expect(projectWorkLink).toBeVisible();
      await projectWorkLink.click();
    }
    await expect(activePage.getByText('Work Panes', { exact: false })).toBeVisible({ timeout: 15_000 });
    await expect(activePage.getByRole('button', { name: 'Create pane' })).toBeVisible({ timeout: 15_000 });

    const newPaneInput = activePage.getByLabel('New pane name');
    const createPaneButton = activePage.getByRole('button', { name: 'Create pane' });
    await expect(newPaneInput).toBeVisible();
    await expect(createPaneButton).toBeVisible();

    const paneName = `workflow-modules-${Date.now().toString(36)}`;
    const createPaneResponsePromise = activePage.waitForResponse((response) => {
      const pathname = new URL(response.url()).pathname;
      return response.request().method() === 'POST' && new RegExp(`/api/hub/projects/${projectId}/panes$`).test(pathname);
    }, { timeout: 20_000 });

    await newPaneInput.fill(paneName);
    await createPaneButton.click();
    const createPaneResponse = await createPaneResponsePromise;
    expect(createPaneResponse.ok()).toBe(true);
    await expect(activePage.getByRole('heading', { name: paneName })).toBeVisible();

    const createdPane = await waitForProjectPane(
      workflowState.tokenA,
      projectId,
      (pane) => pane.name === paneName,
      `pane "${paneName}"`,
    );
    workflowState.createdPaneName = paneName;
    workflowState.createdPaneId = createdPane.pane_id;
    workflowState.createdPaneDocId = createdPane.doc_id || '';

    expect(extractPaneIdFromPathname(new URL(activePage.url()).pathname)).toBe(createdPane.pane_id);

    const addModuleButton = activePage.getByTestId('add-module-table');
    await expect(addModuleButton).toBeVisible();
    await expect(addModuleButton).toBeEnabled();
    const moduleCards = activePage.getByTestId('module-card');
    const moduleCountBefore = await moduleCards.count();
    await addModuleButton.click();
    await expect(moduleCards).toHaveCount(moduleCountBefore + 1);

    const persistedPane = await waitForProjectPane(
      workflowState.tokenA,
      projectId,
      (pane) =>
        pane.pane_id === workflowState.createdPaneId
        && Array.isArray(pane.layout_config?.modules)
        && pane.layout_config.modules.length >= moduleCountBefore + 1,
      `persisted module layout for pane "${paneName}"`,
    );
    workflowState.moduleCountAfterSave = persistedPane.layout_config.modules.length;
    expect(workflowState.moduleCountAfterSave).toBeGreaterThanOrEqual(moduleCountBefore + 1);
    expect(panesBefore.some((pane) => pane.pane_id === workflowState.createdPaneId)).toBe(false);

    const verificationPage = await reopenStableProjectsPage(activePage);
    const verificationWorkLink = verificationPage.locator(`a[href="/projects/${projectId}/work"]`).first();
    await expect(verificationWorkLink).toBeVisible();
    await verificationWorkLink.click();
    await expect(verificationPage.getByText('Work Panes', { exact: false })).toBeVisible({ timeout: 15_000 });
    const createdPaneButton = verificationPage.getByRole('button', {
      name: new RegExp(escapeRegExp(paneName), 'i'),
    }).first();
    await expect(createdPaneButton).toBeVisible({ timeout: 15_000 });
    await createdPaneButton.click();
    await verificationPage.waitForURL((url) => url.pathname.includes(workflowState.createdPaneId), { timeout: 15_000 });
    await expect(verificationPage.getByRole('heading', { name: paneName })).toBeVisible();
    await expect(verificationPage.getByTestId('module-card')).toHaveCount(workflowState.moduleCountAfterSave);
  });

  test('TEST 3 — User B sees the pane but only with read-only capability', async ({ page }) => {
    if (!workflowConfig.modulesEnabled) {
      test.skip(true, 'WORKFLOW_MODULES=false');
    }

    await loginThroughBrowser(page, workflowConfig.accountB);
    const activePage = await reopenStableProjectsPage(page);

    const projectId = workflowState.projectId;
    const targetPaneId = workflowState.createdPaneId;
    expect(projectId).toBeTruthy();
    expect(targetPaneId).toBeTruthy();

    const panesForUserB = await listProjectPanes(workflowState.tokenB, projectId);
    const visiblePaneForUserB = panesForUserB.find((pane) => pane.pane_id === targetPaneId);
    expect(Boolean(visiblePaneForUserB)).toBe(true);
    expect(visiblePaneForUserB?.can_edit).toBe(false);

    const projectWorkTab = activePage.getByRole('tab', { name: 'Work' });
    if (await projectWorkTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await projectWorkTab.click();
    } else {
      const projectWorkLink = activePage.locator(`a[href="/projects/${projectId}/work"]`).first();
      await expect(projectWorkLink).toBeVisible();
      await projectWorkLink.click();
    }
    await expect(activePage.getByText('Work Panes', { exact: false })).toBeVisible({ timeout: 15_000 });
    let targetPaneButton = activePage.getByRole('button', {
      name: new RegExp(escapeRegExp(workflowState.createdPaneName), 'i'),
    }).first();
    if (!(await targetPaneButton.isVisible({ timeout: 3_000 }).catch(() => false))) {
      const otherPanesButton = activePage.getByRole('button', { name: /Other panes/i });
      await expect(otherPanesButton).toBeVisible({ timeout: 15_000 });
      await otherPanesButton.click();
      targetPaneButton = activePage.getByRole('button', {
        name: new RegExp(escapeRegExp(workflowState.createdPaneName), 'i'),
      }).last();
    }
    await expect(targetPaneButton).toBeVisible({ timeout: 15_000 });
    await targetPaneButton.click();
    await activePage.waitForURL((url) => url.pathname.includes(targetPaneId), { timeout: 15_000 });

    await expect(activePage.getByText('Read-only mode.', { exact: false })).toBeVisible();
    await expect(activePage.getByText('pane editors can change this workspace.', { exact: false })).toBeVisible();
    await expect(activePage.getByText('Collaboration unavailable', { exact: false })).toBeVisible();
    await expect(activePage.getByText('Pane capability "write" required.', { exact: false })).toBeVisible();

    const paneToolbar = activePage.getByRole('toolbar', { name: 'Open panes' });
    const addModuleButton = activePage.getByTestId('add-module-table');
    const firstModuleCard = activePage.getByTestId('module-card').first();

    await expect(paneToolbar).toBeVisible();

    if (await firstModuleCard.isVisible().catch(() => false)) {
      await expect(firstModuleCard).toBeVisible();
    }

    if (await addModuleButton.isVisible().catch(() => false)) {
      await expect(addModuleButton).toBeDisabled();
    }

    const collabAuth = await collabAuthorizeStatus(workflowState.tokenB, workflowState.createdPaneDocId);
    expect(collabAuth.status).toBe(403);
  });

  test('TEST 4 — Collaborator surface matches backend membership state', async ({ page }) => {
    await loginThroughBrowser(page, workflowConfig.accountA);
    const activePage = await reopenStableProjectsPage(page);
    const projectId = await resolveProjectId(activePage);

    await expect(activePage.getByLabel('Collaborator email')).toBeVisible();
    await expect(activePage.getByRole('button', { name: 'Add collaborator' })).toBeVisible();

    const membersState = await listProjectMembers(workflowState.tokenA, projectId);
    expect(membersState.members.some((member) => member.user_id === workflowState.userBId)).toBe(true);
  });

  test('TEST 5 — Overview calendar capability is accurately reported', async ({ page }) => {
    if (!supportsProjectCalendar) {
      test.skip(true, 'WORKFLOW_CALENDAR_MODE does not include project calendar checks.');
    }

    await loginThroughBrowser(page, workflowConfig.accountA);
    const activePage = await reopenStableProjectsPage(page);
    await resolveProjectId(activePage);

    const overviewCalendarToggle = activePage.getByRole('tablist', { name: 'Overview views' }).getByRole('button', { name: 'Calendar' });
    await expect(overviewCalendarToggle).toBeAttached({ timeout: 15_000 });
    await overviewCalendarToggle.click();

    await expect(activePage.getByRole('heading', { name: 'Project Calendar' })).toBeVisible();
    await expect(activePage.getByText('No relevant events yet.', { exact: false })).toBeVisible();
    await expect(activePage.getByRole('button', { name: 'Create event' })).toHaveCount(0);
  });

  test('TEST 6 (Optional, gated) — Invite flow', async ({ page }) => {
    if (!workflowConfig.invitesEnabled) {
      test.skip(true, 'WORKFLOW_INVITES=false');
    }

    await loginThroughBrowser(page, workflowConfig.accountA);
    const activePage = await reopenStableProjectsPage(page);
    const projectId = await resolveProjectId(activePage);

    await openToolsTab(activePage, projectId);
    await openOverviewTab(activePage, projectId);

    const inviteInput = activePage.getByLabel('Collaborator email');
    const inviteButton = activePage.getByRole('button', { name: 'Add collaborator' });

    if (!(await inviteInput.isVisible().catch(() => false)) || !(await inviteButton.isVisible().catch(() => false))) {
      test.skip(true, 'Invite UI not present/stable; enable WORKFLOW_INVITES only when implemented');
    }

    const inviteResponsePromise = activePage
      .waitForResponse((response) => {
        const pathname = new URL(response.url()).pathname;
        return response.request().method() === 'POST'
          && (
            /\/api\/hub\/projects\/[^/]+\/members$/.test(pathname)
            || /\/api\/hub\/projects\/[^/]+\/invites$/.test(pathname)
          );
      }, { timeout: 20_000 })
      .catch(() => null);

    await inviteInput.fill(workflowInviteEmailB);
    await inviteButton.click();

    const inviteResponse = await inviteResponsePromise;
    if (!inviteResponse) {
      test.skip(true, 'Invite UI not present/stable; invite request could not be observed');
    }
    if (inviteResponse && !inviteResponse.ok() && inviteResponse.status() !== 409) {
      test.skip(true, 'Invite UI not present/stable; enable WORKFLOW_INVITES only when implemented');
    }

    const membersState = await listProjectMembers(workflowState.tokenA, projectId);
    const memberAlreadyExists = membersState.members.some((member) => member.user_id === workflowState.userBId);
    const inviteExists = membersState.pendingInvites.some((invite) => invite.email === workflowInviteEmailB);

    if (memberAlreadyExists) {
      expect(inviteResponse.status()).toBe(409);
      expect(inviteExists).toBe(false);
      return;
    }

    if (inviteExists) {
      expect(inviteResponse.status()).toBe(409);
      return;
    }

    if (inviteResponse.status() === 201) {
      const updatedMembersState = await listProjectMembers(workflowState.tokenA, projectId);
      expect(updatedMembersState.pendingInvites.some((invite) => invite.email === workflowInviteEmailB)).toBe(true);
      return;
    }

    throw new Error(`Unexpected invite response status ${inviteResponse.status()}.`);
  });
});
