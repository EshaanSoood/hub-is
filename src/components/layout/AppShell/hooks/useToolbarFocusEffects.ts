import { useEffect, type MutableRefObject } from 'react';
import {
  focusElementSoon,
  focusFirstDescendantSoon,
  type QuickAddDialog,
  type ToolbarDialog,
} from '../../appShellUtils';

interface UseToolbarFocusEffectsArgs {
  captureOpen: boolean;
  contextMenuOpen: boolean;
  contextMenuRef: MutableRefObject<HTMLDivElement | null>;
  contextMenuTriggerRef: MutableRefObject<HTMLButtonElement | null>;
  contextMenuWasOpenRef: MutableRefObject<boolean>;
  profileMenuRef: MutableRefObject<HTMLDivElement | null>;
  profileOpen: boolean;
  profileTriggerRef: MutableRefObject<HTMLButtonElement | null>;
  profileWasOpenRef: MutableRefObject<boolean>;
  quickAddDialog: QuickAddDialog;
  quickNavOpen: boolean;
  skipContextMenuFocusRestoreRef: MutableRefObject<boolean>;
  skipProfileFocusRestoreRef: MutableRefObject<boolean>;
  toolbarDialog: ToolbarDialog;
}

export const useToolbarFocusEffects = ({
  captureOpen,
  contextMenuOpen,
  contextMenuRef,
  contextMenuTriggerRef,
  contextMenuWasOpenRef,
  profileMenuRef,
  profileOpen,
  profileTriggerRef,
  profileWasOpenRef,
  quickAddDialog,
  quickNavOpen,
  skipContextMenuFocusRestoreRef,
  skipProfileFocusRestoreRef,
  toolbarDialog,
}: UseToolbarFocusEffectsArgs) => {
  useEffect(() => {
    if (profileOpen) {
      focusFirstDescendantSoon(profileMenuRef.current, '[role="menuitem"]');
    } else if (
      profileWasOpenRef.current
      && !skipProfileFocusRestoreRef.current
      && !quickNavOpen
      && !contextMenuOpen
      && !captureOpen
      && !toolbarDialog
      && !quickAddDialog
    ) {
      focusElementSoon(profileTriggerRef.current);
    }
    if (!profileOpen) {
      skipProfileFocusRestoreRef.current = false;
    }
    profileWasOpenRef.current = profileOpen;
  }, [captureOpen, contextMenuOpen, profileOpen, quickAddDialog, quickNavOpen, toolbarDialog]);

  useEffect(() => {
    if (contextMenuOpen) {
      focusFirstDescendantSoon(contextMenuRef.current, '[role="menuitem"]');
    } else if (
      contextMenuWasOpenRef.current
      && !skipContextMenuFocusRestoreRef.current
      && !quickNavOpen
      && !profileOpen
      && !captureOpen
      && !toolbarDialog
      && !quickAddDialog
    ) {
      focusElementSoon(contextMenuTriggerRef.current);
    }
    if (!contextMenuOpen) {
      skipContextMenuFocusRestoreRef.current = false;
    }
    contextMenuWasOpenRef.current = contextMenuOpen;
  }, [captureOpen, contextMenuOpen, profileOpen, quickAddDialog, quickNavOpen, toolbarDialog]);
};
