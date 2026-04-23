import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { getProjectColor } from '../../lib/getProjectColor';

export type TaskCardStatus = 'todo' | 'in_progress' | 'done' | 'cancelled';

interface TaskCardProps {
  title: string;
  status: TaskCardStatus;
  dueLabel?: string | null;
  projectId?: string | null;
  projectName?: string | null;
  subtitle?: string | null;
  className?: string;
  titleClassName?: string;
  trailing?: ReactNode;
  onToggleStatus?: () => void;
  toggleDisabled?: boolean;
  toggleAriaLabel?: string;
  onTitleClick?: () => void;
  onTitleFocus?: () => void;
  onTitleKeyDown?: (event: ReactKeyboardEvent<HTMLButtonElement>) => void;
  titleAriaLabel?: string;
  titlePressed?: boolean;
  titleExpanded?: boolean;
  titleControls?: string;
}

const STATUS_SYMBOLS: Record<TaskCardStatus, string> = {
  todo: '○',
  in_progress: '◐',
  done: '✓',
  cancelled: '⊘',
};

const statusToneClassName = (status: TaskCardStatus): string => {
  if (status === 'done') {
    return 'text-primary';
  }
  if (status === 'cancelled') {
    return 'text-danger';
  }
  return 'text-text-secondary';
};

const titleToneClassName = (status: TaskCardStatus): string => {
  if (status === 'cancelled') {
    return 'line-through text-text-secondary';
  }
  return 'text-text';
};

const ContentBody = ({
  title,
  status,
  dueLabel,
  projectId,
  projectName,
  subtitle,
  titleClassName,
  trailing,
}: {
  title: string;
  status: TaskCardStatus;
  dueLabel?: string | null;
  projectId?: string | null;
  projectName?: string | null;
  subtitle?: string | null;
  titleClassName?: string;
  trailing?: ReactNode;
}) => {
  const hasProjectMeta = Boolean(projectName || projectId);
  const hasMeta = hasProjectMeta || Boolean(subtitle);
  const resolvedProjectName = projectName || (projectId ? 'Space' : null);

  return (
    <>
      <div className="min-w-0 flex-1">
        <span className={cn('block truncate text-sm', titleToneClassName(status), titleClassName)}>
          {title}
        </span>
        {hasMeta ? (
          <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
            {hasProjectMeta ? (
              <>
                <span className={cn('inline-block h-2.5 w-2.5 rounded-full', getProjectColor(projectId))} aria-hidden="true" />
                <span>{resolvedProjectName}</span>
              </>
            ) : null}
            {subtitle ? <span>{subtitle}</span> : null}
          </span>
        ) : null}
      </div>
      {dueLabel ? <span className="shrink-0 text-xs text-text-secondary">{dueLabel}</span> : null}
      {trailing}
    </>
  );
};

export const TaskCard = ({
  title,
  status,
  dueLabel = null,
  projectId = null,
  projectName = null,
  subtitle = null,
  className,
  titleClassName,
  trailing,
  onToggleStatus,
  toggleDisabled = false,
  toggleAriaLabel,
  onTitleClick,
  onTitleFocus,
  onTitleKeyDown,
  titleAriaLabel,
  titlePressed,
  titleExpanded,
  titleControls,
}: TaskCardProps) => {
  const showInteractiveToggle = typeof onToggleStatus === 'function';

  return (
    <div className={cn('flex min-w-0 items-start gap-2', className)}>
      {showInteractiveToggle ? (
        <button
          type="button"
          disabled={toggleDisabled}
          aria-label={toggleAriaLabel}
          onClick={(event) => {
            event.stopPropagation();
            onToggleStatus();
          }}
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm transition-colors hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-50',
            statusToneClassName(status),
          )}
        >
          <span aria-hidden="true">{STATUS_SYMBOLS[status]}</span>
        </button>
      ) : (
        <span
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm',
            statusToneClassName(status),
          )}
          aria-hidden="true"
        >
          {STATUS_SYMBOLS[status]}
        </span>
      )}

      {onTitleClick || onTitleFocus || onTitleKeyDown ? (
        <button
          type="button"
          onClick={onTitleClick}
          onFocus={onTitleFocus}
          onKeyDown={onTitleKeyDown}
          aria-label={titleAriaLabel}
          aria-pressed={titlePressed}
          aria-expanded={titleExpanded}
          aria-controls={titleControls}
          className="flex min-w-0 flex-1 items-start gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          <ContentBody
            title={title}
            status={status}
            dueLabel={dueLabel}
            projectId={projectId}
            projectName={projectName}
            subtitle={subtitle}
            titleClassName={titleClassName}
            trailing={trailing}
          />
        </button>
      ) : (
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <ContentBody
            title={title}
            status={status}
            dueLabel={dueLabel}
            projectId={projectId}
            projectName={projectName}
            subtitle={subtitle}
            titleClassName={titleClassName}
            trailing={trailing}
          />
        </div>
      )}
    </div>
  );
};
