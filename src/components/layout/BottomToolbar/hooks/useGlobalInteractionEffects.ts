import { useEffect, type MutableRefObject } from 'react';
import type { CloseContextMenuOptions, CloseNotificationsOptions, CloseProfileOptions, CloseQuickNavOptions } from '../types';
import { isTextInputElement, type QuickAddDialog, type ToolbarDialog } from '../../appShellUtils';

interface UseGlobalInteractionEffectsArgs {
  closeCapturePanel: (options?: { restoreFocus?: boolean }) => void;
  closeQuickNav: (options?: CloseQuickNavOptions) => void;
  closeQuickNavPanel: () => void;
  openQuickNavPanel: (panel: Exclude<ToolbarDialog, null>) => void;
  closeProfile: (options?: CloseProfileOptions) => void;
  closeSearch: () => void;
  closeNotifications: (options?: CloseNotificationsOptions) => void;
  closeContextMenu: (options?: CloseContextMenuOptions) => void;
  contextMenuOpen: boolean;
  contextMenuRef: MutableRefObject<HTMLDivElement | null>;
  quickAddDialog: QuickAddDialog;
}

export const useGlobalInteractionEffects = ({
  closeCapturePanel,
  closeQuickNav,
  closeQuickNavPanel,
  openQuickNavPanel,
  closeProfile,
  closeSearch,
  closeNotifications,
  closeContextMenu,
  contextMenuOpen,
  contextMenuRef,
  quickAddDialog,
}: UseGlobalInteractionEffectsArgs) => {
  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;

      if (contextMenuOpen && contextMenuRef.current && !contextMenuRef.current.contains(target)) {
        closeContextMenu({ restoreFocus: false });
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
        closeNotifications();
        closeQuickNav();
        closeQuickNavPanel();
        closeProfile();
        closeContextMenu();
      }
    };

    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [closeCapturePanel, closeContextMenu, closeNotifications, closeProfile, closeQuickNav, closeQuickNavPanel, closeSearch, contextMenuOpen, contextMenuRef, openQuickNavPanel, quickAddDialog]);
};
