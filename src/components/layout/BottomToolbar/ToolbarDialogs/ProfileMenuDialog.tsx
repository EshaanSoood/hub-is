import type { MutableRefObject } from 'react';
import { ProfileMenu } from '../../ProfileMenu';

interface ProfileMenuDialogProps {
  sessionSummary: { name: string; email: string };
  avatarUrl: string;
  avatarBroken: boolean;
  profileMenuRef: MutableRefObject<HTMLDivElement | null>;
  hasCalendarFeedUrl: boolean;
  onCopyCalendarLink: () => void;
  installMenuLabel: string | null;
  onInstallHubOs: () => Promise<void>;
  onNavigateProjectsFromProfileMenu: () => void;
  onLogoutFromProfileMenu: () => void;
}

export const ProfileMenuDialog = ({
  sessionSummary,
  avatarUrl,
  avatarBroken,
  profileMenuRef,
  hasCalendarFeedUrl,
  onCopyCalendarLink,
  installMenuLabel,
  onInstallHubOs,
  onNavigateProjectsFromProfileMenu,
  onLogoutFromProfileMenu,
}: ProfileMenuDialogProps) => (
  <ProfileMenu
    name={sessionSummary.name}
    email={sessionSummary.email}
    avatarUrl={avatarUrl}
    avatarBroken={avatarBroken}
    menuRef={profileMenuRef}
    onCopyCalendarLink={hasCalendarFeedUrl ? () => {
      void onCopyCalendarLink();
    } : undefined}
    installLabel={installMenuLabel}
    onInstall={
      installMenuLabel
        ? () => {
          void onInstallHubOs();
        }
        : undefined
    }
    onNavigateProjects={onNavigateProjectsFromProfileMenu}
    onLogout={onLogoutFromProfileMenu}
  />
);
