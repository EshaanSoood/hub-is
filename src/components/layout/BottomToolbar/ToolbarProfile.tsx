import type { Dispatch, SetStateAction } from 'react';
import { Icon } from '../../primitives';
import { ProfileMenuDialog } from './ToolbarDialogs/ProfileMenuDialog';
import type { CloseNotificationsOptions } from './hooks/useToolbarNotifications';
import type { BottomToolbarProps } from './types';

interface ToolbarProfileProps {
  profileRef: BottomToolbarProps['profileRef'];
  profileTriggerRef: BottomToolbarProps['profileTriggerRef'];
  setProfileOpen: Dispatch<SetStateAction<boolean>>;
  closeNotifications: (options?: CloseNotificationsOptions) => void;
  closeSearch: () => void;
  closeQuickNav: () => void;
  closeQuickNavPanel: () => void;
  setContextMenuOpen: Dispatch<SetStateAction<boolean>>;
  closeCapturePanel: BottomToolbarProps['closeCapturePanel'];
  profileOpen: boolean;
  avatarBroken: boolean;
  avatarUrl: string;
  sessionSummary: BottomToolbarProps['sessionSummary'];
  setAvatarBroken: Dispatch<SetStateAction<boolean>>;
  profileMenuRef: BottomToolbarProps['profileMenuRef'];
  hasCalendarFeedUrl: boolean;
  onCopyCalendarLink: () => void;
  installMenuLabel: string | null;
  onInstallHubOs: () => Promise<void>;
  onNavigateProjectsFromProfileMenu: () => void;
  onLogoutFromProfileMenu: () => void;
}

export const ToolbarProfile = ({
  profileRef,
  profileTriggerRef,
  setProfileOpen,
  closeNotifications,
  closeSearch,
  closeQuickNav,
  closeQuickNavPanel,
  setContextMenuOpen,
  closeCapturePanel,
  profileOpen,
  avatarBroken,
  avatarUrl,
  sessionSummary,
  setAvatarBroken,
  profileMenuRef,
  hasCalendarFeedUrl,
  onCopyCalendarLink,
  installMenuLabel,
  onInstallHubOs,
  onNavigateProjectsFromProfileMenu,
  onLogoutFromProfileMenu,
}: ToolbarProfileProps) => (
  <div className="relative" ref={profileRef}>
    <button
      ref={profileTriggerRef}
      type="button"
      onClick={() => {
        setProfileOpen((current) => !current);
        closeNotifications({ restoreFocus: false });
        closeSearch();
        closeQuickNav();
        closeQuickNavPanel();
        setContextMenuOpen(false);
        closeCapturePanel({ restoreFocus: false });
      }}
      aria-label="Account menu"
      aria-expanded={profileOpen}
      className="h-7 w-7 overflow-hidden rounded-full border-2 border-transparent bg-muted p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
      style={{ borderColor: profileOpen ? 'var(--color-primary)' : 'transparent' }}
    >
      {avatarBroken ? (
        <span className="flex h-full w-full items-center justify-center text-text">
          <Icon name="user" className="text-[16px]" />
        </span>
      ) : (
        <img
          src={avatarUrl}
          alt={sessionSummary.name}
          className="h-full w-full object-cover"
          onError={() => setAvatarBroken(true)}
        />
      )}
    </button>

    {profileOpen ? (
      <ProfileMenuDialog
        sessionSummary={sessionSummary}
        avatarUrl={avatarUrl}
        avatarBroken={avatarBroken}
        profileMenuRef={profileMenuRef}
        hasCalendarFeedUrl={hasCalendarFeedUrl}
        onCopyCalendarLink={onCopyCalendarLink}
        installMenuLabel={installMenuLabel}
        onInstallHubOs={onInstallHubOs}
        onNavigateProjectsFromProfileMenu={onNavigateProjectsFromProfileMenu}
        onLogoutFromProfileMenu={onLogoutFromProfileMenu}
      />
    ) : null}
  </div>
);
