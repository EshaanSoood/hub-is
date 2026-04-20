import type { ProjectRecord } from '../../types/domain';
import { PersonalizedDashboardPanel } from '../PersonalizedDashboardPanel';
import type { HomeViewId } from './navigation';
import type { HomeRuntime } from './useHomeRuntime';

interface HomeViewHostProps {
  activeView: HomeViewId;
  onOpenRecord: (recordId: string) => void;
  onViewChange: (view: HomeViewId) => void;
  projects: ProjectRecord[];
  runtime: HomeRuntime;
}

export const HomeViewHost = ({
  activeView,
  onOpenRecord,
  onViewChange,
  projects,
  runtime,
}: HomeViewHostProps) => (
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
);
