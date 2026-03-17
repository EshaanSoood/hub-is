import type { BrowserContext, Page } from '@playwright/test';

export const E2E_ACCESS_TOKEN_STORAGE_KEY = 'hub:e2e:access-token';

const originFromBaseUrl = (baseUrl: string): string => new URL(baseUrl).origin;

export const buildStorageStateForToken = (baseUrl: string, accessToken: string) => ({
  cookies: [],
  origins: [
    {
      origin: originFromBaseUrl(baseUrl),
      localStorage: [
        {
          name: E2E_ACCESS_TOKEN_STORAGE_KEY,
          value: accessToken,
        },
      ],
    },
  ],
});

export const bootstrapAuthIntoContext = async (
  context: BrowserContext,
  accessToken: string,
): Promise<void> => {
  await context.addInitScript(
    ({ key, token }) => {
      window.localStorage.setItem(key, token);
    },
    {
      key: E2E_ACCESS_TOKEN_STORAGE_KEY,
      token: accessToken,
    },
  );
};

export const bootstrapAuthIntoPage = async (
  page: Page,
  accessToken: string,
): Promise<void> => {
  await page.addInitScript(
    ({ key, token }) => {
      window.localStorage.setItem(key, token);
    },
    {
      key: E2E_ACCESS_TOKEN_STORAGE_KEY,
      token: accessToken,
    },
  );
};
