import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  IconButton,
} from '../primitives';
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
      <DropdownMenu>
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
        <DropdownMenuContent align="end" className="min-w-28 p-1">
          <DropdownMenuItem
            onSelect={onRemove}
            className="justify-center text-sm font-medium text-danger focus:bg-danger-subtle focus:text-danger"
          >
            Remove
          </DropdownMenuItem>
        </DropdownMenuContent>
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
