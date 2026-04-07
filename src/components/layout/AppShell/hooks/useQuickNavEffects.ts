import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import {
  focusElementSoon,
  isTextInputElement,
  type QuickAddDialog,
  type QuickNavActionItem,
  type ToolbarDialog,
} from '../../appShellUtils';

interface UseQuickNavEffectsArgs {
  captureOpen: boolean;
  closeQuickNav: () => void;
  contextMenuOpen: boolean;
  navigate: NavigateFunction;
  normalizedQuickNavActiveIndex: number;
  openQuickNavPanel: (panel: Exclude<ToolbarDialog, null>) => void;
  profileOpen: boolean;
  quickAddDialog: QuickAddDialog;
  quickNavInputRef: MutableRefObject<HTMLInputElement | null>;
  quickNavItems: QuickNavActionItem[];
  quickNavOpen: boolean;
  quickNavTriggerRef: MutableRefObject<HTMLButtonElement | null>;
  quickNavWasOpenRef: MutableRefObject<boolean>;
  setQuickNavActiveIndex: Dispatch<SetStateAction<number>>;
  setQuickNavQuery: Dispatch<SetStateAction<string>>;
  setToolbarDialog: Dispatch<SetStateAction<ToolbarDialog>>;
  skipQuickNavFocusRestoreRef: MutableRefObject<boolean>;
  toolbarDialog: ToolbarDialog;
}

export const useQuickNavEffects = ({
  captureOpen,
  closeQuickNav,
  contextMenuOpen,
  navigate,
  normalizedQuickNavActiveIndex,
  openQuickNavPanel,
  profileOpen,
  quickAddDialog,
  quickNavInputRef,
  quickNavItems,
  quickNavOpen,
  quickNavTriggerRef,
  quickNavWasOpenRef,
  setQuickNavActiveIndex,
  setQuickNavQuery,
  setToolbarDialog,
  skipQuickNavFocusRestoreRef,
  toolbarDialog,
}: UseQuickNavEffectsArgs) => {
  useEffect(() => {
    if (!quickNavOpen) {
      return;
    }

    const onQuickNavKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setQuickNavActiveIndex((current) => {
          if (quickNavItems.length === 0) {
            return -1;
          }
          const nextIndex = current < 0 ? 0 : current + 1;
          return nextIndex >= quickNavItems.length ? 0 : nextIndex;
        });
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setQuickNavActiveIndex((current) => {
          if (quickNavItems.length === 0) {
            return -1;
          }
          if (current <= 0) {
            return quickNavItems.length - 1;
          }
          return current - 1;
        });
        return;
      }

      if (event.key === 'Enter' && normalizedQuickNavActiveIndex >= 0 && quickNavItems[normalizedQuickNavActiveIndex]) {
        event.preventDefault();
        const selectedItem = quickNavItems[normalizedQuickNavActiveIndex];
        if (!selectedItem) {
          return;
        }
        skipQuickNavFocusRestoreRef.current = true;
        if (selectedItem.action === 'panel') {
          openQuickNavPanel(selectedItem.panel);
          return;
        }
        setToolbarDialog(null);
        navigate(selectedItem.href);
        closeQuickNav();
        return;
      }

      if (event.key.length === 1 && !isTextInputElement(event.target)) {
        event.preventDefault();
        setQuickNavQuery((current) => `${current}${event.key}`);
      }
    };

    document.addEventListener('keydown', onQuickNavKeyDown);
    return () => {
      document.removeEventListener('keydown', onQuickNavKeyDown);
    };
  }, [closeQuickNav, navigate, normalizedQuickNavActiveIndex, openQuickNavPanel, quickNavItems, quickNavOpen]);

  useEffect(() => {
    if (quickNavOpen) {
      focusElementSoon(quickNavInputRef.current);
    } else if (
      quickNavWasOpenRef.current
      && !skipQuickNavFocusRestoreRef.current
      && !profileOpen
      && !contextMenuOpen
      && !captureOpen
      && !toolbarDialog
      && !quickAddDialog
    ) {
      focusElementSoon(quickNavTriggerRef.current);
    }
    if (!quickNavOpen) {
      skipQuickNavFocusRestoreRef.current = false;
    }
    quickNavWasOpenRef.current = quickNavOpen;
  }, [captureOpen, contextMenuOpen, profileOpen, quickAddDialog, quickNavOpen, toolbarDialog]);
};
