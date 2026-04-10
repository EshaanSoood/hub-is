import { useSortable } from '@dnd-kit/sortable';

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
  const { attributes, isDragging, listeners, setNodeRef } = useSortable({
    id: sortableId,
    disabled: !sortableEnabled,
  });

  return (
    <div ref={setNodeRef} className={isDragging ? 'opacity-70' : undefined} {...attributes} {...listeners}>
      <button
        type="button"
        aria-current={active ? 'page' : undefined}
        className={`interactive interactive-subtle flex w-full items-center rounded-control px-3 py-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
          active
            ? 'border border-subtle bg-elevated text-text'
            : 'border border-transparent text-text-secondary hover:bg-surface hover:text-text'
        }`}
        onClick={onClick}
      >
        <span className="block truncate">{label}</span>
      </button>
    </div>
  );
};
