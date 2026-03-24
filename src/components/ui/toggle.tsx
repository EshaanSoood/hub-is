import * as React from 'react';
import * as TogglePrimitive from '@radix-ui/react-toggle';
import { cn } from '../../lib/cn';

export const Toggle = React.forwardRef<
  React.ElementRef<typeof TogglePrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TogglePrimitive.Root>
>(({ className, ...props }, ref) => (
  <TogglePrimitive.Root
    ref={ref}
    className={cn(
      'inline-flex items-center justify-center rounded-control border border-subtle bg-surface px-3 py-2 text-sm font-semibold text-primary transition-colors hover:bg-elevated focus-visible:outline-2 focus-visible:outline-[color:var(--color-border-primary)] focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-60 data-[state=on]:bg-accent data-[state=on]:text-on-primary',
      className,
    )}
    {...props}
  />
));
Toggle.displayName = TogglePrimitive.Root.displayName;
