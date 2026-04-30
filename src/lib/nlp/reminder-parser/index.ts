import {
  parseReminderInput as parseKalandarReminderInput,
} from '../../productivity-parser/index.ts';
import type { ReminderParseOptions, ReminderParseResult } from './types.ts';

export const parseReminderInput = (input: string, opts?: ReminderParseOptions): ReminderParseResult => {
  const result = parseKalandarReminderInput(input, opts);

  return {
    fields: {
      title: result.fields.title,
      remind_at: result.fields.remind_at,
      recurrence: result.fields.recurrence,
      context_hint: result.fields.context_hint,
    },
    meta: {
      confidence: {
        title: result.meta.confidence.title,
        remind_at: result.meta.confidence.remind_at,
        recurrence: result.meta.confidence.recurrence,
        context_hint: result.meta.confidence.context_hint,
      },
      spans: {
        title: result.meta.spans.title,
        remind_at: result.meta.spans.remind_at,
        recurrence: result.meta.spans.recurrence,
        context_hint: result.meta.spans.context_hint,
      },
      debugSteps: result.meta.debugSteps,
      maskedInput: result.meta.maskedInput,
    },
    warnings: result.warnings?.map((warning) => ({
      code: warning.code,
      severity: warning.severity,
      message: warning.message,
      fieldHints: warning.fieldHints ?? [],
      spans: warning.spans ?? [],
      details: warning.details ?? {},
    })) ?? null,
  };
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
