import type { DragEvent } from 'react';
import { Link } from 'react-router-dom';
import { SidebarLabel } from '../motion/SidebarLabel';
import { Icon } from '../../primitives/Icon';

interface WorkspaceHeaderProps {
  isCollapsed: boolean;
  onCollapseSidebar: () => void;
  onOpenHome: () => void;
  showLabels: boolean;
}

export const WorkspaceHeader = ({
  isCollapsed,
  onCollapseSidebar,
  onOpenHome,
  showLabels,
}: WorkspaceHeaderProps) => {
  const preventNativeDrag = (event: DragEvent<HTMLAnchorElement>) => {
    event.preventDefault();
  };

  if (isCollapsed) {
    return (
      <button
        type="button"
        aria-label="Open Home"
        className="interactive interactive-subtle sidebar-row sidebar-row-button h-10 w-10 justify-center bg-surface text-text-secondary hover:bg-surface-highest hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        onClick={onOpenHome}
      >
        <Icon name="home" size={16} />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        to="/projects"
        draggable={false}
        className="interactive interactive-subtle interactive-fold sidebar-row sidebar-row-button min-w-0 flex-1 bg-surface text-text hover:bg-surface-highest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        onDragStart={preventNativeDrag}
      >
        <span
          aria-hidden="true"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-surface-low text-text"
        >
          <Icon name="home" size={16} />
        </span>
        <SidebarLabel show={showLabels} className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold tracking-[0.01em]">Home</span>
        </SidebarLabel>
      </Link>

      <button
        type="button"
        aria-label="Collapse sidebar"
        className="interactive interactive-subtle sidebar-row sidebar-row-button h-10 w-10 shrink-0 justify-center bg-surface text-text-secondary hover:bg-surface-highest hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        onClick={onCollapseSidebar}
      >
        <Icon name="back" size={16} />
      </button>
    </div>
  );
};
