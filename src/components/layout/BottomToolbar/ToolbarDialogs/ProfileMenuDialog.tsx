import { ProfileMenu } from '../../ProfileMenu';
import type { BottomToolbarProps } from '../types';

type ProfileMenuDialogProps = Pick<
  BottomToolbarProps,
  | 'sessionSummary'
  | 'avatarUrl'
  | 'avatarBroken'
  | 'profileMenuRef'
  | 'hasCalendarFeedUrl'
  | 'onCopyCalendarLink'
  | 'installMenuLabel'
  | 'onInstallHubOs'
  | 'onNavigateProjectsFromProfileMenu'
  | 'onLogoutFromProfileMenu'
>;

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
