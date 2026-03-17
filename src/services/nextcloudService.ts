import { mockFiles, nowIso } from '../data/mockData';
import { env } from '../lib/env';
import type { HubFile, IntegrationOutcome } from '../types/domain';

export const listRecentFiles = async (): Promise<IntegrationOutcome<HubFile[]>> => {
  if (env.useMocks) {
    return { data: mockFiles };
  }

  if (!env.nextcloudBaseUrl || !env.nextcloudUser || !env.nextcloudAppPassword) {
    return {
      blockedReason:
        'Set VITE_NEXTCLOUD_BASE_URL, VITE_NEXTCLOUD_USER, and VITE_NEXTCLOUD_APP_PASSWORD for Nextcloud APIs.',
    };
  }

  return { data: mockFiles };
};

export const createFolder = async (
  folderName: string,
): Promise<IntegrationOutcome<{ folderName: string }>> => {
  if (env.useMocks) {
    return { data: { folderName } };
  }

  if (!env.nextcloudBaseUrl || !env.nextcloudUser || !env.nextcloudAppPassword) {
    return {
      blockedReason:
        'Set Nextcloud credentials to create folders in the live environment.',
    };
  }

  return { data: { folderName } };
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

  if (!env.nextcloudBaseUrl || !env.nextcloudUser || !env.nextcloudAppPassword) {
    return {
      blockedReason:
        'Set Nextcloud credentials to generate secure share links.',
    };
  }

  return {
    data: {
      fileId,
      shareUrl: `${env.nextcloudBaseUrl}/s/${fileId}`,
    },
  };
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

  if (!env.nextcloudBaseUrl || !env.nextcloudUser || !env.nextcloudAppPassword) {
    return {
      blockedReason:
        'Set Nextcloud credentials to upload files in the live environment.',
    };
  }

  return { data: uploaded };
};
