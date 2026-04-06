import type { FC, RefObject } from 'react';
import { Icon } from '../primitives';

interface ProfileMenuProps {
  name: string;
  email: string;
  avatarUrl: string;
  avatarBroken: boolean;
  menuRef: RefObject<HTMLDivElement | null>;
  onCopyCalendarLink?: () => void;
  installLabel?: string | null;
  onInstall?: () => void;
  onNavigateProjects: () => void;
  onLogout: () => void;
}

export const ProfileMenu: FC<ProfileMenuProps> = ({
  name,
  email,
  avatarUrl,
  avatarBroken,
  menuRef,
  onCopyCalendarLink,
  installLabel,
  onInstall,
  onNavigateProjects,
  onLogout,
}) => (
  <div
    ref={menuRef}
    role="menu"
    className="absolute bottom-[calc(100%+8px)] right-0 z-[100] w-56 overflow-hidden rounded-panel border border-border-muted bg-surface-elevated shadow-soft"
  >
    <div className="flex items-center gap-sm border-b border-border-muted px-md py-md">
      {avatarBroken ? (
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface text-text"
        >
          <Icon name="user" className="text-[18px]" />
        </span>
      ) : (
        <img src={avatarUrl} alt="" aria-hidden="true" className="h-9 w-9 shrink-0 rounded-full object-cover" />
      )}
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-text">{name}</p>
        <p className="truncate text-xs text-muted">{email}</p>
      </div>
    </div>

    {onCopyCalendarLink ? (
      <button
        type="button"
        role="menuitem"
        aria-label="Copy calendar subscription link"
        className="block w-full px-md py-sm text-left text-sm text-text hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        onClick={onCopyCalendarLink}
      >
        Copy calendar link
      </button>
    ) : null}
    {installLabel && onInstall ? (
      <button
        type="button"
        role="menuitem"
        aria-label="Install Hub OS app."
        className="block w-full px-md py-sm text-left text-sm text-text hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        onClick={onInstall}
      >
        {installLabel}
      </button>
    ) : null}
    <button
      type="button"
      role="menuitem"
      className="block w-full px-md py-sm text-left text-sm text-text hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
      onClick={onNavigateProjects}
    >
      Projects
    </button>
    <button
      type="button"
      role="menuitem"
      className="block w-full px-md py-sm text-left text-sm text-danger hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
      onClick={onLogout}
    >
      Log out
    </button>
  </div>
);
