import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';

const ensureProgrammaticFocusability = (element: HTMLElement) => {
  if (!element.hasAttribute('tabindex')) {
    element.setAttribute('tabindex', '-1');
  }
};

export const useRouteFocusReset = () => {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      const mainContent = document.getElementById('main-content');
      if (!(mainContent instanceof HTMLElement)) {
        return;
      }

      const activeElement = document.activeElement;
      if (
        activeElement instanceof HTMLElement
        && activeElement !== document.body
        && activeElement !== document.documentElement
        && (
          mainContent.contains(activeElement)
          || activeElement.closest('[role="dialog"], [aria-modal="true"]')
        )
      ) {
        return;
      }

      const heading = mainContent.querySelector('h1');
      const focusTarget = heading instanceof HTMLElement ? heading : mainContent;
      ensureProgrammaticFocusability(focusTarget);
      focusTarget.focus();
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [pathname]);
};
