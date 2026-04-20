import { cn } from '../../lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-2 py-1 text-xs',
  md: 'px-3 py-2 text-sm',
  lg: 'px-4 py-2.5 text-sm',
};

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'interactive interactive-fold cta-primary',
  secondary:
    'bg-surface-low text-secondary hover:bg-surface-container hover:text-secondary-strong active:bg-surface-container',
  ghost:
    'bg-transparent text-secondary hover:bg-surface-low hover:text-secondary-strong active:bg-surface-low',
  danger: 'interactive interactive-fold bg-danger text-on-primary hover:bg-danger active:bg-danger',
};

export const buttonBaseClass =
  'inline-flex items-center justify-center gap-2 rounded-control font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60';

export const getButtonClassName = (
  variant: ButtonVariant,
  size: ButtonSize,
  className?: string,
): string => cn(buttonBaseClass, sizeClasses[size], variantClasses[variant], className);
