import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInlineExpansionFocus } from '../../../hooks/accessibility/useInlineExpansionFocus';
import { buildSearchResultHref, SEARCH_RESULT_TYPE_LABELS } from '../../layout/appShellUtils';
import { SidebarLabel } from '../motion/SidebarLabel';
import {
  sidebarSearchOverlayVariants,
  sidebarSearchResultVariants,
  sidebarSearchResultsVariants,
} from '../motion/sidebarMotion';
import { Icon } from '../../primitives/Icon';
import { searchHub, type HubSearchResult } from '../../../services/hub/search';

interface SearchButtonProps {
  accessToken: string | null | undefined;
  autoFocusKey: number;
  isCollapsed: boolean;
  onOpenSearch: () => void;
  routeKey: string;
  showLabels: boolean;
}

export const SearchButton = ({
  accessToken,
  autoFocusKey,
  isCollapsed,
  onOpenSearch,
  routeKey,
  showLabels,
}: SearchButtonProps) => {
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion() ?? false;
  const [isActive, setIsActive] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<HubSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const requestVersionRef = useRef(0);

  const hasOverlay = isActive && (loading || Boolean(error) || query.trim().length > 0);
  const normalizedActiveIndex = useMemo(
    () => (results.length === 0 ? -1 : activeIndex < 0 || activeIndex >= results.length ? 0 : activeIndex),
    [activeIndex, results.length],
  );

  useInlineExpansionFocus({
    anchorRef: inputRef,
    active: hasOverlay,
    expansionKey: `${query.trim()}|${loading ? 'loading' : 'idle'}|${error ?? 'no-error'}|${results.length}`,
    enabled: isActive,
  });

  const closeSearch = useCallback(() => {
    requestVersionRef.current += 1;
    setIsActive(false);
    setQuery('');
    setResults([]);
    setLoading(false);
    setError(null);
    setActiveIndex(-1);
  }, []);

  const focusSearchInput = useCallback(() => {
    setIsActive(true);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, []);

  useEffect(() => {
    if (isCollapsed) {
      setIsActive(false);
      return;
    }
    if (autoFocusKey > 0) {
      focusSearchInput();
    }
  }, [autoFocusKey, focusSearchInput, isCollapsed]);

  useEffect(() => {
    closeSearch();
  }, [closeSearch, routeKey]);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    const onMouseDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        closeSearch();
      }
    };

    document.addEventListener('mousedown', onMouseDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
    };
  }, [closeSearch, isActive]);

  useEffect(() => {
    const trimmedQuery = query.trim();
    const requestVersion = requestVersionRef.current + 1;
    requestVersionRef.current = requestVersion;

    if (!isActive || !trimmedQuery || !accessToken) {
      setResults([]);
      setLoading(false);
      setError(null);
      setActiveIndex(-1);
      return;
    }

    setLoading(true);
    setError(null);
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const response = await searchHub(accessToken, trimmedQuery, { limit: 12 });
          if (requestVersionRef.current !== requestVersion) {
            return;
          }
          setResults(response.results);
          setActiveIndex(response.results.length > 0 ? 0 : -1);
        } catch {
          if (requestVersionRef.current !== requestVersion) {
            return;
          }
          setResults([]);
          setActiveIndex(-1);
          setError('Search is temporarily unavailable.');
        } finally {
          if (requestVersionRef.current === requestVersion) {
            setLoading(false);
          }
        }
      })();
    }, 250);

    return () => {
      window.clearTimeout(timer);
    };
  }, [accessToken, isActive, query]);

  if (isCollapsed) {
    return (
      <button
        type="button"
        aria-label="Open search"
        className="interactive interactive-subtle sidebar-row sidebar-row-button h-10 w-10 justify-center bg-surface text-text-secondary hover:bg-surface-highest hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        onClick={onOpenSearch}
      >
        <Icon name="search" size={16} />
      </button>
    );
  }

  return (
    <div className="relative" ref={containerRef}>
      {!isActive ? (
        <button
          type="button"
          className="interactive interactive-subtle interactive-fold sidebar-row sidebar-row-button w-full bg-surface text-left text-text-secondary hover:bg-surface-highest hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          onClick={focusSearchInput}
        >
          <span
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-surface-low text-text-secondary"
          >
            <Icon name="search" size={16} />
          </span>
          <SidebarLabel show={showLabels} className="min-w-0 flex flex-1 items-center">
            <span className="flex min-h-8 items-center truncate text-sm font-medium leading-none">Search</span>
          </SidebarLabel>
          <SidebarLabel show={showLabels}>
            <span className="ghost-button text-label-sm tracking-sidebar-kicker bg-surface-low px-2 py-1 uppercase leading-none text-muted">
              ⌘K
            </span>
          </SidebarLabel>
        </button>
      ) : (
        <div className="sidebar-row-button rounded-panel bg-surface px-3 py-2 shadow-soft">
          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-surface-highest text-primary"
            >
              <Icon name="search" size={16} />
            </span>
            <SidebarLabel show={showLabels} className="min-w-0 flex flex-1 items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                role="combobox"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    setActiveIndex((current) => {
                      if (results.length === 0) {
                        return -1;
                      }
                      return current < 0 || current + 1 >= results.length ? 0 : current + 1;
                    });
                    return;
                  }
                  if (event.key === 'ArrowUp') {
                    event.preventDefault();
                    setActiveIndex((current) => {
                      if (results.length === 0) {
                        return -1;
                      }
                      return current <= 0 ? results.length - 1 : current - 1;
                    });
                    return;
                  }
                  if (event.key === 'Enter' && normalizedActiveIndex >= 0 && results[normalizedActiveIndex]) {
                    event.preventDefault();
                    const href = buildSearchResultHref(results[normalizedActiveIndex]);
                    if (!href) {
                      return;
                    }
                    navigate(href);
                    closeSearch();
                    return;
                  }
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    closeSearch();
                  }
                }}
                placeholder="Search"
                aria-label="Search across Facets"
                aria-controls="sidebar-search-results"
                aria-expanded={hasOverlay}
                aria-activedescendant={normalizedActiveIndex >= 0 ? `sidebar-search-result-${normalizedActiveIndex}` : undefined}
                className="h-8 min-w-0 flex-1 border-0 bg-transparent text-sm leading-none text-text outline-none placeholder:text-text-secondary"
              />
              <button
                type="button"
                aria-label="Close search"
                className="interactive interactive-subtle ghost-button flex h-8 w-8 shrink-0 items-center justify-center bg-surface-low text-primary hover:bg-surface-highest hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                onClick={closeSearch}
              >
                <Icon name="close" size={14} />
              </button>
            </SidebarLabel>
          </div>
        </div>
      )}

      <AnimatePresence initial={false}>
        {hasOverlay ? (
          <motion.div
            initial="initial"
            animate="animate"
            exit="exit"
            variants={sidebarSearchOverlayVariants(prefersReducedMotion)}
            className="sidebar-flyout-offset absolute left-0 right-0 z-[120] max-h-72 overflow-hidden rounded-panel border border-border-muted bg-surface-elevated shadow-soft"
          >
            {loading ? (
              <p className="px-3 py-3 text-sm text-muted">Searching…</p>
            ) : error ? (
              <p className="px-3 py-3 text-sm text-danger" role="alert">{error}</p>
            ) : results.length === 0 ? (
              <p className="px-3 py-3 text-sm text-muted">No results</p>
            ) : (
              <motion.ul
                id="sidebar-search-results"
                role="listbox"
                initial={false}
                animate="animate"
                variants={sidebarSearchResultsVariants(prefersReducedMotion)}
                className="overflow-y-auto py-1"
              >
                {results.map((result, index) => {
                  const href = buildSearchResultHref(result);
                  const isSelected = normalizedActiveIndex === index;
                  return (
                    <motion.li
                      key={`${result.type}:${result.id}`}
                      id={`sidebar-search-result-${index}`}
                      role="option"
                      aria-selected={isSelected}
                      variants={sidebarSearchResultVariants(prefersReducedMotion)}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                    >
                      <button
                        type="button"
                        disabled={!href}
                        aria-disabled={!href}
                        className={`interactive interactive-subtle flex w-full flex-col gap-1 px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-60 ${
                          isSelected ? 'bg-elevated' : 'bg-transparent hover:bg-elevated'
                        }`}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => {
                          if (!href) {
                            return;
                          }
                          navigate(href);
                          closeSearch();
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-label-xs tracking-sidebar-kicker rounded-control border border-subtle bg-surface px-2 py-3xs uppercase text-muted">
                            {SEARCH_RESULT_TYPE_LABELS[result.type]}
                          </span>
                          <span className="min-w-0 truncate text-sm font-medium text-text">{result.title}</span>
                        </div>
                        {result.project_name ? (
                          <span className="text-xs text-muted">{result.project_name}</span>
                        ) : null}
                      </button>
                    </motion.li>
                  );
                })}
              </motion.ul>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};
