import type { IconName } from '../primitives';

export type WidgetSizeTier = 'S' | 'M' | 'L';

type WidgetCatalogEntry = {
  type: string;
  label: string;
  description: string;
  lensConfigurable: boolean;
  iconName: IconName;
  allowedSizeTiers: readonly WidgetSizeTier[];
  defaultSize: WidgetSizeTier;
};

export const WIDGET_CATALOG = [
  {
    type: 'table',
    label: 'Table',
    description: 'Structured records with sortable fields.',
    lensConfigurable: true,
    iconName: 'table',
    allowedSizeTiers: ['M', 'L'],
    defaultSize: 'M',
  },
  {
    type: 'kanban',
    label: 'Kanban',
    description: 'Board-style work staged across columns.',
    lensConfigurable: true,
    iconName: 'kanban',
    allowedSizeTiers: ['M', 'L'],
    defaultSize: 'M',
  },
  {
    type: 'calendar',
    label: 'Calendar',
    description: 'Time-based planning and event visibility.',
    lensConfigurable: true,
    iconName: 'calendar',
    allowedSizeTiers: ['S', 'M', 'L'],
    defaultSize: 'L',
  },
  {
    type: 'tasks',
    label: 'Tasks',
    description: 'A focused task list for this project.',
    lensConfigurable: false,
    iconName: 'tasks',
    allowedSizeTiers: ['S', 'M', 'L'],
    defaultSize: 'M',
  },
  {
    type: 'reminders',
    label: 'Reminders',
    description: 'Upcoming reminders and nudges.',
    lensConfigurable: false,
    iconName: 'reminders',
    allowedSizeTiers: ['S', 'M', 'L'],
    defaultSize: 'M',
  },
  {
    type: 'timeline',
    label: 'Timeline',
    description: 'Recent space movement in one stream.',
    lensConfigurable: true,
    iconName: 'timeline',
    allowedSizeTiers: ['S', 'M', 'L'],
    defaultSize: 'M',
  },
  {
    type: 'files',
    label: 'Files',
    description: 'Shared assets and uploads for the project.',
    lensConfigurable: true,
    iconName: 'upload',
    allowedSizeTiers: ['S', 'M', 'L'],
    defaultSize: 'S',
  },
  {
    type: 'quick_thoughts',
    label: 'Quick Thoughts',
    description: 'Low-friction capture for ideas and notes.',
    lensConfigurable: false,
    iconName: 'thought-pile',
    allowedSizeTiers: ['S', 'M', 'L'],
    defaultSize: 'S',
  },
] as const satisfies readonly WidgetCatalogEntry[];

export const widgetCatalogEntry = (widgetType: string) =>
  WIDGET_CATALOG.find((entry) => entry.type === widgetType);

export const widgetLabel = (widgetType: string): string =>
  widgetCatalogEntry(widgetType)?.label || widgetType.replace(/_/g, ' ');

export const widgetDescription = (widgetType: string): string =>
  widgetCatalogEntry(widgetType)?.description || 'Add this widget to the project.';

export const isLensConfigurable = (widgetType: string): boolean =>
  widgetCatalogEntry(widgetType)?.lensConfigurable ?? true;

export const widgetIconName = (widgetType: string): IconName | null =>
  widgetCatalogEntry(widgetType)?.iconName ?? null;

export const widgetAllowedSizeTiers = (widgetType: string): readonly WidgetSizeTier[] =>
  widgetCatalogEntry(widgetType)?.allowedSizeTiers ?? ['S', 'M', 'L'];

export const widgetDefaultSize = (widgetType: string): WidgetSizeTier =>
  widgetCatalogEntry(widgetType)?.defaultSize ?? 'M';

export const clampWidgetSizeTier = (widgetType: string, sizeTier: WidgetSizeTier): WidgetSizeTier =>
  widgetAllowedSizeTiers(widgetType).includes(sizeTier) ? sizeTier : widgetDefaultSize(widgetType);

export const widgetAccentClassName = (widgetType: string): string => {
  if (widgetType === 'tasks') {
    return 'widget-accent-tasks';
  }
  if (widgetType === 'calendar') {
    return 'widget-accent-calendar';
  }
  if (widgetType === 'quick_thoughts' || widgetType === 'notes') {
    return 'widget-accent-notes';
  }
  if (widgetType === 'timeline' || widgetType === 'stream') {
    return 'widget-accent-stream';
  }
  if (widgetType === 'files') {
    return 'widget-accent-files';
  }
  if (widgetType === 'reminders') {
    return 'widget-accent-reminders';
  }
  return '';
};
