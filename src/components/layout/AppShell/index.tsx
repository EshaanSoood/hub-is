import { type ReactNode, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthz } from '../../../context/AuthzContext';
import { useProjects } from '../../../context/ProjectsContext';
import {
  buildHomeOverlayHref,
  parseHomeContentViewId,
  parseHomeOverviewViewId,
  parseHomeOverlayId,
  parseHomePaneId,
  parseHomeTabId,
  type HomeContentViewId,
  type HomeOverviewViewId,
  type HomeTabId,
} from '../../../features/home/navigation';
import { useProjectPanes } from '../../../hooks/useProjectPanes';
import { useRouteFocusReset } from '../../../hooks/useRouteFocusReset';
import { SidebarShell } from '../../Sidebar';
import { AppCommandBar } from './AppCommandBar';

const decodePathSegment = (value: string | null): string | null => {
  if (!value) {
    return null;
  }
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

interface HomeRouteState {
  content: HomeContentViewId;
  overview: HomeOverviewViewId;
  paneId: string | null;
  pinned: boolean;
  tab: HomeTabId;
}

const defaultHomeRouteState: HomeRouteState = {
  content: 'project',
  overview: 'timeline',
  paneId: null,
  pinned: false,
  tab: 'overview',
};

export const AppShell = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { accessToken } = useAuthz();
  const { projects } = useProjects();
  const lastHomeRouteRef = useRef<HomeRouteState>(defaultHomeRouteState);

  useRouteFocusReset();

  const normalizedPathname = location.pathname.replace(/\/+$/, '') || '/';
  const isOnHome = normalizedPathname === '/projects';
  const currentProjectId = useMemo(
    () => decodePathSegment(normalizedPathname.match(/^\/projects\/([^/]+)/)?.[1] || null),
    [normalizedPathname],
  );
  const currentPaneId = useMemo(
    () => decodePathSegment(normalizedPathname.match(/^\/projects\/[^/]+\/work\/([^/]+)/)?.[1] || null),
    [normalizedPathname],
  );
  const currentProject = useMemo(
    () => projects.find((project) => project.id === currentProjectId) || null,
    [currentProjectId, projects],
  );
  const personalProject = useMemo(
    () => projects.find((project) => project.isPersonal) || null,
    [projects],
  );
  const currentProjectPanes = useProjectPanes(accessToken, currentProjectId);
  const currentHomeState = useMemo<HomeRouteState>(() => {
    const searchParams = new URLSearchParams(location.search);
    return {
      content: parseHomeContentViewId(searchParams.get('content') ?? searchParams.get('view')),
      overview: parseHomeOverviewViewId(searchParams.get('overview')),
      paneId: parseHomePaneId(searchParams.get('pane')),
      pinned: searchParams.get('pinned') === '1',
      tab: parseHomeTabId(searchParams.get('tab')),
    };
  }, [location.search]);
  const currentSurface = useMemo(
    () => (isOnHome ? parseHomeOverlayId(new URLSearchParams(location.search).get('surface')) : null),
    [isOnHome, location.search],
  );

  useEffect(() => {
    if (!isOnHome) {
      return;
    }
    lastHomeRouteRef.current = currentHomeState;
  }, [currentHomeState, isOnHome]);

  return (
    <div className="flex h-screen bg-bg text-text">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[200] focus:rounded-control focus:bg-surface-elevated focus:px-md focus:py-sm focus:text-text focus:ring-2 focus:ring-focus-ring"
      >
        Skip to main content
      </a>

      <SidebarShell />

      <main id="main-content" className="min-w-0 flex-1 overflow-y-auto bg-bg">
        <div className="mx-auto w-full max-w-7xl px-4 pb-6 pt-6">
          <AppCommandBar
            accessToken={accessToken}
            currentPaneId={currentPaneId}
            currentProject={currentProject}
            currentProjectPanes={currentProjectPanes}
            currentSurface={currentSurface}
            onOpenQuickThoughts={() => {
              const homeRoute = isOnHome ? currentHomeState : lastHomeRouteRef.current;
              navigate(buildHomeOverlayHref('thoughts', {
                content: homeRoute.content,
                overview: homeRoute.overview,
                paneId: homeRoute.paneId,
                pinned: homeRoute.pinned,
                tab: homeRoute.tab,
              }));
            }}
            personalProject={personalProject}
          />
        </div>
        <div className="mx-auto w-full max-w-7xl px-4 pb-6">
          {children}
        </div>
      </main>
    </div>
  );
};
