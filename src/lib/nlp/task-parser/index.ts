import { classifyIntent } from '../intent/index.ts';
import type { ParseWarning } from '../shared/types.ts';
import { formatDateTimeInTimezone, parseReferenceDate } from '../shared/utils.ts';
import { DEFAULT_KNOWN_ASSIGNEES } from './constants.ts';
import { assigneePass } from './passes/assigneePass.ts';
import { dateTypoCorrectionPass } from './passes/dateTypoCorrectionPass.ts';
import { dueDatePass } from './passes/dueDatePass.ts';
import { priorityPass } from './passes/priorityPass.ts';
import { titlePass } from './passes/titlePass.ts';
import type { TaskParseContext, TaskParseOptions, TaskParsePass, TaskParseResult } from './types.ts';
import { createTaskParseContext, getKnownAssigneeSet } from './utils.ts';

const PIPELINE: TaskParsePass[] = [priorityPass, assigneePass, dateTypoCorrectionPass, dueDatePass, titlePass];

const OFFSET_OR_Z_SUFFIX_REGEX = /(?:[zZ]|[+-]\d{2}:\d{2})$/;
const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const parseIsoAsUtcMs = (value: string): number | null => {
  const parsed = new Date(`${value}Z`);
  const time = parsed.getTime();
  return Number.isNaN(time) ? null : time;
};

const parseComparableDate = (value: string | null, timezone: string): Date | null => {
  if (!value) {
    return null;
  }
  const normalizedValue = DATE_ONLY_REGEX.test(value) ? `${value}T23:59:00` : value;
  const parsed = new Date(normalizedValue);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  if (!OFFSET_OR_Z_SUFFIX_REGEX.test(normalizedValue)) {
    const comparableUtcMs = parseIsoAsUtcMs(normalizedValue);
    if (comparableUtcMs === null) {
      return parsed;
    }
    const zonedComparable = formatDateTimeInTimezone(parsed, timezone);
    const zonedComparableUtcMs = parseIsoAsUtcMs(zonedComparable);
    if (zonedComparableUtcMs !== null) {
      const adjustedTimestamp = parsed.getTime() + (comparableUtcMs - zonedComparableUtcMs);
      return new Date(adjustedTimestamp);
    }
  }
  return parsed;
};

const buildWarnings = (ctx: TaskParseContext): ParseWarning[] => {
  const warnings: ParseWarning[] = [];
  const dueAt = parseComparableDate(ctx.result.fields.due_at, ctx.options.timezone);
  const nowComparable = parseComparableDate(formatDateTimeInTimezone(ctx.now, ctx.options.timezone), ctx.options.timezone) || ctx.now;
  if (dueAt && dueAt.getTime() < nowComparable.getTime()) {
    warnings.push({
      code: 'due_date_past',
      severity: 'warning',
      message: 'Due date is in the past.',
      fieldHints: ['due_at'],
      spans: ctx.result.meta.spans.due_at,
      details: {
        due_at: ctx.result.fields.due_at,
        now: ctx.now.toISOString(),
      },
    });
  }

  const intent = classifyIntent(ctx.rawInput);
  if (intent.intent === 'reminder') {
    warnings.push({
      code: 'intent_mismatch_reminder',
      severity: 'warning',
      message: 'Input looks more like a reminder than a task.',
      fieldHints: ['title'],
      spans: ctx.result.meta.spans.title,
      details: {
        intent: intent.intent,
        topTwoGap: intent.meta.topTwoGap,
      },
    });
  }

  const knownSet = getKnownAssigneeSet(ctx.options.knownAssignees || DEFAULT_KNOWN_ASSIGNEES);
  const unknownAssignees = ctx.result.fields.assignee_hints.filter((hint) => {
    if (hint.startsWith('@') || hint.includes('@')) {
      return false;
    }
    return !knownSet.has(hint.trim().toLowerCase());
  });

  if (unknownAssignees.length > 0) {
    warnings.push({
      code: 'unknown_assignee',
      severity: 'warning',
      message: `Unknown assignee: ${unknownAssignees.join(', ')}`,
      fieldHints: ['assignee_hints'],
      spans: ctx.result.meta.spans.assignee_hints,
      details: {
        unknownAssignees,
      },
    });
  }

  if (!ctx.result.fields.due_at) {
    warnings.push({
      code: 'no_due_date',
      severity: 'info',
      message: 'No due date extracted — consider adding one for visibility.',
      fieldHints: ['due_at'],
      spans: [],
      details: {},
    });
  }

  return warnings;
};

export const parseTaskInput = (input: string, opts?: TaskParseOptions): TaskParseResult => {
  const ctx = createTaskParseContext(input, opts);
  ctx.now = parseReferenceDate(opts?.now);

  for (const pass of PIPELINE) {
    pass(ctx);
  }

  const warnings = buildWarnings(ctx);
  ctx.result.warnings = warnings.length > 0 ? warnings : null;
  ctx.result.meta.maskedInput = ctx.maskedInput;

  return ctx.result;
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
