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
  canEditPane: boolean;
  previewMode?: boolean;
}

export const TasksModule = ({ module, contract, canEditPane, previewMode = false }: Props) => (
  <div className="flex h-full min-h-0 flex-col">
    <Suspense fallback={<ModuleLoadingState label="Loading tasks module" rows={4} />}>
      <TasksModuleSkin
        sizeTier={module.size_tier || 'M'}
        tasks={contract.items}
        tasksLoading={contract.loading}
        onCreateTask={canEditPane ? contract.onCreateTask : undefined}
        onUpdateTaskStatus={canEditPane ? contract.onUpdateTaskStatus : undefined}
        onUpdateTaskPriority={canEditPane ? contract.onUpdateTaskPriority : undefined}
        onUpdateTaskDueDate={canEditPane ? contract.onUpdateTaskDueDate : undefined}
        onDeleteTask={canEditPane ? contract.onDeleteTask : undefined}
        onInsertToEditor={previewMode ? undefined : contract.onInsertToEditor}
        readOnly={previewMode || !canEditPane}
        previewMode={previewMode}
      />
    </Suspense>
  </div>
);
