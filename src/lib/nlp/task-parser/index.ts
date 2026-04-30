import * as chrono from 'chrono-node';
import {
  parseTaskInput as parseKalandarTaskInput,
  type KalandarTaskParseResult,
} from '../../productivity-parser/index.ts';
import { formatDateTimeInTimezone, parseReferenceDate } from '../shared/utils.ts';
import type { TaskParseOptions, TaskParseResult } from './types.ts';

const toIsoDate = (year: number, month: number, day: number): string =>
  `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

const normalizeTaskDueAt = (result: KalandarTaskParseResult, opts?: TaskParseOptions): string | null => {
  if (result.fields.recurrence) {
    return null;
  }

  const datePhrase = result.fields.due_date?.trim() || '';
  const timePhrase = result.fields.due_time?.trim() || '';
  const phrase = [datePhrase, timePhrase].filter(Boolean).join(' ').trim();
  if (!phrase) {
    return null;
  }

  const timezone = opts?.timezone || 'UTC';
  const referenceDate = parseReferenceDate(opts?.now);
  const wallClockReference = new Date(formatDateTimeInTimezone(referenceDate, timezone));
  const parsed = chrono.parse(phrase, wallClockReference, { forwardDate: true })[0];
  if (!parsed) {
    return null;
  }

  const year = parsed.start.get('year');
  const month = parsed.start.get('month');
  const day = parsed.start.get('day');
  if (typeof year !== 'number' || typeof month !== 'number' || typeof day !== 'number') {
    return null;
  }

  const isoDate = toIsoDate(year, month, day);
  const hasExplicitTime = Boolean(timePhrase) || parsed.start.isCertain('hour');
  if (!hasExplicitTime) {
    return isoDate;
  }

  const hour = parsed.start.get('hour');
  const minute = parsed.start.get('minute');
  if (typeof hour !== 'number' || typeof minute !== 'number') {
    return isoDate;
  }

  return `${isoDate}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
};

const maxConfidence = (...values: number[]): number => values.reduce((max, value) => Math.max(max, value), 0);

export const parseTaskInput = (input: string, opts?: TaskParseOptions): TaskParseResult => {
  const result = parseKalandarTaskInput(input, opts);

  return {
    fields: {
      title: result.fields.title,
      due_at: normalizeTaskDueAt(result, opts),
      priority: result.fields.priority,
      assignee_hints: result.fields.assignee,
    },
    meta: {
      confidence: {
        title: result.meta.confidence.title,
        due_at: maxConfidence(result.meta.confidence.due_date, result.meta.confidence.due_time),
        priority: result.meta.confidence.priority,
        assignee_hints: result.meta.confidence.assignee,
      },
      spans: {
        title: result.meta.spans.title,
        due_at: [...result.meta.spans.due_date, ...result.meta.spans.due_time],
        priority: result.meta.spans.priority,
        assignee_hints: result.meta.spans.assignee,
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
  TaskFields,
  TaskParseContext,
  TaskParseMeta,
  TaskParseOptions,
  TaskParsePass,
  TaskParseResult,
  TaskPriority,
} from './types.ts';
