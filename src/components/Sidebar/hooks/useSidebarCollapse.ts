import { useCallback, useEffect, useState } from 'react';
import { isTextInputElement } from '../../layout/appShellUtils';

const SIDEBAR_COLLAPSE_STORAGE_KEY = 'hub-sidebar-collapsed';

const readStoredSidebarCollapsed = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSE_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
};

export const useSidebarCollapse = () => {
  const [isCollapsed, setIsCollapsed] = useState(readStoredSidebarCollapsed);

  const toggleSidebar = useCallback(() => {
    setIsCollapsed((current) => !current);
  }, []);

  const collapseSidebar = useCallback(() => {
    setIsCollapsed(true);
  }, []);

  const expandSidebar = useCallback(() => {
    setIsCollapsed(false);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_COLLAPSE_STORAGE_KEY, String(isCollapsed));
    } catch {
      // Ignore storage failures so the sidebar still works in restricted environments.
    }
  }, [isCollapsed]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.altKey || event.shiftKey) {
        return;
      }

      if (!(event.metaKey || event.ctrlKey) || event.code !== 'Backslash') {
        return;
      }

      if (isTextInputElement(event.target)) {
        return;
      }

      event.preventDefault();
      toggleSidebar();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [toggleSidebar]);

  return {
    isCollapsed,
    toggleSidebar,
    collapseSidebar,
    expandSidebar,
  };
};
