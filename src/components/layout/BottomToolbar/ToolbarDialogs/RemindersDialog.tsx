import type { ComponentProps, MutableRefObject } from 'react';
import { dialogLayoutIds } from '../../../../styles/motion';
import { RemindersModuleSkin } from '../../../project-space/RemindersModuleSkin';
import { Dialog } from '../../../primitives';
import type { ToolbarDialog } from '../../appShellUtils';

interface RemindersDialogProps {
  toolbarDialog: ToolbarDialog;
  closeQuickNavPanel: () => void;
  triggerRef: MutableRefObject<HTMLButtonElement | null>;
  remindersRuntime: {
    reminders: ComponentProps<typeof RemindersModuleSkin>['reminders'];
    loading: ComponentProps<typeof RemindersModuleSkin>['loading'];
    error: ComponentProps<typeof RemindersModuleSkin>['error'];
    dismiss: ComponentProps<typeof RemindersModuleSkin>['onDismiss'];
  };
  onSnoozeReminderFromModule: ComponentProps<typeof RemindersModuleSkin>['onSnooze'];
  onCreateReminderFromModule: ComponentProps<typeof RemindersModuleSkin>['onCreate'];
}

export const RemindersDialog = ({
  toolbarDialog,
  closeQuickNavPanel,
  triggerRef,
  remindersRuntime,
  onSnoozeReminderFromModule,
  onCreateReminderFromModule,
}: RemindersDialogProps) => (
  <Dialog
    open={toolbarDialog === 'reminders'}
    onClose={closeQuickNavPanel}
    triggerRef={triggerRef}
    layoutId={dialogLayoutIds.toolbarReminders}
    title="Reminders"
    description="Your active reminders."
    panelClassName="dialog-panel-compact-size"
  >
    <div id="toolbar-reminders-panel">
      <RemindersModuleSkin
        sizeTier="L"
        reminders={remindersRuntime.reminders}
        loading={remindersRuntime.loading}
        error={remindersRuntime.error}
        onDismiss={remindersRuntime.dismiss}
        onSnooze={onSnoozeReminderFromModule}
        onCreate={onCreateReminderFromModule}
      />
    </div>
  </Dialog>
);
