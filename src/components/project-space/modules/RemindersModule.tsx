import { Suspense, lazy } from 'react';
import type { ContractModuleConfig } from '../ModuleGrid';
import { ModuleLoadingState } from '../ModuleFeedback';
import type { WorkViewRemindersRuntime } from '../WorkView';

const RemindersModuleSkin = lazy(async () => {
  const module = await import('../RemindersModuleSkin');
  return { default: module.RemindersModuleSkin };
});

interface Props {
  module: ContractModuleConfig;
  runtime: WorkViewRemindersRuntime;
}

export const RemindersModule = ({ module, runtime }: Props) => (
  <Suspense fallback={<ModuleLoadingState label="Loading reminders module" rows={4} />}>
    <RemindersModuleSkin
      reminders={runtime.items}
      loading={runtime.loading}
      error={runtime.error}
      onDismiss={runtime.onDismiss}
      onCreate={runtime.onCreate}
      sizeTier={module.size_tier}
    />
  </Suspense>
);
