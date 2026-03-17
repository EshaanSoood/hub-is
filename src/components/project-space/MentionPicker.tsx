import { useEffect, useId, useMemo, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { searchMentionTargets } from '../../services/hub/records';
import type { HubMentionTarget } from '../../services/hub/types';

interface MentionPickerProps {
  accessToken: string;
  projectId: string;
  onSelect: (target: HubMentionTarget) => void;
  buttonLabel?: string;
  ariaLabel?: string;
  includeTypes?: Array<'user' | 'record'>;
}

export const MentionPicker = ({
  accessToken,
  projectId,
  onSelect,
  buttonLabel = 'Mention',
  ariaLabel = 'Mention picker',
  includeTypes = ['user', 'record'],
}: MentionPickerProps) => {
  const queryInputId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<HubMentionTarget[]>([]);
  const [error, setError] = useState<string | null>(null);

  const onOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      void searchMentionTargets(accessToken, projectId, query, 20)
        .then((results) => {
          if (cancelled) {
            return;
          }
          setItems(results);
        })
        .catch((loadError) => {
          if (cancelled) {
            return;
          }
          setItems([]);
          setError(loadError instanceof Error ? loadError.message : 'Failed to load mention targets.');
        })
        .finally(() => {
          if (!cancelled) {
            setLoading(false);
          }
        });
    }, 140);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [accessToken, open, projectId, query]);

  const filtered = useMemo(() => items.filter((item) => includeTypes.includes(item.entity_type)), [includeTypes, items]);

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="rounded-panel border border-border-muted px-2 py-1 text-xs font-semibold text-primary"
          aria-label={ariaLabel}
        >
          {buttonLabel}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-2">
        <div className="space-y-2">
          <label className="sr-only" htmlFor={queryInputId}>
            Search mention targets
          </label>
          <input
            id={queryInputId}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full rounded-panel border border-border-muted bg-surface px-2 py-1.5 text-xs text-text"
            placeholder="Search people or records"
            aria-label="Search mention targets"
          />

          <div className="max-h-56 space-y-1 overflow-auto" role="listbox" aria-label="Mention targets">
            {loading ? <p className="px-1 py-2 text-xs text-muted">Loading...</p> : null}
            {!loading && error ? <p className="px-1 py-2 text-xs text-danger">{error}</p> : null}
            {!loading && !error && filtered.length === 0 ? (
              <p className="px-1 py-2 text-xs text-muted">No results.</p>
            ) : null}
            {!loading && !error
              ? filtered.map((item) => (
                  <button
                    key={`${item.entity_type}:${item.entity_ref.entity_id}`}
                    type="button"
                    role="option"
                    aria-selected="false"
                    className="block w-full rounded-panel px-2 py-1.5 text-left text-xs text-text hover:bg-muted-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    onClick={() => {
                      onSelect(item);
                      onOpenChange(false);
                      setQuery('');
                    }}
                  >
                    <span className="font-semibold text-primary">{item.label}</span>
                    <span className="ml-2 text-muted">{item.entity_type}</span>
                    {item.secondary_label ? <span className="ml-2 text-muted">{item.secondary_label}</span> : null}
                  </button>
                ))
              : null}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
