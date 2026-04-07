import type { BottomToolbarProps } from './types';

type ToolbarBreadcrumbProps = Pick<BottomToolbarProps, 'isOnHubHome' | 'navigate' | 'breadcrumb'>;

export const ToolbarBreadcrumb = ({ isOnHubHome, navigate, breadcrumb }: ToolbarBreadcrumbProps) => (
  <div className="mr-sm flex min-w-0 items-center gap-xs">
    {!isOnHubHome ? (
      <button
        type="button"
        onClick={() => navigate('/projects')}
        aria-label="Go home"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-control text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M2 7l6-5 6 5v7H10v-4H6v4H2V7z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
        </svg>
      </button>
    ) : null}

    {breadcrumb.length > 0 ? (
      <span className="truncate text-xs text-muted" aria-label={`Current location: ${breadcrumb.join(' › ')}`}>
        {breadcrumb.join(' › ')}
      </span>
    ) : null}
  </div>
);
