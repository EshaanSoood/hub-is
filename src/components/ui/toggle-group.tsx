import * as React from 'react';
import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group';
import { cn } from '../../lib/cn';

export const ToggleGroup = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root>
>(({ className, ...props }, ref) => (
  <ToggleGroupPrimitive.Root ref={ref} className={cn('inline-flex items-center gap-2', className)} {...props} />
));
ToggleGroup.displayName = ToggleGroupPrimitive.Root.displayName;

export const ToggleGroupItem = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item>
>(({ className, ...props }, ref) => (
  <ToggleGroupPrimitive.Item
    ref={ref}
    className={cn(
      'inline-flex items-center justify-center rounded-control border border-secondary/30 bg-surface px-3 py-2 text-sm font-semibold text-secondary transition-colors hover:border-secondary/45 hover:bg-secondary/10 hover:text-secondary-strong focus-visible:outline-2 focus-visible:outline-[color:var(--color-border-primary)] focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-60 data-[state=on]:border-secondary/40 data-[state=on]:bg-secondary data-[state=on]:text-on-secondary',
      className,
    )}
    {...props}
  />
));
ToggleGroupItem.displayName = ToggleGroupPrimitive.Item.displayName;
