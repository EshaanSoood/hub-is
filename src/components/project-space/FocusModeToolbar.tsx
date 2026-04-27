import { useMemo, useRef } from 'react';
import { Button, Dialog } from '../primitives';
import type { ProjectModule } from './types';
import { cn } from '../../lib/cn';

interface FocusModeToolbarProps {
  visible: boolean;
  modules: ProjectModule[];
  activeModuleId: string | null;
  onActiveModuleChange: (moduleId: string | null) => void;
  renderModuleDialogContent?: (module: ProjectModule) => React.ReactNode;
}

const moduleIcon = (moduleLabel: string): string =>
  moduleLabel
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

export const FocusModeToolbar = ({
  visible,
  modules,
  activeModuleId,
  onActiveModuleChange,
  renderModuleDialogContent,
}: FocusModeToolbarProps) => {
  const triggerRef = useRef<HTMLElement | null>(null);

  const activeModule = useMemo(
    () => modules.find((module) => module.id === activeModuleId) ?? null,
    [activeModuleId, modules],
  );

  if (!visible) {
    return null;
  }

  return (
    <>
      <div
        role="toolbar"
        aria-label="Module shortcuts"
        className="fixed left-1/2 top-0 z-40 flex -translate-x-1/2 items-center gap-1 rounded-b-panel border border-t-0 border-subtle bg-surface px-2 py-1 shadow-soft"
      >
        {modules.map((module) => {
          const active = activeModuleId === module.id;
          return (
            <button
              key={module.id}
              type="button"
              aria-label={`Open ${module.label}`}
              aria-pressed={active}
              onClick={(event) => {
                triggerRef.current = event.currentTarget;
                onActiveModuleChange(active ? null : module.id);
              }}
              className={cn(
                'h-9 w-9 rounded-control border text-xs font-semibold transition-colors',
                active
                  ? 'border-primary bg-elevated text-primary'
                  : 'border-transparent bg-transparent text-muted hover:border-subtle hover:bg-elevated hover:text-text',
              )}
            >
              {moduleIcon(module.label)}
            </button>
          );
        })}
      </div>

      <Dialog
        open={activeModule !== null}
        title={activeModule ? activeModule.label : 'Module'}
        description="Focus mode module dialog"
        onClose={() => onActiveModuleChange(null)}
        triggerRef={triggerRef}
      >
        {activeModule ? (
          <div className="space-y-3">
            {renderModuleDialogContent ? (
              renderModuleDialogContent(activeModule)
            ) : (
              <>
                <p className="text-sm text-text">
                  Quick module actions while staying in workspace focus mode.
                </p>
                <div className="rounded-panel border border-subtle bg-surface p-3 text-xs text-muted">
                  <p>Module type: {activeModule.type}</p>
                  <p>Lens: {activeModule.lens}</p>
                  <p>Size: {activeModule.size}</p>
                </div>
              </>
            )}
            <div className="flex gap-2">
              <Button type="button" size="sm">Inspect</Button>
              <Button type="button" size="sm">Drag Reference</Button>
              <Button type="button" size="sm" onClick={() => onActiveModuleChange(null)}>
                Close
              </Button>
            </div>
          </div>
        ) : null}
      </Dialog>
    </>
  );
};
