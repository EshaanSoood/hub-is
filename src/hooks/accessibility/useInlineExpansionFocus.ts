import { type RefObject, useEffect } from 'react';
import { focusElement, readTextSelection, restoreTextSelection } from '../../lib/accessibility/focus';

interface UseInlineExpansionFocusParams {
  anchorRef: RefObject<HTMLElement | null>;
  active: boolean;
  expansionKey?: string | number | boolean | null;
  enabled?: boolean;
}

export const useInlineExpansionFocus = ({
  anchorRef,
  active,
  expansionKey,
  enabled = true,
}: UseInlineExpansionFocusParams): void => {
  useEffect(() => {
    if (!enabled || !active) {
      return;
    }
    const anchor = anchorRef.current;
    if (!anchor || document.activeElement !== anchor) {
      return;
    }
    const selection = readTextSelection(anchor);
    const frameId = window.requestAnimationFrame(() => {
      const nextAnchor = anchorRef.current;
      if (!nextAnchor || document.activeElement === nextAnchor) {
        return;
      }
      if (focusElement(nextAnchor)) {
        restoreTextSelection(nextAnchor, selection);
      }
    });
    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [active, anchorRef, enabled, expansionKey]);
};
