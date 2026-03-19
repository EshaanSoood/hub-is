import { Suspense, lazy } from 'react';
import { ModuleLoadingState } from '../ModuleFeedback';
import type { WorkViewCalendarRuntime } from '../WorkView';

const CalendarModuleSkin = lazy(async () => {
  const module = await import('../CalendarModuleSkin');
  return { default: module.CalendarModuleSkin };
});

interface Props {
  runtime: WorkViewCalendarRuntime;
  onOpenRecord?: (recordId: string) => void;
}

export const CalendarModule = ({ runtime, onOpenRecord }: Props) => (
  <Suspense fallback={<ModuleLoadingState label="Loading calendar module" rows={5} />}>
    <CalendarModuleSkin
      events={runtime.events}
      loading={runtime.loading}
      scope={runtime.scope}
      onScopeChange={runtime.onScopeChange}
      onCreateEvent={runtime.onCreateEvent}
      onOpenRecord={(recordId) => onOpenRecord?.(recordId)}
    />
  </Suspense>
);
