import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ProjectSpaceDialogPrimitives';
import { Icon } from '../../primitives';
import { dialogLayoutIds } from '../../../styles/motion';
import { motion } from 'framer-motion';
import type { ReactElement, ReactNode, RefObject } from 'react';

interface RecordInspectorShellProps {
  open: boolean;
  inspectorTriggerRect: { top: number; left: number; width: number; height: number } | null;
  inspectorTriggerRef: RefObject<HTMLElement | null>;
  prefersReducedMotion: boolean;
  onClose: () => void;
  children: ReactNode;
}

const InspectorPlaceholder = ({
  inspectorTriggerRect,
}: {
  inspectorTriggerRect: { top: number; left: number; width: number; height: number };
}): ReactElement => (
  <motion.div
    layoutId={dialogLayoutIds.recordInspector}
    aria-hidden="true"
    className="inspector-placeholder"
    initial={false}
    animate={{
      x: inspectorTriggerRect.left,
      y: inspectorTriggerRect.top,
      width: inspectorTriggerRect.width,
      height: inspectorTriggerRect.height,
    }}
  />
);

export const RecordInspectorShell = ({
  open,
  inspectorTriggerRect,
  inspectorTriggerRef,
  prefersReducedMotion,
  onClose,
  children,
}: RecordInspectorShellProps): ReactElement => (
  <>
    {!prefersReducedMotion && inspectorTriggerRect ? <InspectorPlaceholder inspectorTriggerRect={inspectorTriggerRect} /> : null}

    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)}>
      <DialogContent
        open={open}
        animated
        layoutId={dialogLayoutIds.recordInspector}
        motionVariant="fold-sheet"
        className="dialog-panel-sheet-size !left-0 !top-0 h-screen !translate-x-0 !translate-y-0 overflow-y-auto rounded-none sm:!rounded-none border-r border-border-muted"
        onCloseAutoFocus={(event) => {
          if (inspectorTriggerRef.current) {
            event.preventDefault();
            inspectorTriggerRef.current.focus();
          }
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <DialogHeader className="min-w-0 flex-1">
            <DialogTitle>Record Inspector</DialogTitle>
            <DialogDescription className="sr-only">
              Quick dismissible inspector. Press Escape or close to return focus to the invoking control.
            </DialogDescription>
          </DialogHeader>
          <DialogClose
            aria-label="Close inspector"
            className="inline-flex h-9 w-9 items-center justify-center rounded-panel border border-border-muted text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            <Icon name="close" className="h-4 w-4" />
          </DialogClose>
        </div>

        {children}

        <div className="mt-4">
          <DialogClose className="rounded-panel border border-border-muted px-3 py-1.5 text-sm font-semibold text-primary">
            Close inspector
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  </>
);
