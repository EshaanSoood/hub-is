import { useRef, type ReactNode, type RefObject } from 'react';
import { Dialog } from '../../primitives';
import { useWidgetPickerFocusTrap } from './useWidgetPickerFocusTrap';

interface WidgetPickerOverlayProps {
  open: boolean;
  onClose: () => void;
  triggerRef?: RefObject<HTMLElement | null>;
  layoutId?: string;
  sidebar: ReactNode;
  preview: ReactNode;
  confirm: ReactNode;
}

export const WidgetPickerOverlay = ({
  open,
  onClose,
  triggerRef,
  layoutId,
  sidebar,
  preview,
  confirm,
}: WidgetPickerOverlayProps) => {
  const trapRef = useRef<HTMLDivElement | null>(null);
  useWidgetPickerFocusTrap(open, trapRef);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add Widget"
      description="Choose a widget type and size, then preview it before adding it."
      triggerRef={triggerRef}
      layoutId={layoutId}
      motionVariant="fold-dialog"
      hideHeader
      modal
      openFocusMode="first-control"
      overlayClassName="widget-picker-viewport-backdrop"
      panelClassName="widget-picker-viewport-panel widget-picker-panel-size overflow-hidden p-0"
      contentClassName="mt-0 flex h-full min-h-0 p-0"
      onEscapeKeyDown={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div ref={trapRef} tabIndex={-1} className="flex h-full min-h-0 w-full flex-col md:flex-row">
        <aside className="widget-picker-sidebar-size flex min-h-0 flex-col border-b border-border-muted bg-surface-low md:border-b-0 md:border-r">
          <div className="min-h-0 flex-1 overflow-y-auto p-3">{sidebar}</div>
          <div className="border-t border-border-muted p-3">{confirm}</div>
        </aside>
        <section className="flex min-h-0 flex-1 overflow-hidden bg-surface p-4" aria-label="Widget preview">
          {preview}
        </section>
      </div>
    </Dialog>
  );
};
