import { Icon } from '../../primitives';
import { QuickNavPanel } from './ToolbarDialogs/QuickNavPanel';
import type { BottomToolbarProps } from './types';

type ToolbarNavProps = Pick<
  BottomToolbarProps,
  | 'quickNavRef'
  | 'quickNavTriggerRef'
  | 'quickNavOpen'
  | 'closeQuickNav'
  | 'setQuickNavOpen'
  | 'setQuickNavActiveIndex'
  | 'quickNavItems'
  | 'closeSearch'
  | 'setProfileOpen'
  | 'setNotificationsOpen'
  | 'setContextMenuOpen'
  | 'closeQuickNavPanel'
  | 'closeCapturePanel'
  | 'quickNavInputRef'
  | 'quickNavQuery'
  | 'setQuickNavQuery'
  | 'normalizedQuickNavActiveIndex'
  | 'onSelectQuickNavItem'
  | 'quickNavDestinationItems'
>;

export const ToolbarNav = ({
  quickNavRef,
  quickNavTriggerRef,
  quickNavOpen,
  closeQuickNav,
  setQuickNavOpen,
  setQuickNavActiveIndex,
  quickNavItems,
  closeSearch,
  setProfileOpen,
  setNotificationsOpen,
  setContextMenuOpen,
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
        setProfileOpen(false);
        setNotificationsOpen(false);
        setContextMenuOpen(false);
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
      <Icon name="menu" className="text-[14px]" />
      Nav
    </button>

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
  </div>
);
