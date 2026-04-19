import { useCallback, useMemo, useRef, useState } from 'react';
import { focusWhenReady } from '../../../lib/focusWhenReady';
import {
  captureModeFromIntent,
  PERSONAL_CAPTURE_TARGET,
  resolveTargetProjectForMode,
} from '../model';
import { useQuickCaptureComposerEffects } from './useQuickCaptureComposerEffects';
import type { CaptureMode } from '../types';

interface UseQuickCaptureComposerStateParams {
  defaultProjectCaptureTarget: string;
  activationKey: number;
  initialIntent: string | null;
}

export const useQuickCaptureComposerState = ({
  defaultProjectCaptureTarget,
  activationKey,
  initialIntent,
}: UseQuickCaptureComposerStateParams) => {
  const [captureText, setCaptureText] = useState('');
  const [captureMode, setCaptureMode] = useState<CaptureMode>('thought');
  const [captureTargetProjectId, setCaptureTargetProjectId] = useState(PERSONAL_CAPTURE_TARGET);
  const [captureOptionsExpanded, setCaptureOptionsExpanded] = useState(false);
  const [captureSaving, setCaptureSaving] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [captureNotice, setCaptureNotice] = useState<string | null>(null);
  const captureInputRef = useRef<HTMLInputElement | null>(null);
  const defaultProjectCaptureTargetRef = useRef(PERSONAL_CAPTURE_TARGET);

  const focusCaptureInput = useCallback(() => focusWhenReady(() => captureInputRef.current), []);

  const resetCaptureComposer = useCallback(
    (nextMode: CaptureMode = 'thought', expandOptions = false, nextProjectId = PERSONAL_CAPTURE_TARGET) => {
      setCaptureText('');
      setCaptureMode(nextMode);
      setCaptureOptionsExpanded(expandOptions);
      setCaptureTargetProjectId(nextProjectId);
      setCaptureError(null);
      setCaptureNotice(null);
    },
    [],
  );

  useQuickCaptureComposerEffects({
    defaultProjectCaptureTarget,
    defaultProjectCaptureTargetRef,
    activationKey,
    initialIntent,
    captureModeFromIntent,
    personalCaptureTarget: PERSONAL_CAPTURE_TARGET,
    resetCaptureComposer,
    focusCaptureInput,
    captureNotice,
    setCaptureNotice,
  });

  const onComposerModeChange = useCallback((value: string) => {
    const nextMode = value as CaptureMode;
    setCaptureMode(nextMode);
    setCaptureTargetProjectId((current) => resolveTargetProjectForMode(nextMode, current, defaultProjectCaptureTarget));
  }, [defaultProjectCaptureTarget]);

  return useMemo(() => ({
    captureInputRef,
    captureText,
    setCaptureText,
    captureMode,
    setCaptureMode,
    captureTargetProjectId,
    setCaptureTargetProjectId,
    captureOptionsExpanded,
    setCaptureOptionsExpanded,
    captureSaving,
    setCaptureSaving,
    captureError,
    setCaptureError,
    captureNotice,
    setCaptureNotice,
    focusCaptureInput,
    resetCaptureComposer,
    onComposerModeChange,
  }), [
    captureError,
    captureMode,
    captureNotice,
    captureOptionsExpanded,
    captureSaving,
    captureTargetProjectId,
    captureText,
    focusCaptureInput,
    onComposerModeChange,
    resetCaptureComposer,
  ]);
};
