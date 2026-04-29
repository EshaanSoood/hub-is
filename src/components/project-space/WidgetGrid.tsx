import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Icon, IconButton } from '../primitives';
import { cn } from '../../lib/cn';
import { dialogLayoutIds } from '../../styles/motion';
import { AddWidgetDialog } from './AddWidgetDialog';
import { WidgetShell } from './WidgetShell';
import { useWidgetTrays } from './hooks/useWidgetTrays';

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
  projectId: string;
  widgets: ContractWidgetConfig[];
  onAddWidget: (
    widgetType: string,
    sizeTier: ContractWidgetConfig['size_tier'],
    insertAfterWidgetInstanceId?: string,
  ) => string | void;
  onRemoveWidget: (widgetInstanceId: string) => void;
  onSetWidgetLens: (widgetInstanceId: string, lens: ContractWidgetLens) => void;
  onResizeWidget: (widgetInstanceId: string, sizeTier: ContractWidgetConfig['size_tier']) => void;
  showAddControls?: boolean;
  disableAdd?: boolean;
  disableMutations?: boolean;
  readOnlyState?: boolean;
  compactTray?: boolean;
  renderWidgetBody?: (widget: ContractWidgetConfig) => ReactNode;
}

const columnStartClass: Record<number, string> = {
  1: 'col-start-1',
  2: 'col-start-2',
  3: 'col-start-3',
  4: 'col-start-4',
  5: 'col-start-5',
  6: 'col-start-6',
  7: 'col-start-7',
  8: 'col-start-8',
  9: 'col-start-9',
  10: 'col-start-10',
  11: 'col-start-11',
  12: 'col-start-12',
};

const rowStartClass: Record<number, string> = {
  1: 'row-start-1',
  2: 'row-start-2',
  3: 'row-start-3',
  4: 'row-start-4',
  5: 'row-start-5',
  6: 'row-start-6',
  7: 'row-start-7',
  8: 'row-start-8',
};

const columnSpanClass: Record<number, string> = {
  2: 'col-span-2',
  3: 'col-span-3',
  4: 'col-span-4',
  6: 'col-span-6',
};

const rowSpanClass: Record<number, string> = {
  2: 'row-span-2',
  3: 'row-span-3',
  4: 'row-span-4',
};

export const WidgetGrid = ({
  projectId,
  widgets,
  onAddWidget,
  onRemoveWidget,
  showAddControls = true,
  disableAdd = false,
  disableMutations = false,
  readOnlyState = false,
  compactTray = false,
  renderWidgetBody,
}: WidgetGridProps) => {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const addButtonRef = useRef<HTMLButtonElement | null>(null);
  const trayTrackRef = useRef<HTMLDivElement | null>(null);
  const dotRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const dragStartXRef = useRef<number | null>(null);
  const pendingWidgetFocusIdRef = useRef<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const { activeTrayIndex, findTrayIndexByWidgetId, setActiveTrayIndex, trays } = useWidgetTrays(
    projectId,
    widgets,
    compactTray ? 'compact' : 'desktop',
  );
  const addWidgetLayoutId = !prefersReducedMotion ? dialogLayoutIds.addWidget : undefined;
  const hasWidgets = widgets.length > 0;
  const activeTray = trays[activeTrayIndex] ?? null;

  useEffect(() => {
    const trayTrack = trayTrackRef.current;
    if (!trayTrack) {
      return;
    }

    trayTrack.scrollTo({
      left: activeTrayIndex * trayTrack.clientWidth,
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    });
  }, [activeTrayIndex, prefersReducedMotion, trays.length]);

  useEffect(() => {
    const pendingWidgetFocusId = pendingWidgetFocusIdRef.current;
    if (!pendingWidgetFocusId) {
      return;
    }

    const trayIndex = findTrayIndexByWidgetId(pendingWidgetFocusId);
    if (trayIndex >= 0) {
      pendingWidgetFocusIdRef.current = null;
      setActiveTrayIndex(trayIndex);
    }
  }, [findTrayIndexByWidgetId, setActiveTrayIndex, trays]);

  const openAddDialog = () => {
    if (readOnlyState || disableAdd) {
      return;
    }
    setAddDialogOpen(true);
  };

  const closeAddDialog = () => setAddDialogOpen(false);
  const navigateToTray = (trayIndex: number, shouldFocusDot = false) => {
    setActiveTrayIndex(trayIndex);
    if (shouldFocusDot && typeof window !== 'undefined') {
      window.requestAnimationFrame(() => {
        dotRefs.current[trayIndex]?.focus();
      });
    }
  };

  const navigateByOffset = (offset: number, shouldFocusDot = false) => {
    navigateToTray(activeTrayIndex + offset, shouldFocusDot);
  };

  const handleAddWidget = (widgetType: string, sizeTier: ContractWidgetConfig['size_tier']) => {
    const insertAfterWidgetInstanceId = activeTray?.placements.at(-1)?.widget.widget_instance_id;
    const addedWidgetId = onAddWidget(widgetType, sizeTier, insertAfterWidgetInstanceId);
    if (addedWidgetId) {
      pendingWidgetFocusIdRef.current = addedWidgetId;
    }
  };

  const handleTrayKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      navigateByOffset(-1, true);
      return;
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      navigateByOffset(1, true);
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      navigateToTray(0, true);
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      navigateToTray(trays.length - 1, true);
    }
  };

  const handleDotsPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    dragStartXRef.current = event.clientX;
  };

  const handleDotsPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const startX = dragStartXRef.current;
    dragStartXRef.current = null;
    if (startX === null) {
      return;
    }

    const distance = event.clientX - startX;
    if (Math.abs(distance) < 24) {
      return;
    }

    navigateByOffset(distance < 0 ? 1 : -1, true);
  };

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

      <div className="widget-tray-shell" role="region" aria-label="Widget tray carousel">
        <div className="widget-tray-viewport widget-sheet">
          {!hasWidgets ? (
            <div className="flex h-full items-center justify-center px-4 py-6 sm:px-6 sm:py-7">
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
            <div ref={trayTrackRef} className="widget-tray-track">
              {trays.map((tray, trayIndex) => (
                <div
                  key={tray.id}
                  className={cn('widget-tray-panel', compactTray && 'widget-tray-panel-compact')}
                  aria-labelledby={`${tray.id}-label`}
                >
                  <span id={`${tray.id}-label`} className="sr-only">
                    Widget tray {trayIndex + 1} of {trays.length}
                  </span>
                  {tray.placements.map((placement) => (
                    <WidgetShell
                      key={placement.widget.widget_instance_id}
                      widgetType={placement.widget.widget_type}
                      sizeTier={placement.widget.size_tier}
                      layoutMode="tray"
                      className={cn(
                        columnStartClass[placement.columnStart],
                        rowStartClass[placement.rowStart],
                        columnSpanClass[placement.columnSpan],
                        rowSpanClass[placement.rowSpan],
                      )}
                      readOnlyState={readOnlyState}
                      removeDisabled={disableMutations}
                      onRemove={() => onRemoveWidget(placement.widget.widget_instance_id)}
                    >
                      {renderWidgetBody ? renderWidgetBody(placement.widget) : `Widget: ${placement.widget.widget_type}`}
                    </WidgetShell>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {trays.length > 0 ? (
          <div className="widget-tray-controls" aria-label="Widget tray navigation">
            <IconButton
              aria-label="Previous widget tray"
              disabled={activeTrayIndex === 0}
              size="sm"
              variant="ghost"
              onClick={() => navigateByOffset(-1)}
            >
              <Icon name="back" className="text-[14px]" />
            </IconButton>

            <div
              className="widget-tray-dots"
              role="toolbar"
              aria-label="Widget trays"
              onKeyDown={handleTrayKeyDown}
              onPointerDown={handleDotsPointerDown}
              onPointerUp={handleDotsPointerUp}
            >
              {trays.map((tray, trayIndex) => {
                const isActive = trayIndex === activeTrayIndex;

                return (
                  <button
                    key={tray.id}
                    ref={(element) => {
                      dotRefs.current[trayIndex] = element;
                    }}
                    type="button"
                    className="widget-tray-dot"
                    aria-current={isActive ? 'true' : undefined}
                    aria-label={`Go to widget tray ${trayIndex + 1} of ${trays.length}${isActive ? ', current tray' : ''}`}
                    onClick={() => navigateToTray(trayIndex)}
                  >
                    <span className="sr-only">
                      {isActive ? 'Current tray. ' : ''}Widget tray {trayIndex + 1} of {trays.length}
                    </span>
                  </button>
                );
              })}
            </div>

            <IconButton
              aria-label="Next widget tray"
              disabled={activeTrayIndex === trays.length - 1}
              size="sm"
              variant="ghost"
              onClick={() => navigateByOffset(1)}
            >
              <Icon name="back" className="rotate-180 text-[14px]" />
            </IconButton>
          </div>
        ) : null}
      </div>
      <AddWidgetDialog
        open={addDialogOpen}
        onClose={closeAddDialog}
        onAddWidget={handleAddWidget}
        triggerRef={addButtonRef}
        layoutId={addWidgetLayoutId}
        disableConfirm={disableAdd}
      />
    </section>
  );
};
