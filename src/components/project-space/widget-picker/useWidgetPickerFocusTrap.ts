import { useLayoutEffect, type RefObject } from 'react';

const AUTOFOCUS_SELECTOR = '[data-dialog-autofocus]';
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

const isVisible = (element: HTMLElement): boolean => {
  if (element.hidden || element.closest('[hidden],[inert],[aria-hidden="true"]')) {
    return false;
  }
  const style = window.getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
};

const focusableElements = (container: HTMLElement): HTMLElement[] =>
  Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(isVisible);

const initialFocusElement = (container: HTMLElement): HTMLElement => {
  const autofocusTarget = container.querySelector<HTMLElement>(AUTOFOCUS_SELECTOR);
  if (autofocusTarget && isVisible(autofocusTarget)) {
    return autofocusTarget;
  }
  const [first] = focusableElements(container);
  return first ?? container;
};

const focusFirst = (container: HTMLElement): void => {
  initialFocusElement(container).focus({ preventScroll: true });
};

export const useWidgetPickerFocusTrap = (open: boolean, containerRef: RefObject<HTMLElement | null>) => {
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!open || !container) {
      return undefined;
    }

    focusFirst(container);
    const focusFrame = window.requestAnimationFrame(() => focusFirst(container));

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') {
        return;
      }

      const focusable = focusableElements(container);
      if (focusable.length === 0) {
        event.preventDefault();
        container.focus({ preventScroll: true });
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      const activeInside = active instanceof HTMLElement && container.contains(active);

      if (event.shiftKey && (!activeInside || active === first)) {
        event.preventDefault();
        last.focus({ preventScroll: true });
        return;
      }

      if (!event.shiftKey && (!activeInside || active === last)) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    };

    const onFocusIn = (event: FocusEvent) => {
      if (event.target instanceof Node && !container.contains(event.target)) {
        focusFirst(container);
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('focusin', onFocusIn, true);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('focusin', onFocusIn, true);
    };
  }, [containerRef, open]);
};
