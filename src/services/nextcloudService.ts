import { mockFiles, nowIso } from '../data/mockData';
import { env } from '../lib/env';
import type { HubFile, IntegrationOutcome } from '../types/domain';

const browserNextcloudIntegrationBlocked =
  'Browser Nextcloud integration is disabled. Route file operations through hub-api or the desktop bridge.';

export const listRecentFiles = async (): Promise<IntegrationOutcome<HubFile[]>> => {
  if (env.useMocks) {
    return { data: mockFiles };
  }

  return { blockedReason: browserNextcloudIntegrationBlocked };
};

export const createFolder = async (
  folderName: string,
): Promise<IntegrationOutcome<{ folderName: string }>> => {
  if (env.useMocks) {
    return { data: { folderName } };
  }

  return { blockedReason: browserNextcloudIntegrationBlocked };
};

export const generateShareLink = async (
  fileId: string,
): Promise<IntegrationOutcome<{ fileId: string; shareUrl: string }>> => {
  if (env.useMocks) {
    return {
      data: {
        fileId,
        shareUrl: `https://cloud.eshaansood.org/s/${fileId}-share`,
      },
    };
  }

  return { blockedReason: browserNextcloudIntegrationBlocked };
};

export const requestDownloadBundle = async (): Promise<IntegrationOutcome<{ createdAt: string }>> => {
  if (env.useMocks) {
    return { data: { createdAt: nowIso() } };
  }

  if (!env.n8nWakeWebhook) {
    return {
      blockedReason: 'Set VITE_N8N_WAKE_WEBHOOK_URL to trigger download bundle automation.',
    };
  }

  return { data: { createdAt: nowIso() } };
};

export const uploadFile = async (
  file: File,
): Promise<IntegrationOutcome<HubFile>> => {
  const uploaded: HubFile = {
    id: `upload-${Date.now()}`,
    name: file.name,
    updatedAt: nowIso(),
    size: `${Math.max(1, Math.round(file.size / 1024))} KB`,
  };

  if (env.useMocks) {
    return { data: uploaded };
  }

  return { blockedReason: browserNextcloudIntegrationBlocked };
};
