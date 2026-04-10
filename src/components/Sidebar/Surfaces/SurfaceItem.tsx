import { SidebarLabel } from '../motion/SidebarLabel';
import { SidebarSelectionMarker } from '../motion/SidebarSelectionMarker';
import { Icon, type IconName } from '../../primitives/Icon';

interface SurfaceItemProps {
  active: boolean;
  iconName: IconName;
  isCollapsed: boolean;
  label: string;
  onClick: () => void;
  showLabels: boolean;
}

export const SurfaceItem = ({
  active,
  iconName,
  isCollapsed,
  label,
  onClick,
  showLabels,
}: SurfaceItemProps) => (
  <button
    type="button"
    aria-current={active ? 'page' : undefined}
    aria-label={isCollapsed ? label : undefined}
    className={`interactive interactive-subtle relative flex items-center gap-3 overflow-hidden rounded-control border px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
      active
        ? 'border-subtle text-text'
        : 'border-transparent bg-transparent text-text-secondary hover:border-subtle hover:bg-surface hover:text-text'
    } ${isCollapsed ? 'h-10 w-10 justify-center px-0 py-0' : 'w-full'}`}
    onClick={onClick}
  >
    {active ? <SidebarSelectionMarker /> : null}
    <span className="relative z-[1] flex shrink-0">
      <Icon name={iconName} size={16} />
    </span>
    {!isCollapsed ? (
      <SidebarLabel show={showLabels} className="relative z-[1] min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{label}</span>
      </SidebarLabel>
    ) : null}
  </button>
);
