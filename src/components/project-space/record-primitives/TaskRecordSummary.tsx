import { TaskCard, type TaskCardStatus } from '../../cards/TaskCard';
import { cn } from '../../../lib/cn';
import type { KeyboardEvent as ReactKeyboardEvent, ReactElement, ReactNode } from 'react';

interface TaskRecordSummaryProps {
  title: string;
  status: TaskCardStatus;
  dueLabel?: string | null;
  priorityLabel?: string | null;
  assigneeLabel?: string | null;
  subtaskCount?: number;
  frame?: 'none' | 'panel';
  className?: string;
  trailing?: ReactNode;
  onToggleStatus?: () => void;
  toggleDisabled?: boolean;
  toggleAriaLabel?: string;
  onTitleClick?: () => void;
  onTitleFocus?: () => void;
  onTitleKeyDown?: (event: ReactKeyboardEvent<HTMLButtonElement>) => void;
  titleAriaLabel?: string;
  titlePressed?: boolean;
}

export const TaskRecordSummary = ({
  title,
  status,
  dueLabel = null,
  priorityLabel = null,
  assigneeLabel = null,
  subtaskCount,
  frame = 'none',
  className,
  trailing,
  onToggleStatus,
  toggleDisabled = false,
  toggleAriaLabel,
  onTitleClick,
  onTitleFocus,
  onTitleKeyDown,
  titleAriaLabel,
  titlePressed,
}: TaskRecordSummaryProps): ReactElement => {
  const metaItems = [
    assigneeLabel ? `Assignee ${assigneeLabel}` : null,
    typeof subtaskCount === 'number' && subtaskCount > 0 ? `${subtaskCount} subtask${subtaskCount === 1 ? '' : 's'}` : null,
  ].filter(Boolean);

  return (
    <div
      className={cn(
        frame === 'panel' ? 'rounded-panel border border-border-muted bg-surface-elevated p-3' : null,
        className,
      )}
    >
      <TaskCard
        title={title}
        status={status}
        dueLabel={dueLabel}
        subtitle={priorityLabel ? `Priority ${priorityLabel}` : null}
        trailing={trailing}
        onToggleStatus={onToggleStatus}
        toggleDisabled={toggleDisabled}
        toggleAriaLabel={toggleAriaLabel}
        onTitleClick={onTitleClick}
        onTitleFocus={onTitleFocus}
        onTitleKeyDown={onTitleKeyDown}
        titleAriaLabel={titleAriaLabel}
        titlePressed={titlePressed}
      />
      {metaItems.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted">
          {metaItems.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
};
