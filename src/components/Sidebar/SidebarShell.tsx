import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthz } from '../../context/AuthzContext';
import { useProjects } from '../../context/ProjectsContext';
import { cn } from '../../lib/cn';
import { listPanes } from '../../services/hub/panes';
import type { HubPaneSummary } from '../../services/hub/types';
import { Icon } from '../primitives/Icon';
import { CaptureInput } from './CaptureInput';
import { SearchButton } from './SearchButton';
import { Surfaces, buildSurfaceHref, type SidebarSurfaceId } from './Surfaces';
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

const PlaceholderSection = ({
  iconName,
  isBottom = false,
  isCollapsed,
  label,
  onExpand,
}: {
  iconName: 'timeline' | 'project-list' | 'user';
  isBottom?: boolean;
  isCollapsed: boolean;
  label: string;
  onExpand: () => void;
}) => {
  if (isCollapsed) {
    return (
      <button
        type="button"
        aria-label={`Expand sidebar from ${label}`}
        className="interactive interactive-subtle flex h-10 w-10 items-center justify-center rounded-control border border-subtle bg-surface text-text-secondary hover:bg-elevated hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        onClick={onExpand}
      >
        <Icon name={iconName} size={16} />
      </button>
    );
  }

  return (
    <div
      className={`rounded-panel border border-subtle px-3 py-2 ${
        isBottom ? 'bg-elevated text-text' : 'bg-surface text-text-secondary'
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-control border border-subtle ${
            isBottom ? 'bg-surface text-text' : 'bg-elevated text-text-secondary'
          }`}
        >
          <Icon name={iconName} size={16} />
        </span>
        <span className="min-w-0 truncate text-sm font-medium">{label}</span>
      </div>
    </div>
  );
};

export const SidebarShell = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { accessToken } = useAuthz();
  const { projects } = useProjects();
  const { collapseSidebar, expandSidebar, isCollapsed } = useSidebarCollapse();
  const [currentProjectPanes, setCurrentProjectPanes] = useState<HubPaneSummary[]>([]);
  const [searchAutoFocusKey, setSearchAutoFocusKey] = useState(0);
  const [captureAutoFocusKey, setCaptureAutoFocusKey] = useState(0);

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
  const currentSurface = useMemo<SidebarSurfaceId | null>(() => {
    if (!isOnHome) {
      return null;
    }
    const candidate = new URLSearchParams(location.search).get('surface');
    return candidate === 'tasks' || candidate === 'calendar' || candidate === 'reminders' || candidate === 'thoughts'
      ? candidate
      : null;
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

  useEffect(() => {
    if (!accessToken || !currentProjectId) {
      return;
    }
    let cancelled = false;
    void listPanes(accessToken, currentProjectId)
      .then((panes) => {
        if (!cancelled) {
          setCurrentProjectPanes(panes);
        }
      })
      .catch(() => {
        if (!cancelled) {
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

  const onSelectSurface = useCallback((surfaceId: SidebarSurfaceId) => {
    expandSidebar();
    navigate(buildSurfaceHref(surfaceId));
  }, [expandSidebar, navigate]);

  return (
    <nav
      aria-label="Primary workspace navigation"
      className={cn(
        'sidebar-shell-transition flex h-screen shrink-0 flex-col border-r border-border-muted bg-surface px-2 py-3',
        isCollapsed ? 'sidebar-shell-collapsed items-center gap-2' : 'sidebar-shell-expanded gap-3',
      )}
    >
      <WorkspaceHeader
        isCollapsed={isCollapsed}
        onCollapseSidebar={collapseSidebar}
        onOpenHome={openHome}
      />

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
        <SearchButton
          accessToken={accessToken}
          autoFocusKey={searchAutoFocusKey}
          isCollapsed={isCollapsed}
          onOpenSearch={openSearch}
          routeKey={`${location.pathname}${location.search}`}
        />

        <CaptureInput
          key={`capture:${location.pathname}${location.search}`}
          accessToken={accessToken}
          autoFocusKey={captureAutoFocusKey}
          currentProject={currentProject}
          currentProjectPanes={currentProjectPanes}
          currentSurfaceLabel={currentSurfaceLabel}
          isCollapsed={isCollapsed}
          onOpenCapture={openCapture}
          personalProject={personalProject}
        />

        <Surfaces
          activeSurface={currentSurface}
          isCollapsed={isCollapsed}
          onSelectSurface={onSelectSurface}
        />

        <PlaceholderSection
          iconName="timeline"
          isCollapsed={isCollapsed}
          label="Recent Panes"
          onExpand={expandSidebar}
        />

        <PlaceholderSection
          iconName="project-list"
          isCollapsed={isCollapsed}
          label="Projects"
          onExpand={expandSidebar}
        />
      </div>

      <PlaceholderSection
        iconName="user"
        isBottom
        isCollapsed={isCollapsed}
        label="Profile"
        onExpand={expandSidebar}
      />
    </nav>
  );
};
