import { requestHubHomeRefresh } from '../../../../lib/hubHomeRefresh';
import { TaskCreateDialog } from '../../../project-space/TaskCreateDialog';
import { QuickAddEventDialog, QuickAddProjectDialog, QuickAddReminderDialog } from '../../QuickAddDialogs';
import type { UseToolbarQuickAddResult } from '../hooks/useToolbarQuickAdd';

type QuickAddDialogsProps = Pick<
  UseToolbarQuickAddResult,
  | 'quickAddDialog'
  | 'closeQuickAddDialog'
  | 'quickAddProjectId'
  | 'selectedTaskProjectMembers'
  | 'contextMenuTriggerRef'
  | 'quickAddProjectOptions'
  | 'taskTitleInputRef'
  | 'setQuickAddProjectId'
  | 'loadTaskProjectMembers'
  | 'onCreateQuickAddEvent'
  | 'eventTitle'
  | 'setEventTitle'
  | 'eventStartAt'
  | 'setEventStartAt'
  | 'eventEndAt'
  | 'setEventEndAt'
  | 'eventSubmitting'
  | 'eventError'
  | 'eventTitleInputRef'
  | 'reminderDraft'
  | 'setReminderDraft'
  | 'reminderPreview'
  | 'onCreateQuickAddReminder'
  | 'reminderSubmitting'
  | 'reminderError'
  | 'setReminderError'
  | 'reminderInputRef'
  | 'personalReminderProjectLabel'
  | 'projectDialogName'
  | 'setProjectDialogName'
  | 'onCreateQuickAddProject'
  | 'projectDialogSubmitting'
  | 'projectDialogError'
  | 'projectNameInputRef'
> & {
  accessToken: string | null | undefined;
  refreshCaptureData: () => Promise<void>;
};

export const QuickAddDialogs = ({
  quickAddDialog,
  closeQuickAddDialog,
  refreshCaptureData,
  accessToken,
  quickAddProjectId,
  selectedTaskProjectMembers,
  contextMenuTriggerRef,
  quickAddProjectOptions,
  taskTitleInputRef,
  setQuickAddProjectId,
  loadTaskProjectMembers,
  onCreateQuickAddEvent,
  eventTitle,
  setEventTitle,
  eventStartAt,
  setEventStartAt,
  eventEndAt,
  setEventEndAt,
  eventSubmitting,
  eventError,
  eventTitleInputRef,
  reminderDraft,
  setReminderDraft,
  reminderPreview,
  onCreateQuickAddReminder,
  reminderSubmitting,
  reminderError,
  setReminderError,
  reminderInputRef,
  personalReminderProjectLabel,
  projectDialogName,
  setProjectDialogName,
  onCreateQuickAddProject,
  projectDialogSubmitting,
  projectDialogError,
  projectNameInputRef,
}: QuickAddDialogsProps) => (
  <>
    <TaskCreateDialog
      open={quickAddDialog === 'task'}
      onClose={closeQuickAddDialog}
      onCreated={() => {
        void refreshCaptureData();
        requestHubHomeRefresh();
        closeQuickAddDialog();
      }}
      accessToken={accessToken ?? ''}
      projectId={quickAddProjectId}
      projectMembers={selectedTaskProjectMembers.map((member) => ({
        user_id: member.user_id,
        display_name: member.display_name,
      }))}
      triggerRef={contextMenuTriggerRef}
      projectOptions={quickAddProjectOptions}
      selectedProjectId={quickAddProjectId}
      titleInputRef={taskTitleInputRef}
      onSelectedProjectIdChange={(projectId) => {
        setQuickAddProjectId(projectId);
        void loadTaskProjectMembers(projectId);
      }}
    />

    <QuickAddEventDialog
      open={quickAddDialog === 'event'}
      onClose={closeQuickAddDialog}
      triggerRef={contextMenuTriggerRef}
      projectOptions={quickAddProjectOptions}
      selectedProjectId={quickAddProjectId}
      onSelectedProjectIdChange={setQuickAddProjectId}
      onSubmit={onCreateQuickAddEvent}
      title={eventTitle}
      onTitleChange={setEventTitle}
      startAt={eventStartAt}
      onStartAtChange={setEventStartAt}
      endAt={eventEndAt}
      onEndAtChange={setEventEndAt}
      submitting={eventSubmitting}
      error={eventError}
      titleInputRef={eventTitleInputRef}
    />

    <QuickAddReminderDialog
      open={quickAddDialog === 'reminder'}
      onClose={closeQuickAddDialog}
      triggerRef={contextMenuTriggerRef}
      draft={reminderDraft}
      onDraftChange={setReminderDraft}
      preview={reminderPreview}
      onSubmit={onCreateQuickAddReminder}
      submitting={reminderSubmitting}
      error={reminderError}
      onClearError={() => setReminderError(null)}
      inputRef={reminderInputRef}
      personalProjectLabel={personalReminderProjectLabel}
    />

    <QuickAddProjectDialog
      open={quickAddDialog === 'project'}
      onClose={closeQuickAddDialog}
      triggerRef={contextMenuTriggerRef}
      name={projectDialogName}
      onNameChange={setProjectDialogName}
      onSubmit={onCreateQuickAddProject}
      submitting={projectDialogSubmitting}
      error={projectDialogError}
      nameInputRef={projectNameInputRef}
    />
  </>
);
