import { Suspense, lazy } from 'react';
import type { ContractModuleConfig } from '../ModuleGrid';
import { ModuleLoadingState } from '../ModuleFeedback';
import type { RemindersModuleContract } from '../moduleContracts';

const RemindersModuleSkin = lazy(async () => {
  const module = await import('../RemindersModuleSkin');
  return { default: module.RemindersModuleSkin };
});

interface Props {
  module: ContractModuleConfig;
  contract: RemindersModuleContract;
  canEditPane: boolean;
  previewMode?: boolean;
}

export const RemindersModule = ({ module, contract, canEditPane, previewMode = false }: Props) => (
  <Suspense fallback={<ModuleLoadingState label="Loading reminders module" rows={4} />}>
    <RemindersModuleSkin
      reminders={contract.items}
      loading={contract.loading}
      error={contract.error}
      onDismiss={canEditPane ? contract.onDismiss : async () => {}}
      onCreate={canEditPane ? contract.onCreate : async () => {}}
      onInsertToEditor={previewMode ? undefined : contract.onInsertToEditor}
      sizeTier={module.size_tier}
      readOnly={previewMode || !canEditPane}
      previewMode={previewMode}
    />
  </Suspense>
);
