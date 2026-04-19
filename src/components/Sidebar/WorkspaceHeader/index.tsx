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
        className="interactive interactive-subtle flex h-10 w-10 items-center justify-center rounded-control border border-subtle bg-surface text-text-secondary hover:bg-elevated hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
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
        className="interactive interactive-subtle interactive-fold flex min-w-0 flex-1 items-center gap-3 rounded-panel border border-subtle bg-elevated px-3 py-2 text-text hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        onDragStart={preventNativeDrag}
      >
        <span
          aria-hidden="true"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control border border-subtle bg-surface text-text"
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
        className="interactive interactive-subtle flex h-10 w-10 shrink-0 items-center justify-center rounded-control border border-subtle bg-surface text-text-secondary hover:bg-elevated hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        onClick={onCollapseSidebar}
      >
        <Icon name="back" size={16} />
      </button>
    </div>
  );
};
