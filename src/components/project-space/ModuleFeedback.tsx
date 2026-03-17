import { cn } from '../../lib/cn';

export const ModuleLoadingState = ({
  label = 'Loading content',
  rows = 4,
  className,
}: {
  label?: string;
  rows?: number;
  className?: string;
}) => {
  const safeRows = Number.isFinite(rows) ? Math.max(0, Math.floor(rows)) : 0;
  return (
    <div role="status" aria-live="polite" className={cn('space-y-2 rounded-panel border border-subtle bg-surface p-3', className)}>
      <span className="sr-only">{label}</span>
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
  className,
}: {
  title: string;
  description?: string;
  className?: string;
}) => (
  <div role="status" aria-live="polite" className={cn('rounded-panel border border-subtle bg-surface p-5 text-center', className)}>
    <h4 className="text-sm font-semibold text-text">{title}</h4>
    {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
  </div>
);
