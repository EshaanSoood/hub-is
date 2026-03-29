import { useEffect, useRef } from 'react';
import type { TouchEventHandler } from 'react';

export const useLongPress = (onLongPress: () => void, delay = 500) => {
  const timeoutRef = useRef<number | null>(null);
  const startPointRef = useRef<{ x: number; y: number } | null>(null);
  const firedRef = useRef(false);

  const clearTimer = () => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, []);

  const onTouchStart: TouchEventHandler<HTMLElement> = (event) => {
    const touch = event.touches[0];
    if (!touch) {
      return;
    }

    firedRef.current = false;
    startPointRef.current = { x: touch.clientX, y: touch.clientY };
    clearTimer();
    timeoutRef.current = window.setTimeout(() => {
      firedRef.current = true;
      onLongPress();
    }, delay);
  };

  const onTouchEnd: TouchEventHandler<HTMLElement> = (event) => {
    if (firedRef.current) {
      event.preventDefault();
    }
    clearTimer();
    firedRef.current = false;
    startPointRef.current = null;
  };

  const onTouchMove: TouchEventHandler<HTMLElement> = (event) => {
    const origin = startPointRef.current;
    const touch = event.touches[0];
    if (!origin || !touch) {
      return;
    }

    const deltaX = touch.clientX - origin.x;
    const deltaY = touch.clientY - origin.y;
    if (Math.hypot(deltaX, deltaY) > 10) {
      clearTimer();
      firedRef.current = false;
      startPointRef.current = null;
    }
  };

  return {
    onTouchStart,
    onTouchEnd,
    onTouchMove,
  };
};
