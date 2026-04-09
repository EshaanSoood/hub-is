import { AnimatePresence } from 'framer-motion';
import { useState, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  IconButton,
} from '../primitives';
import { AnimatedSurface } from '../motion/AnimatedSurface';
import { moduleLabel } from './moduleCatalog';

type ModuleSizeTier = 'S' | 'M' | 'L';

const sizeClass: Record<ModuleSizeTier, string> = {
  S: 'md:col-span-3',
  M: 'md:col-span-6',
  L: 'md:col-span-12',
};

const sizeHeightClass: Record<ModuleSizeTier, string> = {
  S: 'module-card-s',
  M: 'module-card-m',
  L: 'module-card-l',
};

interface ModuleShellProps {
  moduleType: string;
  sizeTier: ModuleSizeTier;
  readOnlyState?: boolean;
  removeDisabled?: boolean;
  onRemove: () => void;
  children: ReactNode;
}

export const ModuleShell = ({
  moduleType,
  sizeTier,
  readOnlyState = false,
  removeDisabled = false,
  onRemove,
  children,
}: ModuleShellProps) => {
  const [actionsOpen, setActionsOpen] = useState(false);
  const label = moduleLabel(moduleType);

  return (
    <article
      data-testid="module-card"
      className={cn(
        'relative flex flex-col overflow-hidden rounded-panel border border-subtle bg-elevated p-3',
        sizeClass[sizeTier],
        sizeHeightClass[sizeTier],
      )}
    >
      <DropdownMenu open={actionsOpen} onOpenChange={setActionsOpen}>
        <DropdownMenuTrigger asChild>
          <IconButton
            size="sm"
            variant="ghost"
            aria-label={`${removeDisabled ? 'View' : 'Open'} ${label} module actions`}
            disabled={removeDisabled}
            className={cn(
              'absolute right-2 top-2 z-20 opacity-100 disabled:opacity-100',
              readOnlyState
                ? 'border-transparent text-danger hover:bg-transparent hover:text-danger'
                : removeDisabled
                  ? 'border-transparent text-muted/60 hover:bg-transparent hover:text-muted/60'
                  : 'border-transparent text-muted hover:bg-subtle hover:text-text',
            )}
          >
            <span aria-hidden="true" className="text-base leading-none">
              −
            </span>
          </IconButton>
        </DropdownMenuTrigger>
        <AnimatePresence>
          {actionsOpen ? (
            <DropdownMenuContent align="end" sideOffset={8} asChild forceMount>
              <AnimatedSurface
                role="menu"
                ariaLabel={`${label} module actions`}
                transformOrigin="top right"
                className="min-w-28 p-1"
              >
                <DropdownMenuItem
                  onSelect={onRemove}
                  className="justify-center text-sm font-medium text-danger focus:bg-danger-subtle focus:text-danger"
                >
                  Remove
                </DropdownMenuItem>
              </AnimatedSurface>
            </DropdownMenuContent>
          ) : null}
        </AnimatePresence>
      </DropdownMenu>

      <div
        className="min-h-0 flex flex-1 flex-col overflow-y-auto overflow-x-hidden pr-10"
        data-module-card-body="true"
      >
        {children}
      </div>
    </article>
  );
};
