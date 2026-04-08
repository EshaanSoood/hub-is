import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { HubSearchResult } from '../../../services/hub/search';
import { SearchResultsPanel } from './ToolbarDialogs/SearchResultsPanel';
import type {
  CloseContextMenuOptions,
  CloseNotificationsOptions,
  CloseProfileOptions,
  CloseQuickNavOptions,
} from './types';

interface ToolbarSearchProps {
  searchRef: MutableRefObject<HTMLDivElement | null>;
  searchQuery: string;
  setSearchQuery: Dispatch<SetStateAction<string>>;
  setSearchActiveIndex: Dispatch<SetStateAction<number>>;
  searchDismissedRef: MutableRefObject<boolean>;
  setSearchOpen: Dispatch<SetStateAction<boolean>>;
  closeQuickNav: (options?: CloseQuickNavOptions) => void;
  closeQuickNavPanel: () => void;
  closeProfile: (options?: CloseProfileOptions) => void;
  closeNotifications: (options?: CloseNotificationsOptions) => void;
  closeContextMenu: (options?: CloseContextMenuOptions) => void;
  closeCapturePanel: (options?: { restoreFocus?: boolean }) => void;
  searchOpen: boolean;
  searchLoading: boolean;
  normalizedSearchActiveIndex: number;
  searchResults: HubSearchResult[];
  onSelectSearchResult: (result: HubSearchResult) => void;
  closeSearch: () => void;
  searchError: string | null;
}

export const ToolbarSearch = ({
  searchRef,
  searchQuery,
  setSearchQuery,
  setSearchActiveIndex,
  searchDismissedRef,
  setSearchOpen,
  closeQuickNav,
  closeQuickNavPanel,
  closeProfile,
  closeNotifications,
  closeContextMenu,
  closeCapturePanel,
  searchOpen,
  searchLoading,
  normalizedSearchActiveIndex,
  searchResults,
  onSelectSearchResult,
  closeSearch,
  searchError,
}: ToolbarSearchProps) => {
  const handleSelectSearchResult = useCallback((result: HubSearchResult) => {
    closeNotifications({ restoreFocus: false });
    onSelectSearchResult(result);
  }, [closeNotifications, onSelectSearchResult]);

  return (
    <div className="mx-auto w-full max-w-xs flex-1" ref={searchRef}>
      <div className="relative">
        <input
          type="search"
          role="combobox"
          value={searchQuery}
          onChange={(event) => {
            setSearchQuery(event.target.value);
            setSearchActiveIndex(0);
          }}
          onFocus={() => {
            if (searchQuery.trim()) {
              searchDismissedRef.current = false;
              setSearchOpen(true);
            }
            closeQuickNav({ restoreFocus: false });
            closeQuickNavPanel();
            closeProfile({ restoreFocus: false });
            closeNotifications({ restoreFocus: false });
            closeContextMenu({ restoreFocus: false });
            closeCapturePanel({ restoreFocus: false });
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              if (!searchOpen) {
                setSearchOpen(true);
              }
              setSearchActiveIndex((current) => {
                if (searchResults.length === 0) {
                  return -1;
                }
                const nextIndex = current < 0 ? 0 : current + 1;
                return nextIndex >= searchResults.length ? 0 : nextIndex;
              });
              return;
            }

            if (event.key === 'ArrowUp') {
              event.preventDefault();
              if (!searchOpen) {
                setSearchOpen(true);
              }
              setSearchActiveIndex((current) => {
                if (searchResults.length === 0) {
                  return -1;
                }
                if (current <= 0) {
                  return searchResults.length - 1;
                }
                return current - 1;
              });
              return;
            }

            if (
              searchOpen && !searchLoading
              && event.key === 'Enter'
              && normalizedSearchActiveIndex >= 0
              && searchResults[normalizedSearchActiveIndex]
            ) {
              event.preventDefault();
              handleSelectSearchResult(searchResults[normalizedSearchActiveIndex]);
              return;
            }

            if (event.key === 'Escape') {
              event.preventDefault();
              closeSearch();
            }
          }}
          placeholder="Search..."
          aria-label="Global search"
          aria-autocomplete="list"
          aria-controls="global-search-results"
          aria-activedescendant={normalizedSearchActiveIndex >= 0 ? `search-result-${normalizedSearchActiveIndex}` : undefined}
          aria-expanded={searchOpen}
          className="h-7 w-full rounded-control border border-border-muted bg-surface px-sm pr-16 text-[13px] text-text outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        />
        <div
          className="pointer-events-none absolute inset-y-0 right-sm flex items-center text-[11px] text-muted"
          aria-hidden="true"
        >
          {searchLoading ? 'Searching…' : ''}
        </div>

        {searchOpen ? (
          <SearchResultsPanel
            searchLoading={searchLoading}
            searchError={searchError}
            searchResults={searchResults}
            normalizedSearchActiveIndex={normalizedSearchActiveIndex}
            setSearchActiveIndex={setSearchActiveIndex}
            onSelectSearchResult={handleSelectSearchResult}
          />
        ) : null}
      </div>
    </div>
  );
};
