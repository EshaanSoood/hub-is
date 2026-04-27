import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthz } from '../../context/AuthzContext';
import { useProjects } from '../../context/ProjectsContext';
import {
  buildHomeContentHref,
  parseHomeContentViewId,
  parseHomeOverlayId,
  parseHomeOverviewViewId,
  parseHomeTabId,
  type HomeContentViewId,
  type HomeTabId,
} from '../../features/home/navigation';
import { buildProjectOverviewHref } from '../../lib/hubRoutes';
import { cn } from '../../lib/cn';
import { fadeThroughVariants } from '../motion/hubMotion';
import { useProjectProjects } from '../../hooks/useProjectProjects';
import { useSidebarNavigationState } from './hooks/useSidebarNavigationState';
import { sidebarMotionDurations, sidebarShellVariants } from './motion/sidebarMotion';
import { ProjectsTree } from './ProjectsTree';
import { ProfileBadge } from './ProfileBadge';
import { RecentPlaces } from './RecentPlaces';
import { SearchButton } from './SearchButton';
import { Surfaces, type SidebarSurfaceId } from './Surfaces';
import { useSidebarCollapse } from './hooks/useSidebarCollapse';
import { WorkspaceHeader } from './WorkspaceHeader';
import { buildProjectWorkHref } from '../../lib/hubRoutes';

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

export const SidebarShell = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion() ?? false;
  const { accessToken } = useAuthz();
  const { projects } = useProjects();
  const { collapseSidebar, expandSidebar, isCollapsed } = useSidebarCollapse();
  const [searchAutoFocusKey, setSearchAutoFocusKey] = useState(0);
  const [profileAutoOpenKey, setProfileAutoOpenKey] = useState(0);
  const [visualCollapsed, setVisualCollapsed] = useState(isCollapsed);
  const [showLabels, setShowLabels] = useState(!isCollapsed);

  const normalizedPathname = location.pathname.replace(/\/+$/, '') || '/';
  const isOnHome = normalizedPathname === '/projects';
  const currentProjectId = useMemo(() => {
    if (normalizedPathname === '/projects') {
      return null;
    }
    return decodePathSegment(normalizedPathname.match(/^\/projects\/([^/]+)/)?.[1] || null);
  }, [normalizedPathname]);
  const currentWorkProjectId = useMemo(
    () => decodePathSegment(normalizedPathname.match(/^\/projects\/[^/]+\/work\/([^/]+)/)?.[1] || null),
    [normalizedPathname],
  );
  const activeSpaceId = currentProjectId;
  const currentProject = useMemo(
    () => projects.find((project) => project.id === activeSpaceId) || null,
    [activeSpaceId, projects],
  );
  const currentSpaceProjectId = currentWorkProjectId;
  const { projects: activeCurrentProjectProjects } = useProjectProjects(accessToken, activeSpaceId);
  const currentRecentPlace = useMemo(() => {
    if (!activeSpaceId || !currentSpaceProjectId || !currentProject) {
      return null;
    }
    const currentWorkProject = activeCurrentProjectProjects.find((project) => project.project_id === currentSpaceProjectId) || null;
    if (!currentWorkProject) {
      return null;
    }
    return {
      href: buildProjectWorkHref(activeSpaceId, currentWorkProject.project_id),
      projectId: currentWorkProject.project_id,
      projectName: currentWorkProject.name,
      spaceId: activeSpaceId,
      spaceName: currentProject.name,
    };
  }, [activeCurrentProjectProjects, activeSpaceId, currentProject, currentSpaceProjectId]);
  const currentHomeTab = useMemo<HomeTabId>(() => parseHomeTabId(new URLSearchParams(location.search).get('tab')), [location.search]);
  const currentHomeContentView = useMemo<HomeContentViewId>(() => {
    const searchParams = new URLSearchParams(location.search);
    return parseHomeContentViewId(searchParams.get('content') ?? searchParams.get('view'));
  }, [location.search]);
  const currentHomeOverviewView = useMemo(() => {
    if (!isOnHome) {
      return 'timeline';
    }
    return parseHomeOverviewViewId(new URLSearchParams(location.search).get('overview'));
  }, [isOnHome, location.search]);
  const currentSurface = useMemo<SidebarSurfaceId | null>(() => {
    if (!isOnHome) {
      return null;
    }
    return parseHomeOverlayId(new URLSearchParams(location.search).get('surface'));
  }, [isOnHome, location.search]);
  const resolvedVisualCollapsed = prefersReducedMotion ? isCollapsed : visualCollapsed;
  const resolvedShowLabels = prefersReducedMotion ? !isCollapsed : showLabels;
  const sidebarContextKey = currentSpaceProjectId
    ? `project:${currentSpaceProjectId}`
    : activeSpaceId
      ? `space:${activeSpaceId}`
      : `hub:${currentSurface ?? `${currentHomeTab}:${currentHomeContentView}`}`;
  const sidebarState = useSidebarNavigationState({
    activeSpaceId,
    currentSpaceHref: activeSpaceId ? `${location.pathname}${location.search}` : null,
    isHomeState: !activeSpaceId && isOnHome,
    knownSpaceIds: projects.map((project) => project.id),
  });

  useEffect(() => {
    if (prefersReducedMotion) {
      return;
    }

    const timeoutMs = isCollapsed
      ? sidebarMotionDurations.labelFade * 1000
      : sidebarMotionDurations.shellExpandDelay * 1000;

    const phaseTimerId = window.setTimeout(() => {
      if (isCollapsed) {
        setShowLabels(false);
        return;
      }
      setVisualCollapsed(false);
    }, 0);

    const timeoutId = window.setTimeout(() => {
      if (isCollapsed) {
        setVisualCollapsed(true);
        return;
      }
      setShowLabels(true);
    }, timeoutMs);

    return () => {
      window.clearTimeout(phaseTimerId);
      window.clearTimeout(timeoutId);
    };
  }, [isCollapsed, prefersReducedMotion]);

  const openSearch = useCallback(() => {
    expandSidebar();
    setSearchAutoFocusKey((current) => current + 1);
  }, [expandSidebar]);

  const openHome = useCallback(() => {
    expandSidebar();
    navigate('/projects');
  }, [expandSidebar, navigate]);

  const openProfile = useCallback(() => {
    expandSidebar();
    setProfileAutoOpenKey((current) => current + 1);
  }, [expandSidebar]);

  const onSelectHomeContentView = useCallback((viewId: HomeContentViewId) => {
    expandSidebar();
    navigate(buildHomeContentHref(viewId, {
      overview: currentHomeOverviewView,
    }));
  }, [currentHomeOverviewView, expandSidebar, navigate]);

  const openProject = useCallback((projectId: string) => {
    expandSidebar();
    navigate(sidebarState.projectRoutesBySpaceId[projectId] || buildProjectOverviewHref(projectId));
  }, [expandSidebar, navigate, sidebarState.projectRoutesBySpaceId]);

  return (
    <LayoutGroup id="sidebar-shell-layout">
      <motion.nav
        aria-label="Primary"
        initial={false}
        animate={resolvedVisualCollapsed ? 'collapsed' : 'expanded'}
        variants={sidebarShellVariants(prefersReducedMotion)}
        className={cn(
          'sidebar-fold flex h-screen shrink-0 flex-col overflow-hidden px-2 py-3',
          resolvedVisualCollapsed ? 'items-center gap-2' : 'gap-2',
        )}
      >
        <div className="shrink-0">
          <WorkspaceHeader
            isCollapsed={resolvedVisualCollapsed}
            onCollapseSidebar={collapseSidebar}
            onOpenHome={openHome}
            showLabels={resolvedShowLabels}
          />
        </div>

        <div className={cn('flex min-h-0 flex-1 flex-col overflow-hidden', resolvedVisualCollapsed ? 'items-center gap-2' : 'gap-2')}>
          <section
            aria-label="Quick access"
            className={cn('shrink-0', resolvedVisualCollapsed ? 'w-full' : 'space-y-2')}
          >
            <div className="shrink-0">
              <SearchButton
                accessToken={accessToken}
                autoFocusKey={searchAutoFocusKey}
                isCollapsed={resolvedVisualCollapsed}
                onOpenSearch={openSearch}
                routeKey={`${location.pathname}${location.search}`}
                showLabels={resolvedShowLabels}
              />
            </div>

            <div className="shrink-0">
              <Surfaces
                activeHomeContentView={currentHomeContentView}
                activeHomeTab={currentHomeTab}
                isCollapsed={resolvedVisualCollapsed}
                onToggleSection={() => {
                  sidebarState.setHomeViewsExpanded((current) => !current);
                }}
                onSelectHomeContentView={onSelectHomeContentView}
                sectionExpanded={sidebarState.homeViewsExpanded}
                showLabels={resolvedShowLabels}
              />
            </div>
          </section>

          <div className="min-h-0 flex-1 overflow-hidden">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={sidebarContextKey}
                initial="initial"
                animate="animate"
                exit="exit"
                variants={fadeThroughVariants(prefersReducedMotion)}
                className={cn('flex min-h-0 flex-1 flex-col overflow-hidden', resolvedVisualCollapsed ? 'items-center gap-2' : 'gap-2')}
              >
                <RecentPlaces
                  currentPlace={currentRecentPlace}
                  isCollapsed={resolvedVisualCollapsed}
                  onExpandSidebar={expandSidebar}
                />

                <div className="min-h-0 flex-1 overflow-hidden">
                  <ProjectsTree
                    activeSpaceId={activeSpaceId}
                    currentProjectProjects={activeCurrentProjectProjects}
                    currentSpaceProjectId={currentSpaceProjectId}
                    expandedProjectId={sidebarState.expandedProjectId}
                    isCollapsed={resolvedVisualCollapsed}
                    onOpenProject={openProject}
                    onExpandSidebar={expandSidebar}
                    onToggleProjectExpansion={(projectId) => {
                      sidebarState.setExpandedProjectId((current) => (current === projectId ? null : projectId));
                    }}
                    onToggleSection={() => {
                      sidebarState.setProjectsSectionExpanded((current) => !current);
                    }}
                    sectionExpanded={sidebarState.projectsSectionExpanded}
                    spaceFocused={Boolean(activeSpaceId)}
                    showLabels={resolvedShowLabels}
                  />
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        <div className="shrink-0">
          <ProfileBadge
            key={`profile:${profileAutoOpenKey}`}
            autoOpenKey={profileAutoOpenKey}
            isCollapsed={resolvedVisualCollapsed}
            onOpenProfile={openProfile}
            showLabels={resolvedShowLabels}
          />
        </div>
      </motion.nav>
    </LayoutGroup>
  );
};
