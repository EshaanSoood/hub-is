import { useMemo } from 'react';

export type CalendarDisplayTier = 'small' | 'medium' | 'large';

export const useCalendarTierSelection = (sizeTier?: 'S' | 'M' | 'L'): CalendarDisplayTier =>
  useMemo(() => {
    if (sizeTier === 'S') {
      return 'small';
    }
    if (sizeTier === 'M') {
      return 'medium';
    }
    return 'large';
  }, [sizeTier]);
