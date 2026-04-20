import type { HomeContentViewId, HomeOverlayId, HomeTabId } from '../../../features/home/navigation';
import type { IconName } from '../../primitives/Icon';
import { SurfaceItem } from './SurfaceItem';

export type SidebarSurfaceId = HomeOverlayId;
export type SidebarHomeContentViewId = HomeContentViewId;
export type SidebarHomeTabId = HomeTabId;

const HOME_CONTENT_ITEMS: Array<{
  id: SidebarHomeContentViewId;
  iconName: IconName;
  label: string;
}> = [
  { id: 'lenses', iconName: 'focus', label: 'Lenses' },
  { id: 'stream', iconName: 'timeline', label: 'Stream' },
];

const SURFACE_ITEMS: Array<{
  id: SidebarSurfaceId;
  iconName: IconName;
  label: string;
}> = [
  { id: 'thoughts', iconName: 'thought-pile', label: 'Quick thoughts' },
];

interface SurfacesProps {
  activeHomeContentView: SidebarHomeContentViewId;
  activeHomeTab: SidebarHomeTabId;
  activeSurface: SidebarSurfaceId | null;
  onSelectHomeContentView: (viewId: SidebarHomeContentViewId) => void;
  isCollapsed: boolean;
  onSelectSurface: (surfaceId: SidebarSurfaceId) => void;
  showLabels: boolean;
}

export const Surfaces = ({
  activeHomeContentView,
  activeHomeTab,
  activeSurface,
  onSelectHomeContentView,
  isCollapsed,
  onSelectSurface,
  showLabels,
}: SurfacesProps) => (
  <div className={`flex ${isCollapsed ? 'flex-col items-center gap-3' : 'flex-col gap-3'}`}>
    <div role="group" aria-label="Home subviews" className={`flex ${isCollapsed ? 'flex-col items-center gap-2' : 'flex-col gap-2'}`}>
      {HOME_CONTENT_ITEMS.map((view) => (
        <SurfaceItem
          key={view.id}
          active={activeSurface === null && activeHomeTab === 'overview' && activeHomeContentView === view.id}
          id={view.id}
          iconName={view.iconName}
          isCollapsed={isCollapsed}
          label={view.label}
          onClick={() => onSelectHomeContentView(view.id)}
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
