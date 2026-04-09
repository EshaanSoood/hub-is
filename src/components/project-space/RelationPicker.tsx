import { AnimatePresence } from 'framer-motion';
import { KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from 'react';
import { searchRelationRecords } from '../../services/hub/records';
import type { HubRelationSearchRecord } from '../../services/hub/types';
import { AnimatedSurface } from '../motion/AnimatedSurface';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';

export interface RelationFieldOption {
  field_id: string;
  name: string;
  target_collection_id: string | null;
}

interface RelationPickerProps {
  accessToken: string;
  projectId: string;
  fromRecordId: string;
  relationFields: RelationFieldOption[];
  disabled?: boolean;
  onAddRelation: (payload: { to_record_id: string; via_field_id: string }) => Promise<void>;
}

export const RelationPicker = ({
  accessToken,
  projectId,
  fromRecordId,
  relationFields,
  disabled = false,
  onAddRelation,
}: RelationPickerProps) => {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const listboxId = `${useId()}-relation-targets`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<HubRelationSearchRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [selectedFieldId, setSelectedFieldId] = useState<string>('');
  const [activeOptionIndex, setActiveOptionIndex] = useState(-1);

  const selectedField = useMemo(
    () => relationFields.find((field) => field.field_id === selectedFieldId) || null,
    [relationFields, selectedFieldId],
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      void searchRelationRecords(accessToken, projectId, query, {
        limit: 20,
        exclude_record_id: fromRecordId,
        collection_id: selectedField?.target_collection_id || undefined,
      })
        .then((items) => {
          if (cancelled) {
            return;
          }
          setResults(items);
        })
        .catch((loadError) => {
          if (cancelled) {
            return;
          }
          setResults([]);
          setError(loadError instanceof Error ? loadError.message : 'Failed to load records.');
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
  }, [accessToken, fromRecordId, open, projectId, query, selectedField?.target_collection_id]);

  const selectedRecord = useMemo(
    () => results.find((item) => item.record_id === selectedRecordId) || null,
    [results, selectedRecordId],
  );
  const selectedOptionIndex = selectedRecordId ? results.findIndex((item) => item.record_id === selectedRecordId) : -1;
  const resolvedActiveOptionIndex =
    activeOptionIndex >= 0 && activeOptionIndex < results.length
      ? activeOptionIndex
      : selectedOptionIndex >= 0
        ? selectedOptionIndex
        : results.length > 0
          ? 0
          : -1;
  const activeRecord = resolvedActiveOptionIndex >= 0 ? results[resolvedActiveOptionIndex] : null;

  useEffect(() => {
    if (!open) {
      return;
    }

    const focusTimer = window.setTimeout(() => {
      searchInputRef.current?.focus();
    }, 0);

    return () => {
      window.clearTimeout(focusTimer);
    };
  }, [open]);

  const closePicker = () => {
    setOpen(false);
    window.setTimeout(() => {
      triggerRef.current?.focus();
    }, 0);
  };

  return (
    <Popover open={open} onOpenChange={(nextOpen) => {
      setOpen(nextOpen);
      if (nextOpen) {
        setSelectedFieldId((current) => {
          if (relationFields.length === 1) {
            return relationFields[0].field_id;
          }
          if (current && relationFields.some((field) => field.field_id === current)) {
            return current;
          }
          return relationFields[0]?.field_id || '';
        });
        setSelectedRecordId(null);
        setActiveOptionIndex(-1);
      }
      if (!nextOpen) {
        setLoading(false);
        setActiveOptionIndex(-1);
        window.setTimeout(() => {
          triggerRef.current?.focus();
        }, 0);
      }
    }}
    >
      <PopoverTrigger asChild>
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled || relationFields.length === 0}
          className="rounded-panel border border-border-muted px-3 py-1.5 text-sm font-semibold text-primary disabled:cursor-not-allowed disabled:opacity-60"
          aria-label="Add relation"
          data-testid="relation-picker-trigger"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-haspopup="listbox"
        >
          Add relation
        </button>
      </PopoverTrigger>
      <AnimatePresence>
        {open ? (
          <PopoverContent forceMount asChild align="start">
            <AnimatedSurface transformOrigin="bottom left" className="w-[min(34rem,90vw)] p-3">
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-primary" htmlFor="relation-field-select">
              Relation field
            </label>
            <select
              id="relation-field-select"
              value={selectedFieldId}
              onChange={(event) => {
                setSelectedFieldId(event.target.value);
                setSelectedRecordId(null);
                setActiveOptionIndex(-1);
                setResults([]);
                setError(null);
              }}
              className="w-full rounded-panel border border-border-muted bg-surface px-2 py-1.5 text-sm text-text"
              aria-label="Relation field"
              disabled={relationFields.length <= 1}
            >
              {relationFields.map((field) => (
                <option key={field.field_id} value={field.field_id}>
                  {field.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-primary" htmlFor="relation-target-search">
              Target record
            </label>
            <input
              id="relation-target-search"
              ref={searchInputRef}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSelectedRecordId(null);
                setActiveOptionIndex(-1);
                setResults([]);
                setError(null);
              }}
              onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
                if (event.key === 'Escape') {
                  event.preventDefault();
                  closePicker();
                  return;
                }
                if (event.key === 'ArrowDown') {
                  if (results.length === 0) {
                    return;
                  }
                  event.preventDefault();
                  setActiveOptionIndex((current) => {
                    const nextIndex = current >= results.length - 1 ? 0 : current + 1;
                    setSelectedRecordId(results[nextIndex]?.record_id ?? null);
                    return nextIndex;
                  });
                  return;
                }
                if (event.key === 'ArrowUp') {
                  if (results.length === 0) {
                    return;
                  }
                  event.preventDefault();
                  setActiveOptionIndex((current) => {
                    const nextIndex = current <= 0 ? results.length - 1 : current - 1;
                    setSelectedRecordId(results[nextIndex]?.record_id ?? null);
                    return nextIndex;
                  });
                  return;
                }
                if (event.key === 'Enter' && resolvedActiveOptionIndex >= 0 && resolvedActiveOptionIndex < results.length) {
                  event.preventDefault();
                  setSelectedRecordId(results[resolvedActiveOptionIndex].record_id);
                }
              }}
              className="w-full rounded-panel border border-border-muted bg-surface px-2 py-1.5 text-sm text-text"
              placeholder="Search records"
              aria-label="Search target record"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={open}
              aria-controls={listboxId}
              aria-haspopup="listbox"
              aria-activedescendant={activeRecord ? `${listboxId}-option-${activeRecord.record_id}` : undefined}
            />
          </div>

          <div id={listboxId} className="max-h-56 space-y-1 overflow-auto rounded-panel border border-border-muted p-1" role="listbox" aria-label="Relation target results">
            {loading ? <p className="px-2 py-2 text-xs text-muted">Loading...</p> : null}
            {!loading && error ? <p className="px-2 py-2 text-xs text-danger">{error}</p> : null}
            {!loading && !error && results.length === 0 ? <p className="px-2 py-2 text-xs text-muted">No records found.</p> : null}
            {!loading && !error
              ? results.map((item, index) => {
                  const selected = selectedRecordId === item.record_id;
                  const active = resolvedActiveOptionIndex === index;
                  return (
                    <button
                      key={item.record_id}
                      id={`${listboxId}-option-${item.record_id}`}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={`block w-full rounded-panel px-2 py-1.5 text-left text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                        selected || active ? 'bg-muted-subtle text-primary' : 'text-text hover:bg-muted-subtle'
                      }`}
                      onMouseEnter={() => setActiveOptionIndex(index)}
                      onFocus={() => setActiveOptionIndex(index)}
                      onClick={() => {
                        setSelectedRecordId(item.record_id);
                        setActiveOptionIndex(index);
                      }}
                    >
                      <span className="font-semibold">{item.title || 'Untitled record'}</span>
                      <span className="ml-2 text-muted">{item.collection_name || item.collection_id}</span>
                    </button>
                  );
                })
              : null}
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              className="rounded-panel border border-border-muted px-3 py-1.5 text-sm text-primary"
              onClick={closePicker}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!selectedRecord || !selectedFieldId || submitting}
              className="rounded-panel border border-border-muted px-3 py-1.5 text-sm font-semibold text-primary disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => {
                if (!selectedRecord || !selectedFieldId) {
                  return;
                }
                setSubmitting(true);
                setError(null);
                void onAddRelation({
                  to_record_id: selectedRecord.record_id,
                  via_field_id: selectedFieldId,
                })
                  .then(() => {
                    setQuery('');
                    setSelectedRecordId(null);
                    closePicker();
                  })
                  .catch((submitError) => {
                    setError(submitError instanceof Error ? submitError.message : 'Failed to add relation.');
                  })
                  .finally(() => {
                    setSubmitting(false);
                  });
              }}
            >
              {submitting ? 'Adding...' : 'Add'}
            </button>
          </div>
        </div>
            </AnimatedSurface>
          </PopoverContent>
        ) : null}
      </AnimatePresence>
    </Popover>
  );
};
