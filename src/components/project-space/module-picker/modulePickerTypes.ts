import type { ModuleSizeTier } from '../moduleCatalog';

export type ModulePickerModuleType =
  | 'table'
  | 'kanban'
  | 'calendar'
  | 'tasks'
  | 'reminders'
  | 'timeline'
  | 'files'
  | 'quick_thoughts';

export type ModulePickerSize = ModuleSizeTier;

export interface ModulePickerSelection {
  moduleType: ModulePickerModuleType;
  sizeTier: ModulePickerSize;
}

export type ModulePickerSeedPayload = Record<string, unknown>;

export type ModulePickerSeedData = Partial<
  Record<ModulePickerModuleType, Partial<Record<ModulePickerSize, ModulePickerSeedPayload>>>
>;

export const MODULE_PICKER_SIZE_LABELS: Record<ModulePickerSize, string> = {
  S: 'Small',
  M: 'Medium',
  L: 'Large',
};
