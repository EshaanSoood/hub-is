import { Icon, type IconName } from '../../primitives/Icon';

interface SurfaceItemProps {
  active: boolean;
  iconName: IconName;
  isCollapsed: boolean;
  label: string;
  onClick: () => void;
}

export const SurfaceItem = ({
  active,
  iconName,
  isCollapsed,
  label,
  onClick,
}: SurfaceItemProps) => (
  <button
    type="button"
    aria-current={active ? 'page' : undefined}
    aria-label={isCollapsed ? label : undefined}
    className={`interactive interactive-subtle flex items-center gap-3 rounded-control border px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
      active
        ? 'border-subtle bg-elevated text-text'
        : 'border-transparent bg-transparent text-text-secondary hover:border-subtle hover:bg-surface hover:text-text'
    } ${isCollapsed ? 'h-10 w-10 justify-center px-0 py-0' : 'w-full'}`}
    onClick={onClick}
  >
    <Icon name={iconName} size={16} />
    {!isCollapsed ? <span className="min-w-0 truncate text-sm font-medium">{label}</span> : null}
  </button>
);
