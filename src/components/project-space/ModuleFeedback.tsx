import { ICON_MAP, Icon, type IconName } from '../primitives/Icon';
import { cn } from '../../lib/cn';

export const ModuleLoadingState = ({
  label = 'Loading content',
  visibleLabel,
  rows = 4,
  className,
}: {
  label?: string;
  visibleLabel?: string;
  rows?: number;
  className?: string;
}) => {
  const safeRows = Number.isFinite(rows) ? Math.max(0, Math.floor(rows)) : 0;
  return (
    <div role="status" aria-live="polite" className={cn('space-y-2 rounded-panel border border-subtle bg-surface p-3', className)}>
      <span className="sr-only">{label}</span>
      {visibleLabel ? <p className="mb-2 text-xs text-muted">{visibleLabel}</p> : null}
      {Array.from({ length: safeRows }).map((_, index) => (
        <div
          key={index}
          className={cn(
            'h-3 animate-pulse rounded-control bg-muted/30 motion-reduce:animate-none',
            index === 0 ? 'w-3/4' : index === safeRows - 1 ? 'w-2/3' : 'w-full',
          )}
          aria-hidden="true"
        />
      ))}
    </div>
  );
};

export const ModuleEmptyState = ({
  title,
  description,
  iconName,
  ctaLabel,
  onCta,
  compact = false,
  className,
}: {
  title: string;
  description?: string;
  iconName?: string;
  ctaLabel?: string;
  onCta?: () => void;
  compact?: boolean;
  className?: string;
}) => {
  const showIcon = !compact && typeof iconName === 'string' && iconName in ICON_MAP;
  const canRenderCta = typeof ctaLabel === 'string' && ctaLabel.length > 0 && typeof onCta === 'function';

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn('my-auto rounded-panel border border-subtle bg-surface text-center', compact ? 'p-3' : 'p-5', className)}
    >
      {showIcon ? (
        <div className="mb-2 flex justify-center">
          <Icon name={iconName as IconName} className="h-8 w-8 text-muted" />
        </div>
      ) : null}
      <h4 className="text-sm font-semibold text-text">{title}</h4>
      {description ? <p className={cn('mt-1 text-sm text-muted', compact ? 'line-clamp-1' : null)}>{description}</p> : null}
      {canRenderCta ? (
        <button
          type="button"
          onClick={onCta}
          className="mt-3 text-sm font-medium text-primary underline underline-offset-2 hover:text-primary-strong"
        >
          {ctaLabel}
        </button>
      ) : null}
    </div>
  );
};
