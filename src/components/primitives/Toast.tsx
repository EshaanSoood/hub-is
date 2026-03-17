import { toast as notify } from 'sonner';
import { Toaster } from '../ui/sonner';

export const ToastProvider = Toaster;
export const toast = notify;

export const notifyInfo = (message: string, description?: string) =>
  notify(message, { description });

export const notifySuccess = (message: string, description?: string) =>
  notify.success(message, { description });

export const notifyWarning = (message: string, description?: string) =>
  notify.warning(message, { description });

export const notifyError = (message: string, description?: string) =>
  notify.error(message, { description });
