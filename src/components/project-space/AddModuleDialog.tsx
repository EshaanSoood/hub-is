import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Dialog, Icon } from '../primitives';
import { MODULE_CATALOG, moduleDescription, moduleIconName, type ModuleSizeTier } from './moduleCatalog';

interface AddModuleDialogProps {
  open: boolean;
  onClose: () => void;
  onAddModule: (moduleType: string, sizeTier: ModuleSizeTier) => void;
  triggerRef?: RefObject<HTMLElement | null>;
  layoutId?: string;
}

const SIZE_TIER_COPY: Record<ModuleSizeTier, { title: string; hint: string }> = {
  S: {
    title: 'S · Compact',
    hint: 'Best for lightweight modules that can share space beside other cards.',
  },
  M: {
    title: 'M · Balanced',
    hint: 'A medium footprint with enough room for browsing and quick edits.',
  },
  L: {
    title: 'L · Spacious',
    hint: 'Gives the module the widest canvas for dense or detailed content.',
  },
};

export const AddModuleDialog = ({
  open,
  onClose,
  onAddModule,
  triggerRef,
  layoutId,
}: AddModuleDialogProps) => {
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const firstModuleButtonRef = useRef<HTMLButtonElement | null>(null);
  const backButtonRef = useRef<HTMLButtonElement | null>(null);
  const selectedEntry = useMemo(
    () => (selectedModule ? MODULE_CATALOG.find((entry) => entry.type === selectedModule) ?? null : null),
    [selectedModule],
  );
  const handleClose = useCallback(() => {
    setSelectedModule(null);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setSelectedModule(null);
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      if (selectedModule) {
        backButtonRef.current?.focus();
        return;
      }
      firstModuleButtonRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [open, selectedModule]);

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Add Module"
      description="Choose a module, then choose the size to add to this pane."
      triggerRef={triggerRef}
      layoutId={layoutId}
      panelClassName="max-h-[88vh] overflow-y-auto"
      contentClassName="pr-1"
    >
      {selectedEntry ? (
        <div className="space-y-5">
          <button
            ref={backButtonRef}
            type="button"
            onClick={() => setSelectedModule(null)}
            className="text-sm font-medium text-primary transition hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            aria-label="Back to module list"
          >
            ← Back to modules
          </button>

          <div className="flex items-center gap-3 rounded-panel border border-subtle bg-surface p-4">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-control border border-border-muted bg-elevated text-primary">
              {moduleIconName(selectedEntry.type) ? (
                <Icon name={moduleIconName(selectedEntry.type)!} className="h-10 w-10" />
              ) : (
                <Icon name="plus" className="h-10 w-10" />
              )}
            </div>
            <div className="min-w-0 space-y-1">
              <h3 className="text-base font-semibold text-text">{selectedEntry.label}</h3>
              <p className="text-sm text-muted">{moduleDescription(selectedEntry.type)}</p>
            </div>
          </div>

          <div className="space-y-3" role="group" aria-label={`${selectedEntry.label} size picker`}>
            {selectedEntry.allowedSizeTiers.map((tier) => (
              <button
                key={tier}
                type="button"
                onClick={() => {
                  onAddModule(selectedEntry.type, tier);
                  handleClose();
                }}
                className="flex w-full flex-col items-start gap-2 rounded-panel border border-border-muted bg-surface p-4 text-left transition hover:border-primary hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                aria-label={`Add ${selectedEntry.label} at ${tier} size`}
              >
                <span className="text-sm font-semibold text-text">{SIZE_TIER_COPY[tier].title}</span>
                <span className="text-sm text-muted">{SIZE_TIER_COPY[tier].hint}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-primary">Choose a module</p>
            <p className="text-sm text-muted">Pick a module first, then choose the size that fits this pane.</p>
          </div>

          <p className="text-xs text-muted">{MODULE_CATALOG.length} modules available</p>

          <div className="grid grid-cols-2 gap-3 pb-1" role="group" aria-label="Module picker">
            {MODULE_CATALOG.map((entry, index) => (
              <button
                key={entry.type}
                ref={index === 0 ? firstModuleButtonRef : undefined}
                type="button"
                onClick={() => setSelectedModule(entry.type)}
                className="flex min-h-32 flex-col gap-3 rounded-panel border border-border-muted bg-surface p-4 text-left transition hover:border-primary hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                aria-label={`Select ${entry.label} module`}
              >
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-control border border-border-muted bg-elevated text-primary">
                  {moduleIconName(entry.type) ? (
                    <Icon name={moduleIconName(entry.type)!} className="h-10 w-10" />
                  ) : (
                    <Icon name="plus" className="h-10 w-10" />
                  )}
                </div>
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-semibold text-text">{entry.label}</p>
                  <p className="truncate text-xs text-muted">{moduleDescription(entry.type)}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </Dialog>
  );
};
