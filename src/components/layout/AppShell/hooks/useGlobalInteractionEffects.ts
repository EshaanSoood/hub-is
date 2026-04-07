import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { isTextInputElement, type QuickAddDialog, type ToolbarDialog } from '../../appShellUtils';

interface UseGlobalInteractionEffectsArgs {
  closeCapturePanel: (options?: { restoreFocus?: boolean }) => void;
  closeQuickNav: () => void;
  closeQuickNavPanel: () => void;
  closeSearch: () => void;
  contextMenuOpen: boolean;
  contextMenuRef: MutableRefObject<HTMLDivElement | null>;
  notificationsOpen: boolean;
  notificationsRef: MutableRefObject<HTMLDivElement | null>;
  openQuickNavPanel: (panel: Exclude<ToolbarDialog, null>) => void;
  profileOpen: boolean;
  profileRef: MutableRefObject<HTMLDivElement | null>;
  quickAddDialog: QuickAddDialog;
  quickNavOpen: boolean;
  quickNavRef: MutableRefObject<HTMLDivElement | null>;
  searchOpen: boolean;
  searchRef: MutableRefObject<HTMLDivElement | null>;
  setContextMenuOpen: Dispatch<SetStateAction<boolean>>;
  setNotificationsOpen: Dispatch<SetStateAction<boolean>>;
  setProfileOpen: Dispatch<SetStateAction<boolean>>;
}

export const useGlobalInteractionEffects = ({
  closeCapturePanel,
  closeQuickNav,
  closeQuickNavPanel,
  closeSearch,
  contextMenuOpen,
  contextMenuRef,
  notificationsOpen,
  notificationsRef,
  openQuickNavPanel,
  profileOpen,
  profileRef,
  quickAddDialog,
  quickNavOpen,
  quickNavRef,
  searchOpen,
  searchRef,
  setContextMenuOpen,
  setNotificationsOpen,
  setProfileOpen,
}: UseGlobalInteractionEffectsArgs) => {
  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;

      if (quickNavOpen && quickNavRef.current && !quickNavRef.current.contains(target)) {
        closeQuickNav();
      }
      if (searchOpen && searchRef.current && !searchRef.current.contains(target)) {
        closeSearch();
      }
      if (profileOpen && profileRef.current && !profileRef.current.contains(target)) {
        setProfileOpen(false);
      }
      if (notificationsOpen && notificationsRef.current && !notificationsRef.current.contains(target)) {
        setNotificationsOpen(false);
      }
      if (contextMenuOpen && contextMenuRef.current && !contextMenuRef.current.contains(target)) {
        setContextMenuOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (!quickAddDialog && !isTextInputElement(event.target) && event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey) {
        if (event.key.toLowerCase() === 'c') {
          event.preventDefault();
          openQuickNavPanel('calendar');
          return;
        }
        if (event.key.toLowerCase() === 't') {
          event.preventDefault();
          openQuickNavPanel('tasks');
          return;
        }
        if (event.key.toLowerCase() === 'r') {
          event.preventDefault();
          openQuickNavPanel('reminders');
          return;
        }
      }
      if (event.key === 'Escape') {
        closeCapturePanel();
        closeSearch();
        closeQuickNav();
        closeQuickNavPanel();
        setProfileOpen(false);
        setNotificationsOpen(false);
        setContextMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [closeCapturePanel, closeQuickNav, closeQuickNavPanel, closeSearch, contextMenuOpen, notificationsOpen, openQuickNavPanel, profileOpen, quickAddDialog, quickNavOpen, searchOpen]);
};
