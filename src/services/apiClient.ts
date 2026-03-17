import type { IntegrationOutcome } from '../types/domain';

export const requestJson = async <T>(
  url: string,
  init?: RequestInit,
): Promise<IntegrationOutcome<T>> => {
  try {
    const response = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });

    if (!response.ok) {
      return { error: `Request failed with ${response.status}` };
    }

    const data = (await response.json()) as T;
    return { data };
  } catch {
    return { error: 'Unable to reach service endpoint.' };
  }
};
