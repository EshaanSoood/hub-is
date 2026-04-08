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
}

export const RemindersModule = ({ module, contract }: Props) => (
  <Suspense fallback={<ModuleLoadingState label="Loading reminders module" rows={4} />}>
    <RemindersModuleSkin
      reminders={contract.items}
      loading={contract.loading}
      error={contract.error}
      onDismiss={contract.onDismiss}
      onCreate={contract.onCreate}
      onInsertToEditor={contract.onInsertToEditor}
      sizeTier={module.size_tier}
    />
  </Suspense>
);
