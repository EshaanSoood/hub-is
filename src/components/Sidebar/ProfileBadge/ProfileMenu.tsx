interface ProfileMenuProps {
  onClose: () => void;
}

export const ProfileMenu = ({ onClose }: ProfileMenuProps) => (
  <div
    role="menu"
    className="absolute bottom-[calc(100%+0.5rem)] left-0 right-0 z-[120] overflow-hidden rounded-panel border border-border-muted bg-surface-elevated shadow-soft"
  >
    <button
      type="button"
      role="menuitem"
      className="interactive interactive-subtle block w-full px-3 py-2 text-left text-sm text-text hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
      onClick={onClose}
    >
      Settings
    </button>
    <button
      type="button"
      role="menuitem"
      className="interactive interactive-subtle block w-full px-3 py-2 text-left text-sm text-text hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
      onClick={onClose}
    >
      Sign out
    </button>
  </div>
);
