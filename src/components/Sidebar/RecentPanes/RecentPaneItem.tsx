interface RecentPaneItemProps {
  label: string;
  onClick: () => void;
  projectName: string;
}

export const RecentPaneItem = ({
  label,
  onClick,
  projectName,
}: RecentPaneItemProps) => (
  <button
    type="button"
    className="interactive interactive-subtle interactive-fold sidebar-row sidebar-row-button flex w-full flex-col items-start hover:bg-surface-highest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
    onClick={onClick}
  >
    <span className="block w-full truncate text-sm font-medium text-text">{label}</span>
    <span className="block w-full truncate text-xs text-muted">{projectName}</span>
  </button>
);
