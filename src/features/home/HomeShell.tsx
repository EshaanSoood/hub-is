import type { ProjectRecord } from '../../types/domain';
import { PersonalizedDashboardPanel } from '../PersonalizedDashboardPanel';
import type { HomeOverlayId, HomeViewId } from './navigation';
import { HomeOverlayHost } from './HomeOverlayHost';
import type { HomeRuntime } from './useHomeRuntime';

interface HomeShellProps {
  activeOverlay: HomeOverlayId | null;
  activeView: HomeViewId;
  onClearOverlay: () => void;
  onOpenRecord: (recordId: string) => void;
  onViewChange: (view: HomeViewId) => void;
  projects: ProjectRecord[];
  runtime: HomeRuntime;
}

const readHomeTitle = (activeOverlay: HomeOverlayId | null) => {
  if (activeOverlay === 'tasks') {
    return 'Tasks';
  }
  if (activeOverlay === 'calendar') {
    return 'Calendar';
  }
  if (activeOverlay === 'reminders') {
    return 'Reminders';
  }
  return 'Home';
};

export const HomeShell = ({
  activeOverlay,
  activeView,
  onClearOverlay,
  onOpenRecord,
  onViewChange,
  projects,
  runtime,
}: HomeShellProps) => (
  <div className="relative space-y-4">
    <h1 className="sr-only">{readHomeTitle(activeOverlay)}</h1>

    <HomeOverlayHost
      activeOverlay={activeOverlay}
      runtime={runtime}
      onClearOverlay={onClearOverlay}
      onOpenRecord={onOpenRecord}
    />

    {activeOverlay !== 'tasks' && activeOverlay !== 'calendar' && activeOverlay !== 'reminders' ? (
      <PersonalizedDashboardPanel
        homeData={runtime.homeData}
        homeLoading={runtime.homeLoading}
        homeReady={runtime.homeReady}
        homeError={runtime.homeError}
        projects={projects}
        onOpenRecord={onOpenRecord}
        initialView={activeView}
        onViewChange={onViewChange}
      />
    ) : null}
  </div>
);
