import * as chrono from 'chrono-node';
import { alertsPass } from './passes/alertsPass.ts';
import { attendeesPass } from './passes/attendeesPass.ts';
import { chronoPass } from './passes/chronoPass.ts';
import { durationPass } from './passes/durationPass.ts';
import { locationPass } from './passes/locationPass.ts';
import { recurrencePass } from './passes/recurrencePass.ts';
import { titlePass } from './passes/titlePass.ts';
import type { EventParseResult, ParseOptions, ParseWarning } from './types.ts';
import {
  createParseContext,
  formatDateInTimezone,
  hasStructuredFields,
  normalizeWeekdayToken,
  weekdayFromIsoDate,
  weekdayOfISODate,
} from './utils.ts';

export type { EventParseResult, ParseOptions, EventFields, EventParseMeta, FieldSpan, DebugStep, ParseWarning } from './types.ts';

const PIPELINE = [recurrencePass, alertsPass, durationPass, locationPass, attendeesPass, chronoPass, titlePass];
const WEEKDAY_TOKEN =
  '(mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:r|rs|rsday|ursday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)';
const WEEKDAY_REGEX = new RegExp(`\\b${WEEKDAY_TOKEN}\\b`, 'gi');
const EXPLICIT_DATE_REGEXES = [
  /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?\b/gi,
  /\b\d{4}-\d{2}-\d{2}\b/g,
  /\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/g,
];
const RECURRENCE_ANCHOR_REGEX =
  /\b(?:starting|from)\s+(.+?)(?=(?:\s+\b(?:until|till|through|ending|except|remind|alert|with|every|for|at|on|from|to)\b|[,.;]|$))/i;

const addMinutesToIsoTime = (time: string, minutesToAdd: number): string | null => {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) {
    return null;
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
    return null;
  }

  const total = hour * 60 + minute + minutesToAdd;
  const wrapped = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const nextHour = Math.floor(wrapped / 60);
  const nextMinute = wrapped % 60;
  return `${String(nextHour).padStart(2, '0')}:${String(nextMinute).padStart(2, '0')}`;
};

const findWeekdaySpans = (input: string): Array<{ start: number; end: number; text: string; weekday: string }> => {
  const spans: Array<{ start: number; end: number; text: string; weekday: string }> = [];
  WEEKDAY_REGEX.lastIndex = 0;
  for (const match of input.matchAll(WEEKDAY_REGEX)) {
    const text = match[0] || '';
    const start = match.index ?? -1;
    const end = start + text.length;
    const weekday = normalizeWeekdayToken(text);
    if (start < 0 || !weekday) {
      continue;
    }
    spans.push({ start, end, text, weekday });
  }
  return spans;
};

const findExplicitDateTokenSpans = (input: string): Array<{ start: number; end: number; text: string }> => {
  const spans: Array<{ start: number; end: number; text: string }> = [];

  for (const regex of EXPLICIT_DATE_REGEXES) {
    regex.lastIndex = 0;
    for (const match of input.matchAll(regex)) {
      const text = match[0] || '';
      const start = match.index ?? -1;
      if (start < 0 || !text) {
        continue;
      }
      spans.push({ start, end: start + text.length, text });
    }
  }

  return spans;
};

const extractRecurrenceAnchor = (
  input: string,
  now: Date,
  timezone: string,
): { dateISO: string; start: number; end: number; text: string; anchorStart: number; anchorEnd: number } | null => {
  const anchorMatch = RECURRENCE_ANCHOR_REGEX.exec(input);
  if (!anchorMatch) {
    return null;
  }

  const snippet = anchorMatch[1] || '';
  if (!snippet.trim()) {
    return null;
  }

  const snippetBase = anchorMatch.index + anchorMatch[0].indexOf(snippet);
  const parsed = chrono.parse(snippet, now, { forwardDate: true });
  if (parsed.length === 0) {
    return null;
  }

  for (const entry of parsed) {
    const year = entry.start.get('year');
    const month = entry.start.get('month');
    const day = entry.start.get('day');
    const dateISO =
      typeof year === 'number' && typeof month === 'number' && typeof day === 'number'
        ? `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        : formatDateInTimezone(entry.start.date(), timezone);

    if (!dateISO) {
      continue;
    }

    const start = snippetBase + entry.index;
    const end = start + entry.text.length;
    return {
      dateISO,
      start,
      end,
      text: input.slice(start, end),
      anchorStart: anchorMatch.index,
      anchorEnd: anchorMatch.index + anchorMatch[0].length,
    };
  }

  return null;
};

const findRecurrenceWeekdayHintSpan = (
  rawInput: string,
  recurrenceSpans: EventParseResult['meta']['spans']['recurrence'],
): { start: number; end: number; text: string } | null => {
  for (const span of recurrenceSpans) {
    WEEKDAY_REGEX.lastIndex = 0;
    if (!WEEKDAY_REGEX.test(span.text)) {
      continue;
    }
    return { start: span.start, end: span.end, text: span.text };
  }

  const weekdaySpan = findWeekdaySpans(rawInput)[0];
  if (!weekdaySpan) {
    return null;
  }
  return { start: weekdaySpan.start, end: weekdaySpan.end, text: weekdaySpan.text };
};

export const parseEventInput = (input: string, opts?: ParseOptions): EventParseResult => {
  const ctx = createParseContext(input, opts);

  for (const pass of PIPELINE) {
    pass(ctx);
  }

  if (ctx.result.fields.recurrence.frequency && ctx.result.fields.recurrence.exceptions === null) {
    if (
      /\bstarting\b/i.test(ctx.rawInput) &&
      /\b(?:every|daily|monthly|yearly|annually|biweekly|fortnight)\b/i.test(ctx.rawInput)
    ) {
      ctx.result.fields.recurrence.exceptions = [];
    }
  }

  if (
    ctx.result.fields.recurrence.frequency === 'weekly' &&
    ctx.result.fields.recurrence.days === null &&
    ctx.result.fields.date &&
    /\bstarting\b/i.test(ctx.rawInput)
  ) {
    const weekdayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const weekdayIndex = weekdayFromIsoDate(ctx.result.fields.date);
    if (weekdayIndex !== null) {
      ctx.result.fields.recurrence.days = [weekdayNames[weekdayIndex]];
    }
  }

  if (ctx.result.fields.time && ctx.result.fields.end_time === null && ctx.result.fields.duration_minutes === null) {
    const endTime = addMinutesToIsoTime(ctx.result.fields.time, 60);
    if (endTime) {
      ctx.result.fields.end_time = endTime;
      ctx.result.fields.duration_minutes = 60;
      ctx.result.meta.confidence.end_time = Math.max(ctx.result.meta.confidence.end_time, 0.68);
      ctx.result.meta.confidence.duration_minutes = Math.max(ctx.result.meta.confidence.duration_minutes, 0.66);
      ctx.result.meta.debugSteps.push({
        pass: 'postprocess',
        ruleId: 'postprocess.default_end_time',
        start: 0,
        end: ctx.rawInput.length,
        text: ctx.result.fields.time,
        confidence: 0.68,
        note: 'defaulted end time to +60 minutes because no explicit end time was provided',
      });
    }
  }

  const warnings: ParseWarning[] = [];
  const recurrence = ctx.result.fields.recurrence;
  const recurrenceActive = Boolean(recurrence.frequency);
  const recurrenceAnchor = extractRecurrenceAnchor(ctx.rawInput, ctx.now, ctx.options.timezone);

  const dateSpanOverlapsAnchor = recurrenceAnchor
    ? ctx.result.meta.spans.date.some(
        (span) => span.start < recurrenceAnchor.anchorEnd && span.end > recurrenceAnchor.anchorStart,
      )
    : false;

  if (recurrenceActive && recurrenceAnchor && (ctx.result.fields.date === recurrenceAnchor.dateISO || dateSpanOverlapsAnchor)) {
    ctx.result.fields.date = null;
    ctx.result.meta.confidence.date = 0;
    ctx.result.meta.debugSteps.push({
      pass: 'postprocess',
      ruleId: 'postprocess.recurrence_anchor_date_suppressed',
      start: recurrenceAnchor.start,
      end: recurrenceAnchor.end,
      text: recurrenceAnchor.text,
      confidence: 0.82,
      note: 'suppressed one-off date because starting/from date acts as recurrence anchor',
    });
  }

  if (recurrenceActive && recurrenceAnchor && recurrence.days && recurrence.days.length > 0) {
    const anchorWeekday = weekdayOfISODate(recurrenceAnchor.dateISO, ctx.options.timezone);
    if (anchorWeekday && !recurrence.days.includes(anchorWeekday)) {
      const recurrenceSpan = findRecurrenceWeekdayHintSpan(ctx.rawInput, ctx.result.meta.spans.recurrence);
      const spanPayload = recurrenceSpan
        ? [
            { start: recurrenceAnchor.start, end: recurrenceAnchor.end, text: recurrenceAnchor.text },
            recurrenceSpan,
          ]
        : [{ start: recurrenceAnchor.start, end: recurrenceAnchor.end, text: recurrenceAnchor.text }];

      warnings.push({
        code: 'recurrence_start_weekday_mismatch',
        severity: 'warning',
        message: "Start date doesn't fall on the recurrence weekday; the series will begin on the next matching day.",
        fieldHints: ['recurrence'],
        spans: spanPayload,
        details: {
          anchorDateISO: recurrenceAnchor.dateISO,
          anchorWeekday,
          recurrenceDays: recurrence.days,
          policy: 'snap_forward_no_backwards',
        },
      });
    }
  }

  if (!recurrenceActive && ctx.result.fields.date) {
    const explicitDateSpans = findExplicitDateTokenSpans(ctx.rawInput);
    if (explicitDateSpans.length > 0) {
      const weekdaySpans = findWeekdaySpans(ctx.rawInput);
      const computedWeekday = weekdayOfISODate(ctx.result.fields.date, ctx.options.timezone);
      if (weekdaySpans.length > 0 && computedWeekday) {
        const mismatches = weekdaySpans.filter((entry) => entry.weekday !== computedWeekday);
        if (mismatches.length > 0) {
          warnings.push({
            code: 'weekday_date_conflict',
            severity: 'warning',
            message: "Weekday doesn't match the given date.",
            fieldHints: ['date'],
            spans: mismatches.map((entry) => ({
              start: entry.start,
              end: entry.end,
              text: entry.text,
            })),
            details: {
              dateISO: ctx.result.fields.date,
              weekdayText: mismatches[0].text,
              computedWeekday,
              policy: 'date_wins',
            },
          });
        }
      }
    }
  }

  ctx.result.meta.maskedInput = ctx.maskedInput;
  ctx.result.warnings = warnings.length > 0 ? warnings : null;
  return ctx.result;
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
    fields.attendees * 0.6,
  ];

  const sum = weighted.reduce((total, value) => total + value, 0);
  const max = 6.8;
  return Math.max(0, Math.min(1, sum / max));
};

export const shouldFallbackToPlainSearch = (result: EventParseResult): boolean => {
  if (!hasStructuredFields(result)) {
    return true;
  }
  return getStructuredParseConfidence(result) < 0.35;
};
