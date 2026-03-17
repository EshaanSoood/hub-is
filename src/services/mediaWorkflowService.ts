import { nowIso } from '../data/mockData';
import { env } from '../lib/env';
import type { IntegrationOutcome } from '../types/domain';

export const ingestMeeting = async (
  sourceUrl: string,
): Promise<IntegrationOutcome<{ jobId: string }>> => {
  if (!env.useMocks && !env.n8nWakeWebhook) {
    return {
      blockedReason: 'Set VITE_N8N_WAKE_WEBHOOK_URL to ingest meetings into the media workflow.',
    };
  }

  return { data: { jobId: `ingest-${Math.abs(sourceUrl.length * 13)}` } };
};

export const buildAiSummary = async (
  jobId: string,
): Promise<IntegrationOutcome<{ summary: string; createdAt: string }>> => {
  return {
    data: {
      summary: `AI summary for ${jobId}: key outcomes captured, action items extracted, and next-step owners assigned.`,
      createdAt: nowIso(),
    },
  };
};

export const exportEpisodeBundle = async (): Promise<IntegrationOutcome<{ exportedAt: string }>> => {
  return { data: { exportedAt: nowIso() } };
};

export const deleteEpisodeBundle = async (): Promise<IntegrationOutcome<{ deletedAt: string }>> => {
  return { data: { deletedAt: nowIso() } };
};
