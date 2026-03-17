import { env } from '../lib/env';
import type { IntegrationOutcome } from '../types/domain';
import { nowIso } from '../data/mockData';

export const sendPostmarkEmail = async (
  to: string,
  subject: string,
  body: string,
): Promise<IntegrationOutcome<{ queuedAt: string }>> => {
  try {
    const response = await fetch('/api/postmark/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to,
        subject,
        textBody: body,
      }),
    });

    if (!response.ok) {
      let message = `Postmark proxy error ${response.status}`;
      try {
        const payload = (await response.json()) as { error?: string };
        if (payload.error) {
          message = payload.error;
        }
      } catch {
        // Keep generic message.
      }
      return { error: message };
    }

    return { data: { queuedAt: nowIso() } };
  } catch {
    return { error: 'Failed to send Postmark request.' };
  }
};

export const publishNtfyAlert = async (
  title: string,
  message: string,
): Promise<IntegrationOutcome<{ deliveredAt: string }>> => {
  if (env.useMocks) {
    return { data: { deliveredAt: nowIso() } };
  }

  if (!env.ntfyTopicUrl) {
    return { blockedReason: 'Set VITE_NTFY_TOPIC_URL to publish ntfy alerts.' };
  }

  try {
    const response = await fetch(env.ntfyTopicUrl, {
      method: 'POST',
      headers: {
        Title: title,
        Priority: 'high',
      },
      body: message,
    });

    if (!response.ok) {
      return { error: `ntfy error ${response.status}` };
    }

    return { data: { deliveredAt: nowIso() } };
  } catch {
    return { error: 'Failed to publish ntfy alert.' };
  }
};
