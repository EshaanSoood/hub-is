import type { ParseWarning as SharedParseWarning } from '../nlp/shared/types.ts';
import {
  classifyIntent,
  parseEventInput,
  parseReminderInput,
  parseTaskInput,
  type KalandarCalendarParseOptions,
  type KalandarCalendarParseResult,
  type KalandarIntentResult,
  type KalandarReminderParseOptions,
  type KalandarReminderParseResult,
  type KalandarTaskParseOptions,
  type KalandarTaskParseResult,
} from './lightweightKalandar';

export interface ProductivityParseOptions {
  now?: Date | string;
  timezone?: string;
  locale?: string;
  debug?: boolean;
  threshold?: number;
  knownAssignees?: string[];
}

export interface ProductivityAbstainResult {
  intent: 'none';
  parser: null;
  intentResult: KalandarIntentResult;
  result: null;
}

export interface ProductivityTaskResult {
  intent: 'task';
  parser: 'task';
  intentResult: KalandarIntentResult;
  result: KalandarTaskParseResult;
}

export interface ProductivityCalendarResult {
  intent: 'calendar';
  parser: 'calendar';
  intentResult: KalandarIntentResult;
  result: KalandarCalendarParseResult;
}

export interface ProductivityReminderResult {
  intent: 'reminder';
  parser: 'reminder';
  intentResult: KalandarIntentResult;
  result: KalandarReminderParseResult;
}

export type ProductivityParseResult =
  | ProductivityAbstainResult
  | ProductivityTaskResult
  | ProductivityCalendarResult
  | ProductivityReminderResult;

const toTaskOptions = (opts?: ProductivityParseOptions): KalandarTaskParseOptions => ({
  now: opts?.now,
  timezone: opts?.timezone,
  knownAssignees: opts?.knownAssignees,
  debug: opts?.debug,
});

const toReminderOptions = (opts?: ProductivityParseOptions): KalandarReminderParseOptions => ({
  now: opts?.now,
  timezone: opts?.timezone,
  debug: opts?.debug,
});

const toCalendarOptions = (opts?: ProductivityParseOptions): KalandarCalendarParseOptions => ({
  now: opts?.now,
  timezone: opts?.timezone,
  locale: opts?.locale,
  debug: opts?.debug,
});

export const parseProductivityInput = (input: string, opts?: ProductivityParseOptions): ProductivityParseResult => {
  const intentResult = classifyIntent(input, { threshold: opts?.threshold });

  if (intentResult.intent === 'task') {
    return {
      intent: 'task',
      parser: 'task',
      intentResult,
      result: parseTaskInput(input, toTaskOptions(opts)),
    };
  }

  if (intentResult.intent === 'calendar') {
    return {
      intent: 'calendar',
      parser: 'calendar',
      intentResult,
      result: parseEventInput(input, toCalendarOptions(opts)),
    };
  }

  if (intentResult.intent === 'reminder') {
    return {
      intent: 'reminder',
      parser: 'reminder',
      intentResult,
      result: parseReminderInput(input, toReminderOptions(opts)),
    };
  }

  return {
    intent: 'none',
    parser: null,
    intentResult,
    result: null,
  };
};

const normalizeWarnings = (warnings: KalandarIntentResult['warnings']): SharedParseWarning[] | null =>
  warnings?.map((warning) => ({
    code: warning.code,
    severity: warning.severity,
    message: warning.message,
    fieldHints: warning.fieldHints ?? [],
    spans: warning.spans ?? [],
    details: warning.details ?? {},
  })) ?? null;

export const normalizeProductivityWarnings = normalizeWarnings;

export { classifyIntent, parseEventInput, parseReminderInput, parseTaskInput };
export type {
  KalandarCalendarParseOptions,
  KalandarCalendarParseResult,
  KalandarIntentResult,
  KalandarReminderParseOptions,
  KalandarReminderParseResult,
  KalandarTaskParseOptions,
  KalandarTaskParseResult,
} from './lightweightKalandar';
