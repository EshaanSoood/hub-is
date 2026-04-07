import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { CloseNotificationsOptions } from '../../BottomToolbar';
import { isTextInputElement, type QuickAddDialog, type ToolbarDialog } from '../../appShellUtils';

interface UseGlobalInteractionEffectsArgs {
  closeCapturePanel: (options?: { restoreFocus?: boolean }) => void;
  closeQuickNav: () => void;
  closeQuickNavPanel: () => void;
  openQuickNavPanel: (panel: Exclude<ToolbarDialog, null>) => void;
  closeProfile: () => void;
  closeSearch: () => void;
  closeNotifications: (options?: CloseNotificationsOptions) => void;
  contextMenuOpen: boolean;
  contextMenuRef: MutableRefObject<HTMLDivElement | null>;
  quickAddDialog: QuickAddDialog;
  setContextMenuOpen: Dispatch<SetStateAction<boolean>>;
}

export const useGlobalInteractionEffects = ({
  closeCapturePanel,
  closeQuickNav,
  closeQuickNavPanel,
  openQuickNavPanel,
  closeProfile,
  closeSearch,
  closeNotifications,
  contextMenuOpen,
  contextMenuRef,
  quickAddDialog,
  setContextMenuOpen,
}: UseGlobalInteractionEffectsArgs) => {
  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;

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
        closeNotifications();
        closeQuickNav();
        closeQuickNavPanel();
        closeProfile();
        setContextMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [closeCapturePanel, closeNotifications, closeProfile, closeQuickNav, closeQuickNavPanel, closeSearch, contextMenuOpen, openQuickNavPanel, quickAddDialog]);
};
