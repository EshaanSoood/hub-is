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
  notificationsOpen: boolean;
  notificationsPanelRef: MutableRefObject<HTMLDivElement | null>;
  notificationsTriggerRef: MutableRefObject<HTMLButtonElement | null>;
  notificationsWereOpenRef: MutableRefObject<boolean>;
  profileMenuRef: MutableRefObject<HTMLDivElement | null>;
  profileOpen: boolean;
  profileTriggerRef: MutableRefObject<HTMLButtonElement | null>;
  profileWasOpenRef: MutableRefObject<boolean>;
  quickAddDialog: QuickAddDialog;
  quickNavOpen: boolean;
  searchOpen: boolean;
  skipContextMenuFocusRestoreRef: MutableRefObject<boolean>;
  skipNotificationsFocusRestoreRef: MutableRefObject<boolean>;
  skipProfileFocusRestoreRef: MutableRefObject<boolean>;
  toolbarDialog: ToolbarDialog;
}

export const useToolbarFocusEffects = ({
  captureOpen,
  contextMenuOpen,
  contextMenuRef,
  contextMenuTriggerRef,
  contextMenuWasOpenRef,
  notificationsOpen,
  notificationsPanelRef,
  notificationsTriggerRef,
  notificationsWereOpenRef,
  profileMenuRef,
  profileOpen,
  profileTriggerRef,
  profileWasOpenRef,
  quickAddDialog,
  quickNavOpen,
  searchOpen,
  skipContextMenuFocusRestoreRef,
  skipNotificationsFocusRestoreRef,
  skipProfileFocusRestoreRef,
  toolbarDialog,
}: UseToolbarFocusEffectsArgs) => {
  useEffect(() => {
    if (notificationsOpen) {
      focusFirstDescendantSoon(
        notificationsPanelRef.current,
        'button:not([disabled]), select:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
    } else if (
      notificationsWereOpenRef.current
      && !skipNotificationsFocusRestoreRef.current
      && !searchOpen
      && !quickNavOpen
      && !profileOpen
      && !contextMenuOpen
      && !captureOpen
      && !toolbarDialog
      && !quickAddDialog
    ) {
      focusElementSoon(notificationsTriggerRef.current);
    }
    if (!notificationsOpen) {
      skipNotificationsFocusRestoreRef.current = false;
    }
    notificationsWereOpenRef.current = notificationsOpen;
  }, [captureOpen, contextMenuOpen, notificationsOpen, profileOpen, quickAddDialog, quickNavOpen, searchOpen, toolbarDialog]);

  useEffect(() => {
    if (profileOpen) {
      focusFirstDescendantSoon(profileMenuRef.current, '[role="menuitem"]');
    } else if (
      profileWasOpenRef.current
      && !skipProfileFocusRestoreRef.current
      && !searchOpen
      && !quickNavOpen
      && !notificationsOpen
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
  }, [captureOpen, contextMenuOpen, notificationsOpen, profileOpen, quickAddDialog, quickNavOpen, searchOpen, toolbarDialog]);

  useEffect(() => {
    if (contextMenuOpen) {
      focusFirstDescendantSoon(contextMenuRef.current, '[role="menuitem"]');
    } else if (
      contextMenuWasOpenRef.current
      && !skipContextMenuFocusRestoreRef.current
      && !searchOpen
      && !quickNavOpen
      && !notificationsOpen
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
  }, [captureOpen, contextMenuOpen, notificationsOpen, profileOpen, quickAddDialog, quickNavOpen, searchOpen, toolbarDialog]);
};
