import { Icon } from '../../primitives';
import type { UseToolbarQuickAddResult } from './hooks/useToolbarQuickAdd';
import { QuickAddMenu } from './ToolbarDialogs/QuickAddMenu';

type ToolbarQuickAddProps = Pick<
  UseToolbarQuickAddResult,
  | 'contextMenuRef'
  | 'contextMenuTriggerRef'
  | 'contextMenuOpen'
  | 'toggleQuickAddMenu'
  | 'quickAddItemRefs'
  | 'quickAddActiveIndex'
  | 'setQuickAddActiveIndex'
  | 'onQuickAddMenuItemKeyDown'
  | 'onSelectQuickAddOption'
>;

export const ToolbarQuickAdd = ({
  contextMenuRef,
  contextMenuTriggerRef,
  contextMenuOpen,
  toggleQuickAddMenu,
  quickAddItemRefs,
  quickAddActiveIndex,
  setQuickAddActiveIndex,
  onQuickAddMenuItemKeyDown,
  onSelectQuickAddOption,
}: ToolbarQuickAddProps) => (
  <div className="relative" ref={contextMenuRef}>
    <button
      ref={contextMenuTriggerRef}
      type="button"
      aria-label="Open quick add menu"
      aria-haspopup="menu"
      aria-expanded={contextMenuOpen}
      onClick={toggleQuickAddMenu}
      className="flex h-7 w-7 items-center justify-center rounded-control border border-border-muted text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
    >
      <Icon name="plus" className="text-[14px]" />
    </button>

    {contextMenuOpen ? (
      <QuickAddMenu
        quickAddItemRefs={quickAddItemRefs}
        quickAddActiveIndex={quickAddActiveIndex}
        setQuickAddActiveIndex={setQuickAddActiveIndex}
        onQuickAddMenuItemKeyDown={onQuickAddMenuItemKeyDown}
        onSelectQuickAddOption={onSelectQuickAddOption}
      />
    ) : null}
  </div>
);
