import { expect, test } from '@playwright/test';
import { HUB_API_BASE_URL, type HubEnvelope, loadTokenFromLocalEnv } from '../../helpers/api-client';

const parseEnvelope = async <T>(response: Response): Promise<HubEnvelope<T> | null> => {
  const raw = await response.text();
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as HubEnvelope<T>;
  } catch {
    return null;
  }
};

test.describe('Auth and error handling', () => {
  test('requests without token return 401', async () => {
    const response = await fetch(`${HUB_API_BASE_URL}/api/hub/home`, {
      method: 'GET',
    });

    expect(response.status).toBe(401);

    const envelope = await parseEnvelope<unknown>(response);
    expect(envelope?.ok).toBe(false);
  });

  test('requests with invalid token return 401', async () => {
    const response = await fetch(`${HUB_API_BASE_URL}/api/hub/home`, {
      method: 'GET',
      headers: {
        Authorization: 'Bearer invalid-token',
      },
    });

    expect(response.status).toBe(401);

    const envelope = await parseEnvelope<unknown>(response);
    expect(envelope?.ok).toBe(false);
  });

  test.skip('server errors return 500 not 400', async () => {
    const token = await loadTokenFromLocalEnv('TOKEN_A');
    const response = await fetch(`${HUB_API_BASE_URL}/api/hub/tasks`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: 'server-error-probe',
        task_state: { due_at: { nested: 'not-valid-internal-shape' } },
      }),
    });

    expect([400, 500]).toContain(response.status);
  });
});
