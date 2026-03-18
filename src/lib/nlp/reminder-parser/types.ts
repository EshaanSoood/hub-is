export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface RecurrenceInfo {
  frequency: RecurrenceFrequency;
  interval?: number;
}

export interface ReminderParseResult {
  title: string;
  remind_at: string | null;
  recurrence: RecurrenceInfo | null;
  context_hint: string | null;
}
