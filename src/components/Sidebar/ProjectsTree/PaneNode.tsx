import { SidebarSelectionMarker } from '../motion/SidebarSelectionMarker';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useReducedMotion } from 'framer-motion';

interface PaneNodeProps {
  active: boolean;
  label: string;
  onClick: () => void;
  sortableEnabled: boolean;
  sortableId: string;
}

export const PaneNode = ({
  active,
  label,
  onClick,
  sortableEnabled,
  sortableId,
}: PaneNodeProps) => {
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
      <button
        type="button"
        aria-current={active ? 'page' : undefined}
        className={`interactive interactive-subtle relative flex w-full items-center overflow-hidden rounded-control px-3 py-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
          active
            ? 'border border-subtle text-text'
            : 'border border-transparent text-text-secondary hover:bg-surface hover:text-text'
        } ${isDragging ? 'shadow-soft' : ''} ${isDragging && !prefersReducedMotion ? 'scale-[1.02]' : ''}`}
        onClick={onClick}
      >
        {active ? <SidebarSelectionMarker /> : null}
        <span className="relative z-[1] block truncate">{label}</span>
      </button>
    </div>
  );
};
