import { Suspense, lazy } from 'react';
import type { ContractWidgetConfig } from '../WidgetGrid';
import { WidgetLoadingState } from '../WidgetFeedback';
import type { TasksWidgetContract } from '../widgetContracts';

const TasksWidgetSkin = lazy(async () => {
  const module = await import('../TasksWidgetSkin');
  return { default: module.TasksWidgetSkin };
});

interface Props {
  widget: ContractWidgetConfig;
  contract: TasksWidgetContract;
  canEditProject: boolean;
  previewMode?: boolean;
}

export const TasksWidget = ({ widget, contract, canEditProject, previewMode = false }: Props) => (
  <div className="flex h-full min-h-0 flex-col">
    <Suspense fallback={<WidgetLoadingState label="Loading tasks widget" rows={4} />}>
      <TasksWidgetSkin
        sizeTier={widget.size_tier || 'M'}
        tasks={contract.items}
        tasksLoading={contract.loading}
        onCreateTask={canEditProject ? contract.onCreateTask : undefined}
        onUpdateTaskStatus={canEditProject ? contract.onUpdateTaskStatus : undefined}
        onUpdateTaskPriority={canEditProject ? contract.onUpdateTaskPriority : undefined}
        onUpdateTaskDueDate={canEditProject ? contract.onUpdateTaskDueDate : undefined}
        onDeleteTask={canEditProject ? contract.onDeleteTask : undefined}
        onInsertToEditor={previewMode ? undefined : contract.onInsertToEditor}
        readOnly={previewMode || !canEditProject}
        previewMode={previewMode}
      />
    </Suspense>
  </div>
);
