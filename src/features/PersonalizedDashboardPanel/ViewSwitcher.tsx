import { KeyboardEvent, useEffect, useId, useRef, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/primitives';
import type { HubDashboardView } from './types';

const viewLabels: Record<HubDashboardView, string> = {
  'project-lens': 'Project Lens',
  stream: 'Stream',
};

interface ViewSwitcherProps {
  selectedView: HubDashboardView;
  availableViewIds: HubDashboardView[];
  onSelectView: (viewId: HubDashboardView) => void;
}

export const ViewSwitcher = ({ selectedView, availableViewIds, onSelectView }: ViewSwitcherProps) => {
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const [activeViewOptionIndex, setActiveViewOptionIndex] = useState(0);

  const viewListboxId = useId();
  const viewTriggerRef = useRef<HTMLButtonElement | null>(null);
  const viewListboxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!viewMenuOpen) {
      return;
    }
    const frameId = window.requestAnimationFrame(() => {
      viewListboxRef.current?.focus();
    });
    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [viewMenuOpen]);

  const closeViewMenu = () => {
    setViewMenuOpen(false);
  };

  const selectView = (viewId: HubDashboardView) => {
    onSelectView(viewId);
    closeViewMenu();
  };

  const handleViewMenuOpenChange = (nextOpen: boolean) => {
    setViewMenuOpen(nextOpen);
    if (nextOpen) {
      const selectedIndex = availableViewIds.indexOf(selectedView);
      setActiveViewOptionIndex(selectedIndex >= 0 ? selectedIndex : 0);
    }
  };

  const handleViewListboxKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (availableViewIds.length === 0) {
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      closeViewMenu();
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveViewOptionIndex((current) => (current + 1) % availableViewIds.length);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveViewOptionIndex((current) => (current - 1 + availableViewIds.length) % availableViewIds.length);
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      setActiveViewOptionIndex(0);
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      setActiveViewOptionIndex(availableViewIds.length - 1);
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const nextView = availableViewIds[activeViewOptionIndex];
      if (nextView) {
        selectView(nextView);
      }
    }
  };

  return (
    <>
      <h2 className="sr-only">Views</h2>
      <Popover open={viewMenuOpen} onOpenChange={handleViewMenuOpenChange}>
        <PopoverTrigger asChild>
          <button
            ref={viewTriggerRef}
            type="button"
            className="mt-3 inline-flex items-center gap-2 rounded-panel border border-border-muted bg-surface px-3 py-2 text-sm font-semibold text-text"
            aria-haspopup="listbox"
            aria-expanded={viewMenuOpen}
            aria-controls={viewMenuOpen ? viewListboxId : undefined}
          >
            <span>{viewLabels[selectedView]}</span>
            <span aria-hidden="true" className="text-xs text-muted">
              ▾
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-56 border border-border-muted bg-surface p-1.5"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            viewTriggerRef.current?.focus();
          }}
        >
          <div
            id={viewListboxId}
            ref={viewListboxRef}
            role="listbox"
            tabIndex={-1}
            aria-label="Hub view mode"
            aria-activedescendant={`${viewListboxId}-option-${availableViewIds[activeViewOptionIndex]}`}
            className="space-y-1 outline-none"
            onKeyDown={handleViewListboxKeyDown}
          >
            {availableViewIds.map((viewId, index) => {
              const selected = selectedView === viewId;
              const active = activeViewOptionIndex === index;
              return (
                <button
                  key={viewId}
                  id={`${viewListboxId}-option-${viewId}`}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  tabIndex={-1}
                  className={`flex w-full items-center justify-between rounded-control px-3 py-2 text-left text-sm transition-colors ${
                    active
                      ? 'bg-accent text-on-primary'
                      : selected
                        ? 'bg-surface-elevated text-primary ring-1 ring-border-muted'
                        : 'text-text hover:bg-surface-elevated'
                  }`}
                  onMouseEnter={() => setActiveViewOptionIndex(index)}
                  onClick={() => selectView(viewId)}
                >
                  <span>{viewLabels[viewId]}</span>
                  {selected ? (
                    <span className={`text-[11px] font-medium ${active ? 'text-on-primary/80' : 'text-muted'}`}>
                      Current
                    </span>
                  ) : null}
                  {selected ? (
                    <span aria-hidden="true" className="text-xs">
                      ✓
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
};
