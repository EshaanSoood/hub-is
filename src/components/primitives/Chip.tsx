import { Icon } from './Icon';
import { cn } from '../../lib/cn';

type ChipVariant = 'neutral' | 'selected' | 'dismissible';

const chipClasses: Record<ChipVariant, string> = {
  neutral: 'border-subtle bg-surface text-text',
  selected: 'border-subtle bg-accent text-on-primary',
  dismissible: 'border-subtle bg-surface text-primary',
};

export const Chip = ({
  children,
  variant = 'neutral',
  className,
}: {
  children: React.ReactNode;
  variant?: ChipVariant;
  className?: string;
}) => (
  <span className={cn('inline-flex items-center rounded-control border px-2 py-1 text-xs font-semibold', chipClasses[variant], className)}>
    {children}
  </span>
);

export const FilterChip = ({
  children,
  selected,
  onClick,
  onDismiss,
  disabled,
  className,
}: {
  children: React.ReactNode;
  selected?: boolean;
  onClick?: () => void;
  onDismiss?: () => void;
  disabled?: boolean;
  className?: string;
}) => (
  <span className={cn('inline-flex items-center gap-1 rounded-control border px-2 py-1 text-xs font-semibold', selected ? chipClasses.selected : chipClasses.neutral, disabled && 'opacity-60', className)}>
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className="rounded-control px-0.5 text-current"
    >
      {children}
    </button>
    {onDismiss ? (
      <button
        type="button"
        disabled={disabled}
        onClick={onDismiss}
        aria-label="Dismiss filter"
        className="rounded-control px-0.5 text-current"
      >
        <Icon name="close" className="text-[12px]" />
      </button>
    ) : null}
  </span>
);
