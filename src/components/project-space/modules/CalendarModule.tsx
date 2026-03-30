import { Suspense, lazy } from 'react';
import type { ContractModuleConfig } from '../ModuleGrid';
import { ModuleLoadingState } from '../ModuleFeedback';
import type { WorkViewCalendarRuntime } from '../WorkView';

const CalendarModuleSkin = lazy(async () => {
  const module = await import('../CalendarModuleSkin');
  return { default: module.CalendarModuleSkin };
});

interface Props {
  module: ContractModuleConfig;
  runtime: WorkViewCalendarRuntime;
  onOpenRecord?: (recordId: string) => void;
}

export const CalendarModule = ({ module, runtime, onOpenRecord }: Props) => (
  <Suspense fallback={<ModuleLoadingState label="Loading calendar module" rows={5} />}>
    <div className="h-full min-h-0 overflow-hidden">
      <CalendarModuleSkin
        events={runtime.events}
        loading={runtime.loading}
        sizeTier={module.size_tier}
        scope={runtime.scope}
        onScopeChange={runtime.onScopeChange}
        onCreateEvent={runtime.onCreateEvent}
        onRescheduleEvent={runtime.onRescheduleEvent}
        onOpenRecord={(recordId) => onOpenRecord?.(recordId)}
      />
    </div>
  </Suspense>
);
