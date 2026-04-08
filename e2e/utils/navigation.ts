import { expect, type Page } from '@playwright/test';

const projectIdFromHref = (href: string): string => {
  const match = href.match(/\/projects\/([^/]+)\/(overview|work|tools)/);
  if (!match) {
    throw new Error(`Unable to parse project id from href: ${href}`);
  }
  return decodeURIComponent(match[1]);
};

export const openProjectsIndex = async (page: Page, baseUrl: string): Promise<void> => {
  await page.goto(new URL('/projects', baseUrl).toString(), { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /myHub|Projects/i })).toBeVisible();
};

export const navigateWithinSpa = async (page: Page, path: string): Promise<void> => {
  await page.evaluate((nextPath) => {
    window.history.pushState({}, '', nextPath);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
};

export const openProjectById = async (
  page: Page,
  baseUrl: string,
  projectId: string,
  route: 'overview' | 'work' | 'tools' = 'overview',
): Promise<void> => {
  await page.goto(new URL(`/projects/${encodeURIComponent(projectId)}/${route}`, baseUrl).toString(), {
    waitUntil: 'domcontentloaded',
  });
};

export const openProjectOverviewFromList = async (page: Page, projectId: string): Promise<void> => {
  const overviewLink = page.locator(`a[href="/projects/${encodeURIComponent(projectId)}/overview"]`).first();
  await expect(overviewLink).toBeVisible();
  await navigateWithinSpa(page, `/projects/${encodeURIComponent(projectId)}/overview`);
};

export const openFirstProjectRow = async (page: Page): Promise<{ projectId: string; href: string }> => {
  const firstWorkLink = page.getByRole('link', { name: 'Work' }).first();
  await expect(firstWorkLink).toBeVisible();

  const href = await firstWorkLink.getAttribute('href');
  if (!href) {
    throw new Error('First project Work link did not contain an href.');
  }

  const projectId = projectIdFromHref(href);
  await navigateWithinSpa(page, `/projects/${encodeURIComponent(projectId)}/work`);
  return {
    projectId,
    href,
  };
};
