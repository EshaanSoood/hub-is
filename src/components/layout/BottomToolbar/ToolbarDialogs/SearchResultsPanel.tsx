import type { Dispatch, SetStateAction } from 'react';
import type { HubSearchResult } from '../../../../services/hub/search';
import { buildSearchResultHref, SEARCH_RESULT_TYPE_LABELS } from '../../appShellUtils';

interface SearchResultsPanelProps {
  searchLoading: boolean;
  searchError: string | null;
  searchResults: HubSearchResult[];
  normalizedSearchActiveIndex: number;
  setSearchActiveIndex: Dispatch<SetStateAction<number>>;
  onSelectSearchResult: (result: HubSearchResult) => void;
}

export const SearchResultsPanel = ({
  searchLoading,
  searchError,
  searchResults,
  normalizedSearchActiveIndex,
  setSearchActiveIndex,
  onSelectSearchResult,
}: SearchResultsPanelProps) => (
  <div
    role="dialog"
    aria-label="Global search results"
    className="absolute bottom-[calc(100%+8px)] left-0 z-[100] w-full overflow-hidden rounded-panel border border-border-muted bg-surface-elevated shadow-soft"
  >
    {searchLoading ? (
      <div className="px-md py-sm text-sm text-muted">Searching…</div>
    ) : (
      <ul id="global-search-results" role="listbox" className="max-h-72 overflow-y-auto py-1">
        {searchError ? (
          <li className="px-md py-sm text-sm text-danger">{searchError}</li>
        ) : searchResults.length === 0 ? (
          <li className="px-md py-sm text-sm text-muted">No results</li>
        ) : (
          searchResults.map((result, index) => {
            const href = buildSearchResultHref(result);
            const disabled = !href;
            return (
              <li
                key={`${result.type}:${result.id}`}
                id={`search-result-${index}`}
                role="option"
                aria-selected={normalizedSearchActiveIndex === index}
              >
                <button
                  type="button"
                  disabled={disabled}
                  aria-disabled={disabled}
                  className="w-full px-md py-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-60"
                  style={{
                    background:
                      normalizedSearchActiveIndex === index
                        ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)'
                        : 'transparent',
                  }}
                  onMouseEnter={() => {
                    if (!disabled) {
                      setSearchActiveIndex(index);
                    }
                  }}
                  onClick={() => {
                    if (href) {
                      onSelectSearchResult(result);
                    }
                  }}
                >
                  <div className="flex items-center gap-sm">
                    <span className="rounded-full border border-border-muted px-2 py-[2px] text-[10px] uppercase tracking-[0.12em] text-muted">
                      {SEARCH_RESULT_TYPE_LABELS[result.type]}
                    </span>
                    <span className={`truncate text-sm ${disabled ? 'text-muted' : 'text-text'}`}>{result.title}</span>
                  </div>
                  {result.type === 'record' || result.type === 'pane' ? (
                    <div className="mt-1 text-xs text-muted">
                      {result.project_name || 'Unknown project'}
                      {result.type === 'record' && result.content_type && result.content_type !== 'record'
                        ? ` • ${result.content_type}`
                        : ''}
                    </div>
                  ) : null}
                </button>
              </li>
            );
          })
        )}
      </ul>
    )}
  </div>
);
