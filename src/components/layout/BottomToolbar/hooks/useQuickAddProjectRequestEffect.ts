import { useEffect } from 'react';
import { subscribeQuickAddProjectRequest } from '../../../../lib/quickAddProjectRequest';
import type {
  CloseContextMenuOptions,
  CloseNotificationsOptions,
  CloseProfileOptions,
  CloseQuickNavOptions,
} from '../types';
import type { QuickAddDialog } from '../../appShellUtils';

interface UseQuickAddProjectRequestEffectArgs {
  closeCapturePanel: (options?: { restoreFocus?: boolean }) => void;
  closeQuickNav: (options?: CloseQuickNavOptions) => void;
  closeQuickNavPanel: () => void;
  closeProfile: (options?: CloseProfileOptions) => void;
  closeContextMenu: (options?: CloseContextMenuOptions) => void;
  closeSearch: () => void;
  closeNotifications: (options?: CloseNotificationsOptions) => void;
  openQuickAddDialog: (dialogType: Exclude<QuickAddDialog, null>) => Promise<void>;
}

export const useQuickAddProjectRequestEffect = ({
  closeCapturePanel,
  closeQuickNav,
  closeQuickNavPanel,
  closeProfile,
  closeContextMenu,
  closeSearch,
  closeNotifications,
  openQuickAddDialog,
}: UseQuickAddProjectRequestEffectArgs) => {
  useEffect(
    () => subscribeQuickAddProjectRequest(() => {
      closeQuickNav({ restoreFocus: false });
      closeQuickNavPanel();
      closeProfile({ restoreFocus: false });
      closeContextMenu({ restoreFocus: false });
      closeSearch();
      closeNotifications({ restoreFocus: false });
      closeCapturePanel({ restoreFocus: false });
      void openQuickAddDialog('project');
    }),
    [
      closeCapturePanel,
      closeContextMenu,
      closeNotifications,
      closeProfile,
      closeQuickNav,
      closeQuickNavPanel,
      closeSearch,
      openQuickAddDialog,
    ],
  );
};
