import { SidebarLabel } from '../motion/SidebarLabel';
import { SidebarSelectionMarker } from '../motion/SidebarSelectionMarker';
import { Icon, type IconName } from '../../primitives/Icon';

interface SurfaceItemProps {
  active: boolean;
  id: string;
  iconName: IconName;
  isCollapsed: boolean;
  label: string;
  onClick: () => void;
  showLabels: boolean;
}

export const SurfaceItem = ({
  active,
  id,
  iconName,
  isCollapsed,
  label,
  onClick,
  showLabels,
}: SurfaceItemProps) => (
  <button
    type="button"
    data-home-launcher={id}
    data-sidebar-surface={id}
    aria-current={active ? 'page' : undefined}
    aria-label={isCollapsed ? label : undefined}
    className={`interactive interactive-subtle sidebar-row relative overflow-hidden text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
      active
        ? 'sidebar-row-button sidebar-row-active'
        : 'sidebar-row-button text-text-secondary hover:bg-surface-highest hover:text-text'
    } ${isCollapsed ? 'h-10 w-10 justify-center px-0 py-0' : 'w-full'}`}
    onClick={onClick}
  >
    {active ? <SidebarSelectionMarker /> : null}
    <span className="relative z-[1] flex h-4 w-4 shrink-0 items-center justify-center self-center">
      <Icon name={iconName} size={16} />
    </span>
    {!isCollapsed ? (
      <SidebarLabel show={showLabels} className="relative z-[1] min-w-0 flex-1">
        <span className="block truncate text-sm font-medium leading-none">{label}</span>
      </SidebarLabel>
    ) : null}
  </button>
);
