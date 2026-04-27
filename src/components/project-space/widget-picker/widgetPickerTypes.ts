import type { WidgetSizeTier } from '../widgetCatalog';

export type WidgetPickerWidgetType =
  | 'table'
  | 'kanban'
  | 'calendar'
  | 'tasks'
  | 'reminders'
  | 'timeline'
  | 'files'
  | 'quick_thoughts';

export type WidgetPickerSize = WidgetSizeTier;

export interface WidgetPickerSelection {
  widgetType: WidgetPickerWidgetType;
  sizeTier: WidgetPickerSize;
}

export type WidgetPickerSeedPayload = Record<string, unknown>;

export type WidgetPickerSeedData = Partial<
  Record<WidgetPickerWidgetType, Partial<Record<WidgetPickerSize, WidgetPickerSeedPayload>>>
>;

export const WIDGET_PICKER_SIZE_LABELS: Record<WidgetPickerSize, string> = {
  S: 'Small',
  M: 'Medium',
  L: 'Large',
};
