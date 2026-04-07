import { type MutableRefObject, useEffect } from 'react';
import { type SetURLSearchParams } from 'react-router-dom';

const PENDING_CAPTURE_DRAFT_KEY = 'hub:pending-project-capture';

interface UseQuickCaptureQueryIntentEffectParams {
  createAndOpenCaptureRecord: (intent: string | null, seedText?: string) => Promise<boolean>;
  quickCaptureInFlightRef: MutableRefObject<boolean>;
  searchParams: URLSearchParams;
  setSearchParams: SetURLSearchParams;
}

export const useQuickCaptureQueryIntentEffect = ({
  createAndOpenCaptureRecord,
  quickCaptureInFlightRef,
  searchParams,
  setSearchParams,
}: UseQuickCaptureQueryIntentEffectParams): void => {
  useEffect(() => {
    if (searchParams.get('capture') !== '1') {
      return;
    }
    if (quickCaptureInFlightRef.current) {
      return;
    }

    let cancelled = false;
    const intent = searchParams.get('intent');
    const pendingDraft =
      typeof window === 'undefined'
        ? null
        : (() => {
            try {
              const raw = window.sessionStorage.getItem(PENDING_CAPTURE_DRAFT_KEY);
              if (!raw) {
                return null;
              }
              const parsed = JSON.parse(raw) as { intent?: string | null; seedText?: string };
              if ((parsed.intent ?? null) !== intent) {
                return null;
              }
              return parsed;
            } catch {
              return null;
            }
          })();

    const createAndOpenCapture = async () => {
      let didRun = false;
      try {
        didRun = await createAndOpenCaptureRecord(intent, pendingDraft?.seedText);
        if (cancelled || !didRun) {
          return;
        }
      } finally {
        if (!cancelled && didRun) {
          if (typeof window !== 'undefined') {
            window.sessionStorage.removeItem(PENDING_CAPTURE_DRAFT_KEY);
          }
          setSearchParams((current) => {
            const next = new URLSearchParams(current);
            next.delete('capture');
            next.delete('intent');
            return next;
          }, { replace: true });
        }
      }
    };

    void createAndOpenCapture().catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [createAndOpenCaptureRecord, quickCaptureInFlightRef, searchParams, setSearchParams]);
};
