import { Suspense, lazy } from 'react';
import type { ContractWidgetConfig } from '../WidgetGrid';
import { WidgetLoadingState } from '../WidgetFeedback';
import type { CalendarWidgetContract } from '../widgetContracts';

const CalendarWidgetSkin = lazy(async () => {
  const module = await import('../CalendarWidgetSkin');
  return { default: module.CalendarWidgetSkin };
});

interface Props {
  widget: ContractWidgetConfig;
  contract: CalendarWidgetContract;
  previewMode?: boolean;
  onOpenRecord?: (recordId: string) => void;
}

export const CalendarWidget = ({ widget, contract, previewMode = false, onOpenRecord }: Props) => (
  <Suspense fallback={<WidgetLoadingState label="Loading calendar widget" rows={5} />}>
    <div className="h-full min-h-0 overflow-hidden">
      <CalendarWidgetSkin
        events={contract.events}
        loading={contract.loading}
        sizeTier={widget.size_tier}
        previewMode={previewMode}
        scope={contract.scope}
        onScopeChange={contract.onScopeChange}
        onCreateEvent={contract.onCreateEvent}
        onRescheduleEvent={contract.onRescheduleEvent}
        onOpenRecord={(recordId) => onOpenRecord?.(recordId)}
      />
    </div>
  </Suspense>
);
