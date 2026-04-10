import { SurfaceItem } from './SurfaceItem';

export type SidebarSurfaceId = 'tasks' | 'calendar' | 'reminders' | 'thoughts';

export const buildSurfaceHref = (surfaceId: SidebarSurfaceId): string =>
  `/projects?surface=${encodeURIComponent(surfaceId)}`;

const SURFACE_ITEMS: Array<{
  id: SidebarSurfaceId;
  iconName: 'tasks' | 'calendar' | 'reminders' | 'thought-pile';
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
  <div className={`flex ${isCollapsed ? 'flex-col items-center gap-2' : 'flex-col gap-1'}`}>
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
