import { Suspense, lazy } from 'react';
import type { ContractModuleConfig } from '../ModuleGrid';
import { ModuleLoadingState } from '../ModuleFeedback';
import type { CalendarModuleContract } from '../moduleContracts';

const CalendarModuleSkin = lazy(async () => {
  const module = await import('../CalendarModuleSkin');
  return { default: module.CalendarModuleSkin };
});

interface Props {
  module: ContractModuleConfig;
  contract: CalendarModuleContract;
  onOpenRecord?: (recordId: string) => void;
}

export const CalendarModule = ({ module, contract, onOpenRecord }: Props) => (
  <Suspense fallback={<ModuleLoadingState label="Loading calendar module" rows={5} />}>
    <div className="h-full min-h-0 overflow-hidden">
      <CalendarModuleSkin
        events={contract.events}
        loading={contract.loading}
        sizeTier={module.size_tier}
        scope={contract.scope}
        onScopeChange={contract.onScopeChange}
        onCreateEvent={contract.onCreateEvent}
        onRescheduleEvent={contract.onRescheduleEvent}
        onOpenRecord={(recordId) => onOpenRecord?.(recordId)}
      />
    </div>
  </Suspense>
);
