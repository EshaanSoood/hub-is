import { useId, useState, type RefObject } from 'react';
import { cn } from '../../lib/cn';
import { Dialog, Icon, Select } from '../primitives';
import type { ContractModuleConfig } from './ModuleGrid';
import { MODULE_CATALOG, moduleDescription, moduleIconName } from './moduleCatalog';

type ModuleSizeTier = ContractModuleConfig['size_tier'];

interface AddModuleDialogProps {
  open: boolean;
  onClose: () => void;
  onAddModule: (moduleType: string, sizeTier: ModuleSizeTier) => void;
  triggerRef?: RefObject<HTMLElement | null>;
}

const SIZE_OPTIONS: Array<{ value: ModuleSizeTier; label: string }> = [
  { value: 'S', label: 'S · compact' },
  { value: 'M', label: 'M · balanced' },
  { value: 'L', label: 'L · spacious' },
];

const previewGridClass: Record<ModuleSizeTier, string> = {
  S: 'sm:grid-cols-3',
  M: 'sm:grid-cols-2',
  L: 'sm:grid-cols-1',
};

const previewCardClass: Record<ModuleSizeTier, string> = {
  S: 'min-h-32 p-3',
  M: 'min-h-40 p-4',
  L: 'min-h-48 p-5',
};

const previewIconWrapClass: Record<ModuleSizeTier, string> = {
  S: 'h-9 w-9 text-base',
  M: 'h-11 w-11 text-lg',
  L: 'h-12 w-12 text-xl',
};

const previewLineWidthClass: Record<ModuleSizeTier, string> = {
  S: 'w-16',
  M: 'w-24',
  L: 'w-32',
};

export const AddModuleDialog = ({
  open,
  onClose,
  onAddModule,
  triggerRef,
}: AddModuleDialogProps) => {
  const sizeSelectId = useId();
  const [selectedSize, setSelectedSize] = useState<ModuleSizeTier>('M');

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add Module"
      description="Choose a module type and preview the size it will use in this pane."
      triggerRef={triggerRef}
      panelClassName="max-w-4xl"
    >
      <div className="space-y-5">
        <div className="flex flex-col gap-4 border-b border-subtle pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-primary">Choose a module</p>
            <p className="text-sm text-muted">
              Pick the size first, then choose the module that fits this pane.
            </p>
          </div>
          <label className="flex min-w-48 flex-col gap-1 text-sm text-muted" htmlFor={sizeSelectId}>
            Module size
            <Select
              id={sizeSelectId}
              ariaLabel="Module size"
              value={selectedSize}
              onValueChange={(value) => {
                if (value === 'S' || value === 'M' || value === 'L') {
                  setSelectedSize(value);
                }
              }}
              options={SIZE_OPTIONS}
            />
          </label>
        </div>

        <div className={cn('grid gap-3', previewGridClass[selectedSize])} aria-label="Module picker">
          {MODULE_CATALOG.map((entry) => (
            <button
              key={entry.type}
              type="button"
              onClick={() => {
                onAddModule(entry.type, selectedSize);
                onClose();
              }}
              className={cn(
                'group flex h-full flex-col rounded-panel border border-border-muted bg-surface text-left transition hover:border-primary hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
                previewCardClass[selectedSize],
              )}
              aria-label={`Add ${entry.label} module at ${selectedSize} size`}
            >
              <div className="flex items-start justify-between gap-3">
                <div
                  className={cn(
                    'inline-flex items-center justify-center rounded-control border border-border-muted bg-elevated text-primary',
                    previewIconWrapClass[selectedSize],
                  )}
                >
                  {moduleIconName(entry.type) ? (
                    <Icon name={moduleIconName(entry.type)!} className="text-[1em]" />
                  ) : (
                    <Icon name="plus" className="text-[0.9em]" />
                  )}
                </div>
                <span className="rounded-control border border-border-muted bg-elevated px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                  {selectedSize}
                </span>
              </div>

              <div className="mt-4 space-y-2">
                <p className="text-sm font-semibold text-text">{entry.label}</p>
                <p className="text-sm text-muted">{moduleDescription(entry.type)}</p>
              </div>

              <div className="mt-auto pt-4">
                <div className="space-y-2 rounded-control border border-dashed border-border-muted bg-elevated/70 p-3">
                  <div className={cn('h-2 rounded-full bg-border-subtle', previewLineWidthClass[selectedSize])} />
                  <div className="h-2 w-full rounded-full bg-border-subtle" />
                  {selectedSize !== 'S' ? <div className="h-2 w-4/5 rounded-full bg-border-subtle" /> : null}
                  {selectedSize === 'L' ? <div className="h-12 rounded-control bg-surface" /> : null}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </Dialog>
  );
};
