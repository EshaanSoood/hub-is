import { useRef, useState, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Icon } from '../primitives';
import { dialogLayoutIds } from '../../styles/motion';
import { AddWidgetDialog } from './AddWidgetDialog';
import { WidgetShell } from './WidgetShell';

export type ContractWidgetLens = 'space' | 'project' | 'project_scratch';

export interface ContractWidgetConfig {
  widget_instance_id: string;
  widget_type: string;
  size_tier: 'S' | 'M' | 'L';
  lens: ContractWidgetLens;
  binding?: {
    view_id?: string;
    owned_view_id?: string;
    source_mode?: 'owned' | 'linked';
  };
}

interface WidgetGridProps {
  widgets: ContractWidgetConfig[];
  onAddWidget: (widgetType: string, sizeTier: ContractWidgetConfig['size_tier']) => void;
  onRemoveWidget: (widgetInstanceId: string) => void;
  onSetWidgetLens: (widgetInstanceId: string, lens: ContractWidgetLens) => void;
  onResizeWidget: (widgetInstanceId: string, sizeTier: ContractWidgetConfig['size_tier']) => void;
  showAddControls?: boolean;
  disableAdd?: boolean;
  disableMutations?: boolean;
  readOnlyState?: boolean;
  renderWidgetBody?: (widget: ContractWidgetConfig) => ReactNode;
}

export const WidgetGrid = ({
  widgets,
  onAddWidget,
  onRemoveWidget,
  showAddControls = true,
  disableAdd = false,
  disableMutations = false,
  readOnlyState = false,
  renderWidgetBody,
}: WidgetGridProps) => {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const addButtonRef = useRef<HTMLButtonElement | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const addWidgetLayoutId = !prefersReducedMotion ? dialogLayoutIds.addWidget : undefined;
  const hasWidgets = widgets.length > 0;

  const openAddDialog = () => {
    if (readOnlyState || disableAdd) {
      return;
    }
    setAddDialogOpen(true);
  };

  const closeAddDialog = () => setAddDialogOpen(false);
  const addControl = showAddControls && !readOnlyState ? (
    <motion.button
      layoutId={addWidgetLayoutId}
      ref={addButtonRef}
      type="button"
      title="Add widget"
      aria-label="Add widget"
      disabled={disableAdd}
      onClick={openAddDialog}
      className="inline-flex h-9 w-9 items-center justify-center rounded-control border border-border-muted bg-surface text-primary disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
    >
      <Icon name="plus" className="text-[14px]" />
    </motion.button>
  ) : null;

  return (
    <section className="space-y-3" aria-label="Project organization widgets">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Widgets</p>
        {addControl}
      </div>

      {!hasWidgets ? (
        <div className="rounded-panel border border-dashed border-border-muted bg-elevated px-4 py-6 sm:px-6 sm:py-7">
          <div className="mx-auto flex w-full max-w-2xl flex-col items-center text-center">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border-muted bg-surface text-primary">
              <Icon name="plus" className="text-[18px]" />
            </div>
            <h3 className="mt-3 max-w-2xl text-base font-semibold text-primary">
              {readOnlyState ? 'No widgets in this project yet' : "Let's get this project started!"}
            </h3>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
              {readOnlyState
                ? 'This project is currently read-only. Widgets will appear here after they are added elsewhere.'
                : 'Add a first widget to shape the project.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          {widgets.map((widget) => (
            <WidgetShell
              key={widget.widget_instance_id}
              widgetType={widget.widget_type}
              sizeTier={widget.size_tier}
              readOnlyState={readOnlyState}
              removeDisabled={disableMutations}
              onRemove={() => onRemoveWidget(widget.widget_instance_id)}
            >
              {renderWidgetBody ? renderWidgetBody(widget) : `Widget: ${widget.widget_type}`}
            </WidgetShell>
          ))}
        </div>
      )}
      <AddWidgetDialog
        open={addDialogOpen}
        onClose={closeAddDialog}
        onAddWidget={onAddWidget}
        triggerRef={addButtonRef}
        layoutId={addWidgetLayoutId}
        disableConfirm={disableAdd}
      />
    </section>
  );
};
