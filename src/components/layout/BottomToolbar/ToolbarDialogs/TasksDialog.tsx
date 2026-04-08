import type { ComponentProps, MutableRefObject } from 'react';
import { TasksModuleSkin } from '../../../project-space/TasksModuleSkin';
import { Dialog } from '../../../primitives';
import type { ToolbarDialog } from '../../appShellUtils';

interface TasksDialogProps {
  toolbarDialog: ToolbarDialog;
  closeQuickNavPanel: () => void;
  quickNavTriggerRef: MutableRefObject<HTMLButtonElement | null>;
  quickNavTasksError: string | null;
  refreshQuickNavTasks: () => Promise<void>;
  adaptedTasks: ComponentProps<typeof TasksModuleSkin>['tasks'];
  quickNavTasksLoading: ComponentProps<typeof TasksModuleSkin>['tasksLoading'];
  onCreateTaskFromModule: ComponentProps<typeof TasksModuleSkin>['onCreateTask'];
}

export const TasksDialog = ({
  toolbarDialog,
  closeQuickNavPanel,
  quickNavTriggerRef,
  quickNavTasksError,
  refreshQuickNavTasks,
  adaptedTasks,
  quickNavTasksLoading,
  onCreateTaskFromModule,
}: TasksDialogProps) => (
  <Dialog
    open={toolbarDialog === 'tasks'}
    onClose={closeQuickNavPanel}
    triggerRef={quickNavTriggerRef}
    title="Tasks"
    description="All your tasks across projects."
    panelClassName="dialog-panel-wide-size !top-[calc(50%-1.5rem)] !h-[calc(100vh-5rem)] !max-h-[calc(100vh-5rem)] flex flex-col overflow-hidden"
    contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
  >
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {quickNavTasksError ? (
        <div className="rounded-panel border border-danger/30 bg-danger/5 p-3" role="alert">
          <p className="text-sm text-danger">{quickNavTasksError}</p>
          <button
            type="button"
            onClick={() => {
              void refreshQuickNavTasks();
            }}
            className="mt-2 rounded-control border border-border-muted px-3 py-1.5 text-sm text-text"
          >
            Retry
          </button>
        </div>
      ) : null}
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <TasksModuleSkin
          sizeTier="L"
          tasks={adaptedTasks}
          tasksLoading={quickNavTasksLoading}
          onCreateTask={onCreateTaskFromModule}
          hideHeader
        />
      </div>
    </div>
  </Dialog>
);
