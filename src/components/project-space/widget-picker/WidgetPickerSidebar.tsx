import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../primitives';
import { WIDGET_CATALOG, widgetIconName, type WidgetSizeTier } from '../widgetCatalog';
import { WIDGET_PICKER_SIZE_LABELS, type WidgetPickerWidgetType, type WidgetPickerSelection } from './widgetPickerTypes';

interface WidgetPickerSidebarProps {
  onSelectionChange: (selection: WidgetPickerSelection) => void;
}

const firstSizeForWidget = (widgetType: string): WidgetSizeTier =>
  WIDGET_CATALOG.find((entry) => entry.type === widgetType)?.allowedSizeTiers[0] ?? 'M';

const initialSelection = (): WidgetPickerSelection => {
  const firstEntry = WIDGET_CATALOG[0];
  return {
    widgetType: firstEntry.type as WidgetPickerWidgetType,
    sizeTier: firstEntry.allowedSizeTiers[0],
  };
};

export const WidgetPickerSidebar = ({ onSelectionChange }: WidgetPickerSidebarProps) => {
  const [expandedWidget, setExpandedWidget] = useState<WidgetPickerWidgetType>(() => initialSelection().widgetType);
  const [selection, setSelection] = useState<WidgetPickerSelection>(() => initialSelection());
  const widgetButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    onSelectionChange(selection);
  }, [onSelectionChange, selection]);

  const selectWidget = (widgetType: WidgetPickerWidgetType) => {
    const sizeTier = firstSizeForWidget(widgetType);
    const nextSelection = { widgetType, sizeTier };
    setExpandedWidget(widgetType);
    setSelection(nextSelection);
  };

  const selectSize = (widgetType: WidgetPickerWidgetType, sizeTier: WidgetSizeTier) => {
    const nextSelection = { widgetType, sizeTier };
    setSelection(nextSelection);
  };

  const focusWidgetButton = (index: number) => {
    const normalizedIndex = (index + WIDGET_CATALOG.length) % WIDGET_CATALOG.length;
    widgetButtonRefs.current[normalizedIndex]?.focus();
  };

  return (
    <nav aria-label="Widget types">
      <ul className="space-y-1">
        {WIDGET_CATALOG.map((entry, index) => {
          const widgetType = entry.type as WidgetPickerWidgetType;
          const expanded = expandedWidget === widgetType;
          const iconName = widgetIconName(entry.type) ?? 'plus';
          return (
            <li key={entry.type}>
              <button
                ref={(node) => {
                  widgetButtonRefs.current[index] = node;
                }}
                type="button"
                data-dialog-autofocus={index === 0 ? true : undefined}
                aria-expanded={expanded}
                onClick={() => selectWidget(widgetType)}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    focusWidgetButton(index + 1);
                  } else if (event.key === 'ArrowUp') {
                    event.preventDefault();
                    focusWidgetButton(index - 1);
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
                    const selected = selection.widgetType === widgetType && selection.sizeTier === sizeTier;
                    return (
                      <li key={sizeTier}>
                        <button
                          type="button"
                          aria-current={selected ? 'true' : undefined}
                          onClick={() => selectSize(widgetType, sizeTier)}
                          className="w-full rounded-control px-2 py-1.5 text-left text-xs font-semibold text-muted transition hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring aria-current:bg-elevated aria-current:text-primary"
                        >
                          {WIDGET_PICKER_SIZE_LABELS[sizeTier]}
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
