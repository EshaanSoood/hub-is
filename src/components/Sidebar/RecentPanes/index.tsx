import { useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { buildProjectWorkHref } from '../../../lib/hubRoutes';
import type { HubPaneSummary } from '../../../services/hub/types';
import type { ProjectRecord } from '../../../types/domain';
import { SidebarLabel } from '../motion/SidebarLabel';
import { Icon } from '../../primitives/Icon';
import { RecentPaneItem } from './RecentPaneItem';

const RECENT_PANES_STORAGE_KEY = 'hub:sidebar:recent-panes';
const MAX_RECENT_PANES = 5;

interface StoredRecentPane {
  paneId: string;
  paneName: string;
  projectId: string;
  projectName: string;
  visitedAt: string;
}

const readRecentPanes = (): StoredRecentPane[] => {
  if (typeof window === 'undefined') {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(RECENT_PANES_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeRecentPanes = (entries: StoredRecentPane[]) => {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(RECENT_PANES_STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_RECENT_PANES)));
  } catch {
    // Ignore storage failures so recent panes remain non-blocking.
  }
};

const mergeRecentPaneVisit = (currentEntries: StoredRecentPane[], nextEntry: StoredRecentPane): StoredRecentPane[] => [
  nextEntry,
  ...currentEntries.filter(
    (entry) => !(entry.projectId === nextEntry.projectId && entry.paneId === nextEntry.paneId),
  ),
].slice(0, MAX_RECENT_PANES);

interface RecentPanesProps {
  currentProject: ProjectRecord | null;
  currentProjectPanes: HubPaneSummary[];
  isCollapsed: boolean;
  onExpandSidebar: () => void;
  showLabels: boolean;
}

export const RecentPanes = ({
  currentProject,
  currentProjectPanes,
  isCollapsed,
  onExpandSidebar,
  showLabels,
}: RecentPanesProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const normalizedPathname = location.pathname.replace(/\/+$/, '') || '/';
  const isOnHome = normalizedPathname === '/projects';
  const currentPaneId = useMemo(() => {
    const match = normalizedPathname.match(/^\/projects\/[^/]+\/work\/([^/]+)/);
    if (!match) {
      return null;
    }
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  }, [normalizedPathname]);
  const currentPane = useMemo(
    () => currentProjectPanes.find((pane) => pane.pane_id === currentPaneId) || null,
    [currentPaneId, currentProjectPanes],
  );
  const recentPanes = readRecentPanes().filter((entry) => entry.projectId && entry.paneId);

  useEffect(() => {
    if (!currentProject || !currentPane) {
      return;
    }
    writeRecentPanes(
      mergeRecentPaneVisit(readRecentPanes(), {
        paneId: currentPane.pane_id,
        paneName: currentPane.name,
        projectId: currentProject.id,
        projectName: currentProject.name,
        visitedAt: new Date().toISOString(),
      }),
    );
  }, [currentPane, currentProject]);

  if (!isOnHome) {
    return null;
  }

  if (isCollapsed) {
    return (
      <button
        type="button"
        aria-label="Open recent panes"
        className="interactive interactive-subtle flex h-10 w-10 items-center justify-center rounded-control bg-surface-container text-text-secondary hover:bg-surface hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        onClick={onExpandSidebar}
      >
        <Icon name="timeline" size={16} />
      </button>
    );
  }

  if (recentPanes.length === 0) {
    return null;
  }

  return (
    <section aria-label="Recent panes" className="rounded-panel bg-surface-container px-2 py-2 shadow-soft">
      <SidebarLabel show={showLabels}>
        <div className="space-y-1">
          {recentPanes.map((entry) => (
            <RecentPaneItem
              key={`${entry.projectId}:${entry.paneId}`}
              label={entry.paneName}
              projectName={entry.projectName}
              onClick={() => navigate(buildProjectWorkHref(entry.projectId, entry.paneId))}
            />
          ))}
        </div>
      </SidebarLabel>
    </section>
  );
};
