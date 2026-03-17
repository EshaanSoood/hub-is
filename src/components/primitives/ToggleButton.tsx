import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { Toggle } from '../ui/toggle';
import { ToggleGroup as ToggleGroupRoot, ToggleGroupItem } from '../ui/toggle-group';
import { buttonBaseClass, type ButtonSize } from './buttonStyles';

type ToggleVariant = 'primary' | 'secondary' | 'ghost';

const variantClassByState: Record<ToggleVariant, string> = {
  primary:
    'data-[state=off]:border-subtle data-[state=off]:bg-accent data-[state=off]:text-on-primary data-[state=off]:hover:bg-primary-strong data-[state=on]:border-subtle data-[state=on]:bg-primary-strong data-[state=on]:text-on-primary',
  secondary:
    'data-[state=off]:border-subtle data-[state=off]:bg-surface data-[state=off]:text-primary data-[state=off]:hover:bg-elevated data-[state=on]:border-subtle data-[state=on]:bg-accent data-[state=on]:text-on-primary',
  ghost:
    'data-[state=off]:border-transparent data-[state=off]:bg-transparent data-[state=off]:text-primary data-[state=off]:hover:bg-subtle data-[state=on]:border-subtle data-[state=on]:bg-elevated data-[state=on]:text-primary',
};

interface ToggleButtonProps extends Omit<ComponentPropsWithoutRef<typeof Toggle>, 'pressed' | 'onPressedChange' | 'children'> {
  children: ReactNode;
  pressed: boolean;
  onPressedChange?: (pressed: boolean) => void;
  variant?: ToggleVariant;
  size?: ButtonSize;
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-2 py-1 text-xs',
  md: 'px-3 py-2 text-sm',
  lg: 'px-4 py-2.5 text-sm',
};

export const ToggleButton = ({
  children,
  pressed,
  onPressedChange,
  variant = 'secondary',
  size = 'md',
  className,
  disabled,
  ...props
}: ToggleButtonProps) => (
  <Toggle
    pressed={pressed}
    onPressedChange={onPressedChange}
    disabled={disabled}
    className={cn(buttonBaseClass, sizeClasses[size], variantClassByState[variant], className)}
    {...props}
  >
    {children}
  </Toggle>
);

export const ToggleGroup = ToggleGroupRoot;
export { ToggleGroupItem };
