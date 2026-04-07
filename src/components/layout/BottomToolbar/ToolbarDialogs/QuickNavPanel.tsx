import { Icon } from '../../../primitives';
import { QUICK_NAV_FIXED_ITEMS } from '../../appShellUtils';
import type { BottomToolbarProps } from '../types';

type QuickNavPanelProps = Pick<
  BottomToolbarProps,
  | 'quickNavInputRef'
  | 'quickNavQuery'
  | 'setQuickNavQuery'
  | 'setQuickNavActiveIndex'
  | 'normalizedQuickNavActiveIndex'
  | 'onSelectQuickNavItem'
  | 'quickNavDestinationItems'
>;

export const QuickNavPanel = ({
  quickNavInputRef,
  quickNavQuery,
  setQuickNavQuery,
  setQuickNavActiveIndex,
  normalizedQuickNavActiveIndex,
  onSelectQuickNavItem,
  quickNavDestinationItems,
}: QuickNavPanelProps) => (
  <div
    role="dialog"
    aria-label="Quick navigation"
    className="absolute bottom-[calc(100%+8px)] left-0 z-[100] w-72 overflow-hidden rounded-panel border border-border-muted bg-surface-elevated shadow-soft"
  >
    <input
      ref={quickNavInputRef}
      type="search"
      value={quickNavQuery}
      onChange={(event) => {
        setQuickNavQuery(event.target.value);
        setQuickNavActiveIndex(0);
      }}
      placeholder="Jump to…"
      aria-label="Navigate to a location"
      className="w-full border-b border-border-muted bg-transparent px-md py-sm text-sm text-text outline-none"
    />
    <ul className="max-h-72 overflow-y-auto py-1">
      {QUICK_NAV_FIXED_ITEMS.map((item, index) => (
        <li key={item.id}>
          <button
            type="button"
            aria-label={`Open ${item.label.toLowerCase()}`}
            className="flex w-full items-center gap-2 px-md py-sm text-left text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            style={{
              background:
                normalizedQuickNavActiveIndex === index
                  ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)'
                  : 'transparent',
            }}
            onMouseEnter={() => setQuickNavActiveIndex(index)}
            onClick={() => onSelectQuickNavItem(item)}
          >
            {item.iconName ? <Icon name={item.iconName} className="text-[13px] text-muted" /> : null}
            <span className="truncate">{item.label}</span>
          </button>
        </li>
      ))}
      <li aria-hidden="true" className="my-1 border-t border-border-muted" />
      {quickNavDestinationItems.length === 0 ? (
        <li className="px-md py-sm text-sm text-muted">No matching destinations</li>
      ) : (
        quickNavDestinationItems.map((item, index) => {
          const absoluteIndex = QUICK_NAV_FIXED_ITEMS.length + index;
          return (
            <li key={item.id}>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-md py-sm text-left text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                style={{
                  background:
                    normalizedQuickNavActiveIndex === absoluteIndex
                      ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)'
                      : 'transparent',
                }}
                onMouseEnter={() => setQuickNavActiveIndex(absoluteIndex)}
                onClick={() => onSelectQuickNavItem(item)}
              >
                {item.iconName ? <Icon name={item.iconName} className="text-[13px] text-muted" /> : null}
                <span className="truncate">{item.label}</span>
              </button>
            </li>
          );
        })
      )}
    </ul>
  </div>
);
