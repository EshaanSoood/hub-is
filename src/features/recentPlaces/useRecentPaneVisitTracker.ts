import { useEffect, useRef } from 'react';
import { recordRecentPaneVisit } from './store';
import type { RecentPanePlaceInput } from './types';

const VISIT_TRACKING_DELAY_MS = 2000;

export const useRecentPaneVisitTracker = (place: RecentPanePlaceInput | null) => {
  const latestPlaceRef = useRef<RecentPanePlaceInput | null>(place);
  const stablePlaceKey = place ? `${place.spaceId}:${place.paneId}:${place.href ?? ''}` : null;

  useEffect(() => {
    latestPlaceRef.current = place;
  }, [place]);

  useEffect(() => {
    if (!stablePlaceKey) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      if (latestPlaceRef.current) {
        recordRecentPaneVisit(latestPlaceRef.current);
      }
    }, VISIT_TRACKING_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [stablePlaceKey]);
};
