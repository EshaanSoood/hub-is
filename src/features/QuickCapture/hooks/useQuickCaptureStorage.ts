import { useCallback } from 'react';
import { safeGetLastProjectId } from '../model';

export const useQuickCaptureStorage = () => {
  const lastOpenedProjectId = safeGetLastProjectId();

  const writePendingCaptureDraft = useCallback((intent: string, seedText: string) => {
    if (typeof window === 'undefined') {
      return;
    }
    window.sessionStorage.setItem(
      'hub:pending-project-capture',
      JSON.stringify({
        intent,
        seedText,
      }),
    );
  }, []);

  return {
    lastOpenedProjectId,
    writePendingCaptureDraft,
  };
};
