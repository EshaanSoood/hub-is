import { cn } from '../../lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-2 py-1 text-xs',
  md: 'px-3 py-2 text-sm',
  lg: 'px-4 py-2.5 text-sm',
};

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'interactive interactive-fold border border-subtle bg-accent text-on-primary hover:bg-primary-strong active:bg-primary-strong',
  secondary:
    'border border-secondary/30 bg-surface text-secondary hover:border-secondary/45 hover:bg-secondary/10 hover:text-secondary-strong active:bg-secondary/15',
  ghost:
    'border border-transparent bg-transparent text-secondary hover:bg-secondary/10 hover:text-secondary-strong active:bg-secondary/15',
  danger: 'border border-danger bg-danger text-on-primary hover:bg-danger-subtle hover:text-danger active:bg-danger-subtle',
};

export const buttonBaseClass =
  'inline-flex items-center justify-center gap-2 rounded-control font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60';

export const getButtonClassName = (
  variant: ButtonVariant,
  size: ButtonSize,
  className?: string,
): string => cn(buttonBaseClass, sizeClasses[size], variantClasses[variant], className);
