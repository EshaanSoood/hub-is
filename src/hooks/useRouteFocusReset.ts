import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const ensureProgrammaticFocusability = (element: HTMLElement) => {
  if (!element.hasAttribute('tabindex')) {
    element.setAttribute('tabindex', '-1');
  }
};

export const useRouteFocusReset = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    let timeoutId: number | null = null;
    const frameId = window.requestAnimationFrame(() => {
      timeoutId = window.setTimeout(() => {
        const mainContent = document.getElementById('main-content');
        if (!(mainContent instanceof HTMLElement)) {
          return;
        }

        const heading = mainContent.querySelector('h1');
        const focusTarget = heading instanceof HTMLElement ? heading : mainContent;
        ensureProgrammaticFocusability(focusTarget);
        focusTarget.focus();
      }, 0);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [pathname]);
};
