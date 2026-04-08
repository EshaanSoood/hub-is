import { AnimatePresence } from 'framer-motion';
import { useMemo, useState } from 'react';
import { cn } from '../../lib/cn';
import { AnimatedSurface } from '../motion/AnimatedSurface';
import type { PriorityLevel } from './designTokens';
import { getPriorityClasses } from '../../lib/priorityStyles';

export interface FilterOption {
  id: string;
  label: string;
}

export interface FilterGroup {
  id: string;
  label: string;
  options: FilterOption[];
}

interface FilterBarOverlayProps {
  groups: FilterGroup[];
  activeFilterIds: string[];
  onToggleFilter: (filterId: string) => void;
  onClearAll: () => void;
}

const priorityById: Record<string, PriorityLevel> = {
  high: 'high',
  medium: 'medium',
  low: 'low',
};

export const FilterBarOverlay = ({ groups, activeFilterIds, onToggleFilter, onClearAll }: FilterBarOverlayProps) => {
  const [expanded, setExpanded] = useState(false);

  const activeSet = useMemo(() => new Set(activeFilterIds), [activeFilterIds]);

  return (
    <div className="relative">
      <div className="flex items-center gap-2 border-b border-subtle px-2 py-1.5">
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls="filter-overlay-panel"
          onClick={() => setExpanded((current) => !current)}
          className={cn(
            'inline-flex items-center gap-2 rounded-control border px-2 py-1 text-xs transition-colors',
            expanded || activeFilterIds.length > 0
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-subtle bg-surface text-muted hover:text-text',
          )}
        >
          <span aria-hidden="true">⌄</span>
          Filter
          {activeFilterIds.length > 0 ? (
            <span className="rounded-control bg-primary px-1 py-0.5 text-[10px] font-bold text-on-primary">
              {activeFilterIds.length}
            </span>
          ) : null}
        </button>

        {activeFilterIds.length > 0 && !expanded ? (
          <button type="button" onClick={onClearAll} className="text-xs text-muted hover:text-danger">
            Clear all
          </button>
        ) : null}
      </div>

      <AnimatePresence>
        {expanded ? (
          <>
          <button
            type="button"
            aria-label="Close filters"
            onClick={() => setExpanded(false)}
            className="fixed inset-0 z-40"
          />

          <AnimatedSurface
            id="filter-overlay-panel"
            role="region"
            ariaLabel="Filters"
            transformOrigin="top left"
            className="absolute left-0 top-[calc(100%+4px)] z-50 w-full max-w-xl space-y-4 rounded-panel border border-subtle bg-elevated p-4 shadow-soft"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-text">Filters</p>
              {activeFilterIds.length > 0 ? (
                <button type="button" onClick={onClearAll} className="text-xs text-danger hover:opacity-80">
                  Clear all
                </button>
              ) : null}
            </div>

            {groups.map((group) => (
              <section key={group.id} className="space-y-2">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">{group.label}</p>
                  {group.options.some((option) => activeSet.has(option.id)) ? (
                    <span className="rounded-control border border-primary bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                      {group.options.filter((option) => activeSet.has(option.id)).length}
                    </span>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  {group.options.map((option) => {
                    const active = activeSet.has(option.id);
                    const priorityLevel = group.id === 'priority' ? priorityById[option.id] : null;
                    const priorityClasses = priorityLevel ? getPriorityClasses(priorityLevel) : null;

                    return (
                      <button
                        key={option.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => onToggleFilter(option.id)}
                        className={cn(
                          'inline-flex items-center gap-1 rounded-control border px-2 py-1 text-xs transition-colors',
                          active
                            ? priorityClasses
                              ? cn(priorityClasses.text, priorityClasses.border, priorityClasses.tint)
                              : 'border-primary bg-primary/10 text-primary'
                            : 'border-subtle bg-surface text-muted hover:text-text',
                        )}
                      >
                        {active ? <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" /> : null}
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </AnimatedSurface>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  );
};
