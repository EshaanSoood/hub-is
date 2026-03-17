import { expect, test, type Page } from '@playwright/test';
import { bootstrapAuthIntoPage } from './utils/auth';
import { navigateWithinSpa, openFirstProjectRow, openProjectById } from './utils/navigation';
import { mintTokensForAccounts, resolveLinkedTestAccounts } from './utils/tokenMint';
import { DEFAULT_BASE_URL } from './utils/auth-state';

interface HubErrorEnvelope {
  code?: string;
  message?: string;
}

interface HubEnvelope<T> {
  ok: boolean;
  data: T | null;
  error?: HubErrorEnvelope;
}

interface SessionSummary {
  userId: string;
}

interface RuntimeContext {
  baseUrl: string;
  envProjectId: string;
  envPaneId: string;
  envPrivatePaneId: string;
  tokenA: string;
  tokenB: string;
  regressionProjectId: string;
  sharedPaneId: string;
  privatePaneId: string;
  sourceRecordTitle: string;
  targetRecordTitle: string;
  embedViewId: string;
  embedViewName: string;
}

const optionalEnv = (name: string): string => String(process.env[name] || '').trim();

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const hubRequest = async <T>(
  baseUrl: string,
  accessToken: string,
  path: string,
  init: RequestInit = {},
): Promise<T> => {
  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bearer ${accessToken}`);
  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(new URL(path, baseUrl).toString(), {
    ...init,
    headers,
  });

  const raw = await response.text();
  const parsed = (() => {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return null;
    }
  })();

  const envelope = (parsed && typeof parsed === 'object' && 'ok' in parsed
    ? (parsed as HubEnvelope<T>)
    : null);

  if (!envelope || typeof envelope.ok !== 'boolean') {
    const errorText =
      parsed && typeof parsed === 'object' && 'error' in parsed
        ? String((parsed as { error?: unknown }).error || '').trim()
        : '';
    const preview = raw.slice(0, 180).replace(/\s+/g, ' ').trim();
    throw new Error(
      `Unexpected response shape for ${path} (${response.status}). ${errorText || preview || 'No response body.'}`,
    );
  }

  if (!response.ok || !envelope.ok || envelope.data === null) {
    const message = envelope.error?.message || `Request failed for ${path} (${response.status}).`;
    throw new Error(message);
  }

  return envelope.data;
};

const loadSessionSummary = async (baseUrl: string, accessToken: string): Promise<SessionSummary> => {
  const response = await fetch(new URL('/api/hub/me', baseUrl).toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const raw = await response.text();
  const parsed = (() => {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return null;
    }
  })();

  const envelope =
    parsed && typeof parsed === 'object' && 'ok' in parsed
      ? (parsed as HubEnvelope<{ sessionSummary: SessionSummary }>)
      : null;
  if (envelope && typeof envelope.ok === 'boolean') {
    if (!response.ok || !envelope.ok || !envelope.data?.sessionSummary) {
      throw new Error(envelope.error?.message || `Session request failed (${response.status}).`);
    }
    return envelope.data.sessionSummary;
  }

  const direct =
    parsed && typeof parsed === 'object' && 'sessionSummary' in parsed
      ? (parsed as { sessionSummary?: SessionSummary })
      : null;
  if (!response.ok || !direct?.sessionSummary) {
    const preview = raw.slice(0, 180).replace(/\s+/g, ' ').trim();
    throw new Error(`Session request failed (${response.status}): ${preview || 'No response body.'}`);
  }
  return direct.sessionSummary;
};

const createRegressionWorkspace = async (runtimeSeed: {
  baseUrl: string;
  tokenA: string;
  userAId: string;
  userBId: string;
  preferredProjectId: string;
}): Promise<{
  projectId: string;
  sharedPaneId: string;
  privatePaneId: string;
  sourceRecordTitle: string;
  targetRecordTitle: string;
  embedViewId: string;
  embedViewName: string;
}> => {
  const runId = `pw-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const defaultPaneLayout = {
    modules_enabled: true,
    workspace_enabled: true,
    doc_binding_mode: 'owned',
    modules: [
      {
        module_type: 'table',
        size_tier: 'L',
        lens: 'project',
      },
    ],
  };

  let projectId = runtimeSeed.preferredProjectId;
  if (!projectId) {
    const projects = await hubRequest<{ projects: Array<{ project_id: string }> }>(
      runtimeSeed.baseUrl,
      runtimeSeed.tokenA,
      '/api/hub/projects',
      { method: 'GET' },
    );
    projectId = projects.projects[0]?.project_id || '';
    if (!projectId) {
      throw new Error('No accessible project found. Set PROJECT_ID or HUB_PROJECT_ID for E2E setup.');
    }
  }

  try {
    await hubRequest<{ panes: Array<{ pane_id: string }> }>(
      runtimeSeed.baseUrl,
      runtimeSeed.tokenA,
      `/api/hub/projects/${encodeURIComponent(projectId)}/panes`,
      { method: 'GET' },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('/panes') && message.includes('(404)')) {
      throw new Error(
        `BASE_URL ${runtimeSeed.baseUrl} does not expose Project Space pane endpoints for project ${projectId}. Point BASE_URL to the Hub environment running /api/hub/projects/:projectId/panes.`,
      );
    }
    throw error;
  }

  const sharedPane = await hubRequest<{ pane: { pane_id: string } }>(
    runtimeSeed.baseUrl,
    runtimeSeed.tokenA,
    `/api/hub/projects/${encodeURIComponent(projectId)}/panes`,
    {
      method: 'POST',
      body: JSON.stringify({
        name: `E2E Shared ${runId}`,
        member_user_ids: [runtimeSeed.userAId, runtimeSeed.userBId],
        layout_config: defaultPaneLayout,
      }),
    },
  );

  const privatePane = await hubRequest<{ pane: { pane_id: string } }>(
    runtimeSeed.baseUrl,
    runtimeSeed.tokenA,
    `/api/hub/projects/${encodeURIComponent(projectId)}/panes`,
    {
      method: 'POST',
      body: JSON.stringify({
        name: `E2E Private ${runId}`,
        member_user_ids: [runtimeSeed.userAId],
        layout_config: defaultPaneLayout,
      }),
    },
  );

  const collection = await hubRequest<{ collection_id: string }>(
    runtimeSeed.baseUrl,
    runtimeSeed.tokenA,
    `/api/hub/projects/${encodeURIComponent(projectId)}/collections`,
    {
      method: 'POST',
      body: JSON.stringify({
        name: `Regression Tasks ${runId}`,
        icon: 'table',
        color: 'blue',
      }),
    },
  );

  const relationField = await hubRequest<{ field_id: string }>(
    runtimeSeed.baseUrl,
    runtimeSeed.tokenA,
    `/api/hub/collections/${encodeURIComponent(collection.collection_id)}/fields`,
    {
      method: 'POST',
      body: JSON.stringify({
        name: 'Related',
        type: 'relation',
        config: {
          target_collection_id: collection.collection_id,
        },
      }),
    },
  );

  await hubRequest<{ view_id: string }>(
    runtimeSeed.baseUrl,
    runtimeSeed.tokenA,
    `/api/hub/projects/${encodeURIComponent(projectId)}/views`,
    {
      method: 'POST',
      body: JSON.stringify({
        collection_id: collection.collection_id,
        type: 'table',
        name: `Regression Table ${runId}`,
        config: {
          visible_field_ids: [relationField.field_id],
        },
      }),
    },
  );

  const embedViewName = `Embed Table ${runId}`;
  const embedView = await hubRequest<{ view_id: string }>(
    runtimeSeed.baseUrl,
    runtimeSeed.tokenA,
    `/api/hub/projects/${encodeURIComponent(projectId)}/views`,
    {
      method: 'POST',
      body: JSON.stringify({
        collection_id: collection.collection_id,
        type: 'table',
        name: embedViewName,
        config: {
          visible_field_ids: [relationField.field_id],
        },
      }),
    },
  );

  const targetRecordTitle = `Target ${runId}`;
  await hubRequest<{ record_id: string }>(
    runtimeSeed.baseUrl,
    runtimeSeed.tokenA,
    `/api/hub/projects/${encodeURIComponent(projectId)}/records`,
    {
      method: 'POST',
      body: JSON.stringify({
        collection_id: collection.collection_id,
        title: targetRecordTitle,
      }),
    },
  );

  const sourceRecordTitle = `Source ${runId}`;
  await hubRequest<{ record_id: string }>(
    runtimeSeed.baseUrl,
    runtimeSeed.tokenA,
    `/api/hub/projects/${encodeURIComponent(projectId)}/records`,
    {
      method: 'POST',
      body: JSON.stringify({
        collection_id: collection.collection_id,
        title: sourceRecordTitle,
      }),
    },
  );

  return {
    projectId,
    sharedPaneId: sharedPane.pane.pane_id,
    privatePaneId: privatePane.pane.pane_id,
    sourceRecordTitle,
    targetRecordTitle,
    embedViewId: embedView.view_id,
    embedViewName,
  };
};

let runtime: RuntimeContext;

const signInAs = async (page: Page, accessToken: string): Promise<void> => {
  await bootstrapAuthIntoPage(page, accessToken);
  const meResponsePromise = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      url.origin === runtime.baseUrl
      && url.pathname === '/api/hub/me'
      && response.request().method() === 'GET'
    );
  }, { timeout: 30_000 });

  await page.goto(new URL('/projects', runtime.baseUrl).toString(), { waitUntil: 'domcontentloaded' });
  const meResponse = await meResponsePromise;
  expect(meResponse.status(), 'Expected /api/hub/me to return 200 before UI assertions.').toBe(200);
  expect(
    (meResponse.headers()['content-type'] || '').toLowerCase(),
    'Expected /api/hub/me to return JSON before UI assertions.',
  ).toContain('application/json');

  await page.waitForURL((url) => (
    url.origin === runtime.baseUrl
    && !url.searchParams.has('code')
    && !url.searchParams.has('state')
  ), { timeout: 30_000 });
  await expect(page.getByRole('heading', { name: /Hub Home|Projects/i, level: 1 })).toBeVisible();
};

test.describe.serial('Project Space Playwright regressions', () => {
  test.beforeAll(async () => {
    const baseUrl = (optionalEnv('BASE_URL') || optionalEnv('HUB_BASE_URL') || DEFAULT_BASE_URL).replace(/\/+$/, '');
    const { accountA, accountB } = await resolveLinkedTestAccounts();

    const envProjectId = optionalEnv('PROJECT_ID') || optionalEnv('HUB_PROJECT_ID');
    const envPaneId = optionalEnv('PANE_ID');
    const envPrivatePaneId = optionalEnv('PANE_ID_PRIVATE');

    const { tokenA, tokenB } = await mintTokensForAccounts(accountA, accountB);
    const sessionA = await loadSessionSummary(baseUrl, tokenA);
    const sessionB = await loadSessionSummary(baseUrl, tokenB);

    const workspace = await createRegressionWorkspace({
      baseUrl,
      tokenA,
      userAId: sessionA.userId,
      userBId: sessionB.userId,
      preferredProjectId: envProjectId,
    });

    runtime = {
      baseUrl,
      envProjectId,
      envPaneId,
      envPrivatePaneId,
      tokenA,
      tokenB,
      regressionProjectId: workspace.projectId,
      sharedPaneId: workspace.sharedPaneId,
      privatePaneId: workspace.privatePaneId,
      sourceRecordTitle: workspace.sourceRecordTitle,
      targetRecordTitle: workspace.targetRecordTitle,
      embedViewId: workspace.embedViewId,
      embedViewName: workspace.embedViewName,
    };
  });

  test('1) project space loads with tabs chrome', async ({ page }) => {
    await signInAs(page, runtime.tokenA);

    if (runtime.envProjectId) {
      await openProjectById(page, runtime.baseUrl, runtime.envProjectId, 'work');
    } else {
      await openFirstProjectRow(page);
    }

    await expect(page.getByRole('tab', { name: 'Overview' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Work' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Tools' })).toBeVisible();
  });

  test('2) pane access and workspace doc surface load', async ({ page }) => {
    await signInAs(page, runtime.tokenA);

    const projectId = runtime.envProjectId || runtime.regressionProjectId;
    const paneId = runtime.envPaneId || runtime.sharedPaneId;

    await navigateWithinSpa(page, `/projects/${encodeURIComponent(projectId)}/work/${encodeURIComponent(paneId)}`);

    await expect(page.getByRole('tab', { name: 'Work' })).toBeVisible();

    const paneToolbar = page.getByRole('toolbar', { name: 'Open panes' });
    await expect(paneToolbar).toBeVisible();

    if (!runtime.envPaneId) {
      await paneToolbar.getByRole('button').first().click();
    }

    await expect(page.getByLabel('Project note editor')).toBeVisible();
  });

  test('3) pane permission boundary renders access denied', async ({ page }) => {
    await signInAs(page, runtime.tokenB);

    const targetProjectId = runtime.envProjectId || runtime.regressionProjectId;
    const targetPrivatePaneId = runtime.envPrivatePaneId || runtime.privatePaneId;

    await navigateWithinSpa(
      page,
      `/projects/${encodeURIComponent(targetProjectId)}/work/${encodeURIComponent(targetPrivatePaneId)}`,
    );

    await expect(page.getByRole('heading', { name: /Access denied/i })).toBeVisible();
  });

  test('4) record inspector relation add/remove roundtrip', async ({ page }) => {
    await signInAs(page, runtime.tokenA);

    await navigateWithinSpa(
      page,
      `/projects/${encodeURIComponent(runtime.regressionProjectId)}/work/${encodeURIComponent(runtime.sharedPaneId)}`,
    );

    const addTableModuleButton = page.getByRole('button', { name: 'Add module: table' });
    const tableModule = page.getByLabel('Table module').first();
    if ((await tableModule.count()) === 0 && (await addTableModuleButton.count()) > 0) {
      await addTableModuleButton.first().click();
    }
    await expect(tableModule).toBeVisible();
    const openRecordButtons = tableModule.locator('[data-testid^="open-record-button-"]');
    const openRecordCount = await openRecordButtons.count();
    expect(openRecordCount, 'Expected at least two records in the table module.').toBeGreaterThanOrEqual(2);

    const sourceRecordTitle = (await openRecordButtons.nth(0).innerText()).trim();
    const targetRecordTitle = (await openRecordButtons.nth(1).innerText()).trim();
    await openRecordButtons.nth(0).click();

    const inspectorDialog = page.getByRole('dialog', { name: 'Record Inspector' });
    await expect(inspectorDialog).toContainText(sourceRecordTitle);

    const existingRelationRemove = inspectorDialog.getByRole('button', {
      name: new RegExp(`^Remove relation to ${escapeRegex(targetRecordTitle)}$`),
    });
    if (await existingRelationRemove.count()) {
      await existingRelationRemove.first().click();
      await expect(existingRelationRemove).toHaveCount(0);
    }

    await inspectorDialog.getByRole('button', { name: 'Add relation' }).click();
    const relationSearch = page.getByLabel('Search target record');
    await expect(relationSearch).toBeVisible();
    await relationSearch.fill(targetRecordTitle);

    const targetOption = page.getByRole('option').filter({
      hasText: targetRecordTitle,
    }).first();
    await expect(targetOption).toBeVisible();
    await targetOption.click();

    const relationDialog = page.getByRole('dialog').filter({ hasText: 'Relation field' }).last();
    const addRelationConfirm = relationDialog.getByRole('button', { name: 'Add' });
    await expect(addRelationConfirm).toBeEnabled();
    await addRelationConfirm.click();

    const removeButton = inspectorDialog.getByRole('button', {
      name: new RegExp(`^Remove relation to ${escapeRegex(targetRecordTitle)}$`),
    });
    await expect(removeButton).toBeVisible();
    await removeButton.click();

    await expect(removeButton).toHaveCount(0);
  });

  test('5) view-ref embed renders and open action works via keyboard', async ({ page }) => {
    await signInAs(page, runtime.tokenA);

    await navigateWithinSpa(
      page,
      `/projects/${encodeURIComponent(runtime.regressionProjectId)}/work/${encodeURIComponent(runtime.sharedPaneId)}`,
    );

    const embedPicker = page.getByLabel('View embed picker');
    await expect(embedPicker).toBeVisible();
    await embedPicker.selectOption(runtime.embedViewId);

    await page.getByRole('button', { name: 'Insert selected view embed' }).click();

    const embedBlock = page.getByLabel(`Embedded view ${runtime.embedViewId}`);
    await expect(embedBlock).toBeVisible();

    const openButton = embedBlock.getByRole('button', { name: 'Open full view' });
    await openButton.focus();
    await expect(openButton).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(embedBlock.getByText(runtime.embedViewName)).toBeVisible();
  });
});
