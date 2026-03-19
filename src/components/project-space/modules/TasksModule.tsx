import { Suspense, lazy } from 'react';
import type { ContractModuleConfig } from '../ModuleGrid';
import { ModuleLoadingState } from '../ModuleFeedback';
import type { WorkViewTasksRuntime } from '../WorkView';

const TasksModuleSkin = lazy(async () => {
  const module = await import('../TasksModuleSkin');
  return { default: module.TasksModuleSkin };
});

interface Props {
  module: ContractModuleConfig;
  runtime: WorkViewTasksRuntime;
  canEditPane: boolean;
}

export const TasksModule = ({ module, runtime, canEditPane }: Props) => (
  <Suspense fallback={<ModuleLoadingState label="Loading tasks module" rows={4} />}>
    <TasksModuleSkin
      sizeTier={module.size_tier || 'M'}
      tasks={runtime.items}
      tasksLoading={runtime.loading}
      onCreateTask={canEditPane ? runtime.onCreateTask : async () => {}}
      onUpdateTaskStatus={canEditPane ? runtime.onUpdateTaskStatus : undefined}
      onUpdateTaskPriority={canEditPane ? runtime.onUpdateTaskPriority : undefined}
      onUpdateTaskDueDate={canEditPane ? runtime.onUpdateTaskDueDate : undefined}
      onDeleteTask={canEditPane ? runtime.onDeleteTask : undefined}
      readOnly={!canEditPane}
    />
  </Suspense>
);
