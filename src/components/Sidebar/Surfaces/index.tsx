import type { IconName } from '../../primitives/Icon';
import { SurfaceItem } from './SurfaceItem';

export type SidebarSurfaceId = 'tasks' | 'calendar' | 'reminders' | 'thoughts';

export const parseSidebarSurfaceId = (value: string | null): SidebarSurfaceId | null =>
  value === 'tasks' || value === 'calendar' || value === 'reminders' || value === 'thoughts'
    ? value
    : null;

export const buildSurfaceHref = (surfaceId: SidebarSurfaceId): string =>
  `/projects?surface=${encodeURIComponent(surfaceId)}`;

const SURFACE_ITEMS: Array<{
  id: SidebarSurfaceId;
  iconName: IconName;
  label: string;
}> = [
  { id: 'tasks', iconName: 'tasks', label: 'Tasks' },
  { id: 'calendar', iconName: 'calendar', label: 'Calendar' },
  { id: 'reminders', iconName: 'reminders', label: 'Reminders' },
  { id: 'thoughts', iconName: 'thought-pile', label: 'Quick Thoughts' },
];

interface SurfacesProps {
  activeSurface: SidebarSurfaceId | null;
  isCollapsed: boolean;
  onSelectSurface: (surfaceId: SidebarSurfaceId) => void;
  showLabels: boolean;
}

export const Surfaces = ({
  activeSurface,
  isCollapsed,
  onSelectSurface,
  showLabels,
}: SurfacesProps) => (
  <div className={`flex ${isCollapsed ? 'flex-col items-center gap-2' : 'flex-col gap-2'}`}>
    {SURFACE_ITEMS.map((surface) => (
      <SurfaceItem
        key={surface.id}
        active={activeSurface === surface.id}
        iconName={surface.iconName}
        isCollapsed={isCollapsed}
        label={surface.label}
        onClick={() => onSelectSurface(surface.id)}
        showLabels={showLabels}
      />
    ))}
  </div>
);
