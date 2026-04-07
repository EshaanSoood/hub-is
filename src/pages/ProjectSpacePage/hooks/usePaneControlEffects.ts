import { type Dispatch, type MutableRefObject, type SetStateAction, useEffect } from 'react';

interface UsePaneControlEffectsParams {
  openedFromPinned: boolean;
  previousOpenedFromPinnedRef: MutableRefObject<boolean>;
  setShowPaneSwitcher: Dispatch<SetStateAction<boolean>>;
  showCreatePaneControl: boolean;
  createPaneNameInputRef: MutableRefObject<HTMLInputElement | null>;
}

export const usePaneControlEffects = ({
  openedFromPinned,
  previousOpenedFromPinnedRef,
  setShowPaneSwitcher,
  showCreatePaneControl,
  createPaneNameInputRef,
}: UsePaneControlEffectsParams): void => {
  useEffect(() => {
    if (previousOpenedFromPinnedRef.current !== openedFromPinned) {
      setShowPaneSwitcher(!openedFromPinned);
    }
    previousOpenedFromPinnedRef.current = openedFromPinned;
  }, [openedFromPinned, previousOpenedFromPinnedRef, setShowPaneSwitcher]);

  useEffect(() => {
    if (!showCreatePaneControl) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      createPaneNameInputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [createPaneNameInputRef, showCreatePaneControl]);
};
