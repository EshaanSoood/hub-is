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
  quickAddDialog: QuickAddDialog;
  skipContextMenuFocusRestoreRef: MutableRefObject<boolean>;
  toolbarDialog: ToolbarDialog;
}

export const useToolbarFocusEffects = ({
  captureOpen,
  contextMenuOpen,
  contextMenuRef,
  contextMenuTriggerRef,
  contextMenuWasOpenRef,
  quickAddDialog,
  skipContextMenuFocusRestoreRef,
  toolbarDialog,
}: UseToolbarFocusEffectsArgs) => {
  useEffect(() => {
    if (contextMenuOpen) {
      focusFirstDescendantSoon(contextMenuRef.current, '[role="menuitem"]');
    } else if (
      contextMenuWasOpenRef.current
      && !skipContextMenuFocusRestoreRef.current
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refs are stable object identities; only .current changes.
  }, [captureOpen, contextMenuOpen, quickAddDialog, toolbarDialog]);
};
