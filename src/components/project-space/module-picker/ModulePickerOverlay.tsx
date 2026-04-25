import { useRef, type ReactNode, type RefObject } from 'react';
import { Dialog } from '../../primitives';
import { useModulePickerFocusTrap } from './useModulePickerFocusTrap';

interface ModulePickerOverlayProps {
  open: boolean;
  onClose: () => void;
  triggerRef?: RefObject<HTMLElement | null>;
  layoutId?: string;
  sidebar: ReactNode;
  preview: ReactNode;
  confirm: ReactNode;
}

export const ModulePickerOverlay = ({
  open,
  onClose,
  triggerRef,
  layoutId,
  sidebar,
  preview,
  confirm,
}: ModulePickerOverlayProps) => {
  const trapRef = useRef<HTMLDivElement | null>(null);
  useModulePickerFocusTrap(open, trapRef);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add Module"
      description="Choose a module type and size, then preview it before adding it."
      triggerRef={triggerRef}
      layoutId={layoutId}
      motionVariant="fold-dialog"
      hideHeader
      modal
      openFocusMode="first-control"
      overlayClassName="module-picker-viewport-backdrop"
      panelClassName="module-picker-viewport-panel module-picker-panel-size overflow-hidden p-0"
      contentClassName="mt-0 flex h-full min-h-0 p-0"
      onEscapeKeyDown={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div ref={trapRef} tabIndex={-1} className="flex h-full min-h-0 w-full flex-col md:flex-row">
        <aside className="module-picker-sidebar-size flex min-h-0 flex-col border-b border-border-muted bg-surface-low md:border-b-0 md:border-r">
          <div className="min-h-0 flex-1 overflow-y-auto p-3">{sidebar}</div>
          <div className="border-t border-border-muted p-3">{confirm}</div>
        </aside>
        <section className="flex min-h-0 flex-1 overflow-hidden bg-surface p-4" aria-label="Module preview">
          {preview}
        </section>
      </div>
    </Dialog>
  );
};
