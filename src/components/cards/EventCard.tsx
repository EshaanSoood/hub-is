import { cn } from '../../lib/cn';
import { getProjectColor } from '../../lib/getProjectColor';

interface EventCardProps {
  title: string;
  timeLabel?: string | null;
  detailLabel?: string | null;
  projectId?: string | null;
  projectName?: string | null;
  className?: string;
}

export const EventCard = ({
  title,
  timeLabel = null,
  detailLabel = null,
  projectId = null,
  projectName = null,
  className,
}: EventCardProps) => {
  const hasProjectMeta = Boolean(projectName || projectId);
  const resolvedProjectName = projectName || (projectId ? 'Project' : null);

  return (
    <div className={cn('flex min-w-0 items-start justify-between gap-2', className)}>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-semibold text-text">{title}</p>
        {hasProjectMeta ? (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-text">
            <span className={cn('inline-block h-2.5 w-2.5 rounded-full', getProjectColor(projectId))} aria-hidden="true" />
            <span className="truncate">{resolvedProjectName}</span>
          </p>
        ) : null}
      </div>
      {timeLabel || detailLabel ? (
        <div className="shrink-0 text-right">
          {timeLabel ? <p className="text-[11px] font-medium text-text">{timeLabel}</p> : null}
          {detailLabel ? <p className="text-[11px] text-text-secondary">{detailLabel}</p> : null}
        </div>
      ) : null}
    </div>
  );
};
