import { useCallback, useMemo, useState } from 'react';
import type { ContractWidgetConfig } from '../WidgetGrid';

const TRAY_COLUMNS = 12;
const COMPACT_TRAY_COLUMNS = 4;
const TRAY_ROWS = 8;

export type WidgetTrayLayout = 'desktop' | 'compact';

export type WidgetTrayPlacement = {
  widget: ContractWidgetConfig;
  columnStart: number;
  rowStart: number;
  columnSpan: number;
  rowSpan: number;
};

export type WidgetTray = {
  id: string;
  placements: WidgetTrayPlacement[];
};

type WidgetTraySpan = Pick<WidgetTrayPlacement, 'columnSpan' | 'rowSpan'>;

export const WIDGET_TRAY_SIZE_SPANS: Record<ContractWidgetConfig['size_tier'], WidgetTraySpan> = {
  S: { columnSpan: 3, rowSpan: 2 },
  M: { columnSpan: 4, rowSpan: 3 },
  L: { columnSpan: 6, rowSpan: 4 },
};

export const COMPACT_WIDGET_TRAY_SIZE_SPANS: Record<ContractWidgetConfig['size_tier'], WidgetTraySpan> = {
  S: { columnSpan: 2, rowSpan: 2 },
  M: { columnSpan: 4, rowSpan: 3 },
  L: { columnSpan: 4, rowSpan: 4 },
};

const activeTrayByProjectId = new Map<string, number>();

const createOccupiedCells = (columnCount: number) =>
  Array.from({ length: TRAY_ROWS }, () => Array.from({ length: columnCount }, () => false));

const findPlacement = (
  occupiedCells: boolean[][],
  { columnSpan, rowSpan }: WidgetTraySpan,
  columnCount: number,
): Pick<WidgetTrayPlacement, 'columnStart' | 'rowStart'> | null => {
  for (let rowIndex = 0; rowIndex <= TRAY_ROWS - rowSpan; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex <= columnCount - columnSpan; columnIndex += 1) {
      let fits = true;

      for (let rowOffset = 0; rowOffset < rowSpan; rowOffset += 1) {
        for (let columnOffset = 0; columnOffset < columnSpan; columnOffset += 1) {
          if (occupiedCells[rowIndex + rowOffset][columnIndex + columnOffset]) {
            fits = false;
            break;
          }
        }
        if (!fits) {
          break;
        }
      }

      if (fits) {
        return {
          columnStart: columnIndex + 1,
          rowStart: rowIndex + 1,
        };
      }
    }
  }

  return null;
};

const occupyCells = (
  occupiedCells: boolean[][],
  { columnStart, rowStart, columnSpan, rowSpan }: Omit<WidgetTrayPlacement, 'widget'>,
) => {
  const rowIndex = rowStart - 1;
  const columnIndex = columnStart - 1;

  for (let rowOffset = 0; rowOffset < rowSpan; rowOffset += 1) {
    for (let columnOffset = 0; columnOffset < columnSpan; columnOffset += 1) {
      occupiedCells[rowIndex + rowOffset][columnIndex + columnOffset] = true;
    }
  }
};

const widgetTraySpansByLayout: Record<WidgetTrayLayout, Record<ContractWidgetConfig['size_tier'], WidgetTraySpan>> = {
  compact: COMPACT_WIDGET_TRAY_SIZE_SPANS,
  desktop: WIDGET_TRAY_SIZE_SPANS,
};

const widgetTrayColumnCountByLayout: Record<WidgetTrayLayout, number> = {
  compact: COMPACT_TRAY_COLUMNS,
  desktop: TRAY_COLUMNS,
};

export const buildWidgetTrays = (widgets: ContractWidgetConfig[], layout: WidgetTrayLayout = 'desktop'): WidgetTray[] => {
  const trays: WidgetTray[] = [];
  const columnCount = widgetTrayColumnCountByLayout[layout];
  const spans = widgetTraySpansByLayout[layout];
  let occupiedCells = createOccupiedCells(columnCount);
  let activeTray: WidgetTray | null = null;

  for (const widget of widgets) {
    const span = spans[widget.size_tier];
    let placement = findPlacement(occupiedCells, span, columnCount);

    if (!placement) {
      occupiedCells = createOccupiedCells(columnCount);
      activeTray = null;
      placement = findPlacement(occupiedCells, span, columnCount);
    }

    if (!placement) {
      continue;
    }

    if (!activeTray) {
      activeTray = { id: `widget-tray-${trays.length + 1}`, placements: [] };
      trays.push(activeTray);
    }

    const nextPlacement = {
      widget,
      ...placement,
      ...span,
    };
    activeTray.placements.push(nextPlacement);
    occupyCells(occupiedCells, nextPlacement);
  }

  return trays;
};

export const useWidgetTrays = (projectId: string, widgets: ContractWidgetConfig[], layout: WidgetTrayLayout = 'desktop') => {
  const trays = useMemo(() => buildWidgetTrays(widgets, layout), [layout, widgets]);
  const [activeTrayState, setActiveTrayState] = useState(() => ({
    projectId,
    trayIndex: activeTrayByProjectId.get(projectId) ?? 0,
  }));
  const storedActiveTrayIndex = activeTrayState.projectId === projectId
    ? activeTrayState.trayIndex
    : activeTrayByProjectId.get(projectId) ?? 0;
  const activeTrayIndex = trays.length ? Math.min(storedActiveTrayIndex, trays.length - 1) : 0;

  const setActiveTrayIndex = useCallback((nextIndex: number) => {
    const boundedIndex = trays.length ? Math.max(0, Math.min(nextIndex, trays.length - 1)) : 0;
    activeTrayByProjectId.set(projectId, boundedIndex);
    setActiveTrayState({ projectId, trayIndex: boundedIndex });
  }, [projectId, trays.length]);

  const findTrayIndexByWidgetId = useCallback((widgetInstanceId: string) =>
    trays.findIndex((tray) =>
      tray.placements.some(({ widget }) => widget.widget_instance_id === widgetInstanceId),
    ), [trays]);

  return {
    activeTrayIndex,
    findTrayIndexByWidgetId,
    setActiveTrayIndex,
    trays,
  };
};
