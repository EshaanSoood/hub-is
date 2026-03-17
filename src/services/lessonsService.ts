import { nowIso } from '../data/mockData';
import { env } from '../lib/env';
import type { IntegrationOutcome } from '../types/domain';
import { sendPostmarkEmail } from './notificationService';

export const sendLessonUpdateEmail = async (
  email: string,
  studentName: string,
): Promise<IntegrationOutcome<{ sentAt: string }>> => {
  const result = await sendPostmarkEmail(
    email,
    `Lesson Update for ${studentName}`,
    `Hello, this is a lesson update for ${studentName}.`,
  );

  if (result.blockedReason) {
    return { blockedReason: result.blockedReason };
  }

  if (result.error) {
    return { error: result.error };
  }

  return { data: { sentAt: nowIso() } };
};

export const generateAndSendInvoice = async (
  studentName: string,
): Promise<IntegrationOutcome<{ invoiceNumber: string; sentAt: string }>> => {
  if (!env.useMocks && !env.n8nWakeWebhook) {
    return {
      blockedReason: 'Set VITE_N8N_WAKE_WEBHOOK_URL to trigger invoice generation workflow.',
    };
  }

  const invoiceNumber = `INV-${studentName.slice(0, 2).toUpperCase()}-${Date.now().toString().slice(-4)}`;
  return {
    data: {
      invoiceNumber,
      sentAt: nowIso(),
    },
  };
};
