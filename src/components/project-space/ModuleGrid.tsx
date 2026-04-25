import { useRef, useState, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Icon } from '../primitives';
import { dialogLayoutIds } from '../../styles/motion';
import { AddModuleDialog } from './AddModuleDialog';
import { ModuleShell } from './ModuleShell';

export type ContractModuleLens = 'project' | 'pane' | 'pane_scratch';

export interface ContractModuleConfig {
  module_instance_id: string;
  module_type: string;
  size_tier: 'S' | 'M' | 'L';
  lens: ContractModuleLens;
  binding?: {
    view_id?: string;
    owned_view_id?: string;
    source_mode?: 'owned' | 'linked';
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
  readOnlyState?: boolean;
  renderModuleBody?: (module: ContractModuleConfig) => ReactNode;
}

export const ModuleGrid = ({
  modules,
  onAddModule,
  onRemoveModule,
  showAddControls = true,
  disableAdd = false,
  disableMutations = false,
  readOnlyState = false,
  renderModuleBody,
}: ModuleGridProps) => {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const addButtonRef = useRef<HTMLButtonElement | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const addModuleLayoutId = !prefersReducedMotion ? dialogLayoutIds.addModule : undefined;
  const hasModules = modules.length > 0;

  const openAddDialog = () => {
    if (readOnlyState || disableAdd) {
      return;
    }
    setAddDialogOpen(true);
  };

  const closeAddDialog = () => setAddDialogOpen(false);
  const addControl = showAddControls && !readOnlyState ? (
    <motion.button
      layoutId={addModuleLayoutId}
      ref={addButtonRef}
      type="button"
      title="Add module"
      aria-label="Add module"
      disabled={disableAdd}
      onClick={openAddDialog}
      className="inline-flex h-9 w-9 items-center justify-center rounded-control border border-border-muted bg-surface text-primary disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
    >
      <Icon name="plus" className="text-[14px]" />
    </motion.button>
  ) : null;

  return (
    <section className="space-y-3" aria-label="Project organization modules">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Modules</p>
        {addControl}
      </div>

      {!hasModules ? (
        <div className="rounded-panel border border-dashed border-border-muted bg-elevated px-4 py-6 sm:px-6 sm:py-7">
          <div className="mx-auto flex w-full max-w-2xl flex-col items-center text-center">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border-muted bg-surface text-primary">
              <Icon name="plus" className="text-[18px]" />
            </div>
            <h3 className="mt-3 max-w-2xl text-base font-semibold text-primary">
              {readOnlyState ? 'No modules in this project yet' : "Let's get this project started!"}
            </h3>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
              {readOnlyState
                ? 'This project is currently read-only. Modules will appear here after they are added elsewhere.'
                : 'Add a first module to shape the project.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          {modules.map((module) => (
            <ModuleShell
              key={module.module_instance_id}
              moduleType={module.module_type}
              sizeTier={module.size_tier}
              readOnlyState={readOnlyState}
              removeDisabled={disableMutations}
              onRemove={() => onRemoveModule(module.module_instance_id)}
            >
              {renderModuleBody ? renderModuleBody(module) : `Module: ${module.module_type}`}
            </ModuleShell>
          ))}
        </div>
      )}
      <AddModuleDialog
        open={addDialogOpen}
        onClose={closeAddDialog}
        onAddModule={onAddModule}
        triggerRef={addButtonRef}
        layoutId={addModuleLayoutId}
        disableConfirm={disableAdd}
      />
    </section>
  );
};
