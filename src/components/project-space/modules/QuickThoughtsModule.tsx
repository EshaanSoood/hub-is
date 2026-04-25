import { Suspense, lazy } from 'react';
import type { ContractModuleConfig } from '../ModuleGrid';
import { ModuleLoadingState } from '../ModuleFeedback';
import type { HubPaneSummary } from '../../../services/hub/types';
import type { QuickThoughtsModuleContract } from '../moduleContracts';

const QuickThoughtsModuleSkin = lazy(async () => {
  const module = await import('../QuickThoughtsModuleSkin');
  return { default: module.QuickThoughtsModuleSkin };
});

interface Props {
  module: ContractModuleConfig;
  contract: QuickThoughtsModuleContract;
  pane: HubPaneSummary;
  canEditPane: boolean;
  previewMode?: boolean;
}

export const QuickThoughtsModule = ({ module, contract, pane, canEditPane, previewMode = false }: Props) => (
  <Suspense fallback={<ModuleLoadingState label="Loading Quick Thoughts module" rows={5} />}>
    <QuickThoughtsModuleSkin
      key={`${contract.storageKeyBase}:${pane.pane_id}:${module.module_instance_id}`}
      sizeTier={module.size_tier}
      storageKey={`${contract.storageKeyBase}:${pane.pane_id}:${module.module_instance_id}`}
      legacyStorageKey={
        contract.legacyStorageKeyBase
          ? `${contract.legacyStorageKeyBase}:${pane.pane_id}:${module.module_instance_id}`
          : undefined
      }
      initialEntries={contract.initialEntries}
      onInsertToEditor={previewMode ? undefined : contract.onInsertToEditor}
      readOnly={previewMode || !canEditPane}
      previewMode={previewMode}
    />
  </Suspense>
);
