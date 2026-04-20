import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthz } from '../../context/AuthzContext';
import { useProjects } from '../../context/ProjectsContext';
import {
  buildHomeOverlayHref,
  buildHomeViewHref,
  parseHomeOverlayId,
  parseHomeViewId,
  type HomeViewId,
} from '../../features/home/navigation';
import { cn } from '../../lib/cn';
import { fadeThroughVariants } from '../motion/hubMotion';
import { listPanes } from '../../services/hub/panes';
import type { HubPaneSummary } from '../../services/hub/types';
import { CaptureInput } from './CaptureInput';
import { sidebarMotionDurations, sidebarShellVariants } from './motion/sidebarMotion';
import { ProjectsTree } from './ProjectsTree';
import { ProfileBadge } from './ProfileBadge';
import { RecentPanes } from './RecentPanes';
import { SearchButton } from './SearchButton';
import { Surfaces, type SidebarSurfaceId } from './Surfaces';
import { useSidebarCollapse } from './hooks/useSidebarCollapse';
import { WorkspaceHeader } from './WorkspaceHeader';

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
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);
  const [currentProjectPanes, setCurrentProjectPanes] = useState<HubPaneSummary[]>([]);
  const [searchAutoFocusKey, setSearchAutoFocusKey] = useState(0);
  const [captureAutoFocusKey, setCaptureAutoFocusKey] = useState(0);
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
  const currentProject = useMemo(
    () => projects.find((project) => project.id === currentProjectId) || null,
    [currentProjectId, projects],
  );
  const currentPaneId = useMemo(
    () => decodePathSegment(normalizedPathname.match(/^\/projects\/[^/]+\/work\/([^/]+)/)?.[1] || null),
    [normalizedPathname],
  );
  const activeCurrentProjectPanes =
    currentProjectId && loadedProjectId === currentProjectId ? currentProjectPanes : [];
  const currentHomeView = useMemo<HomeViewId>(() => parseHomeViewId(new URLSearchParams(location.search).get('view')), [location.search]);
  const currentSurface = useMemo<SidebarSurfaceId | null>(() => {
    if (!isOnHome) {
      return null;
    }
    return parseHomeOverlayId(new URLSearchParams(location.search).get('surface'));
  }, [isOnHome, location.search]);
  const currentSurfaceLabel = useMemo(() => {
    if (currentSurface === 'tasks') {
      return 'Tasks';
    }
    if (currentSurface === 'calendar') {
      return 'Calendar';
    }
    if (currentSurface === 'reminders') {
      return 'Reminders';
    }
    if (currentSurface === 'thoughts') {
      return 'Quick Thoughts';
    }
    return null;
  }, [currentSurface]);
  const personalProject = useMemo(
    () => projects.find((project) => project.isPersonal) || null,
    [projects],
  );
  const resolvedVisualCollapsed = prefersReducedMotion ? isCollapsed : visualCollapsed;
  const resolvedShowLabels = prefersReducedMotion ? !isCollapsed : showLabels;
  const sidebarContextKey = currentPaneId
    ? `pane:${currentPaneId}`
    : currentProjectId
      ? `project:${currentProjectId}`
      : `hub:${currentSurface ?? currentHomeView}`;

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

  useEffect(() => {
    if (!accessToken || !currentProjectId) {
      return;
    }
    let cancelled = false;
    void listPanes(accessToken, currentProjectId)
      .then((panes) => {
        if (!cancelled) {
          setLoadedProjectId(currentProjectId);
          setCurrentProjectPanes(panes);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadedProjectId(currentProjectId);
          setCurrentProjectPanes([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, currentProjectId]);

  const openSearch = useCallback(() => {
    expandSidebar();
    setSearchAutoFocusKey((current) => current + 1);
  }, [expandSidebar]);

  const openCapture = useCallback(() => {
    expandSidebar();
    setCaptureAutoFocusKey((current) => current + 1);
  }, [expandSidebar]);

  const openHome = useCallback(() => {
    expandSidebar();
    navigate('/projects');
  }, [expandSidebar, navigate]);

  const openProfile = useCallback(() => {
    expandSidebar();
    setProfileAutoOpenKey((current) => current + 1);
  }, [expandSidebar]);

  const onSelectSurface = useCallback((surfaceId: SidebarSurfaceId) => {
    expandSidebar();
    navigate(buildHomeOverlayHref(surfaceId, { view: currentHomeView }));
  }, [currentHomeView, expandSidebar, navigate]);

  const onSelectHomeView = useCallback((viewId: HomeViewId) => {
    expandSidebar();
    navigate(buildHomeViewHref(viewId));
  }, [expandSidebar, navigate]);

  return (
    <LayoutGroup id="sidebar-shell-layout">
      <motion.nav
        aria-label="Primary"
        initial={false}
        animate={resolvedVisualCollapsed ? 'collapsed' : 'expanded'}
        variants={sidebarShellVariants(prefersReducedMotion)}
        className={cn(
          'flex h-screen shrink-0 flex-col overflow-hidden border-r border-border-muted bg-surface px-2 py-3',
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
              <CaptureInput
                key={`capture:${location.pathname}${location.search}`}
                accessToken={accessToken}
                autoFocusKey={captureAutoFocusKey}
                currentPaneId={currentPaneId}
                currentProject={currentProject}
                currentProjectPanes={activeCurrentProjectPanes}
                currentSurface={currentSurface}
                currentSurfaceLabel={currentSurfaceLabel}
                isCollapsed={resolvedVisualCollapsed}
                onOpenCapture={openCapture}
                personalProject={personalProject}
                showLabels={resolvedShowLabels}
              />
            </div>

            <div className="shrink-0">
              <Surfaces
                activeHomeView={currentHomeView}
                activeSurface={currentSurface}
                isCollapsed={resolvedVisualCollapsed}
                onSelectHomeView={onSelectHomeView}
                onSelectSurface={onSelectSurface}
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
                <RecentPanes
                  currentProject={currentProject}
                  currentProjectPanes={activeCurrentProjectPanes}
                  isCollapsed={resolvedVisualCollapsed}
                  onExpandSidebar={expandSidebar}
                  showLabels={resolvedShowLabels}
                />

                <div className="min-h-0 flex-1 overflow-hidden">
                  <ProjectsTree
                    currentProject={currentProject}
                    currentProjectPanes={activeCurrentProjectPanes}
                    isCollapsed={resolvedVisualCollapsed}
                    onExpandSidebar={expandSidebar}
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
