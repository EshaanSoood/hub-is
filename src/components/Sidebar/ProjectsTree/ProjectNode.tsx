import type { ReactNode } from 'react';
import { SidebarSelectionMarker } from '../motion/SidebarSelectionMarker';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useReducedMotion } from 'framer-motion';

interface ProjectNodeProps {
  active: boolean;
  children?: ReactNode;
  expanded?: boolean;
  label: string;
  onClick?: () => void;
  onNavigate?: () => void;
  onToggleExpanded?: () => void;
  showToggle?: boolean;
  sortableEnabled: boolean;
  sortableId: string;
}

export const ProjectNode = ({
  active,
  children,
  expanded = false,
  label,
  onClick,
  onNavigate,
  onToggleExpanded,
  showToggle = false,
  sortableEnabled,
  sortableId,
}: ProjectNodeProps) => {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const { attributes, isDragging, listeners, setNodeRef, transform, transition } = useSortable({
    id: sortableId,
    disabled: !sortableEnabled,
  });

  return (
    <div
      ref={setNodeRef}
      className={isDragging ? 'z-[2]' : undefined}
      {...attributes}
      {...listeners}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      <div className={isDragging ? 'shadow-soft' : undefined}>
        <div className="flex items-center gap-1">
          {showToggle ? (
            <button
              type="button"
              aria-expanded={expanded}
              aria-label={expanded ? `Collapse ${label}` : `Expand ${label}`}
              className="interactive interactive-subtle sidebar-row-button px-2 text-text-secondary"
              onClick={onToggleExpanded}
            >
              {expanded ? '-' : '+'}
            </button>
          ) : null}
          <button
            type="button"
            aria-current={active ? 'page' : undefined}
            className={`interactive interactive-subtle sidebar-row relative w-full overflow-hidden text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
              active
                ? 'sidebar-row-button sidebar-row-active'
                : 'sidebar-row-button text-text-secondary hover:bg-surface-highest hover:text-text'
            } ${isDragging && !prefersReducedMotion ? 'scale-[1.02]' : ''}`}
            onClick={onClick ?? onNavigate}
          >
            {active ? <SidebarSelectionMarker /> : null}
            <span className="relative z-[1] block truncate">{label}</span>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};
