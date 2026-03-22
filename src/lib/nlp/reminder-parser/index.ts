import type { ParseWarning } from '../shared/types.ts';
import { prefixPass } from './passes/prefixPass.ts';
import { recurrencePass } from './passes/recurrencePass.ts';
import { relativeTimePass } from './passes/relativeTimePass.ts';
import { absoluteTimePass } from './passes/absoluteTimePass.ts';
import { namedDatePass } from './passes/namedDatePass.ts';
import { chronoFallbackPass } from './passes/chronoFallbackPass.ts';
import { titlePass } from './passes/titlePass.ts';
import type { ReminderParseContext, ReminderParseOptions, ReminderParsePass, ReminderParseResult } from './types.ts';
import { createReminderParseContext, resolveRecurringReminderAt } from './utils.ts';

const PIPELINE: ReminderParsePass[] = [
  prefixPass,
  recurrencePass,
  relativeTimePass,
  absoluteTimePass,
  namedDatePass,
  chronoFallbackPass,
  titlePass,
];

const WEEKDAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

const parseComparableDate = (value: string | null): Date | null => {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const applyRecurrencePostProcess = (ctx: ReminderParseContext): void => {
  const recurrence = ctx.result.fields.recurrence;
  if (!recurrence) {
    return;
  }

  const explicitHour = ctx.state.explicitHour;
  const explicitMinute = ctx.state.explicitMinute;
  const hour = explicitHour ?? 9;
  const minute = explicitMinute ?? 0;

  if (recurrence.frequency === 'daily' && recurrence.interval > 1 && explicitHour === null && explicitMinute === null) {
    ctx.result.fields.remind_at = null;
    return;
  }

  const resolved = resolveRecurringReminderAt(
    recurrence,
    ctx.now,
    ctx.options.timezone,
    hour,
    minute,
    ctx.state.anchorDayOfMonth,
    ctx.state.anchorMonthDay,
  );

  if (resolved) {
    ctx.result.fields.remind_at = resolved;
  }

  if (ctx.result.fields.context_hint && /^morning$/i.test(ctx.result.fields.context_hint) && recurrence.frequency === 'weekly') {
    ctx.result.fields.context_hint = null;
  }
};

const buildWarnings = (ctx: ReminderParseContext): ParseWarning[] => {
  const warnings: ParseWarning[] = [];

  if (!ctx.result.fields.remind_at) {
    warnings.push({
      code: 'no_remind_time',
      severity: 'warning',
      message: 'No time specified for reminder.',
      fieldHints: ['remind_at'],
      spans: [],
      details: {},
    });
  }

  if (ctx.state.ambiguousTime) {
    warnings.push({
      code: 'ambiguous_time',
      severity: 'info',
      message: 'Time is ambiguous and could be AM or PM.',
      fieldHints: ['remind_at'],
      spans: ctx.result.meta.spans.remind_at,
      details: {},
    });
  }

  const remindAt = parseComparableDate(ctx.result.fields.remind_at);
  if (remindAt && remindAt.getTime() < ctx.now.getTime()) {
    warnings.push({
      code: 'remind_at_past',
      severity: 'warning',
      message: 'Reminder time is in the past.',
      fieldHints: ['remind_at'],
      spans: ctx.result.meta.spans.remind_at,
      details: {
        remind_at: ctx.result.fields.remind_at,
        now: ctx.now.toISOString(),
      },
    });
  }

  const recurrence = ctx.result.fields.recurrence;
  if (recurrence?.frequency === 'weekly' && recurrence.days && recurrence.days.length > 0 && remindAt) {
    const weekday = WEEKDAY_NAMES[remindAt.getDay()];
    if (!recurrence.days.includes(weekday)) {
      warnings.push({
        code: 'recurrence_day_mismatch',
        severity: 'warning',
        message: "Recurrence day doesn't match remind_at date.",
        fieldHints: ['recurrence', 'remind_at'],
        spans: [...ctx.result.meta.spans.recurrence, ...ctx.result.meta.spans.remind_at],
        details: {
          remindAtWeekday: weekday,
          recurrenceDays: recurrence.days,
        },
      });
    }
  }

  return warnings;
};

export const parseReminderInput = (input: string, opts?: ReminderParseOptions): ReminderParseResult => {
  const ctx = createReminderParseContext(input, opts);

  for (const pass of PIPELINE) {
    pass(ctx);
  }

  applyRecurrencePostProcess(ctx);
  const warnings = buildWarnings(ctx);
  ctx.result.warnings = warnings.length > 0 ? warnings : null;
  ctx.result.meta.maskedInput = ctx.maskedInput;

  return ctx.result;
};

export type {
  ReminderFields,
  ReminderParseContext,
  ReminderParseMeta,
  ReminderParseOptions,
  ReminderParsePass,
  ReminderParseResult,
  ReminderRecurrence,
  ReminderRecurrenceFrequency,
} from './types.ts';
