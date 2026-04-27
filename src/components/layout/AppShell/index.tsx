import { type ReactNode, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { useAuthz } from '../../../context/AuthzContext';
import { useProjects } from '../../../context/ProjectsContext';
import {
  buildHomeOverlayHref,
  parseHomeContentViewId,
  parseHomeOverviewViewId,
  parseHomeOverlayId,
  parseHomeProjectId,
  parseHomeTabId,
  type HomeContentViewId,
  type HomeOverviewViewId,
  type HomeTabId,
} from '../../../features/home/navigation';
import { useProjectProjects } from '../../../hooks/useProjectProjects';
import { useRouteFocusReset } from '../../../hooks/useRouteFocusReset';
import { useLiveRegion } from '../../../hooks/useLiveRegion';
import { SidebarShell } from '../../Sidebar';
import { LiveRegion } from '../../primitives';
import { AppCommandBar } from './AppCommandBar';
import { decideRouteTransition } from './routeMotion';

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
  projectId: string | null;
  pinned: boolean;
  tab: HomeTabId;
}

const defaultHomeRouteState: HomeRouteState = {
  content: 'project',
  overview: 'timeline',
  projectId: null,
  pinned: false,
  tab: 'overview',
};

export const AppShell = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const navigationType = useNavigationType();
  const { accessToken } = useAuthz();
  const { projects } = useProjects();
  const lastHomeRouteRef = useRef<HomeRouteState>(defaultHomeRouteState);
  const previousRouteRef = useRef<{ pathname: string; state: unknown } | null>(null);
  const { announcement, announce } = useLiveRegion();

  useRouteFocusReset();

  const normalizedPathname = location.pathname.replace(/\/+$/, '') || '/';
  const isOnHome = normalizedPathname === '/projects';
  const currentSpaceId = useMemo(
    () => decodePathSegment(normalizedPathname.match(/^\/projects\/([^/]+)/)?.[1] || null),
    [normalizedPathname],
  );
  const personalProject = useMemo(
    () => projects.find((project) => project.isPersonal) || null,
    [projects],
  );
  const currentHomeState = useMemo<HomeRouteState>(() => {
    const searchParams = new URLSearchParams(location.search);
    return {
      content: parseHomeContentViewId(searchParams.get('content') ?? searchParams.get('view')),
      overview: parseHomeOverviewViewId(searchParams.get('overview')),
      projectId: parseHomeProjectId(searchParams.get('project')),
      pinned: searchParams.get('pinned') === '1',
      tab: parseHomeTabId(searchParams.get('tab')),
    };
  }, [location.search]);
  const currentSurface = useMemo(
    () => (isOnHome ? parseHomeOverlayId(new URLSearchParams(location.search).get('surface')) : null),
    [isOnHome, location.search],
  );
  const currentProjectId = useMemo(
    () => (isOnHome
      ? decodePathSegment(currentHomeState.projectId)
      : decodePathSegment(normalizedPathname.match(/^\/projects\/[^/]+\/work\/([^/]+)/)?.[1] || null)),
    [currentHomeState.projectId, isOnHome, normalizedPathname],
  );
  const currentProject = useMemo(() => {
    if (isOnHome) {
      return personalProject;
    }
    return projects.find((project) => project.id === currentSpaceId) || null;
  }, [currentSpaceId, isOnHome, personalProject, projects]);
  const currentProjectProjectsProjectId = currentProject?.id ?? null;
  const { projects: currentProjectProjects } = useProjectProjects(accessToken, currentProjectProjectsProjectId);

  useEffect(() => {
    if (!isOnHome) {
      return;
    }
    lastHomeRouteRef.current = currentHomeState;
  }, [currentHomeState, isOnHome]);

  useEffect(() => {
    const transitionDecision = decideRouteTransition({
      currentPathname: location.pathname,
      currentState: location.state,
      previousPathname: previousRouteRef.current?.pathname ?? null,
      previousState: previousRouteRef.current?.state,
      navigationType,
      getProjectName: (projectId) => projects.find((project) => project.id === projectId)?.name || null,
    });

    previousRouteRef.current = {
      pathname: location.pathname,
      state: location.state,
    };

    if (transitionDecision.announcement) {
      announce(transitionDecision.announcement);
    }
  }, [announce, location.pathname, location.state, navigationType, projects]);

  return (
    <div className="flex h-screen bg-bg text-text">
      <LiveRegion message={announcement} role="status" ariaLive="polite" />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[200] focus:rounded-control focus:bg-surface-elevated focus:px-md focus:py-sm focus:text-text focus:ring-2 focus:ring-focus-ring"
      >
        Skip to main content
      </a>

      <SidebarShell />

      <main id="main-content" className="min-w-0 flex-1 overflow-y-auto bg-bg">
        <div className="mx-auto w-full max-w-7xl px-4 pb-2 pt-6">
          <AppCommandBar
            accessToken={accessToken}
            currentProjectId={currentProjectId}
            currentProject={currentProject}
            currentProjectProjects={currentProjectProjects}
            currentSurface={currentSurface}
            onOpenQuickThoughts={() => {
              const homeRoute = isOnHome ? currentHomeState : lastHomeRouteRef.current;
              navigate(buildHomeOverlayHref('thoughts', {
                content: homeRoute.content,
                overview: homeRoute.overview,
                projectId: homeRoute.projectId,
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
