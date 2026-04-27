import { Suspense, lazy } from 'react';
import type { ContractModuleConfig } from '../ModuleGrid';
import { ModuleLoadingState } from '../ModuleFeedback';
import type { TasksModuleContract } from '../moduleContracts';

const TasksModuleSkin = lazy(async () => {
  const module = await import('../TasksModuleSkin');
  return { default: module.TasksModuleSkin };
});

interface Props {
  module: ContractModuleConfig;
  contract: TasksModuleContract;
  canEditProject: boolean;
  previewMode?: boolean;
}

export const TasksModule = ({ module, contract, canEditProject, previewMode = false }: Props) => (
  <div className="flex h-full min-h-0 flex-col">
    <Suspense fallback={<ModuleLoadingState label="Loading tasks module" rows={4} />}>
      <TasksModuleSkin
        sizeTier={module.size_tier || 'M'}
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
