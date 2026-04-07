import { useEffect } from 'react';
import type { ToolbarDialog } from '../../appShellUtils';

interface UseTasksDialogEffectsArgs {
  toolbarDialog: ToolbarDialog;
  refreshQuickNavTasks: () => Promise<void>;
}

export const useTasksDialogEffects = ({
  toolbarDialog,
  refreshQuickNavTasks,
}: UseTasksDialogEffectsArgs) => {
  useEffect(() => {
    if (toolbarDialog !== 'tasks') {
      return;
    }
    void refreshQuickNavTasks();
  }, [toolbarDialog, refreshQuickNavTasks]);
};
