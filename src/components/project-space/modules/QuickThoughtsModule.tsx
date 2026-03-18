import { Suspense, lazy } from 'react';
import type { ContractModuleConfig } from '../ModuleGrid';
import { ModuleLoadingState } from '../ModuleFeedback';
import type { WorkViewQuickThoughtsRuntime } from '../WorkView';
import type { HubPaneSummary } from '../../../services/hub/types';

const QuickThoughtsModuleSkin = lazy(async () => {
  const module = await import('../InboxCaptureModuleSkin');
  return { default: module.QuickThoughtsModuleSkin };
});

interface Props {
  module: ContractModuleConfig;
  runtime: WorkViewQuickThoughtsRuntime;
  pane: HubPaneSummary;
  canEditPane: boolean;
}

export const QuickThoughtsModule = ({ module, runtime, pane, canEditPane }: Props) => (
  <Suspense fallback={<ModuleLoadingState label="Loading Quick Thoughts module" rows={5} />}>
    <QuickThoughtsModuleSkin
      key={`${runtime.storageKeyBase}:${pane.pane_id}:${module.module_instance_id}`}
      sizeTier={module.size_tier}
      storageKey={`${runtime.storageKeyBase}:${pane.pane_id}:${module.module_instance_id}`}
      legacyStorageKey={
        runtime.legacyStorageKeyBase
          ? `${runtime.legacyStorageKeyBase}:${pane.pane_id}:${module.module_instance_id}`
          : undefined
      }
      readOnly={!canEditPane}
    />
  </Suspense>
);
