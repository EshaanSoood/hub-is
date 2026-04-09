import { Icon } from '../../primitives';

import { withHubMotionState } from '../../../lib/hubMotionState';

interface ToolbarBreadcrumbProps {
  isOnMyHub: boolean;
  navigate: (to: string, options?: { replace?: boolean; state?: unknown }) => void;
  breadcrumb: string[];
}

export const ToolbarBreadcrumb = ({ isOnMyHub, navigate, breadcrumb }: ToolbarBreadcrumbProps) => (
  <div className="mr-sm flex min-w-0 items-center gap-xs">
    {!isOnMyHub ? (
      <button
        type="button"
        onClick={() => navigate('/projects', {
          state: withHubMotionState(undefined, {
            hubAnnouncement: 'Back to myHub',
          }),
        })}
        aria-label="Go home"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-control text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
      >
        <Icon name="home" className="h-4 w-4" />
      </button>
    ) : null}

    {breadcrumb.length > 0 ? (
      <span className="truncate text-xs text-muted" aria-label={`Current location: ${breadcrumb.join(' › ')}`}>
        {breadcrumb.join(' › ')}
      </span>
    ) : null}
  </div>
);
