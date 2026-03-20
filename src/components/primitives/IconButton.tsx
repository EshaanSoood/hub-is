import { forwardRef, useEffect } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { buttonBaseClass, getButtonClassName, type ButtonSize } from './buttonStyles';

type IconButtonVariant = 'ghost' | 'secondary' | 'danger';

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-7 w-7 text-xs',
  md: 'h-8 w-8 text-sm',
  lg: 'h-9 w-9 text-base',
};

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  children: ReactNode;
  variant?: IconButtonVariant;
  size?: ButtonSize;
  'aria-label': string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  {
    children,
    variant = 'ghost',
    size = 'md',
    className,
    'aria-label': ariaLabel,
    ...props
  },
  ref,
) {
  useEffect(() => {
    if (import.meta.env.DEV && !ariaLabel.trim()) {
      // Keep runtime signal in dev for icon-only buttons that must be named.
      console.warn('IconButton requires a non-empty aria-label.');
    }
  }, [ariaLabel]);

  const variantClass = getButtonClassName(variant, 'sm');

  return (
    <button
      ref={ref}
      type="button"
      {...props}
      aria-label={ariaLabel}
      className={cn(
        buttonBaseClass,
        variantClass,
        'rounded-control p-0',
        sizeClasses[size],
        className,
      )}
    >
      {children}
    </button>
  );
});
