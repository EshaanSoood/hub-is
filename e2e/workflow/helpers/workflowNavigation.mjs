
import { expect } from '@playwright/test';

export const extractProjectIdFromHref = (href) => {
  const match = String(href || '').match(/\/projects\/([^/]+)/);
  return match ? decodeURIComponent(match[1]) : '';
};

export const extractProjectIdFromPathname = (pathname) => {
  const match = String(pathname || '').match(/\/projects\/([^/]+)/);
  return match ? decodeURIComponent(match[1]) : '';
};

export const extractWorkProjectIdFromPathname = (pathname) => {
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
    return { kind: 'access-denied', projectId: '' };
  }

  const noProjectNotice = page.getByText('No projects available', { exact: false });
  if (await noProjectNotice.isVisible().catch(() => false)) {
    return { kind: 'no-project', projectId: '' };
  }

  const projectToolbar = page.getByRole('toolbar', { name: 'Open projects' });
  const newProjectInput = page.getByLabel('New project name');
  const workspaceDocHeading = page.getByRole('heading', { name: 'Workspace Doc' });
  const addWidgetButton = page.getByTestId('add-widget-table');
  const createProjectButton = page.getByRole('button', { name: 'Create project' });
  const workProjectsText = page.getByText('Work Projects', { exact: false });
  const addWidgetText = page.getByText('Add widget: Table', { exact: false });
  if (
    (await projectToolbar.isVisible().catch(() => false))
    || (await newProjectInput.isVisible().catch(() => false))
    || (await workspaceDocHeading.isVisible().catch(() => false))
    || (await addWidgetButton.isVisible().catch(() => false))
    || (await createProjectButton.isVisible().catch(() => false))
    || (await workProjectsText.isVisible().catch(() => false))
    || (await addWidgetText.isVisible().catch(() => false))
  ) {
    return {
      kind: 'ready',
      projectId: extractProjectIdFromPathname(new URL(page.url()).pathname),
    };
  }

  return { kind: 'unknown', projectId: '' };
};

export const openWorkTab = async (page, projectId, preferredProjectId = '') => {
  const openAndReadState = async (target) => {
    await page.goto(target, { waitUntil: 'domcontentloaded' });

    await Promise.race([
      page.getByRole('toolbar', { name: 'Open projects' }).waitFor({ state: 'visible', timeout: 15_000 }).catch(() => null),
      page.getByLabel('New project name').waitFor({ state: 'visible', timeout: 15_000 }).catch(() => null),
      page.getByRole('heading', { name: 'Workspace Doc' }).waitFor({ state: 'visible', timeout: 15_000 }).catch(() => null),
      page.getByTestId('add-widget-table').waitFor({ state: 'visible', timeout: 15_000 }).catch(() => null),
      page.getByRole('button', { name: 'Create project' }).waitFor({ state: 'visible', timeout: 15_000 }).catch(() => null),
      page.getByText('Work Projects', { exact: false }).waitFor({ state: 'visible', timeout: 15_000 }).catch(() => null),
      page.getByText('Add widget: Table', { exact: false }).waitFor({ state: 'visible', timeout: 15_000 }).catch(() => null),
      page.getByRole('heading', { name: /Access denied/i }).waitFor({ state: 'visible', timeout: 15_000 }).catch(() => null),
      page.getByText('No projects available', { exact: false }).waitFor({ state: 'visible', timeout: 15_000 }).catch(() => null),
    ]);

    return detectWorkBoundary(page);
  };

  const openViaVisibleWorkEntry = async () => {
    const workTab = page.getByRole('tab', { name: 'Work' });
    if (await workTab.isVisible().catch(() => false)) {
      await workTab.click();
      await Promise.race([
        page.waitForURL((url) => /\/projects\/[^/]+\/work(?:\/|$)/.test(url.pathname), { timeout: 15_000 }).catch(() => null),
        page.getByRole('toolbar', { name: 'Open projects' }).waitFor({ state: 'visible', timeout: 15_000 }).catch(() => null),
      ]);
      return true;
    }

    const projectWorkLink = page.locator(`a[href="/projects/${projectId}/work"]`).first();
    if (await projectWorkLink.isVisible().catch(() => false)) {
      await projectWorkLink.click();
      await Promise.race([
        page.waitForURL((url) => /\/projects\/[^/]+\/work(?:\/|$)/.test(url.pathname), { timeout: 15_000 }).catch(() => null),
        page.getByRole('button', { name: 'Create project' }).waitFor({ state: 'visible', timeout: 15_000 }).catch(() => null),
        page.getByText('Work Projects', { exact: false }).waitFor({ state: 'visible', timeout: 15_000 }).catch(() => null),
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
          page.getByRole('toolbar', { name: 'Open projects' }).waitFor({ state: 'visible', timeout: 15_000 }).catch(() => null),
          page.getByRole('button', { name: 'Create project' }).waitFor({ state: 'visible', timeout: 15_000 }).catch(() => null),
          page.getByText('Work Projects', { exact: false }).waitFor({ state: 'visible', timeout: 15_000 }).catch(() => null),
        ]);
        return true;
      }
    }

    return false;
  };

  const navigateToPreferredProject = async () => {
    if (!preferredProjectId) {
      return null;
    }

    const target = `/projects/${encodeURIComponent(projectId)}/work/${encodeURIComponent(preferredProjectId)}`;
    const currentPath = new URL(page.url()).pathname;
    if (currentPath !== target) {
      return openAndReadState(target);
    }
    return detectWorkBoundary(page);
  };

  if (await openViaVisibleWorkEntry()) {
    const preferredState = await navigateToPreferredProject();
    if (preferredState?.kind === 'ready') {
      return {
        projectId: preferredState.projectId || preferredProjectId,
        state: preferredState.kind,
      };
    }

    const clickedState = await detectWorkBoundary(page);
    if (clickedState.kind === 'ready' || !preferredProjectId) {
      return {
        projectId: clickedState.projectId,
        state: clickedState.kind,
      };
    }
  }

  if (preferredProjectId) {
    const preferredState = await openAndReadState(`/projects/${encodeURIComponent(projectId)}/work/${encodeURIComponent(preferredProjectId)}`);
    if (preferredState.kind === 'ready') {
      return {
        projectId: preferredState.projectId || preferredProjectId,
        state: preferredState.kind,
      };
    }
  }

  const fallbackState = await openAndReadState(`/projects/${encodeURIComponent(projectId)}/work`);
  return {
    projectId: fallbackState.projectId,
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
