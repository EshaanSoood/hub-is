import { Dispatch, MutableRefObject, SetStateAction, useEffect } from 'react';

type CaptureMode = 'thought' | 'task' | 'reminder' | 'calendar';

interface UseQuickCaptureComposerEffectsParams {
  defaultProjectCaptureTarget: string;
  defaultProjectCaptureTargetRef: MutableRefObject<string>;
  activationKey: number;
  initialIntent: string | null;
  captureModeFromIntent: (intent: string | null) => CaptureMode;
  personalCaptureTarget: string;
  resetCaptureComposer: (nextMode?: CaptureMode, expandOptions?: boolean, nextProjectId?: string) => void;
  focusCaptureInput: () => unknown;
  captureNotice: string | null;
  setCaptureNotice: Dispatch<SetStateAction<string | null>>;
}

export const useQuickCaptureComposerEffects = ({
  defaultProjectCaptureTarget,
  defaultProjectCaptureTargetRef,
  activationKey,
  initialIntent,
  captureModeFromIntent,
  personalCaptureTarget,
  resetCaptureComposer,
  focusCaptureInput,
  captureNotice,
  setCaptureNotice,
}: UseQuickCaptureComposerEffectsParams): void => {
  useEffect(() => {
    defaultProjectCaptureTargetRef.current = defaultProjectCaptureTarget;
  }, [defaultProjectCaptureTarget]);

  useEffect(() => {
    const nextMode = captureModeFromIntent(initialIntent);
    const nextProjectId = nextMode === 'thought' ? personalCaptureTarget : defaultProjectCaptureTargetRef.current;
    resetCaptureComposer(nextMode, nextMode !== 'thought', nextProjectId);
    void focusCaptureInput();
  }, [activationKey, focusCaptureInput, initialIntent, resetCaptureComposer]);

  useEffect(() => {
    if (!captureNotice) {
      return;
    }
    const timer = window.setTimeout(() => {
      setCaptureNotice(null);
    }, 2200);
    return () => {
      window.clearTimeout(timer);
    };
  }, [captureNotice]);
};
