import { AnimatePresence } from 'framer-motion';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { Icon } from '../../primitives';
import type { QuickNavActionItem } from '../appShellUtils';
import { QuickNavPanel } from './ToolbarDialogs/QuickNavPanel';
import type {
  CloseContextMenuOptions,
  CloseNotificationsOptions,
  CloseProfileOptions,
  CloseQuickNavOptions,
} from './types';

interface ToolbarNavProps {
  quickNavRef: MutableRefObject<HTMLDivElement | null>;
  quickNavTriggerRef: MutableRefObject<HTMLButtonElement | null>;
  quickNavOpen: boolean;
  closeQuickNav: (options?: CloseQuickNavOptions) => void;
  setQuickNavOpen: Dispatch<SetStateAction<boolean>>;
  setQuickNavActiveIndex: Dispatch<SetStateAction<number>>;
  quickNavItems: QuickNavActionItem[];
  closeSearch: () => void;
  closeProfile: (options?: CloseProfileOptions) => void;
  closeNotifications: (options?: CloseNotificationsOptions) => void;
  closeContextMenu: (options?: CloseContextMenuOptions) => void;
  closeQuickNavPanel: () => void;
  closeCapturePanel: (options?: { restoreFocus?: boolean }) => void;
  quickNavInputRef: MutableRefObject<HTMLInputElement | null>;
  quickNavQuery: string;
  setQuickNavQuery: Dispatch<SetStateAction<string>>;
  normalizedQuickNavActiveIndex: number;
  onSelectQuickNavItem: (item: QuickNavActionItem) => void;
  quickNavDestinationItems: QuickNavActionItem[];
}

export const ToolbarNav = ({
  quickNavRef,
  quickNavTriggerRef,
  quickNavOpen,
  closeQuickNav,
  setQuickNavOpen,
  setQuickNavActiveIndex,
  quickNavItems,
  closeSearch,
  closeProfile,
  closeNotifications,
  closeContextMenu,
  closeQuickNavPanel,
  closeCapturePanel,
  quickNavInputRef,
  quickNavQuery,
  setQuickNavQuery,
  normalizedQuickNavActiveIndex,
  onSelectQuickNavItem,
  quickNavDestinationItems,
}: ToolbarNavProps) => (
  <div className="relative" ref={quickNavRef}>
    <button
      ref={quickNavTriggerRef}
      type="button"
      onClick={() => {
        if (quickNavOpen) {
          closeQuickNav();
        } else {
          setQuickNavOpen(true);
          setQuickNavActiveIndex(quickNavItems.length > 0 ? 0 : -1);
        }
        closeSearch();
        closeProfile({ restoreFocus: false });
        closeNotifications({ restoreFocus: false });
        closeContextMenu({ restoreFocus: false });
        closeQuickNavPanel();
        closeCapturePanel({ restoreFocus: false });
      }}
      aria-label="Quick navigation"
      aria-expanded={quickNavOpen}
      className="flex h-7 items-center gap-xs rounded-control border border-border-muted px-sm text-[13px] text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
      style={{
        background: quickNavOpen ? 'color-mix(in srgb, var(--color-primary) 12%, transparent)' : 'transparent',
      }}
    >
      <Icon name="nav" className="text-[14px]" />
      Nav
    </button>

    <AnimatePresence>
      {quickNavOpen ? (
        <QuickNavPanel
          quickNavInputRef={quickNavInputRef}
          quickNavQuery={quickNavQuery}
          setQuickNavQuery={setQuickNavQuery}
          setQuickNavActiveIndex={setQuickNavActiveIndex}
          normalizedQuickNavActiveIndex={normalizedQuickNavActiveIndex}
          onSelectQuickNavItem={onSelectQuickNavItem}
          quickNavDestinationItems={quickNavDestinationItems}
        />
      ) : null}
    </AnimatePresence>
  </div>
);
