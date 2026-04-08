import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { cn } from '../../lib/cn';
import { dialogSurfaceVariants, routeFadeVariants } from '../motion/hubMotion';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogPortal = DialogPrimitive.Portal;
export const DialogClose = DialogPrimitive.Close;

export const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay> & { animated?: boolean }
>(({ className, animated = false, ...props }, ref) => {
  const prefersReducedMotion = useReducedMotion() ?? false;
  if (!animated) {
    return <DialogPrimitive.Overlay ref={ref} className={cn('fixed inset-0 z-[300] bg-overlay', className)} {...props} />;
  }
  return (
    <DialogPrimitive.Overlay asChild {...props}>
      <motion.div
        ref={ref}
        initial="initial"
        animate="animate"
        exit="exit"
        variants={routeFadeVariants(prefersReducedMotion)}
        className={cn('fixed inset-0 z-[300] bg-overlay', className)}
      />
    </DialogPrimitive.Overlay>
  );
});
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { layoutId?: string; animated?: boolean; open?: boolean }
>(({ className, children, layoutId, animated = false, open, ...props }, ref) => {
  const prefersReducedMotion = useReducedMotion() ?? false;
  if (animated && typeof open === 'boolean') {
    return (
      <DialogPortal forceMount>
        <AnimatePresence>
          {open ? (
            <React.Fragment key="dialog-content">
              <DialogOverlay animated forceMount />
              <DialogPrimitive.Content forceMount asChild {...props}>
                <motion.div
                  ref={ref}
                  layoutId={!prefersReducedMotion ? layoutId : undefined}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  variants={dialogSurfaceVariants(prefersReducedMotion)}
                  className={cn(
                    'dialog-panel-size fixed left-1/2 top-1/2 z-[300] -translate-x-1/2 -translate-y-1/2 rounded-panel border border-subtle bg-elevated p-5 text-text shadow-soft',
                    className,
                  )}
                >
                  {children}
                </motion.div>
              </DialogPrimitive.Content>
            </React.Fragment>
          ) : null}
        </AnimatePresence>
      </DialogPortal>
    );
  }

  return (
    <DialogPortal>
      <DialogOverlay animated={animated} />
      {animated ? (
        <DialogPrimitive.Content asChild {...props}>
          <motion.div
            ref={ref}
            layoutId={!prefersReducedMotion ? layoutId : undefined}
            initial="initial"
            animate="animate"
            exit="exit"
            variants={dialogSurfaceVariants(prefersReducedMotion)}
            className={cn(
              'dialog-panel-size fixed left-1/2 top-1/2 z-[300] -translate-x-1/2 -translate-y-1/2 rounded-panel border border-subtle bg-elevated p-5 text-text shadow-soft',
              className,
            )}
          >
            {children}
          </motion.div>
        </DialogPrimitive.Content>
      ) : (
        <DialogPrimitive.Content
          ref={ref}
          className={cn(
            'dialog-panel-size fixed left-1/2 top-1/2 z-[300] -translate-x-1/2 -translate-y-1/2 rounded-panel border border-subtle bg-elevated p-5 text-text shadow-soft',
            className,
          )}
          {...props}
        >
          {children}
        </DialogPrimitive.Content>
      )}
    </DialogPortal>
  );
});
DialogContent.displayName = DialogPrimitive.Content.displayName;

export const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('space-y-2', className)} {...props} />
);

export const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('mt-4 flex flex-wrap items-center justify-end gap-2', className)} {...props} />
);

export const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn('heading-2 text-primary', className)} {...props} />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

export const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn('text-sm text-muted', className)} {...props} />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;
