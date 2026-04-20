import type { HomeOverlayId, HomeViewId } from '../../../features/home/navigation';
import type { IconName } from '../../primitives/Icon';
import { SurfaceItem } from './SurfaceItem';

export type SidebarSurfaceId = HomeOverlayId;
export type SidebarHomeViewId = HomeViewId;

const HOME_VIEW_ITEMS: Array<{
  id: SidebarHomeViewId;
  iconName: IconName;
  label: string;
}> = [
  { id: 'project-lens', iconName: 'home', label: 'Project Lens' },
  { id: 'stream', iconName: 'timeline', label: 'Stream' },
];

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
  activeHomeView: SidebarHomeViewId;
  activeSurface: SidebarSurfaceId | null;
  onSelectHomeView: (viewId: SidebarHomeViewId) => void;
  isCollapsed: boolean;
  onSelectSurface: (surfaceId: SidebarSurfaceId) => void;
  showLabels: boolean;
}

export const Surfaces = ({
  activeHomeView,
  activeSurface,
  onSelectHomeView,
  isCollapsed,
  onSelectSurface,
  showLabels,
}: SurfacesProps) => (
  <div className={`flex ${isCollapsed ? 'flex-col items-center gap-3' : 'flex-col gap-3'}`}>
    <div role="group" aria-label="Home views" className={`flex ${isCollapsed ? 'flex-col items-center gap-2' : 'flex-col gap-2'}`}>
      {HOME_VIEW_ITEMS.map((view) => (
        <SurfaceItem
          key={view.id}
          active={activeSurface === null && activeHomeView === view.id}
          id={view.id}
          iconName={view.iconName}
          isCollapsed={isCollapsed}
          label={view.label}
          onClick={() => onSelectHomeView(view.id)}
          showLabels={showLabels}
        />
      ))}
    </div>

    <div role="group" aria-label="Home launchers" className={`flex ${isCollapsed ? 'flex-col items-center gap-2' : 'flex-col gap-2'}`}>
      {SURFACE_ITEMS.map((surface) => (
        <SurfaceItem
          key={surface.id}
          active={activeSurface === surface.id}
          id={surface.id}
          iconName={surface.iconName}
          isCollapsed={isCollapsed}
          label={surface.label}
          onClick={() => onSelectSurface(surface.id)}
          showLabels={showLabels}
        />
      ))}
    </div>
  </div>
);
