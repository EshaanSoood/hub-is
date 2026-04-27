import { type Dispatch, type MutableRefObject, type SetStateAction, useEffect } from 'react';

interface UseProjectControlEffectsParams {
  openedFromPinned: boolean;
  previousOpenedFromPinnedRef: MutableRefObject<boolean>;
  setShowProjectSwitcher: Dispatch<SetStateAction<boolean>>;
  showCreateProjectControl: boolean;
  createProjectNameInputRef: MutableRefObject<HTMLInputElement | null>;
}

export const useProjectControlEffects = ({
  openedFromPinned,
  previousOpenedFromPinnedRef,
  setShowProjectSwitcher,
  showCreateProjectControl,
  createProjectNameInputRef,
}: UseProjectControlEffectsParams): void => {
  useEffect(() => {
    if (previousOpenedFromPinnedRef.current !== openedFromPinned) {
      setShowProjectSwitcher(!openedFromPinned);
    }
    previousOpenedFromPinnedRef.current = openedFromPinned;
  }, [openedFromPinned, previousOpenedFromPinnedRef, setShowProjectSwitcher]);

  useEffect(() => {
    if (!showCreateProjectControl) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      createProjectNameInputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [createProjectNameInputRef, showCreateProjectControl]);
};
