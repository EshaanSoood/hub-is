import { useRef, useState, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { Icon, IconButton } from '../primitives';
import { AddModuleDialog } from './AddModuleDialog';
import { moduleLabel } from './moduleCatalog';

export type ContractModuleLens = 'project' | 'pane' | 'pane_scratch';

export interface ContractModuleConfig {
  module_instance_id: string;
  module_type: string;
  size_tier: 'S' | 'M' | 'L';
  lens: ContractModuleLens;
  binding?: {
    view_id?: string;
  };
}

interface ModuleGridProps {
  modules: ContractModuleConfig[];
  onAddModule: (moduleType: string, sizeTier: ContractModuleConfig['size_tier']) => void;
  onRemoveModule: (moduleInstanceId: string) => void;
  onSetModuleLens: (moduleInstanceId: string, lens: ContractModuleLens) => void;
  onResizeModule: (moduleInstanceId: string, sizeTier: ContractModuleConfig['size_tier']) => void;
  showAddControls?: boolean;
  disableAdd?: boolean;
  disableMutations?: boolean;
  renderModuleBody?: (module: ContractModuleConfig) => ReactNode;
}

const sizeClass: Record<ContractModuleConfig['size_tier'], string> = {
  S: 'md:col-span-3',
  M: 'md:col-span-6',
  L: 'md:col-span-12',
};

const sizeHeightClass: Record<ContractModuleConfig['size_tier'], string> = {
  S: 'module-card-s',
  M: 'module-card-m',
  L: 'module-card-l',
};

export const ModuleGrid = ({
  modules,
  onAddModule,
  onRemoveModule,
  showAddControls = true,
  disableAdd = false,
  disableMutations = false,
  renderModuleBody,
}: ModuleGridProps) => {
  const addButtonRef = useRef<HTMLButtonElement | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const openAddDialog = () => {
    if (disableAdd) {
      return;
    }
    setAddDialogOpen(true);
  };

  const closeAddDialog = () => setAddDialogOpen(false);

  if (modules.length === 0) {
    return (
      <section className="space-y-3" aria-label="Pane organization modules">
        <div className="rounded-panel border border-dashed border-border-muted bg-elevated px-6 py-14">
          <div className="mx-auto flex max-w-md flex-col items-center text-center">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-border-muted bg-surface text-primary">
              <Icon name="plus" className="text-[22px]" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-primary">Let&apos;s get this pane started!</h3>
            <p className="mt-2 text-sm text-muted">
              Add a first module to shape the pane, then keep building from there.
            </p>
            {showAddControls ? (
              <button
                ref={addButtonRef}
                type="button"
                disabled={disableAdd}
                onClick={openAddDialog}
                className="mt-5 inline-flex items-center gap-2 rounded-control border border-border-muted bg-surface px-4 py-2 text-sm font-semibold text-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Icon name="plus" className="text-[14px]" />
                Add a module
              </button>
            ) : null}
          </div>
        </div>
        <AddModuleDialog
          open={addDialogOpen}
          onClose={closeAddDialog}
          onAddModule={onAddModule}
          triggerRef={addButtonRef}
        />
      </section>
    );
  }

  return (
    <section className="space-y-3" aria-label="Pane organization modules">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Modules</p>
        {showAddControls ? (
          <button
            ref={addButtonRef}
            type="button"
            disabled={disableAdd}
            onClick={openAddDialog}
            className="inline-flex items-center gap-2 rounded-control border border-border-muted bg-surface px-3 py-1.5 text-sm font-semibold text-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon name="plus" className="text-[14px]" />
            Add module
          </button>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
        {modules.map((module) => (
          <article
            key={module.module_instance_id}
            data-testid="module-card"
            className={cn(
              'relative rounded-panel border border-subtle bg-elevated p-3 flex flex-col',
              sizeClass[module.size_tier],
              sizeHeightClass[module.size_tier],
            )}
          >
            <IconButton
              size="sm"
              variant="ghost"
              aria-label={`Remove ${moduleLabel(module.module_type)} module`}
              disabled={disableMutations}
              onClick={() => onRemoveModule(module.module_instance_id)}
              className="absolute right-2 top-2 z-10 opacity-40 hover:opacity-100"
            >
              <Icon name="close" className="text-[14px]" />
            </IconButton>
            <div className="min-h-0 flex flex-1 flex-col overflow-y-auto" data-module-card-body="true">
              {renderModuleBody ? renderModuleBody(module) : `Module: ${module.module_type}`}
            </div>
          </article>
        ))}
      </div>
      <AddModuleDialog
        open={addDialogOpen}
        onClose={closeAddDialog}
        onAddModule={onAddModule}
        triggerRef={addButtonRef}
      />
    </section>
  );
};
