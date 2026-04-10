import type { ReactNode } from 'react';
import { useSortable } from '@dnd-kit/sortable';
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
  const { attributes, isDragging, listeners, setNodeRef } = useSortable({
    id: sortableId,
    disabled: !sortableEnabled,
  });

  return (
    <div ref={setNodeRef} className={isDragging ? 'opacity-70' : undefined}>
      <div
        className={`flex items-center gap-1 rounded-control ${
          active ? 'border border-subtle bg-elevated' : 'border border-transparent'
        }`}
        {...attributes}
        {...listeners}
      >
        <button
          type="button"
          aria-label={expanded ? `Collapse ${label}` : `Expand ${label}`}
          aria-expanded={expanded}
          className="interactive interactive-subtle flex h-9 w-9 shrink-0 items-center justify-center rounded-control text-text-secondary hover:bg-surface hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          onClick={(event) => {
            event.stopPropagation();
            onToggleExpanded();
          }}
        >
          <Icon
            name="chevron-down"
            size={14}
            className={expanded ? 'rotate-0 transition-transform' : '-rotate-90 transition-transform'}
          />
        </button>

        <button
          type="button"
          aria-current={active ? 'page' : undefined}
          className={`interactive interactive-subtle min-w-0 flex-1 rounded-control px-2 py-2 text-left text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
            active ? 'text-text' : 'text-text-secondary hover:bg-surface hover:text-text'
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
