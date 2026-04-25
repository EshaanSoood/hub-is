interface RecentPlaceItemProps {
  label: string;
  onClick: () => void;
  spaceName: string;
}

export const RecentPlaceItem = ({
  label,
  onClick,
  spaceName,
}: RecentPlaceItemProps) => (
  <button
    type="button"
    className="interactive interactive-subtle interactive-fold sidebar-row sidebar-row-button flex w-full flex-col items-start hover:bg-surface-highest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
    onClick={onClick}
  >
    <span className="block w-full truncate text-sm font-normal text-text">{label}</span>
    <span className="block w-full truncate text-xs text-muted">{spaceName}</span>
  </button>
);
