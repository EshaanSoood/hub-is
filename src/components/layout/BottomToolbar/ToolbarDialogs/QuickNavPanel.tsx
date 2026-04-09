import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { Icon } from '../../../primitives';
import { AnimatedSurface } from '../../../motion/AnimatedSurface';
import type { QuickNavActionItem } from '../../appShellUtils';

interface QuickNavPanelProps {
  quickNavInputRef: MutableRefObject<HTMLInputElement | null>;
  quickNavQuery: string;
  setQuickNavQuery: Dispatch<SetStateAction<string>>;
  setQuickNavActiveIndex: Dispatch<SetStateAction<number>>;
  normalizedQuickNavActiveIndex: number;
  onSelectQuickNavItem: (item: QuickNavActionItem) => void;
  quickNavDestinationItems: QuickNavActionItem[];
}

export const QuickNavPanel = ({
  quickNavInputRef,
  quickNavQuery,
  setQuickNavQuery,
  setQuickNavActiveIndex,
  normalizedQuickNavActiveIndex,
  onSelectQuickNavItem,
  quickNavDestinationItems,
}: QuickNavPanelProps) => (
  <AnimatedSurface
    role="dialog"
    ariaLabel="Quick navigation"
    transformOrigin="bottom left"
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
      {quickNavDestinationItems.length === 0 ? (
        <li className="px-md py-sm text-sm text-muted">No matching destinations</li>
      ) : (
        quickNavDestinationItems.map((item, index) => {
          return (
            <li key={item.id}>
              <button
                type="button"
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
          );
        })
      )}
    </ul>
  </AnimatedSurface>
);
