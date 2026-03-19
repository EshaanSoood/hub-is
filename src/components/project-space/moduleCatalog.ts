import type { IconName } from '../primitives';

export const MODULE_CATALOG = [
  {
    type: 'table',
    label: 'Table',
    description: 'Structured records with sortable fields.',
    lensConfigurable: true,
    iconName: 'menu' as IconName,
  },
  {
    type: 'kanban',
    label: 'Kanban',
    description: 'Board-style work staged across columns.',
    lensConfigurable: true,
    iconName: 'menu' as IconName,
  },
  {
    type: 'calendar',
    label: 'Calendar',
    description: 'Time-based planning and event visibility.',
    lensConfigurable: true,
    iconName: 'calendar' as IconName,
  },
  {
    type: 'tasks',
    label: 'Tasks',
    description: 'A focused task list for this pane.',
    lensConfigurable: false,
    iconName: 'tasks' as IconName,
  },
  {
    type: 'reminders',
    label: 'Reminders',
    description: 'Upcoming reminders and nudges.',
    lensConfigurable: false,
    iconName: 'reminders' as IconName,
  },
  {
    type: 'timeline',
    label: 'Timeline',
    description: 'Recent project movement in one stream.',
    lensConfigurable: true,
    iconName: 'back' as IconName,
  },
  {
    type: 'files',
    label: 'Files',
    description: 'Shared assets and uploads for the pane.',
    lensConfigurable: true,
    iconName: 'upload' as IconName,
  },
  {
    type: 'quick_thoughts',
    label: 'Quick Thoughts',
    description: 'Low-friction capture for ideas and notes.',
    lensConfigurable: false,
    iconName: 'thought-pile' as IconName,
  },
] as const;

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
