export const focusWhenReady = (
  getElement: () => HTMLElement | null,
  maxAttempts = 10,
): (() => void) => {
  let cancelled = false;
  let frameId = 0;
  let attempts = 0;

  const focus = () => {
    if (cancelled) {
      return;
    }
    const element = getElement();
    if (element) {
      element.focus();
      return;
    }
    attempts += 1;
    if (attempts >= maxAttempts) {
      return;
    }
    frameId = window.requestAnimationFrame(focus);
  };

  frameId = window.requestAnimationFrame(focus);

  return () => {
    cancelled = true;
    window.cancelAnimationFrame(frameId);
  };
};
