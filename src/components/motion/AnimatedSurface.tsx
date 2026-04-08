import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { dialogSurfaceVariants, popoverVariants } from './hubMotion';

interface AnimatedSurfaceProps extends Omit<ComponentPropsWithoutRef<typeof motion.div>, 'children' | 'initial' | 'animate' | 'exit' | 'variants' | 'aria-label'> {
  children: ReactNode;
  transformOrigin?: string;
  ariaLabel?: string;
  variant?: 'popover' | 'dialog';
}

export const AnimatedSurface = forwardRef<HTMLDivElement, AnimatedSurfaceProps>(({
  children,
  className,
  style,
  transformOrigin,
  role,
  ariaLabel,
  variant = 'popover',
  ...restProps
}, ref) => {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const variants = variant === 'dialog' ? dialogSurfaceVariants(prefersReducedMotion) : popoverVariants(prefersReducedMotion);

  return (
    <motion.div
      ref={ref}
      initial="initial"
      animate="animate"
      exit="exit"
      variants={variants}
      role={role}
      aria-label={ariaLabel}
      className={className}
      {...restProps}
      style={{
        transformOrigin,
        ...style,
      }}
    >
      {children}
    </motion.div>
  );
});

AnimatedSurface.displayName = 'AnimatedSurface';
