import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { getButtonClassName, type ButtonSize, type ButtonVariant } from './buttonStyles';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  loadingLabel?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'secondary',
      size = 'md',
      loading = false,
      loadingLabel = 'Loading',
      disabled,
      className,
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        type="button"
        {...props}
        disabled={isDisabled}
        className={getButtonClassName(variant, size, className)}
      >
        {loading ? <span aria-hidden="true">...</span> : null}
        <span>{loading ? loadingLabel : children}</span>
      </button>
    );
  },
);

Button.displayName = 'Button';
