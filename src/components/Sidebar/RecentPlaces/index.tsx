import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../../primitives/Icon';
import { useRecentProjectVisitTracker } from '../../../features/recentPlaces/useRecentProjectVisitTracker';
import { useRecentPlaces } from '../../../features/recentPlaces/useRecentPlaces';
import type { RecentProjectPlaceInput } from '../../../features/recentPlaces/types';
import { RecentPlaceItem } from './RecentPlaceItem';

interface RecentPlacesProps {
  currentPlace: RecentProjectPlaceInput | null;
  isCollapsed: boolean;
  onExpandSidebar: () => void;
}

export const RecentPlaces = ({
  currentPlace,
  isCollapsed,
  onExpandSidebar,
}: RecentPlacesProps) => {
  const navigate = useNavigate();
  const recentPlaces = useRecentPlaces();
  const visiblePlaces = useMemo(
    () => recentPlaces.filter((entry) => entry.kind === 'project' && entry.projectId && entry.projectName.trim().length > 0),
    [recentPlaces],
  );

  useRecentProjectVisitTracker(currentPlace);

  if (visiblePlaces.length === 0) {
    return null;
  }

  if (isCollapsed) {
    return (
      <button
        type="button"
        aria-label="Open recent places"
        className="interactive interactive-subtle flex h-10 w-10 items-center justify-center rounded-control bg-surface-container text-text-secondary hover:bg-surface hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        onClick={onExpandSidebar}
      >
        <Icon name="timeline" size={16} />
      </button>
    );
  }

  return (
    <section aria-labelledby="recent-places-heading" className="sidebar-divider rounded-panel bg-surface-container px-2 py-2 shadow-soft">
      <div className="px-2 py-1">
        <p id="recent-places-heading" className="text-label-xs font-semibold uppercase tracking-sidebar-kicker text-muted">
          Recent Places
        </p>
      </div>
      <div className="sidebar-children-indent mt-1 space-y-1">
        {visiblePlaces.map((entry) => (
          <RecentPlaceItem
            key={entry.key}
            label={entry.projectName}
            spaceName={entry.spaceName}
            onClick={() => navigate(entry.href)}
          />
        ))}
      </div>
    </section>
  );
};
