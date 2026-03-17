import { env } from '../lib/env';
import type { IntegrationOutcome, ServiceRegistryItem } from '../types/domain';

const wait = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });

export const wakeService = async (
  service: ServiceRegistryItem,
): Promise<IntegrationOutcome<{ started: boolean }>> => {
  if (env.useMocks) {
    await wait(800);
    return { data: { started: true } };
  }

  const endpoint = service.wakeWorkflowUrl || env.n8nWakeWebhook;
  if (!endpoint) {
    return {
      blockedReason: `Missing wake workflow endpoint for ${service.label}. Set VITE_N8N_WAKE_WEBHOOK_URL.`,
    };
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serviceId: service.id }),
    });

    if (!response.ok) {
      return { error: `Wake workflow failed with ${response.status}` };
    }

    return { data: { started: true } };
  } catch {
    return { error: `Unable to trigger wake workflow for ${service.label}.` };
  }
};

export const sleepService = async (
  service: ServiceRegistryItem,
): Promise<IntegrationOutcome<{ slept: boolean }>> => {
  if (env.useMocks) {
    await wait(600);
    return { data: { slept: true } };
  }

  const endpoint = service.sleepWorkflowUrl || env.n8nSleepWebhook;
  if (!endpoint) {
    return {
      blockedReason: `Missing sleep workflow endpoint for ${service.label}. Set VITE_N8N_SLEEP_WEBHOOK_URL.`,
    };
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serviceId: service.id }),
    });

    if (!response.ok) {
      return { error: `Sleep workflow failed with ${response.status}` };
    }

    return { data: { slept: true } };
  } catch {
    return { error: `Unable to trigger sleep workflow for ${service.label}.` };
  }
};

export const pollServiceHealth = async (
  service: ServiceRegistryItem,
): Promise<IntegrationOutcome<{ ready: boolean }>> => {
  if (env.useMocks) {
    await wait(1200);
    return { data: { ready: true } };
  }

  const maxAttempts = 10;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const response = await fetch(service.healthUrl, { method: 'GET' });
      if (response.ok) {
        return { data: { ready: true } };
      }
    } catch {
      // Swallow transient polling failures.
    }
    await wait(1000);
  }

  return { error: `Health check did not report ready for ${service.label}.` };
};
