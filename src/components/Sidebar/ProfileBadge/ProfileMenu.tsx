import { useEffect, useRef, useState } from 'react';

interface ProfileMenuProps {
  id: string;
  onCloseAndRestoreFocus: () => void;
}

const MENU_ITEMS = ['Settings', 'Sign out'] as const;

export const ProfileMenu = ({
  id,
  onCloseAndRestoreFocus,
}: ProfileMenuProps) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    itemRefs.current[activeIndex]?.focus();
  }, [activeIndex]);

  const focusItem = (nextIndex: number) => {
    setActiveIndex(nextIndex);
    itemRefs.current[nextIndex]?.focus();
  };

  return (
    <div
      id={id}
      role="menu"
      aria-label="Profile menu"
      aria-orientation="vertical"
      className="sidebar-flyout-above absolute left-0 right-0 z-[120] overflow-hidden rounded-panel border border-border-muted bg-surface-elevated shadow-soft"
    >
      {MENU_ITEMS.map((label, index) => (
        <button
          key={label}
          ref={(node) => {
            itemRefs.current[index] = node;
          }}
          type="button"
          role="menuitem"
          tabIndex={index === activeIndex ? 0 : -1}
          className="interactive interactive-subtle block w-full px-3 py-2 text-left text-sm text-text hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          onFocus={() => setActiveIndex(index)}
          onMouseMove={() => setActiveIndex(index)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              focusItem((index + 1) % MENU_ITEMS.length);
              return;
            }
            if (event.key === 'ArrowUp') {
              event.preventDefault();
              focusItem((index - 1 + MENU_ITEMS.length) % MENU_ITEMS.length);
              return;
            }
            if (event.key === 'Home') {
              event.preventDefault();
              focusItem(0);
              return;
            }
            if (event.key === 'End') {
              event.preventDefault();
              focusItem(MENU_ITEMS.length - 1);
              return;
            }
            if (event.key === 'Escape') {
              event.preventDefault();
              onCloseAndRestoreFocus();
            }
          }}
          onClick={onCloseAndRestoreFocus}
        >
          {label}
        </button>
      ))}
    </div>
  );
};
