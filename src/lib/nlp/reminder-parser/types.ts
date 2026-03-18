export type ReminderRecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface ReminderRecurrence {
  frequency: ReminderRecurrenceFrequency;
  interval: number;
  days: string[] | null;
}

export interface ReminderParseResult {
  title: string;
  remind_at: string | null;
  recurrence: ReminderRecurrence | null;
  context_hint: string | null;
}

export interface ReminderParseOptions {
  now?: Date | string;
  timezone?: string;
}
