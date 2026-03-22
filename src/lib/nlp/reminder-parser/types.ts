import type { DebugStep, FieldSpan, ParseWarning } from '../shared/types.ts';

export type ReminderRecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface ReminderRecurrence {
  frequency: ReminderRecurrenceFrequency;
  interval: number;
  days: string[] | null;
}

export interface ReminderFields {
  title: string;
  remind_at: string | null;
  recurrence: ReminderRecurrence | null;
  context_hint: string | null;
}

export interface ReminderParseMeta {
  confidence: {
    title: number;
    remind_at: number;
    recurrence: number;
    context_hint: number;
  };
  spans: {
    title: FieldSpan[];
    remind_at: FieldSpan[];
    recurrence: FieldSpan[];
    context_hint: FieldSpan[];
  };
  debugSteps: DebugStep[];
  maskedInput: string;
}

export interface ReminderParseResult {
  fields: ReminderFields;
  meta: ReminderParseMeta;
  warnings: ParseWarning[] | null;
}

export interface ReminderParseOptions {
  now?: Date | string;
  timezone?: string;
  debug?: boolean;
}

export interface ReminderParseContext {
  rawInput: string;
  working: string;
  maskedInput: string;
  now: Date;
  options: { timezone: string; debug: boolean };
  result: ReminderParseResult;
  state: {
    anchorDayOfMonth: number | null;
    anchorMonthDay: { month: number; day: number } | null;
    explicitHour: number | null;
    explicitMinute: number | null;
    ambiguousTime: boolean;
  };
}

export type ReminderParsePass = (ctx: ReminderParseContext) => void;
