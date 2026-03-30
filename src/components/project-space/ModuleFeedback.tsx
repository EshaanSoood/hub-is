import { ICON_MAP, Icon, type IconName } from '../primitives/Icon';
import { Button } from '../primitives/Button';
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
  sizeTier,
  className,
}: {
  title: string;
  description?: string;
  iconName?: string;
  ctaLabel?: string;
  onCta?: () => void;
  compact?: boolean;
  sizeTier?: 'S' | 'M' | 'L';
  className?: string;
}) => {
  const hasTierSizing = typeof sizeTier === 'string';
  const resolvedTier = sizeTier ?? 'M';
  const useCompactLayout = hasTierSizing ? compact || resolvedTier === 'S' : compact;
  const showIcon = !useCompactLayout && typeof iconName === 'string' && iconName in ICON_MAP;
  const canRenderCta = typeof ctaLabel === 'string' && ctaLabel.length > 0 && typeof onCta === 'function';
  const iconSizeClass = hasTierSizing && resolvedTier === 'L' ? 'h-10 w-10' : 'h-8 w-8';
  const titleClass = hasTierSizing && resolvedTier === 'L' ? 'text-base' : 'text-sm';
  const contentClass = hasTierSizing && resolvedTier === 'L' ? 'mx-auto flex w-full max-w-xs flex-col items-center' : 'mx-auto flex w-full flex-col items-center';
  const descriptionClass = hasTierSizing
    ? resolvedTier === 'S'
      ? 'mt-1 text-xs text-muted line-clamp-2'
      : resolvedTier === 'L'
        ? 'mt-2 text-sm text-muted'
        : 'mt-1 text-sm text-muted'
    : cn('mt-1 text-sm text-muted', compact ? 'line-clamp-1' : null);
  const ctaSize = resolvedTier === 'L' ? 'md' : 'sm';

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'my-auto w-full rounded-panel border border-subtle bg-surface text-center',
        hasTierSizing ? (resolvedTier === 'L' ? 'p-6' : useCompactLayout ? 'p-3' : 'p-5') : compact ? 'p-3' : 'p-5',
        className,
      )}
    >
      {showIcon ? (
        <div className="mb-2 flex justify-center">
          <Icon name={iconName as IconName} className={cn(iconSizeClass, 'text-muted')} />
        </div>
      ) : null}
      <div className={contentClass}>
        <h4 className={cn(titleClass, 'font-semibold text-text')}>{title}</h4>
        {description ? <p className={descriptionClass}>{description}</p> : null}
        {canRenderCta ? (
          hasTierSizing ? (
            <Button type="button" variant="secondary" size={ctaSize} onClick={onCta} className="mt-3">
              {ctaLabel}
            </Button>
          ) : (
            <button
              type="button"
              onClick={onCta}
              className="mt-3 text-sm font-medium text-primary underline underline-offset-2 hover:text-primary-strong"
            >
              {ctaLabel}
            </button>
          )
        ) : null}
      </div>
    </div>
  );
};
