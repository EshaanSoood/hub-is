import { useEffect, useRef, useState } from 'react';
import { AnimatedSurface } from '../motion/AnimatedSurface';

interface FileMovePopoverProps {
  panes: Array<{ id: string; name: string }>;
  currentFileName: string;
  onSelect: (paneId: string) => void;
  onClose: (options?: { restoreFocus?: boolean }) => void;
}

export const FileMovePopover = ({ panes, currentFileName, onSelect, onClose }: FileMovePopoverProps) => {
  const [pendingPaneId, setPendingPaneId] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose({ restoreFocus: true });
        return;
      }
      if (event.key !== 'Tab' || !popoverRef.current) {
        return;
      }

      const focusable = Array.from(
        popoverRef.current.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'),
      ).filter((element) => !element.hasAttribute('disabled'));

      if (focusable.length === 0) {
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    const focusTarget = popoverRef.current?.querySelector<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    focusTarget?.focus();
  }, [pendingPaneId]);

  return (
    <AnimatedSurface
      ref={popoverRef}
      role="dialog"
      ariaLabel={`Move ${currentFileName} to pane`}
      transformOrigin="top left"
      className="absolute left-0 top-[calc(100%+4px)] z-[200] min-w-[220px] rounded-panel border border-border-muted bg-surface-elevated p-xs shadow-soft"
    >
      {pendingPaneId ? (
        <div className="space-y-xs p-xs">
          <p className="text-sm text-text">
            Move to <strong>{panes.find((pane) => pane.id === pendingPaneId)?.name || 'selected pane'}</strong>?
          </p>
          <div className="flex gap-xs">
            <button
              type="button"
              autoFocus
              onClick={() => onSelect(pendingPaneId)}
              className="flex-1 rounded-control bg-primary px-sm py-xs text-xs font-medium text-on-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              Move
            </button>
            <button
              type="button"
              onClick={() => setPendingPaneId(null)}
              className="flex-1 rounded-control border border-border-muted px-sm py-xs text-xs text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <ul className="space-y-[2px]">
          <li className="px-xs py-[2px] text-[11px] text-muted">Move to pane</li>
          {panes.length === 0 ? (
            <li className="rounded-control px-sm py-xs text-sm text-muted">
              No destination panes available.
            </li>
          ) : (
            panes.map((pane) => (
              <li key={pane.id}>
                <button
                  type="button"
                  onClick={() => setPendingPaneId(pane.id)}
                  className="block w-full rounded-control px-sm py-xs text-left text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring hover:bg-primary/10"
                >
                  {pane.name}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </AnimatedSurface>
  );
};
