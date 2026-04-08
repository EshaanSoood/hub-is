import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { HubSearchResult } from '../../../../services/hub/search';
import { buildSearchResultHref } from '../../appShellUtils';
import type { CloseContextMenuOptions, CloseProfileOptions, CloseQuickNavOptions } from '../types';
import { useGlobalSearchEffect } from './useGlobalSearchEffect';

interface UseToolbarSearchArgs {
  accessToken: string | null | undefined;
  navigate: (to: string) => void;
  closeQuickNav: (options?: CloseQuickNavOptions) => void;
  closeQuickNavPanel: () => void;
  closeProfile: (options?: CloseProfileOptions) => void;
  closeContextMenu: (options?: CloseContextMenuOptions) => void;
  closeCapturePanel: (options?: { restoreFocus?: boolean }) => void;
}

interface UseToolbarSearchResult {
  searchRef: MutableRefObject<HTMLDivElement | null>;
  searchDismissedRef: MutableRefObject<boolean>;
  searchQuery: string;
  setSearchQuery: Dispatch<SetStateAction<string>>;
  setSearchOpen: Dispatch<SetStateAction<boolean>>;
  setSearchActiveIndex: Dispatch<SetStateAction<number>>;
  searchOpen: boolean;
  searchResults: HubSearchResult[];
  searchLoading: boolean;
  searchError: string | null;
  normalizedSearchActiveIndex: number;
  closeSearch: () => void;
  onSelectSearchResult: (result: HubSearchResult) => void;
}

export const useToolbarSearch = ({
  accessToken,
  navigate,
  closeQuickNav,
  closeQuickNavPanel,
  closeProfile,
  closeContextMenu,
  closeCapturePanel,
}: UseToolbarSearchArgs): UseToolbarSearchResult => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<HubSearchResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchActiveIndex, setSearchActiveIndex] = useState(-1);

  const searchRef = useRef<HTMLDivElement | null>(null);
  const searchDismissedRef = useRef(false);
  const searchRequestVersionRef = useRef(0);

  const resetSearch = useCallback(() => {
    searchRequestVersionRef.current += 1;
    searchDismissedRef.current = true;
    setSearchQuery('');
    setSearchResults([]);
    setSearchError(null);
    setSearchLoading(false);
    setSearchOpen(false);
    setSearchActiveIndex(-1);
  }, []);

  const closeSearch = useCallback(() => {
    searchDismissedRef.current = true;
    setSearchOpen(false);
    setSearchActiveIndex(-1);
  }, []);

  const onSelectSearchResult = useCallback((result: HubSearchResult) => {
    const href = buildSearchResultHref(result);
    if (!href) {
      return;
    }
    navigate(href);
    resetSearch();
    closeQuickNav({ restoreFocus: false });
    closeQuickNavPanel();
    closeProfile({ restoreFocus: false });
    closeContextMenu({ restoreFocus: false });
    closeCapturePanel({ restoreFocus: false });
  }, [closeCapturePanel, closeContextMenu, closeProfile, closeQuickNav, closeQuickNavPanel, navigate, resetSearch]);

  const normalizedSearchActiveIndex = useMemo(
    () => (!searchOpen || searchLoading || searchResults.length === 0
      ? -1
      : searchActiveIndex < 0 || searchActiveIndex >= searchResults.length
        ? 0
        : searchActiveIndex),
    [searchActiveIndex, searchLoading, searchOpen, searchResults.length],
  );

  useGlobalSearchEffect({
    accessToken,
    searchQuery,
    searchRequestVersionRef,
    searchDismissedRef,
    setSearchResults,
    setSearchError,
    setSearchLoading,
    setSearchOpen,
    setSearchActiveIndex,
  });

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (searchOpen && searchRef.current && !searchRef.current.contains(target)) {
        closeSearch();
      }
    };

    document.addEventListener('mousedown', onMouseDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
    };
  }, [closeSearch, searchOpen]);

  return {
    searchRef,
    searchDismissedRef,
    searchQuery,
    setSearchQuery,
    setSearchOpen,
    setSearchActiveIndex,
    searchOpen,
    searchResults,
    searchLoading,
    searchError,
    normalizedSearchActiveIndex,
    closeSearch,
    onSelectSearchResult,
  };
};
