import { useEffect, useRef } from 'react';
import { recordRecentProjectVisit } from './store';
import type { RecentProjectPlaceInput } from './types';

const VISIT_TRACKING_DELAY_MS = 2000;

export const useRecentProjectVisitTracker = (place: RecentProjectPlaceInput | null) => {
  const latestPlaceRef = useRef<RecentProjectPlaceInput | null>(place);
  const stablePlaceKey = place ? `${place.spaceId}:${place.projectId}:${place.href ?? ''}` : null;

  useEffect(() => {
    latestPlaceRef.current = place;
  }, [place]);

  useEffect(() => {
    if (!stablePlaceKey) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      if (latestPlaceRef.current) {
        recordRecentProjectVisit(latestPlaceRef.current);
      }
    }, VISIT_TRACKING_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [stablePlaceKey]);
};
