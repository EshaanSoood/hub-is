import { cn } from '../../lib/cn';
import {
  AlertDialog as AlertDialogRoot,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import {
  Dialog as DialogRoot,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';

export interface BaseDialogProps {
  open: boolean;
  title: string;
  description: string;
  onClose: () => void;
  children: React.ReactNode;
  triggerRef?: React.RefObject<HTMLElement | null>;
  layoutId?: string;
  hideHeader?: boolean;
  panelClassName?: string;
  contentClassName?: string;
}

export const Dialog = ({
  open,
  title,
  description,
  onClose,
  children,
  triggerRef,
  layoutId,
  hideHeader = false,
  panelClassName,
  contentClassName,
}: BaseDialogProps) => (
  <DialogRoot open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)}>
    <DialogContent
      onCloseAutoFocus={(event) => {
        if (triggerRef?.current) {
          event.preventDefault();
          triggerRef.current.focus();
        }
      }}
      animated={Boolean(layoutId)}
      layoutId={layoutId}
      className={cn(panelClassName)}
    >
      <DialogHeader className={cn(hideHeader && 'sr-only')}>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription className="sr-only">{description}</DialogDescription>
      </DialogHeader>
      <div className={cn(!hideHeader && 'mt-4', contentClassName)}>{children}</div>
    </DialogContent>
  </DialogRoot>
);

export const AccessibleDialog = Dialog;

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  triggerRef?: React.RefObject<HTMLElement | null>;
  layoutId?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

export const AlertDialog = ({
  open,
  title,
  description,
  onOpenChange,
  onConfirm,
  triggerRef,
  layoutId,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
}: ConfirmDialogProps) => (
  <AlertDialogRoot open={open} onOpenChange={onOpenChange}>
    <AlertDialogContent
      animated={Boolean(layoutId)}
      layoutId={layoutId}
      onCloseAutoFocus={(event) => {
        if (triggerRef?.current) {
          event.preventDefault();
          triggerRef.current.focus();
        }
      }}
    >
      <AlertDialogHeader>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        <AlertDialogDescription className="sr-only">{description}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
        <AlertDialogAction
          onClick={(event) => {
            event.preventDefault();
            onConfirm();
            onOpenChange(false);
          }}
        >
          {confirmLabel}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialogRoot>
);
