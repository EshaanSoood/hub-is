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
import { widgetAccentClassName, widgetLabel } from './widgetCatalog';

type WidgetSizeTier = 'S' | 'M' | 'L';

const sizeClass: Record<WidgetSizeTier, string> = {
  S: 'md:col-span-3',
  M: 'md:col-span-6',
  L: 'md:col-span-12',
};

const sizeHeightClass: Record<WidgetSizeTier, string> = {
  S: 'widget-card-s',
  M: 'widget-card-m',
  L: 'widget-card-l',
};

interface WidgetShellProps {
  widgetType: string;
  sizeTier: WidgetSizeTier;
  readOnlyState?: boolean;
  removeDisabled?: boolean;
  previewMode?: boolean;
  onRemove: () => void;
  children: ReactNode;
}

export const WidgetShell = ({
  widgetType,
  sizeTier,
  readOnlyState = false,
  removeDisabled = false,
  previewMode = false,
  onRemove,
  children,
}: WidgetShellProps) => {
  const [actionsOpen, setActionsOpen] = useState(false);
  const label = widgetLabel(widgetType);
  const accentClassName = widgetAccentClassName(widgetType);

  return (
    <article
      data-testid="widget-card"
      className={cn(
        'widget-sheet relative flex flex-col overflow-hidden p-3',
        accentClassName,
        previewMode ? 'max-h-full w-full' : sizeClass[sizeTier],
        previewMode ? 'widget-picker-preview-card' : sizeHeightClass[sizeTier],
      )}
    >
      {!previewMode ? <DropdownMenu open={actionsOpen} onOpenChange={setActionsOpen}>
        <DropdownMenuTrigger asChild>
          <IconButton
            size="sm"
            variant="ghost"
            aria-label={`${removeDisabled ? 'View' : 'Open'} ${label} widget actions`}
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
                ariaLabel={`${label} widget actions`}
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
      </DropdownMenu> : null}

      <div
        className={cn(
          'min-h-0 flex flex-col overflow-y-auto overflow-x-hidden',
          previewMode ? 'pr-0' : 'flex-1 pr-10',
        )}
        data-widget-card-body="true"
      >
        {children}
      </div>
    </article>
  );
};
