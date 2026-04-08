import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { notifyError, notifyInfo, notifySuccess } from '../../../primitives';
import { buildAccountAvatarUrl, focusElementSoon, focusFirstDescendantSoon, sessionInitials, type QuickAddDialog } from '../../appShellUtils';
import type { CloseProfileOptions } from '../types';
import { useInstallPromptEffect } from './useInstallPromptEffect';

interface InstallState {
  installed: boolean;
  iosSafari: boolean;
}

interface SessionSummary {
  name: string;
  email: string;
  userId: string;
}

interface UseToolbarProfileArgs {
  sessionSummary: SessionSummary;
  calendarFeedUrl: string;
  navigate: (to: string) => void;
  signOut: () => Promise<void>;
  contextMenuOpen: boolean;
  captureOpen: boolean;
  quickAddDialog: QuickAddDialog;
}

interface UseToolbarProfileResult {
  profileRef: MutableRefObject<HTMLDivElement | null>;
  profileTriggerRef: MutableRefObject<HTMLButtonElement | null>;
  profileMenuRef: MutableRefObject<HTMLDivElement | null>;
  profileOpen: boolean;
  avatarBroken: boolean;
  avatarUrl: string;
  hasCalendarFeedUrl: boolean;
  installMenuLabel: string | null;
  closeProfile: (options?: CloseProfileOptions) => void;
  toggleProfile: () => void;
  setAvatarBroken: (broken: boolean) => void;
  onCopyCalendarLink: () => void;
  onInstallHubOs: () => Promise<void>;
  onNavigateProjectsFromProfileMenu: () => void;
  onLogoutFromProfileMenu: () => void;
}

export const useToolbarProfile = ({
  sessionSummary,
  calendarFeedUrl,
  navigate,
  signOut,
  contextMenuOpen,
  captureOpen,
  quickAddDialog,
}: UseToolbarProfileArgs): UseToolbarProfileResult => {
  const [profileOpen, setProfileOpen] = useState(false);
  const [avatarBroken, setAvatarBroken] = useState(false);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installState, setInstallState] = useState<InstallState>({
    installed: false,
    iosSafari: false,
  });

  const profileRef = useRef<HTMLDivElement | null>(null);
  const profileTriggerRef = useRef<HTMLButtonElement | null>(null);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const profileWasOpenRef = useRef(false);
  const skipProfileFocusRestoreRef = useRef(false);

  const accountInitials = sessionInitials(sessionSummary.name, sessionSummary.email, sessionSummary.userId);
  const avatarUrl = buildAccountAvatarUrl(accountInitials, sessionSummary.userId || sessionSummary.email || sessionSummary.name);
  const hasCalendarFeedUrl = calendarFeedUrl.trim().length > 0;

  const closeProfile = useCallback((options?: CloseProfileOptions) => {
    skipProfileFocusRestoreRef.current = options?.restoreFocus === false;
    setProfileOpen(false);
  }, []);

  const toggleProfile = useCallback(() => {
    setProfileOpen((current) => !current);
  }, []);

  const onNavigateProjectsFromProfileMenu = useCallback(() => {
    closeProfile({ restoreFocus: false });
    navigate('/projects');
  }, [closeProfile, navigate]);

  const onLogoutFromProfileMenu = useCallback(() => {
    closeProfile({ restoreFocus: false });
    void signOut();
  }, [closeProfile, signOut]);

  const onCopyCalendarLink = useCallback(() => {
    const url = calendarFeedUrl.trim();
    if (!url) {
      notifyError('Could not copy calendar link.', 'Calendar link is not available yet.');
      return;
    }

    const fallbackCopy = () => {
      const textArea = document.createElement('textarea');
      textArea.value = url;
      textArea.setAttribute('readonly', 'true');
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      textArea.style.pointerEvents = 'none';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const copied = document.execCommand('copy');
      document.body.removeChild(textArea);
      return copied;
    };

    if (navigator.clipboard?.writeText) {
      const copyRequest = navigator.clipboard.writeText(url);
      void copyRequest
        .then(() => {
          notifySuccess('Calendar link copied — paste in Google Calendar, Outlook, or Apple Calendar to subscribe.');
        })
        .catch(() => {
          if (fallbackCopy()) {
            notifySuccess('Calendar link copied — paste in Google Calendar, Outlook, or Apple Calendar to subscribe.');
            return;
          }
          notifyError('Could not copy calendar link.');
        });
      return;
    }

    if (fallbackCopy()) {
      notifySuccess('Calendar link copied — paste in Google Calendar, Outlook, or Apple Calendar to subscribe.');
      return;
    }
    notifyError('Could not copy calendar link.');
  }, [calendarFeedUrl]);

  const onInstallHubOs = useCallback(async () => {
    if (installState.installed) {
      return;
    }

    if (deferredInstallPrompt) {
      closeProfile({ restoreFocus: false });
      const promptEvent = deferredInstallPrompt;
      setDeferredInstallPrompt(null);
      try {
        await promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        if (choice.outcome === 'dismissed') {
          notifyInfo('Install cancelled.');
        }
      } catch {
        notifyError('Could not open the install prompt.');
      }
      return;
    }

    if (installState.iosSafari) {
      closeProfile({ restoreFocus: false });
      notifyInfo('Add to Home Screen', 'In Safari, tap Share, then tap Add to Home Screen.');
    }
  }, [closeProfile, deferredInstallPrompt, installState.installed, installState.iosSafari]);

  const installMenuLabel = useMemo(() => {
    if (installState.installed) {
      return null;
    }
    if (deferredInstallPrompt) {
      return 'Install Hub OS';
    }
    if (installState.iosSafari) {
      return 'Add to Home Screen';
    }
    return null;
  }, [deferredInstallPrompt, installState.installed, installState.iosSafari]);

  useInstallPromptEffect({
    setDeferredInstallPrompt,
    setInstallState,
  });

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (profileOpen && profileRef.current && !profileRef.current.contains(target)) {
        closeProfile();
      }
    };

    document.addEventListener('mousedown', onMouseDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
    };
  }, [closeProfile, profileOpen]);

  useEffect(() => {
    if (profileOpen) {
      focusFirstDescendantSoon(profileMenuRef.current, '[role="menuitem"]');
    } else if (
      profileWasOpenRef.current
      && !skipProfileFocusRestoreRef.current
      && !contextMenuOpen
      && !captureOpen
      && !quickAddDialog
    ) {
      focusElementSoon(profileTriggerRef.current);
    }
    if (!profileOpen) {
      skipProfileFocusRestoreRef.current = false;
    }
    profileWasOpenRef.current = profileOpen;
  }, [captureOpen, contextMenuOpen, profileOpen, quickAddDialog]);

  return {
    profileRef,
    profileTriggerRef,
    profileMenuRef,
    profileOpen,
    avatarBroken,
    avatarUrl,
    hasCalendarFeedUrl,
    installMenuLabel,
    closeProfile,
    toggleProfile,
    setAvatarBroken,
    onCopyCalendarLink,
    onInstallHubOs,
    onNavigateProjectsFromProfileMenu,
    onLogoutFromProfileMenu,
  };
};
