import type { IconName } from '../primitives';

type ModuleCatalogEntry = {
  type: string;
  label: string;
  description: string;
  lensConfigurable: boolean;
  iconName: IconName;
};

export const MODULE_CATALOG = [
  {
    type: 'table',
    label: 'Table',
    description: 'Structured records with sortable fields.',
    lensConfigurable: true,
    iconName: 'menu',
  },
  {
    type: 'kanban',
    label: 'Kanban',
    description: 'Board-style work staged across columns.',
    lensConfigurable: true,
    iconName: 'menu',
  },
  {
    type: 'calendar',
    label: 'Calendar',
    description: 'Time-based planning and event visibility.',
    lensConfigurable: true,
    iconName: 'calendar',
  },
  {
    type: 'tasks',
    label: 'Tasks',
    description: 'A focused task list for this pane.',
    lensConfigurable: false,
    iconName: 'tasks',
  },
  {
    type: 'reminders',
    label: 'Reminders',
    description: 'Upcoming reminders and nudges.',
    lensConfigurable: false,
    iconName: 'reminders',
  },
  {
    type: 'timeline',
    label: 'Timeline',
    description: 'Recent project movement in one stream.',
    lensConfigurable: true,
    iconName: 'back',
  },
  {
    type: 'files',
    label: 'Files',
    description: 'Shared assets and uploads for the pane.',
    lensConfigurable: true,
    iconName: 'upload',
  },
  {
    type: 'quick_thoughts',
    label: 'Quick Thoughts',
    description: 'Low-friction capture for ideas and notes.',
    lensConfigurable: false,
    iconName: 'thought-pile',
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
