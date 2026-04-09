import { Icon } from '../../../primitives';
import { AnimatedSurface } from '../../../motion/AnimatedSurface';
import { QUICK_ADD_OPTIONS } from '../../appShellUtils';
import type { UseToolbarQuickAddResult } from '../hooks/useToolbarQuickAdd';

type QuickAddMenuProps = Pick<
  UseToolbarQuickAddResult,
  | 'quickAddItemRefs'
  | 'quickAddActiveIndex'
  | 'setQuickAddActiveIndex'
  | 'onQuickAddMenuItemKeyDown'
  | 'onSelectQuickAddOption'
>;

export const QuickAddMenu = ({
  quickAddItemRefs,
  quickAddActiveIndex,
  setQuickAddActiveIndex,
  onQuickAddMenuItemKeyDown,
  onSelectQuickAddOption,
}: QuickAddMenuProps) => (
  <AnimatedSurface
    role="menu"
    ariaLabel="Quick add"
    transformOrigin="bottom left"
    className="absolute bottom-[calc(100%+8px)] left-0 z-[200] min-w-[220px] rounded-control border border-border-muted bg-surface-elevated py-1 shadow-soft"
  >
    {QUICK_ADD_OPTIONS.map((option, index) => (
      <button
        key={option.key}
        ref={(node) => {
          quickAddItemRefs.current[index] = node;
        }}
        type="button"
        role="menuitem"
        tabIndex={quickAddActiveIndex === index ? 0 : -1}
        className="flex w-full items-center gap-2 px-md py-xs text-left text-sm text-text hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        style={{
          background:
            quickAddActiveIndex === index ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)' : 'transparent',
        }}
        onMouseEnter={() => setQuickAddActiveIndex(index)}
        onKeyDown={(event) => onQuickAddMenuItemKeyDown(event, index)}
        onClick={() => onSelectQuickAddOption(option)}
      >
        <Icon name={option.iconName} className="text-[14px] text-primary" />
        <span>{option.label}</span>
      </button>
    ))}
  </AnimatedSurface>
);
