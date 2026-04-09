import * as React from 'react';
import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { cn } from '../../lib/cn';
import { dialogSurfaceVariants, routeFadeVariants } from '../motion/hubMotion';

export const AlertDialog = AlertDialogPrimitive.Root;
export const AlertDialogTrigger = AlertDialogPrimitive.Trigger;
export const AlertDialogPortal = AlertDialogPrimitive.Portal;
const ALERT_DIALOG_PANEL_BASE_CLASS =
  'alert-dialog-panel-size fixed left-1/2 top-1/2 z-[300] -translate-x-1/2 -translate-y-1/2 rounded-panel border border-subtle bg-elevated p-5 text-text shadow-soft';

export const AlertDialogOverlay = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Overlay> & { animated?: boolean }
>(({ className, animated = false, ...props }, ref) => {
  const prefersReducedMotion = useReducedMotion() ?? false;
  if (!animated) {
    return <AlertDialogPrimitive.Overlay ref={ref} className={cn('fixed inset-0 z-[300] bg-overlay', className)} {...props} />;
  }
  return (
    <AlertDialogPrimitive.Overlay asChild {...props}>
      <motion.div
        ref={ref}
        initial="initial"
        animate="animate"
        exit="exit"
        variants={routeFadeVariants(prefersReducedMotion)}
        className={cn('fixed inset-0 z-[300] bg-overlay', className)}
      />
    </AlertDialogPrimitive.Overlay>
  );
});
AlertDialogOverlay.displayName = AlertDialogPrimitive.Overlay.displayName;

export const AlertDialogContent = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content> & { layoutId?: string; animated?: boolean; open?: boolean }
>(({ className, layoutId, animated = false, open, children, ...props }, ref) => {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const canAnimateWithPresence = animated && typeof open === 'boolean';
  if (canAnimateWithPresence) {
    return (
      <AlertDialogPortal forceMount>
        <AnimatePresence>
          {open ? (
            <React.Fragment key="alert-dialog-content">
              <AlertDialogOverlay animated forceMount />
              <AlertDialogPrimitive.Content forceMount asChild {...props}>
                <motion.div
                  ref={ref}
                  layoutId={!prefersReducedMotion ? layoutId : undefined}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  variants={dialogSurfaceVariants(prefersReducedMotion)}
                  className={cn(ALERT_DIALOG_PANEL_BASE_CLASS, className)}
                >
                  {children}
                </motion.div>
              </AlertDialogPrimitive.Content>
            </React.Fragment>
          ) : null}
        </AnimatePresence>
      </AlertDialogPortal>
    );
  }

  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Content
        ref={ref}
        className={cn(ALERT_DIALOG_PANEL_BASE_CLASS, className)}
        {...props}
      >
        {children}
      </AlertDialogPrimitive.Content>
    </AlertDialogPortal>
  );
});
AlertDialogContent.displayName = AlertDialogPrimitive.Content.displayName;

export const AlertDialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('space-y-2', className)} {...props} />
);

export const AlertDialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('mt-4 flex flex-wrap items-center justify-end gap-2', className)} {...props} />
);

export const AlertDialogTitle = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Title ref={ref} className={cn('heading-3 text-primary', className)} {...props} />
));
AlertDialogTitle.displayName = AlertDialogPrimitive.Title.displayName;

export const AlertDialogDescription = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Description ref={ref} className={cn('text-sm text-muted', className)} {...props} />
));
AlertDialogDescription.displayName = AlertDialogPrimitive.Description.displayName;

export const AlertDialogAction = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Action>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Action>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Action
    ref={ref}
    className={cn(
      'inline-flex items-center justify-center rounded-control border border-subtle bg-accent px-3 py-2 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-strong focus-visible:outline-2 focus-visible:outline-[color:var(--color-border-primary)] focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60',
      className,
    )}
    {...props}
  />
));
AlertDialogAction.displayName = AlertDialogPrimitive.Action.displayName;

export const AlertDialogCancel = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Cancel>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Cancel>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Cancel
    ref={ref}
    className={cn(
      'inline-flex items-center justify-center rounded-control border border-subtle bg-surface px-3 py-2 text-sm font-semibold text-primary transition-colors hover:bg-elevated focus-visible:outline-2 focus-visible:outline-[color:var(--color-border-primary)] focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60',
      className,
    )}
    {...props}
  />
));
AlertDialogCancel.displayName = AlertDialogPrimitive.Cancel.displayName;
