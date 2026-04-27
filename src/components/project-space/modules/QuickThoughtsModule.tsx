import { Suspense, lazy } from 'react';
import type { ContractModuleConfig } from '../ModuleGrid';
import { ModuleLoadingState } from '../ModuleFeedback';
import type { HubProjectSummary } from '../../../services/hub/types';
import type { QuickThoughtsModuleContract } from '../moduleContracts';

const QuickThoughtsModuleSkin = lazy(async () => {
  const module = await import('../QuickThoughtsModuleSkin');
  return { default: module.QuickThoughtsModuleSkin };
});

interface Props {
  module: ContractModuleConfig;
  contract: QuickThoughtsModuleContract;
  project: HubProjectSummary;
  canEditProject: boolean;
  previewMode?: boolean;
}

export const QuickThoughtsModule = ({ module, contract, project, canEditProject, previewMode = false }: Props) => (
  <Suspense fallback={<ModuleLoadingState label="Loading Quick Thoughts module" rows={5} />}>
    <QuickThoughtsModuleSkin
      key={`${contract.storageKeyBase}:${project.project_id}:${module.module_instance_id}`}
      sizeTier={module.size_tier}
      storageKey={`${contract.storageKeyBase}:${project.project_id}:${module.module_instance_id}`}
      legacyStorageKey={
        contract.legacyStorageKeyBase
          ? `${contract.legacyStorageKeyBase}:${project.project_id}:${module.module_instance_id}`
          : undefined
      }
      initialEntries={contract.initialEntries}
      onInsertToEditor={previewMode ? undefined : contract.onInsertToEditor}
      readOnly={previewMode || !canEditProject}
      previewMode={previewMode}
    />
  </Suspense>
);
