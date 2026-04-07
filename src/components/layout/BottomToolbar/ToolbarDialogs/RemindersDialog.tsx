import type { ComponentProps, MutableRefObject } from 'react';
import { RemindersModuleSkin } from '../../../project-space/RemindersModuleSkin';
import { Dialog } from '../../../primitives';
import type { ToolbarDialog } from '../../appShellUtils';

interface RemindersDialogProps {
  toolbarDialog: ToolbarDialog;
  closeQuickNavPanel: () => void;
  quickNavTriggerRef: MutableRefObject<HTMLButtonElement | null>;
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
  quickNavTriggerRef,
  remindersRuntime,
  onSnoozeReminderFromModule,
  onCreateReminderFromModule,
}: RemindersDialogProps) => (
  <Dialog
    open={toolbarDialog === 'reminders'}
    onClose={closeQuickNavPanel}
    triggerRef={quickNavTriggerRef}
    title="Reminders"
    description="Your active reminders."
    panelClassName="dialog-panel-compact-size"
  >
    <RemindersModuleSkin
      sizeTier="L"
      reminders={remindersRuntime.reminders}
      loading={remindersRuntime.loading}
      error={remindersRuntime.error}
      onDismiss={remindersRuntime.dismiss}
      onSnooze={onSnoozeReminderFromModule}
      onCreate={onCreateReminderFromModule}
    />
  </Dialog>
);
