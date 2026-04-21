export type DialogOpenFocusMode = 'first-control' | 'title' | 'none';
export type DialogOpenIntent = 'user' | 'system';

const DIALOG_AUTOFOCUS_SELECTOR = '[data-dialog-autofocus]';
const DIALOG_TITLE_SELECTOR = '[data-dialog-title]';
const DIALOG_CONTROL_SELECTOR = [
  'input:not([type="hidden"]):not([disabled])',
  'textarea:not([disabled])',
  'select:not([disabled])',
  'button:not([disabled])',
  '[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

const isHtmlElement = (value: unknown): value is HTMLElement => value instanceof HTMLElement;

const isProgrammaticallyFocusable = (element: HTMLElement): boolean => {
  if (element.matches(DIALOG_CONTROL_SELECTOR)) {
    return true;
  }
  return element.tabIndex >= 0;
};

const isVisible = (element: HTMLElement): boolean => {
  if (element.hidden || element.getAttribute('aria-hidden') === 'true') {
    return false;
  }
  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden') {
    return false;
  }
  return element.getClientRects().length > 0;
};

const isFocusableCandidate = (element: HTMLElement | null): element is HTMLElement =>
  Boolean(element && isVisible(element));

const preserveTemporaryTabIndex = (element: HTMLElement) => {
  if (isProgrammaticallyFocusable(element)) {
    return;
  }
  const hadTabIndex = element.hasAttribute('tabindex');
  if (!hadTabIndex) {
    element.setAttribute('tabindex', '-1');
  }
  const cleanup = () => {
    if (!hadTabIndex) {
      element.removeAttribute('tabindex');
    }
  };
  element.addEventListener('blur', cleanup, { once: true });
};

export const focusElement = (element: HTMLElement | null): boolean => {
  if (!element) {
    return false;
  }
  preserveTemporaryTabIndex(element);
  element.focus({ preventScroll: true });
  return document.activeElement === element;
};

export const findDialogAutoFocusTarget = (
  container: HTMLElement,
  mode: Exclude<DialogOpenFocusMode, 'none'> = 'first-control',
): HTMLElement | null => {
  if (mode === 'title') {
    const title = container.querySelector<HTMLElement>(DIALOG_TITLE_SELECTOR);
    return isFocusableCandidate(title) ? title : container;
  }

  const autofocusTarget = container.querySelector<HTMLElement>(DIALOG_AUTOFOCUS_SELECTOR);
  if (isFocusableCandidate(autofocusTarget)) {
    return autofocusTarget;
  }

  const controls = Array.from(container.querySelectorAll<HTMLElement>(DIALOG_CONTROL_SELECTOR));
  const firstControl = controls.find((element) => isFocusableCandidate(element));
  if (firstControl) {
    return firstControl;
  }

  const title = container.querySelector<HTMLElement>(DIALOG_TITLE_SELECTOR);
  if (isFocusableCandidate(title)) {
    return title;
  }

  return container;
};

export const applyDialogOpenFocus = ({
  container,
  intent = 'user',
  mode = 'first-control',
}: {
  container: EventTarget | null;
  intent?: DialogOpenIntent;
  mode?: DialogOpenFocusMode;
}): boolean => {
  if (intent === 'system' || mode === 'none' || !isHtmlElement(container)) {
    return false;
  }
  const target = findDialogAutoFocusTarget(container, mode);
  return focusElement(target);
};

export const restoreTextSelection = (
  element: HTMLElement | null,
  selection: {
    start: number | null;
    end: number | null;
    direction: 'forward' | 'backward' | 'none' | null;
  },
) => {
  if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
    return;
  }
  if (selection.start === null || selection.end === null) {
    return;
  }
  element.setSelectionRange(selection.start, selection.end, selection.direction ?? undefined);
};

export const readTextSelection = (element: HTMLElement | null) => {
  if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
    return {
      start: null,
      end: null,
      direction: null,
    } as const;
  }
  return {
    start: element.selectionStart,
    end: element.selectionEnd,
    direction: element.selectionDirection,
  } as const;
};
