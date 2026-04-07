import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { searchHub, type HubSearchResult } from '../../../../services/hub/search';

interface UseGlobalSearchEffectArgs {
  accessToken: string | null | undefined;
  searchQuery: string;
  searchRequestVersionRef: MutableRefObject<number>;
  searchDismissedRef: MutableRefObject<boolean>;
  setSearchResults: Dispatch<SetStateAction<HubSearchResult[]>>;
  setSearchError: Dispatch<SetStateAction<string | null>>;
  setSearchLoading: Dispatch<SetStateAction<boolean>>;
  setSearchOpen: Dispatch<SetStateAction<boolean>>;
  setSearchActiveIndex: Dispatch<SetStateAction<number>>;
}

export const useGlobalSearchEffect = ({
  accessToken,
  searchQuery,
  searchRequestVersionRef,
  searchDismissedRef,
  setSearchResults,
  setSearchError,
  setSearchLoading,
  setSearchOpen,
  setSearchActiveIndex,
}: UseGlobalSearchEffectArgs) => {
  useEffect(() => {
    const trimmedQuery = searchQuery.trim();
    const requestVersion = searchRequestVersionRef.current + 1;
    searchRequestVersionRef.current = requestVersion;

    if (!accessToken || !trimmedQuery) {
      setSearchResults([]);
      setSearchError(null);
      setSearchLoading(false);
      setSearchOpen(false);
      setSearchActiveIndex(-1);
      return;
    }

    searchDismissedRef.current = false;
    setSearchLoading(true);
    setSearchError(null);
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const response = await searchHub(accessToken, trimmedQuery, { limit: 20 });
          if (searchRequestVersionRef.current !== requestVersion) {
            return;
          }
          setSearchResults(response.results);
          setSearchError(null);
          if (searchDismissedRef.current) {
            return;
          }
          setSearchOpen(true);
          setSearchActiveIndex(response.results.length > 0 ? 0 : -1);
        } catch {
          if (searchRequestVersionRef.current !== requestVersion) {
            return;
          }
          setSearchResults([]);
          setSearchError('Search is temporarily unavailable.');
          if (searchDismissedRef.current) {
            return;
          }
          setSearchOpen(true);
          setSearchActiveIndex(-1);
        } finally {
          if (searchRequestVersionRef.current === requestVersion) {
            setSearchLoading(false);
          }
        }
      })();
    }, 300);

    return () => {
      window.clearTimeout(timer);
    };
  }, [accessToken, searchQuery]);
};
