import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { subscribeQuickAddProjectRequest } from '../../../../lib/quickAddProjectRequest';
import type { QuickAddDialog } from '../../appShellUtils';

interface UseQuickAddProjectRequestEffectArgs {
  closeCapturePanel: (options?: { restoreFocus?: boolean }) => void;
  closeQuickNav: () => void;
  closeQuickNavPanel: () => void;
  closeSearch: () => void;
  closeNotifications: (options?: { restoreFocus?: boolean }) => void;
  openQuickAddDialog: (dialogType: Exclude<QuickAddDialog, null>) => Promise<void>;
  setProfileOpen: Dispatch<SetStateAction<boolean>>;
  setContextMenuOpen: Dispatch<SetStateAction<boolean>>;
  skipQuickNavFocusRestoreRef: MutableRefObject<boolean>;
  skipProfileFocusRestoreRef: MutableRefObject<boolean>;
  skipContextMenuFocusRestoreRef: MutableRefObject<boolean>;
}

export const useQuickAddProjectRequestEffect = ({
  closeCapturePanel,
  closeQuickNav,
  closeQuickNavPanel,
  closeSearch,
  closeNotifications,
  openQuickAddDialog,
  setProfileOpen,
  setContextMenuOpen,
  skipQuickNavFocusRestoreRef,
  skipProfileFocusRestoreRef,
  skipContextMenuFocusRestoreRef,
}: UseQuickAddProjectRequestEffectArgs) => {
  useEffect(
    () => subscribeQuickAddProjectRequest(() => {
      skipQuickNavFocusRestoreRef.current = true;
      closeQuickNav();
      skipProfileFocusRestoreRef.current = true;
      skipContextMenuFocusRestoreRef.current = true;
      closeQuickNavPanel();
      closeSearch();
      closeNotifications({ restoreFocus: false });
      setProfileOpen(false);
      setContextMenuOpen(false);
      closeCapturePanel({ restoreFocus: false });
      void openQuickAddDialog('project');
    }),
    [closeCapturePanel, closeNotifications, closeQuickNav, closeQuickNavPanel, closeSearch, openQuickAddDialog],
  );
};
