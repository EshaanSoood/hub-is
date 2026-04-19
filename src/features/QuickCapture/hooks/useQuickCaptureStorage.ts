import { useCallback } from 'react';
import { safeGetLastProjectId } from '../model';

export const useQuickCaptureStorage = () => {
  const lastOpenedProjectId = safeGetLastProjectId();

  const writePendingCaptureDraft = useCallback((intent: string, seedText: string) => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      window.sessionStorage.setItem(
        'hub:pending-project-capture',
        JSON.stringify({
          intent,
          seedText,
        }),
      );
    } catch {
      // Ignore blocked or unavailable session storage so project handoff still proceeds.
    }
  }, []);

  return {
    lastOpenedProjectId,
    writePendingCaptureDraft,
  };
};
