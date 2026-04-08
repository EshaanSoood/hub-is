import type { Dispatch, SetStateAction } from 'react';

export interface CloseQuickNavOptions {
  restoreFocus?: boolean;
}

export interface CloseNotificationsOptions {
  restoreFocus?: boolean;
}

export interface CloseProfileOptions {
  restoreFocus?: boolean;
}

export interface CloseContextMenuOptions {
  restoreFocus?: boolean;
}

export interface BottomToolbarProps {
  setCaptureAnnouncement: Dispatch<SetStateAction<string>>;
}
