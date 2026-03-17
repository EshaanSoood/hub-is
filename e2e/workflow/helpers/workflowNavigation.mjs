
import { expect } from '@playwright/test';

export const extractProjectIdFromHref = (href) => {
  const match = String(href || '').match(/\/projects\/([^/]+)/);
  return match ? decodeURIComponent(match[1]) : '';
};

export const extractProjectIdFromPathname = (pathname) => {
  const match = String(pathname || '').match(/\/projects\/([^/]+)/);
  return match ? decodeURIComponent(match[1]) : '';
};

export const extractPaneIdFromPathname = (pathname) => {
  const match = String(pathname || '').match(/\/projects\/[^/]+\/work\/([^/?]+)/);
  return match ? decodeURIComponent(match[1]) : '';
};

export const openProjectsIndex = async (page) => {
  await page.goto('/projects', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Projects' }).first()).toBeVisible();
};

export const openProject = async (page, preferredProjectId = '') => {
  await openProjectsIndex(page);

  if (preferredProjectId) {
    const projectList = page.getByRole('list', { name: 'Project list' });
    await expect(projectList).toBeVisible();

    const preferredOverviewLink = projectList.locator(`a[href="/projects/${preferredProjectId}/overview"]`).first();
    if (await preferredOverviewLink.isVisible().catch(() => false)) {
      await preferredOverviewLink.click();
      await waitForProjectRoute(page);
      return extractProjectIdFromPathname(new URL(page.url()).pathname) || preferredProjectId;
    }

    await page.goto(`/projects/${encodeURIComponent(preferredProjectId)}/overview`, { waitUntil: 'domcontentloaded' });
    await waitForProjectRoute(page);
    return extractProjectIdFromPathname(new URL(page.url()).pathname) || preferredProjectId;
  }

  const projectList = page.getByRole('list', { name: 'Project list' });
  await expect(projectList).toBeVisible();

  const projectItems = projectList.getByRole('listitem');
  const count = await projectItems.count();
  if (count === 0) {
    return '';
  }

  const firstOverviewLink = projectItems.first().getByRole('link', { name: 'Overview' });
  const href = await firstOverviewLink.getAttribute('href');
  const projectId = extractProjectIdFromHref(href);
  await firstOverviewLink.click();

  await waitForProjectRoute(page);
  return extractProjectIdFromPathname(new URL(page.url()).pathname) || projectId;
};

export const openOverviewTab = async (page, projectId) => {
  const overviewTab = page.getByRole('tab', { name: 'Overview' });
  if (await overviewTab.isVisible().catch(() => false)) {
    await overviewTab.click();
    await waitForProjectRoute(page);
    return;
  }

  await page.goto(`/projects/${encodeURIComponent(projectId)}/overview`, { waitUntil: 'domcontentloaded' });
  await waitForProjectRoute(page);
};

const detectWorkBoundary = async (page) => {
  const accessDeniedHeading = page.getByRole('heading', { name: /Access denied/i });
  if (await accessDeniedHeading.isVisible().catch(() => false)) {
    return { kind: 'access-denied', paneId: '' };
  }

  const noPaneNotice = page.getByText('No panes available', { exact: false });
  if (await noPaneNotice.isVisible().catch(() => false)) {
    return { kind: 'no-pane', paneId: '' };
  }

  const paneToolbar = page.getByRole('toolbar', { name: 'Open panes' });
  const newPaneInput = page.getByLabel('New pane name');
  const workspaceDocHeading = page.getByRole('heading', { name: 'Workspace Doc' });
  const addModuleButton = page.getByTestId('add-module-table');
  const createPaneButton = page.getByRole('button', { name: 'Create pane' });
  const workPanesText = page.getByText('Work Panes', { exact: false });
  const addModuleText = page.getByText('Add module: Table', { exact: false });
  if (
    (await paneToolbar.isVisible().catch(() => false))
    || (await newPaneInput.isVisible().catch(() => false))
    || (await workspaceDocHeading.isVisible().catch(() => false))
    || (await addModuleButton.isVisible().catch(() => false))
    || (await createPaneButton.isVisible().catch(() => false))
    || (await workPanesText.isVisible().catch(() => false))
    || (await addModuleText.isVisible().catch(() => false))
  ) {
    return {
      kind: 'ready',
      paneId: extractPaneIdFromPathname(new URL(page.url()).pathname),
    };
  }

  return { kind: 'unknown', paneId: '' };
};

export const openWorkTab = async (page, projectId, preferredPaneId = '') => {
  const openAndReadState = async (target) => {
    await page.goto(target, { waitUntil: 'domcontentloaded' });

    await Promise.race([
      page.getByRole('toolbar', { name: 'Open panes' }).waitFor({ state: 'visible', timeout: 15_000 }).catch(() => null),
      page.getByLabel('New pane name').waitFor({ state: 'visible', timeout: 15_000 }).catch(() => null),
      page.getByRole('heading', { name: 'Workspace Doc' }).waitFor({ state: 'visible', timeout: 15_000 }).catch(() => null),
      page.getByTestId('add-module-table').waitFor({ state: 'visible', timeout: 15_000 }).catch(() => null),
      page.getByRole('button', { name: 'Create pane' }).waitFor({ state: 'visible', timeout: 15_000 }).catch(() => null),
      page.getByText('Work Panes', { exact: false }).waitFor({ state: 'visible', timeout: 15_000 }).catch(() => null),
      page.getByText('Add module: Table', { exact: false }).waitFor({ state: 'visible', timeout: 15_000 }).catch(() => null),
      page.getByRole('heading', { name: /Access denied/i }).waitFor({ state: 'visible', timeout: 15_000 }).catch(() => null),
      page.getByText('No panes available', { exact: false }).waitFor({ state: 'visible', timeout: 15_000 }).catch(() => null),
    ]);

    return detectWorkBoundary(page);
  };

  const openViaVisibleWorkEntry = async () => {
    const workTab = page.getByRole('tab', { name: 'Work' });
    if (await workTab.isVisible().catch(() => false)) {
      await workTab.click();
      await Promise.race([
        page.waitForURL((url) => /\/projects\/[^/]+\/work(?:\/|$)/.test(url.pathname), { timeout: 15_000 }).catch(() => null),
        page.getByRole('toolbar', { name: 'Open panes' }).waitFor({ state: 'visible', timeout: 15_000 }).catch(() => null),
      ]);
      return true;
    }

    const projectWorkLink = page.locator(`a[href="/projects/${projectId}/work"]`).first();
    if (await projectWorkLink.isVisible().catch(() => false)) {
      await projectWorkLink.click();
      await Promise.race([
        page.waitForURL((url) => /\/projects\/[^/]+\/work(?:\/|$)/.test(url.pathname), { timeout: 15_000 }).catch(() => null),
        page.getByRole('button', { name: 'Create pane' }).waitFor({ state: 'visible', timeout: 15_000 }).catch(() => null),
        page.getByText('Work Panes', { exact: false }).waitFor({ state: 'visible', timeout: 15_000 }).catch(() => null),
      ]);
      return true;
    }

    const projectList = page.getByRole('list', { name: 'Project list' });
    if (await projectList.isVisible().catch(() => false)) {
      const workLink = projectList.locator(`a[href="/projects/${projectId}/work"]`).first();
      if (await workLink.isVisible().catch(() => false)) {
        await workLink.click();
        await Promise.race([
          page.waitForURL((url) => /\/projects\/[^/]+\/work(?:\/|$)/.test(url.pathname), { timeout: 15_000 }).catch(() => null),
          page.getByRole('toolbar', { name: 'Open panes' }).waitFor({ state: 'visible', timeout: 15_000 }).catch(() => null),
          page.getByRole('button', { name: 'Create pane' }).waitFor({ state: 'visible', timeout: 15_000 }).catch(() => null),
          page.getByText('Work Panes', { exact: false }).waitFor({ state: 'visible', timeout: 15_000 }).catch(() => null),
        ]);
        return true;
      }
    }

    return false;
  };

  const navigateToPreferredPane = async () => {
    if (!preferredPaneId) {
      return null;
    }

    const target = `/projects/${encodeURIComponent(projectId)}/work/${encodeURIComponent(preferredPaneId)}`;
    const currentPath = new URL(page.url()).pathname;
    if (currentPath !== target) {
      return openAndReadState(target);
    }
    return detectWorkBoundary(page);
  };

  if (await openViaVisibleWorkEntry()) {
    const preferredState = await navigateToPreferredPane();
    if (preferredState?.kind === 'ready') {
      return {
        paneId: preferredState.paneId || preferredPaneId,
        state: preferredState.kind,
      };
    }

    const clickedState = await detectWorkBoundary(page);
    if (clickedState.kind === 'ready' || !preferredPaneId) {
      return {
        paneId: clickedState.paneId,
        state: clickedState.kind,
      };
    }
  }

  if (preferredPaneId) {
    const preferredState = await openAndReadState(`/projects/${encodeURIComponent(projectId)}/work/${encodeURIComponent(preferredPaneId)}`);
    if (preferredState.kind === 'ready') {
      return {
        paneId: preferredState.paneId || preferredPaneId,
        state: preferredState.kind,
      };
    }
  }

  const fallbackState = await openAndReadState(`/projects/${encodeURIComponent(projectId)}/work`);
  return {
    paneId: fallbackState.paneId,
    state: fallbackState.kind,
  };
};

export const openToolsTab = async (page, projectId) => {
  await page.goto(`/projects/${encodeURIComponent(projectId)}/tools`, { waitUntil: 'domcontentloaded' });
  await waitForProjectRoute(page);
};

const waitForProjectRoute = async (page) => {
  await page.waitForURL((url) => /\/projects\/[^/]+\/(overview|work|tools)(?:\/|$)/.test(url.pathname), {
    timeout: 15_000,
  });
};
