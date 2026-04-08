import { AnimatePresence } from 'framer-motion';
import type { MutableRefObject } from 'react';
import { Icon } from '../../primitives';
import { ProfileMenuDialog } from './ToolbarDialogs/ProfileMenuDialog';
import type {
  CloseContextMenuOptions,
  CloseNotificationsOptions,
  CloseQuickNavOptions,
} from './types';

interface ToolbarProfileProps {
  profileRef: MutableRefObject<HTMLDivElement | null>;
  profileTriggerRef: MutableRefObject<HTMLButtonElement | null>;
  toggleProfile: () => void;
  closeNotifications: (options?: CloseNotificationsOptions) => void;
  closeSearch: () => void;
  closeQuickNav: (options?: CloseQuickNavOptions) => void;
  closeQuickNavPanel: () => void;
  closeContextMenu: (options?: CloseContextMenuOptions) => void;
  closeCapturePanel: (options?: { restoreFocus?: boolean }) => void;
  profileOpen: boolean;
  avatarBroken: boolean;
  avatarUrl: string;
  sessionSummary: { name: string; email: string };
  setAvatarBroken: (broken: boolean) => void;
  profileMenuRef: MutableRefObject<HTMLDivElement | null>;
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
  toggleProfile,
  closeNotifications,
  closeSearch,
  closeQuickNav,
  closeQuickNavPanel,
  closeContextMenu,
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
        toggleProfile();
        closeNotifications({ restoreFocus: false });
        closeSearch();
        closeQuickNav({ restoreFocus: false });
        closeQuickNavPanel();
        closeContextMenu({ restoreFocus: false });
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

    <AnimatePresence>
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
    </AnimatePresence>
  </div>
);
