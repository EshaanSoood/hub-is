import { RemindersModuleSkin } from '../../../project-space/RemindersModuleSkin';
import { Dialog } from '../../../primitives';
import type { BottomToolbarProps } from '../types';

type RemindersDialogProps = Pick<
  BottomToolbarProps,
  | 'toolbarDialog'
  | 'closeQuickNavPanel'
  | 'quickNavTriggerRef'
  | 'remindersRuntime'
  | 'onSnoozeReminderFromModule'
  | 'onCreateReminderFromModule'
>;

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
