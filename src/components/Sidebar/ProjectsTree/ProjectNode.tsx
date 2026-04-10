import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SidebarSelectionMarker } from '../motion/SidebarSelectionMarker';
import { sidebarChevronVariants } from '../motion/sidebarMotion';
import { Icon } from '../../primitives/Icon';

interface ProjectNodeProps {
  active: boolean;
  children?: ReactNode;
  expanded: boolean;
  label: string;
  onNavigate: () => void;
  onToggleExpanded: () => void;
  sortableEnabled: boolean;
  sortableId: string;
}

export const ProjectNode = ({
  active,
  children,
  expanded,
  label,
  onNavigate,
  onToggleExpanded,
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
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      <div
        className={`relative flex items-center gap-1 overflow-hidden rounded-control ${
          active ? 'border border-subtle' : 'border border-transparent'
        }`}
        {...attributes}
        {...listeners}
      >
        {active ? <SidebarSelectionMarker /> : null}
        <button
          type="button"
          aria-label={expanded ? `Collapse ${label}` : `Expand ${label}`}
          aria-expanded={expanded}
          className={`interactive interactive-subtle relative z-[1] flex h-9 w-9 shrink-0 items-center justify-center rounded-control text-text-secondary hover:bg-surface hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
            isDragging ? 'shadow-soft' : ''
          } ${isDragging && !prefersReducedMotion ? 'scale-[1.02]' : ''}`}
          onClick={(event) => {
            event.stopPropagation();
            onToggleExpanded();
          }}
        >
          <motion.span
            initial={false}
            animate={expanded ? 'expanded' : 'collapsed'}
            variants={sidebarChevronVariants(prefersReducedMotion)}
            className="flex"
          >
            <Icon name="chevron-down" size={14} />
          </motion.span>
        </button>

        <button
          type="button"
          aria-current={active ? 'page' : undefined}
          className={`interactive interactive-subtle relative z-[1] min-w-0 flex-1 rounded-control px-2 py-2 text-left text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
            active ? 'text-text' : 'text-text-secondary hover:bg-surface hover:text-text'
          } ${isDragging ? 'shadow-soft' : ''} ${
            isDragging && !prefersReducedMotion ? 'scale-[1.02]' : ''
          }`}
          onClick={onNavigate}
        >
          <span className="block truncate">{label}</span>
        </button>
      </div>

      {children}
    </div>
  );
};
