import type { ReactNode } from 'react';

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
  onAddModule: (moduleType: string) => void;
  onRemoveModule: (moduleInstanceId: string) => void;
  onSetModuleLens: (moduleInstanceId: string, lens: ContractModuleLens) => void;
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

const MODULE_CATALOG = [
  { type: 'table', label: 'Table', lensConfigurable: true },
  { type: 'kanban', label: 'Kanban', lensConfigurable: true },
  { type: 'calendar', label: 'Calendar', lensConfigurable: true },
  { type: 'tasks', label: 'Tasks', lensConfigurable: false },
  { type: 'timeline', label: 'Timeline', lensConfigurable: true },
  { type: 'files', label: 'Files', lensConfigurable: true },
  { type: 'quick_thoughts', label: 'Quick Thoughts', lensConfigurable: false },
] as const;

const moduleLabel = (moduleType: string): string =>
  MODULE_CATALOG.find((entry) => entry.type === moduleType)?.label || moduleType.replace(/_/g, ' ');

const isLensConfigurable = (moduleType: string): boolean =>
  MODULE_CATALOG.find((entry) => entry.type === moduleType)?.lensConfigurable ?? true;

export const ModuleGrid = ({
  modules,
  onAddModule,
  onRemoveModule,
  onSetModuleLens,
  showAddControls = true,
  disableAdd = false,
  disableMutations = false,
  renderModuleBody,
}: ModuleGridProps) => {
  return (
    <section className="space-y-3" aria-label="Pane organization modules">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
        {modules.map((module) => (
          <article
            key={module.module_instance_id}
            data-testid="module-card"
            className={`rounded-panel border border-subtle bg-elevated p-3 ${sizeClass[module.size_tier]}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-primary">{moduleLabel(module.module_type)}</p>
              <div className="flex flex-wrap items-center gap-2">
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
                <button
                  type="button"
                  disabled={disableMutations}
                  onClick={() => onRemoveModule(module.module_instance_id)}
                  className="rounded-panel border border-border-muted px-2 py-1 text-xs font-semibold text-primary disabled:cursor-not-allowed disabled:opacity-50"
                >
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

      {showAddControls ? (
        <div className="flex flex-wrap gap-2">
          {MODULE_CATALOG.map((moduleType) => (
            <button
              key={moduleType.type}
              type="button"
              aria-label={`Add module: ${moduleType.label}`}
              data-testid={`add-module-${moduleType.type}`}
              disabled={disableAdd}
              onClick={() => onAddModule(moduleType.type)}
              className="rounded-panel border border-border-muted px-3 py-1.5 text-sm font-semibold text-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              Add module: {moduleType.label}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
};
