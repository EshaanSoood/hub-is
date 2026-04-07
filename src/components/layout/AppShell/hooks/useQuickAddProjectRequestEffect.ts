import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { subscribeQuickAddProjectRequest } from '../../../../lib/quickAddProjectRequest';
import type { QuickAddDialog } from '../../appShellUtils';

interface UseQuickAddProjectRequestEffectArgs {
  closeCapturePanel: (options?: { restoreFocus?: boolean }) => void;
  closeQuickNav: () => void;
  closeQuickNavPanel: () => void;
  closeSearch: () => void;
  openQuickAddDialog: (dialogType: Exclude<QuickAddDialog, null>) => Promise<void>;
  setProfileOpen: Dispatch<SetStateAction<boolean>>;
  setNotificationsOpen: Dispatch<SetStateAction<boolean>>;
  setContextMenuOpen: Dispatch<SetStateAction<boolean>>;
  skipQuickNavFocusRestoreRef: MutableRefObject<boolean>;
  skipProfileFocusRestoreRef: MutableRefObject<boolean>;
  skipNotificationsFocusRestoreRef: MutableRefObject<boolean>;
  skipContextMenuFocusRestoreRef: MutableRefObject<boolean>;
}

export const useQuickAddProjectRequestEffect = ({
  closeCapturePanel,
  closeQuickNav,
  closeQuickNavPanel,
  closeSearch,
  openQuickAddDialog,
  setProfileOpen,
  setNotificationsOpen,
  setContextMenuOpen,
  skipQuickNavFocusRestoreRef,
  skipProfileFocusRestoreRef,
  skipNotificationsFocusRestoreRef,
  skipContextMenuFocusRestoreRef,
}: UseQuickAddProjectRequestEffectArgs) => {
  useEffect(
    () => subscribeQuickAddProjectRequest(() => {
      skipQuickNavFocusRestoreRef.current = true;
      closeQuickNav();
      skipProfileFocusRestoreRef.current = true;
      skipNotificationsFocusRestoreRef.current = true;
      skipContextMenuFocusRestoreRef.current = true;
      closeQuickNavPanel();
      closeSearch();
      setProfileOpen(false);
      setNotificationsOpen(false);
      setContextMenuOpen(false);
      closeCapturePanel({ restoreFocus: false });
      void openQuickAddDialog('project');
    }),
    [closeCapturePanel, closeQuickNav, closeQuickNavPanel, closeSearch, openQuickAddDialog],
  );
};
