export interface ElementRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export const resolveInspectorFocusTarget = (candidate: HTMLElement | null): HTMLElement | null => {
  if (candidate && candidate.isConnected) {
    return candidate;
  }
  const mainContent = document.getElementById('main-content');
  if (mainContent instanceof HTMLElement) {
    if (!mainContent.hasAttribute('tabindex')) {
      mainContent.setAttribute('tabindex', '-1');
    }
    return mainContent;
  }
  return null;
};

export const getActiveInspectorFocusTarget = (): HTMLElement | null => {
  if (document.activeElement instanceof HTMLElement && document.activeElement !== document.body) {
    return document.activeElement;
  }
  return resolveInspectorFocusTarget(null);
};

export const readElementRect = (element: HTMLElement | null): ElementRect | null => {
  if (!element || !element.isConnected) {
    return null;
  }
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
};
