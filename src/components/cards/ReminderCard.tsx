import { cn } from '../../lib/cn';
import { getProjectColor } from '../../lib/getProjectColor';

interface ReminderCardProps {
  title: string;
  whenLabel: string;
  projectId?: string | null;
  projectName?: string | null;
  overdue?: boolean;
  className?: string;
}

export const ReminderCard = ({
  title,
  whenLabel,
  projectId = null,
  projectName = null,
  overdue = false,
  className,
}: ReminderCardProps) => {
  const hasProjectMeta = Boolean(projectName || projectId);
  const resolvedProjectName = projectName || (projectId ? 'Space' : null);

  return (
    <div className={cn('min-w-0', className)}>
      <p className="truncate text-sm font-medium text-text">{title}</p>
      <p className={cn('mt-1 flex flex-wrap items-center gap-2 text-xs', overdue ? 'text-text underline' : 'text-text-secondary')}>
        {hasProjectMeta ? (
          <>
            <span className={cn('inline-block h-2.5 w-2.5 rounded-full', getProjectColor(projectId))} aria-hidden="true" />
            <span>{resolvedProjectName}</span>
          </>
        ) : null}
        <span>{whenLabel}</span>
      </p>
    </div>
  );
};
