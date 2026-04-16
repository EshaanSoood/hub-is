import type { IconName } from '../primitives';

export type ModuleSizeTier = 'S' | 'M' | 'L';

type ModuleCatalogEntry = {
  type: string;
  label: string;
  description: string;
  lensConfigurable: boolean;
  iconName: IconName;
  allowedSizeTiers: readonly ModuleSizeTier[];
  defaultSize: ModuleSizeTier;
};

export const MODULE_CATALOG = [
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
    description: 'A focused task list for this pane.',
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
    description: 'Recent project movement in one stream.',
    lensConfigurable: true,
    iconName: 'timeline',
    allowedSizeTiers: ['S', 'M', 'L'],
    defaultSize: 'M',
  },
  {
    type: 'files',
    label: 'Files',
    description: 'Shared assets and uploads for the pane.',
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
] as const satisfies readonly ModuleCatalogEntry[];

export const moduleCatalogEntry = (moduleType: string) =>
  MODULE_CATALOG.find((entry) => entry.type === moduleType);

export const moduleLabel = (moduleType: string): string =>
  moduleCatalogEntry(moduleType)?.label || moduleType.replace(/_/g, ' ');

export const moduleDescription = (moduleType: string): string =>
  moduleCatalogEntry(moduleType)?.description || 'Add this module to the pane.';

export const isLensConfigurable = (moduleType: string): boolean =>
  moduleCatalogEntry(moduleType)?.lensConfigurable ?? true;

export const moduleIconName = (moduleType: string): IconName | null =>
  moduleCatalogEntry(moduleType)?.iconName ?? null;

export const moduleAllowedSizeTiers = (moduleType: string): readonly ModuleSizeTier[] =>
  moduleCatalogEntry(moduleType)?.allowedSizeTiers ?? ['S', 'M', 'L'];

export const moduleDefaultSize = (moduleType: string): ModuleSizeTier =>
  moduleCatalogEntry(moduleType)?.defaultSize ?? 'M';

export const clampModuleSizeTier = (moduleType: string, sizeTier: ModuleSizeTier): ModuleSizeTier =>
  moduleAllowedSizeTiers(moduleType).includes(sizeTier) ? sizeTier : moduleDefaultSize(moduleType);

export const moduleAccentClassName = (moduleType: string): string => {
  if (moduleType === 'tasks') {
    return 'module-accent-tasks';
  }
  if (moduleType === 'calendar') {
    return 'module-accent-calendar';
  }
  if (moduleType === 'quick_thoughts' || moduleType === 'notes') {
    return 'module-accent-notes';
  }
  if (moduleType === 'timeline' || moduleType === 'stream') {
    return 'module-accent-stream';
  }
  if (moduleType === 'files') {
    return 'module-accent-files';
  }
  if (moduleType === 'reminders') {
    return 'module-accent-reminders';
  }
  return '';
};
