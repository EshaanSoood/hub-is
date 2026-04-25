import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../primitives';
import { MODULE_CATALOG, moduleIconName, type ModuleSizeTier } from '../moduleCatalog';
import { MODULE_PICKER_SIZE_LABELS, type ModulePickerModuleType, type ModulePickerSelection } from './modulePickerTypes';

interface ModulePickerSidebarProps {
  onSelectionChange: (selection: ModulePickerSelection) => void;
}

const firstSizeForModule = (moduleType: string): ModuleSizeTier =>
  MODULE_CATALOG.find((entry) => entry.type === moduleType)?.allowedSizeTiers[0] ?? 'M';

const initialSelection = (): ModulePickerSelection => {
  const firstEntry = MODULE_CATALOG[0];
  return {
    moduleType: firstEntry.type as ModulePickerModuleType,
    sizeTier: firstEntry.allowedSizeTiers[0],
  };
};

export const ModulePickerSidebar = ({ onSelectionChange }: ModulePickerSidebarProps) => {
  const [expandedModule, setExpandedModule] = useState<ModulePickerModuleType>(() => initialSelection().moduleType);
  const [selection, setSelection] = useState<ModulePickerSelection>(() => initialSelection());
  const moduleButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    onSelectionChange(selection);
  }, [onSelectionChange, selection]);

  const selectModule = (moduleType: ModulePickerModuleType) => {
    const sizeTier = firstSizeForModule(moduleType);
    const nextSelection = { moduleType, sizeTier };
    setExpandedModule(moduleType);
    setSelection(nextSelection);
  };

  const selectSize = (moduleType: ModulePickerModuleType, sizeTier: ModuleSizeTier) => {
    const nextSelection = { moduleType, sizeTier };
    setSelection(nextSelection);
  };

  const focusModuleButton = (index: number) => {
    const normalizedIndex = (index + MODULE_CATALOG.length) % MODULE_CATALOG.length;
    moduleButtonRefs.current[normalizedIndex]?.focus();
  };

  return (
    <nav aria-label="Module types">
      <ul className="space-y-1">
        {MODULE_CATALOG.map((entry, index) => {
          const moduleType = entry.type as ModulePickerModuleType;
          const expanded = expandedModule === moduleType;
          const iconName = moduleIconName(entry.type) ?? 'plus';
          return (
            <li key={entry.type}>
              <button
                ref={(node) => {
                  moduleButtonRefs.current[index] = node;
                }}
                type="button"
                data-dialog-autofocus={index === 0 ? true : undefined}
                aria-expanded={expanded}
                onClick={() => selectModule(moduleType)}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    focusModuleButton(index + 1);
                  } else if (event.key === 'ArrowUp') {
                    event.preventDefault();
                    focusModuleButton(index - 1);
                  }
                }}
                className="flex w-full items-center gap-2 rounded-control px-3 py-2 text-left text-sm font-semibold text-text transition hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                <Icon name={iconName} className="text-[15px] text-primary" />
                <span className="min-w-0 flex-1 truncate">{entry.label}</span>
                <Icon name="chevron-down" className={expanded ? 'text-[13px]' : '-rotate-90 text-[13px]'} />
              </button>
              {expanded ? (
                <ul className="ml-7 mt-1 space-y-1 border-l border-border-muted pl-2">
                  {entry.allowedSizeTiers.map((sizeTier) => {
                    const selected = selection.moduleType === moduleType && selection.sizeTier === sizeTier;
                    return (
                      <li key={sizeTier}>
                        <button
                          type="button"
                          aria-current={selected ? 'true' : undefined}
                          onClick={() => selectSize(moduleType, sizeTier)}
                          className="w-full rounded-control px-2 py-1.5 text-left text-xs font-semibold text-muted transition hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring aria-current:bg-elevated aria-current:text-primary"
                        >
                          {MODULE_PICKER_SIZE_LABELS[sizeTier]}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
