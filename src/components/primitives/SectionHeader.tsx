import { cn } from '../../lib/cn';

export const SectionHeader = ({
  title,
  subtitle,
  actions,
  className,
  titleId,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
  titleId?: string;
}) => (
  <header className={cn('flex flex-wrap items-start justify-between gap-3', className)}>
    <div>
      <h3 id={titleId} className="text-sm font-semibold text-primary">
        {title}
      </h3>
      {subtitle ? <p className="mt-1 text-xs text-muted">{subtitle}</p> : null}
    </div>
    {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
  </header>
);
