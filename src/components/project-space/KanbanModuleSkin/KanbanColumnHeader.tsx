import { cn } from '../../../lib/cn';
import { Icon, IconButton } from '../../primitives';

interface KanbanColumnHeaderProps {
  label: string;
  count: number;
  isCollapsed: boolean;
  overLimit: boolean;
  wipLimit?: number;
  onToggleCollapse: () => void;
}

export const KanbanColumnHeader = ({
  label,
  count,
  isCollapsed,
  overLimit,
  wipLimit,
  onToggleCollapse,
}: KanbanColumnHeaderProps) => {
  return (
    <header className="rounded-control px-1">
      <div className="flex items-center gap-1">
        <h5 className="flex-1 truncate text-sm font-bold text-text" title={label}>
          {label}
        </h5>
        <span className={cn('shrink-0 text-[11px] text-muted', overLimit && 'text-danger')} aria-label={`${count} cards`}>
          {count}
        </span>
        <IconButton
          aria-label={isCollapsed ? `Expand ${label}` : `Collapse ${label}`}
          variant="ghost"
          size="sm"
          onClick={onToggleCollapse}
        >
          <Icon name="chevron-down" className={cn('h-3.5 w-3.5 transition-transform', isCollapsed && '-rotate-90')} />
        </IconButton>
      </div>
      {overLimit ? <p className="text-[11px] text-danger">Over limit ({count}/{wipLimit})</p> : null}
    </header>
  );
};
