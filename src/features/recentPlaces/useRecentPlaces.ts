import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { MAX_VISIBLE_RECENT_PLACES, selectRecentPlaces, subscribeRecentPlaces } from './store';
import type { RecentPlaceEntry } from './types';

export const useRecentPlaces = (limit = MAX_VISIBLE_RECENT_PLACES): RecentPlaceEntry[] => {
  const getSnapshot = useCallback(() => JSON.stringify(selectRecentPlaces(limit)), [limit]);
  const serializedSnapshot = useSyncExternalStore(subscribeRecentPlaces, getSnapshot, () => '[]');
  return useMemo(() => JSON.parse(serializedSnapshot) as RecentPlaceEntry[], [serializedSnapshot]);
};
