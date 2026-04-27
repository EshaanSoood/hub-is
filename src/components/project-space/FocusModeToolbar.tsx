import { useMemo, useRef } from 'react';
import { Button, Dialog } from '../primitives';
import type { ProjectWidget } from './types';
import { cn } from '../../lib/cn';

interface FocusModeToolbarProps {
  visible: boolean;
  widgets: ProjectWidget[];
  activeWidgetId: string | null;
  onActiveWidgetChange: (widgetId: string | null) => void;
  renderWidgetDialogContent?: (widget: ProjectWidget) => React.ReactNode;
}

const widgetIcon = (widgetLabel: string): string =>
  widgetLabel
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

export const FocusModeToolbar = ({
  visible,
  widgets,
  activeWidgetId,
  onActiveWidgetChange,
  renderWidgetDialogContent,
}: FocusModeToolbarProps) => {
  const triggerRef = useRef<HTMLElement | null>(null);

  const activeWidget = useMemo(
    () => widgets.find((widget) => widget.id === activeWidgetId) ?? null,
    [activeWidgetId, widgets],
  );

  if (!visible) {
    return null;
  }

  return (
    <>
      <div
        role="toolbar"
        aria-label="Widget shortcuts"
        className="fixed left-1/2 top-0 z-40 flex -translate-x-1/2 items-center gap-1 rounded-b-panel border border-t-0 border-subtle bg-surface px-2 py-1 shadow-soft"
      >
        {widgets.map((widget) => {
          const active = activeWidgetId === widget.id;
          return (
            <button
              key={widget.id}
              type="button"
              aria-label={`Open ${widget.label}`}
              aria-pressed={active}
              onClick={(event) => {
                triggerRef.current = event.currentTarget;
                onActiveWidgetChange(active ? null : widget.id);
              }}
              className={cn(
                'h-9 w-9 rounded-control border text-xs font-semibold transition-colors',
                active
                  ? 'border-primary bg-elevated text-primary'
                  : 'border-transparent bg-transparent text-muted hover:border-subtle hover:bg-elevated hover:text-text',
              )}
            >
              {widgetIcon(widget.label)}
            </button>
          );
        })}
      </div>

      <Dialog
        open={activeWidget !== null}
        title={activeWidget ? activeWidget.label : 'Widget'}
        description="Focus mode widget dialog"
        onClose={() => onActiveWidgetChange(null)}
        triggerRef={triggerRef}
      >
        {activeWidget ? (
          <div className="space-y-3">
            {renderWidgetDialogContent ? (
              renderWidgetDialogContent(activeWidget)
            ) : (
              <>
                <p className="text-sm text-text">
                  Quick widget actions while staying in workspace focus mode.
                </p>
                <div className="rounded-panel border border-subtle bg-surface p-3 text-xs text-muted">
                  <p>Widget type: {activeWidget.type}</p>
                  <p>Lens: {activeWidget.lens}</p>
                  <p>Size: {activeWidget.size}</p>
                </div>
              </>
            )}
            <div className="flex gap-2">
              <Button type="button" size="sm">Inspect</Button>
              <Button type="button" size="sm">Drag Reference</Button>
              <Button type="button" size="sm" onClick={() => onActiveWidgetChange(null)}>
                Close
              </Button>
            </div>
          </div>
        ) : null}
      </Dialog>
    </>
  );
};
