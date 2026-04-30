import {
  parseEventInput as parseKalandarEventInput,
  type KalandarCalendarParseResult,
} from '../productivity-parser/index.ts';
import type { EventParseResult, ParseOptions } from './types.ts';

const RECURRENCE_DAY_MAP: Record<string, string> = {
  MO: 'monday',
  TU: 'tuesday',
  WE: 'wednesday',
  TH: 'thursday',
  FR: 'friday',
  SA: 'saturday',
  SU: 'sunday',
};

const parseRecurrence = (
  recurrenceRule: string | null,
  recurrenceEnd: string | null,
  recurrenceException: KalandarCalendarParseResult['fields']['recurrence_exception'],
): EventParseResult['fields']['recurrence'] => {
  const fields: EventParseResult['fields']['recurrence'] = {
    frequency: null,
    interval: null,
    days: null,
    exceptions: null,
    end_date: recurrenceEnd,
  };

  if (recurrenceRule) {
    const parts = Object.fromEntries(
      recurrenceRule
        .split(';')
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => {
          const [key, ...rest] = part.split('=');
          return [key, rest.join('=')];
        }),
    );
    const frequency = parts.FREQ?.toLowerCase();
    if (frequency === 'daily' || frequency === 'weekly' || frequency === 'monthly' || frequency === 'yearly') {
      fields.frequency = frequency;
    }
    const interval = Number(parts.INTERVAL);
    fields.interval = Number.isFinite(interval) && interval > 0 ? interval : fields.frequency ? 1 : null;
    const dayTokens = parts.BYDAY?.split(',').map((token) => token.trim()).filter(Boolean) ?? [];
    const days = dayTokens
      .map((token) => RECURRENCE_DAY_MAP[token.slice(-2)])
      .filter((value): value is string => Boolean(value));
    fields.days = days.length > 0 ? days : null;
  }

  const exceptions = recurrenceException
    .filter(
      (entry) => entry.condition?.type === 'specific_date' && entry.action?.type === 'skip' && typeof entry.condition.date === 'string',
    )
    .map((entry) => entry.condition.date);
  fields.exceptions = exceptions.length > 0 ? exceptions : null;

  return fields;
};

const combineRecurrenceSpans = (result: KalandarCalendarParseResult): EventParseResult['meta']['spans']['recurrence'] => [
  ...result.meta.spans.recurrence,
  ...result.meta.spans.recurrence_end,
  ...result.meta.spans.recurrence_exception,
];

const recurrenceConfidence = (result: KalandarCalendarParseResult): number =>
  Math.max(
    result.meta.confidence.recurrence,
    result.meta.confidence.recurrence_end,
    result.meta.confidence.recurrence_exception,
  );

export const parseEventInput = (input: string, opts?: ParseOptions): EventParseResult => {
  const result = parseKalandarEventInput(input, opts);

  return {
    fields: {
      title: result.fields.title,
      date: result.fields.date,
      time: result.fields.time,
      end_time: result.fields.end_time,
      duration_minutes: result.fields.duration_minutes,
      location: result.fields.location,
      recurrence: parseRecurrence(result.fields.recurrence, result.fields.recurrence_end, result.fields.recurrence_exception),
      alerts: result.fields.alerts,
      attendees: result.fields.attendees,
    },
    meta: {
      locale: result.meta.locale,
      timezone: result.meta.timezone,
      confidence: {
        title: result.meta.confidence.title,
        date: result.meta.confidence.date,
        time: result.meta.confidence.time,
        end_time: result.meta.confidence.end_time,
        duration_minutes: result.meta.confidence.duration_minutes,
        location: result.meta.confidence.location,
        recurrence: recurrenceConfidence(result),
        alerts: result.meta.confidence.alerts,
        attendees: result.meta.confidence.attendees,
      },
      spans: {
        title: result.meta.spans.title,
        date: result.meta.spans.date,
        time: result.meta.spans.time,
        end_time: result.meta.spans.end_time,
        duration_minutes: result.meta.spans.duration_minutes,
        location: result.meta.spans.location,
        recurrence: combineRecurrenceSpans(result),
        alerts: result.meta.spans.alerts,
        attendees: result.meta.spans.attendees,
      },
      cleanedInput: result.meta.cleanedInput,
      maskedInput: result.meta.maskedInput,
      debugSteps: result.meta.debugSteps,
    },
    warnings: result.warnings,
  };
};

export const getStructuredParseConfidence = (result: EventParseResult): number => {
  const fields = result.meta.confidence;
  const weighted = [
    fields.date * 1.1,
    fields.time * 1,
    fields.end_time * 0.8,
    fields.duration_minutes * 0.8,
    fields.location * 0.7,
    fields.recurrence * 1,
    fields.alerts * 0.8,
    fields.attendees * 0.4,
  ];

  const sum = weighted.reduce((total, value) => total + value, 0);
  const max = 6.6;
  return Math.max(0, Math.min(1, sum / max));
};

export const shouldFallbackToPlainSearch = (result: EventParseResult): boolean => {
  const recurrence = result.fields.recurrence;
  const hasStructuredFields = Boolean(
    result.fields.date ||
      result.fields.time ||
      result.fields.end_time ||
      result.fields.duration_minutes ||
      result.fields.location ||
      recurrence.frequency ||
      recurrence.interval ||
      recurrence.end_date ||
      recurrence.days?.length ||
      recurrence.exceptions?.length ||
      result.fields.alerts?.length ||
      result.fields.attendees?.length,
  );

  if (!hasStructuredFields) {
    return true;
  }

  return getStructuredParseConfidence(result) < 0.35;
};

export type { EventParseResult, ParseOptions, EventFields, EventParseMeta, FieldSpan, DebugStep, ParseWarning } from './types.ts';
