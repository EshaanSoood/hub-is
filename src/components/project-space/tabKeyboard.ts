import type { KeyboardEvent } from 'react';

const navigationKeys = new Set(['ArrowLeft', 'ArrowRight', 'Home', 'End']);

interface RovingTabOptions<T extends string> {
  event: KeyboardEvent<HTMLElement>;
  items: readonly T[];
  activeId: T;
  onNavigate: (id: T) => void;
  focusByIndex: (index: number) => void;
}

export const handleRovingTabKeyDown = <T extends string>({
  event,
  items,
  activeId,
  onNavigate,
  focusByIndex,
}: RovingTabOptions<T>): void => {
  if (!navigationKeys.has(event.key)) {
    return;
  }

  event.preventDefault();

  const currentIndex = Math.max(
    0,
    items.findIndex((item) => item === activeId),
  );
  const lastIndex = items.length - 1;

  let nextIndex = currentIndex;

  if (event.key === 'ArrowRight') {
    nextIndex = currentIndex >= lastIndex ? 0 : currentIndex + 1;
  }

  if (event.key === 'ArrowLeft') {
    nextIndex = currentIndex <= 0 ? lastIndex : currentIndex - 1;
  }

  if (event.key === 'Home') {
    nextIndex = 0;
  }

  if (event.key === 'End') {
    nextIndex = lastIndex;
  }

  onNavigate(items[nextIndex]);

  window.setTimeout(() => {
    focusByIndex(nextIndex);
  }, 0);
};
