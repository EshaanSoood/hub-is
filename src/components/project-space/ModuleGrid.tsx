import { useRef, useState, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { Icon, IconButton } from '../primitives';
import { AddModuleDialog } from './AddModuleDialog';
import { isLensConfigurable, moduleIconName, moduleLabel } from './moduleCatalog';
import { ModuleSettingsPopover } from './ModuleSettingsPopover';

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

export const ModuleGrid = ({
  modules,
  onAddModule,
  onRemoveModule,
  onSetModuleLens,
  onResizeModule,
  showAddControls = true,
  disableAdd = false,
  disableMutations = false,
  renderModuleBody,
}: ModuleGridProps) => {
  const addButtonRef = useRef<HTMLButtonElement | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [openSettingsModuleId, setOpenSettingsModuleId] = useState<string | null>(null);

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
            className={`rounded-panel border border-subtle bg-elevated p-3 ${sizeClass[module.size_tier]}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
                {moduleIconName(module.module_type) ? (
                  <Icon name={moduleIconName(module.module_type)!} className="text-[16px]" />
                ) : null}
                {moduleLabel(module.module_type)}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-panel border border-border-muted bg-surface px-2 py-1 text-xs font-semibold text-muted">
                  {module.size_tier}
                </span>
                {isLensConfigurable(module.module_type) ? (
                  <>
                    <label className="text-xs text-muted" htmlFor={`module-lens-${module.module_instance_id}`}>
                      Lens
                    </label>
                    <select
                      id={`module-lens-${module.module_instance_id}`}
                      value={module.lens}
                      disabled={disableMutations}
                      onChange={(event) => {
                        const value = event.target.value;
                        if (value === 'project' || value === 'pane_scratch') {
                          onSetModuleLens(module.module_instance_id, value);
                        }
                      }}
                      className="rounded-panel border border-border-muted bg-surface px-2 py-1 text-xs text-text"
                    >
                      <option value="project">project</option>
                      <option value="pane_scratch">pane_scratch</option>
                    </select>
                  </>
                ) : (
                  <span className="rounded-panel border border-border-muted bg-surface px-2 py-1 text-xs text-muted">
                    local only
                  </span>
                )}
                <ModuleSettingsPopover
                  open={openSettingsModuleId === module.module_instance_id}
                  onOpenChange={(open) => setOpenSettingsModuleId(open ? module.module_instance_id : null)}
                  title={`${moduleLabel(module.module_type)} settings`}
                  trigger={(
                    <IconButton
                      size="sm"
                      variant="ghost"
                      aria-label={`Open settings for ${moduleLabel(module.module_type)}`}
                      disabled={disableMutations}
                    >
                      <Icon name="settings" className="text-[14px]" />
                    </IconButton>
                  )}
                >
                  <div className="space-y-2">
                    <p className="text-xs text-muted">Size</p>
                    <div className="grid grid-cols-3 gap-2" role="group" aria-label="Module size">
                      {(['S', 'M', 'L'] as const).map((sizeTier) => (
                        <button
                          key={sizeTier}
                          type="button"
                          disabled={disableMutations}
                          aria-pressed={module.size_tier === sizeTier}
                          onClick={() => {
                            onResizeModule(module.module_instance_id, sizeTier);
                            setOpenSettingsModuleId(null);
                          }}
                          className={cn(
                            'rounded-control border px-2 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-50',
                            module.size_tier === sizeTier
                              ? 'border-primary bg-primary text-on-primary'
                              : 'border-border-muted bg-surface text-primary',
                          )}
                        >
                          {sizeTier}
                        </button>
                      ))}
                    </div>
                  </div>
                </ModuleSettingsPopover>
                <button
                  type="button"
                  disabled={disableMutations}
                  onClick={() => onRemoveModule(module.module_instance_id)}
                  className="inline-flex items-center gap-1 rounded-panel border border-border-muted px-2 py-1 text-xs font-semibold text-primary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Icon name="trash" className="text-[12px]" />
                  Remove
                </button>
              </div>
            </div>
            <div className="mt-3">
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
