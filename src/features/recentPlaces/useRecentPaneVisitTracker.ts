import { useEffect } from 'react';
import { recordRecentPaneVisit } from './store';
import type { RecentPanePlaceInput } from './types';

const VISIT_TRACKING_DELAY_MS = 2000;

export const useRecentPaneVisitTracker = (place: RecentPanePlaceInput | null) => {
  useEffect(() => {
    if (!place) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      recordRecentPaneVisit(place);
    }, VISIT_TRACKING_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [place]);
};
