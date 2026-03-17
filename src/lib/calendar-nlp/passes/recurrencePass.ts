import * as chrono from 'chrono-node';
import { WEEKDAY_LIST_PATTERN } from '../constants.ts';
import type { ParseContext, RecurrenceFrequency } from '../types.ts';
import {
  addDebugStep,
  addFieldSpan,
  isSpanAvailable,
  maskMatch,
  normalizeWeekdayList,
  parseNumberToken,
  setFieldConfidence,
  toIsoDate,
} from '../utils.ts';

interface RecurrenceRule {
  id: string;
  regex: RegExp;
  confidence: number;
  frequency: RecurrenceFrequency;
  interval?: number;
  intervalGroup?: number;
  daysGroup?: number;
  days?: string[];
  note: string;
}

const DAY = WEEKDAY_LIST_PATTERN;
const DAY_LIST = `${DAY}(?:\\s*(?:,|and)\\s*${DAY})*`;
const COUNT = '(\\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)';
const RECURRENCE_SIGNAL_REGEX =
  /\b(?:every|daily|weekly|monthly|yearly|annually|bi-?weekly|fortnight|weekdays|weekends|every\s+other)\b/i;

const RECURRENCE_RULES: RecurrenceRule[] = [
  {
    id: 'recurrence.every_n_weeks_on_days',
    regex: new RegExp(`\\bevery\\s+${COUNT}\\s+weeks?\\s+on\\s+(${DAY_LIST})\\b`, 'gi'),
    confidence: 0.93,
    frequency: 'weekly',
    intervalGroup: 1,
    daysGroup: 2,
    note: 'numeric weekly recurrence with explicit days',
  },
  {
    id: 'recurrence.every_n_months_on_nth_weekday',
    regex: new RegExp(
      `\\bevery\\s+${COUNT}\\s+months?\\s+on\\s+the\\s+(?:first|1st|second|2nd|third|3rd|fourth|4th|last)\\s+(${DAY})\\b`,
      'gi',
    ),
    confidence: 0.86,
    frequency: 'monthly',
    intervalGroup: 1,
    daysGroup: 2,
    note: 'monthly nth-weekday recurrence with interval',
  },
  {
    id: 'recurrence.every_month_on_nth_weekday',
    regex: new RegExp(
      `\\bevery\\s+month\\s+on\\s+the\\s+(?:first|1st|second|2nd|third|3rd|fourth|4th|last)\\s+(${DAY})\\b`,
      'gi',
    ),
    confidence: 0.85,
    frequency: 'monthly',
    interval: 1,
    daysGroup: 1,
    note: 'monthly nth-weekday recurrence',
  },
  {
    id: 'recurrence.every_other_weekday',
    regex: new RegExp(`\\bevery\\s+other\\s+(${DAY})\\b`, 'gi'),
    confidence: 0.9,
    frequency: 'weekly',
    interval: 2,
    daysGroup: 1,
    note: 'every other specific weekday',
  },
  {
    id: 'recurrence.every_week_on_days',
    regex: new RegExp(`\\bevery\\s+week\\s+on\\s+(${DAY_LIST})\\b`, 'gi'),
    confidence: 0.94,
    frequency: 'weekly',
    interval: 1,
    daysGroup: 1,
    note: 'weekly recurrence with day list',
  },
  {
    id: 'recurrence.weekly_on_days',
    regex: new RegExp(`\\bweekly\\s+on\\s+(${DAY_LIST})\\b`, 'gi'),
    confidence: 0.94,
    frequency: 'weekly',
    interval: 1,
    daysGroup: 1,
    note: 'weekly on <days>',
  },
  {
    id: 'recurrence.on_days_weekly',
    regex: new RegExp(`\\bon\\s+(${DAY_LIST})\\s+weekly\\b`, 'gi'),
    confidence: 0.9,
    frequency: 'weekly',
    interval: 1,
    daysGroup: 1,
    note: 'on <days> weekly',
  },
  {
    id: 'recurrence.every_weekday',
    regex: /\bevery\s+weekday\b/gi,
    confidence: 0.93,
    frequency: 'weekly',
    interval: 1,
    days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    note: 'weekday recurrence phrase',
  },
  {
    id: 'recurrence.weekdays',
    regex: /\bweekdays\b/gi,
    confidence: 0.83,
    frequency: 'weekly',
    interval: 1,
    days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    note: 'weekdays shorthand',
  },
  {
    id: 'recurrence.every_weekend',
    regex: /\bevery\s+weekend\b/gi,
    confidence: 0.83,
    frequency: 'weekly',
    interval: 1,
    days: ['saturday', 'sunday'],
    note: 'weekend recurrence phrase',
  },
  {
    id: 'recurrence.weekends',
    regex: /\bweekends\b/gi,
    confidence: 0.75,
    frequency: 'weekly',
    interval: 1,
    days: ['saturday', 'sunday'],
    note: 'weekends shorthand',
  },
  {
    id: 'recurrence.every_other_day',
    regex: /\bevery\s+other\s+day\b/gi,
    confidence: 0.92,
    frequency: 'daily',
    interval: 2,
    note: 'every other day recurrence',
  },
  {
    id: 'recurrence.every_single_day',
    regex: /\bevery\s+single\s+day\b/gi,
    confidence: 0.88,
    frequency: 'daily',
    interval: 1,
    note: 'explicit every single day phrase',
  },
  {
    id: 'recurrence.every_day',
    regex: /\bevery\s+day\b/gi,
    confidence: 0.95,
    frequency: 'daily',
    interval: 1,
    note: 'every day phrase',
  },
  {
    id: 'recurrence.each_day',
    regex: /\beach\s+day\b/gi,
    confidence: 0.86,
    frequency: 'daily',
    interval: 1,
    note: 'each day phrase',
  },
  {
    id: 'recurrence.daily',
    regex: /\bdaily\b/gi,
    confidence: 0.95,
    frequency: 'daily',
    interval: 1,
    note: 'daily keyword',
  },
  {
    id: 'recurrence.every_other_week',
    regex: /\bevery\s+other\s+week\b/gi,
    confidence: 0.9,
    frequency: 'weekly',
    interval: 2,
    note: 'every other week phrase',
  },
  {
    id: 'recurrence.biweekly',
    regex: /\bbi-?weekly\b/gi,
    confidence: 0.9,
    frequency: 'weekly',
    interval: 2,
    note: 'biweekly keyword',
  },
  {
    id: 'recurrence.fortnight',
    regex: /\bevery\s+fortnight\b/gi,
    confidence: 0.87,
    frequency: 'weekly',
    interval: 2,
    note: 'fortnight recurrence',
  },
  {
    id: 'recurrence.every_week',
    regex: /\bevery\s+week\b/gi,
    confidence: 0.91,
    frequency: 'weekly',
    interval: 1,
    note: 'every week phrase',
  },
  {
    id: 'recurrence.each_week',
    regex: /\beach\s+week\b/gi,
    confidence: 0.83,
    frequency: 'weekly',
    interval: 1,
    note: 'each week phrase',
  },
  {
    id: 'recurrence.weekly',
    regex: /\bweekly\b/gi,
    confidence: 0.9,
    frequency: 'weekly',
    interval: 1,
    note: 'weekly keyword',
  },
  {
    id: 'recurrence.every_n_days',
    regex: new RegExp(`\\bevery\\s+${COUNT}\\s+days?\\b`, 'gi'),
    confidence: 0.92,
    frequency: 'daily',
    intervalGroup: 1,
    note: 'numeric day interval',
  },
  {
    id: 'recurrence.every_n_months_on_days',
    regex: new RegExp(`\\bevery\\s+${COUNT}\\s+months?\\s+on\\s+(${DAY_LIST})\\b`, 'gi'),
    confidence: 0.9,
    frequency: 'monthly',
    intervalGroup: 1,
    daysGroup: 2,
    note: 'numeric monthly recurrence with explicit day list',
  },
  {
    id: 'recurrence.every_n_weeks',
    regex: new RegExp(`\\bevery\\s+${COUNT}\\s+weeks?\\b`, 'gi'),
    confidence: 0.91,
    frequency: 'weekly',
    intervalGroup: 1,
    note: 'numeric week interval',
  },
  {
    id: 'recurrence.every_n_months',
    regex: new RegExp(`\\bevery\\s+${COUNT}\\s+months?\\b`, 'gi'),
    confidence: 0.91,
    frequency: 'monthly',
    intervalGroup: 1,
    note: 'numeric month interval',
  },
  {
    id: 'recurrence.every_n_years',
    regex: new RegExp(`\\bevery\\s+${COUNT}\\s+years?\\b`, 'gi'),
    confidence: 0.91,
    frequency: 'yearly',
    intervalGroup: 1,
    note: 'numeric year interval',
  },
  {
    id: 'recurrence.every_weekday_name',
    regex: new RegExp(`\\bevery\\s+(${DAY})\\b`, 'gi'),
    confidence: 0.88,
    frequency: 'weekly',
    interval: 1,
    daysGroup: 1,
    note: 'every <weekday> recurrence',
  },
  {
    id: 'recurrence.twice_a_week',
    regex: /\btwice\s+a\s+week\b/gi,
    confidence: 0.62,
    frequency: 'weekly',
    interval: 1,
    note: 'ambiguous twice a week fallback',
  },
  {
    id: 'recurrence.twice_weekly',
    regex: /\btwice\s+weekly\b/gi,
    confidence: 0.62,
    frequency: 'weekly',
    interval: 1,
    note: 'ambiguous twice weekly fallback',
  },
  {
    id: 'recurrence.monthly_on_day_of_month',
    regex: /\b(?:every\s+month|monthly)\s+on\s+the\s+\d{1,2}(?:st|nd|rd|th)?\b/gi,
    confidence: 0.82,
    frequency: 'monthly',
    interval: 1,
    note: 'monthly recurrence anchored to day-of-month phrase',
  },
  {
    id: 'recurrence.every_month',
    regex: /\bevery\s+month\b/gi,
    confidence: 0.93,
    frequency: 'monthly',
    interval: 1,
    note: 'every month phrase',
  },
  {
    id: 'recurrence.each_month',
    regex: /\beach\s+month\b/gi,
    confidence: 0.82,
    frequency: 'monthly',
    interval: 1,
    note: 'each month phrase',
  },
  {
    id: 'recurrence.monthly',
    regex: /\bmonthly\b/gi,
    confidence: 0.93,
    frequency: 'monthly',
    interval: 1,
    note: 'monthly keyword',
  },
  {
    id: 'recurrence.every_year',
    regex: /\bevery\s+year\b/gi,
    confidence: 0.93,
    frequency: 'yearly',
    interval: 1,
    note: 'every year phrase',
  },
  {
    id: 'recurrence.yearly',
    regex: /\byearly\b/gi,
    confidence: 0.93,
    frequency: 'yearly',
    interval: 1,
    note: 'yearly keyword',
  },
  {
    id: 'recurrence.annually',
    regex: /\bannually\b/gi,
    confidence: 0.9,
    frequency: 'yearly',
    interval: 1,
    note: 'annually keyword',
  },
];

const extractIsoDateFromSnippet = (ctx: ParseContext, snippet: string): string | null => {
  const parsed = chrono.parse(snippet, ctx.now, { forwardDate: true })[0];
  if (!parsed) {
    return null;
  }

  const year = parsed.start.get('year');
  const month = parsed.start.get('month');
  const day = parsed.start.get('day');

  if (!year || !month || !day) {
    return null;
  }

  return toIsoDate(year, month, day);
};

const applyRecurrence = (
  ctx: ParseContext,
  payload: { frequency: RecurrenceFrequency; interval: number; days: string[] | null },
  start: number,
  end: number,
  text: string,
  ruleId: string,
  confidence: number,
  note: string,
): void => {
  const recurrence = ctx.result.fields.recurrence;
  const hadFrequency = recurrence.frequency;

  let resolvedConfidence = confidence;
  if (hadFrequency && hadFrequency !== payload.frequency) {
    resolvedConfidence = Math.max(0.35, confidence - 0.25);
  }

  recurrence.frequency = payload.frequency;
  recurrence.interval = payload.interval;
  recurrence.days = payload.days;

  addFieldSpan(ctx, 'recurrence', {
    start,
    end,
    text,
    ruleId,
    confidence: resolvedConfidence,
  });
  setFieldConfidence(ctx, 'recurrence', resolvedConfidence);
  addDebugStep(ctx, {
    pass: 'recurrence',
    ruleId,
    start,
    end,
    text,
    confidence: resolvedConfidence,
    note,
  });
  maskMatch(ctx, { start, end, text, ruleId, confidence: resolvedConfidence });
};

const runEndDateRule = (ctx: ParseContext): void => {
  if (!ctx.result.fields.recurrence.frequency && !RECURRENCE_SIGNAL_REGEX.test(ctx.rawInput)) {
    return;
  }

  const regex =
    /\b(?:until|till|through|ending)\s+(.+?)(?=(?:\s+\b(?:except|remind|alert|with|every|for|at|on|from|to|starting|start)\b|[,.;]|$))/gi;
  const matches = Array.from(ctx.maskedInput.matchAll(regex));

  for (const match of matches) {
    const fullText = match[0];
    const start = match.index ?? -1;
    const end = start + fullText.length;
    if (!isSpanAvailable(ctx, start, end)) {
      continue;
    }

    const dateText = match[1] || '';
    const isoDate = extractIsoDateFromSnippet(ctx, dateText);
    if (!isoDate) {
      continue;
    }

    ctx.result.fields.recurrence.end_date = isoDate;
    addFieldSpan(ctx, 'recurrence', {
      start,
      end,
      text: fullText,
      ruleId: 'recurrence.end_date',
      confidence: 0.84,
    });
    setFieldConfidence(ctx, 'recurrence', 0.84);
    addDebugStep(ctx, {
      pass: 'recurrence',
      ruleId: 'recurrence.end_date',
      start,
      end,
      text: fullText,
      confidence: 0.84,
      note: 'detected recurrence end date from until/till/ending phrase',
    });
    maskMatch(ctx, { start, end, text: fullText, ruleId: 'recurrence.end_date', confidence: 0.84 });
  }
};

const runExceptionRule = (ctx: ParseContext): void => {
  if (!ctx.result.fields.recurrence.frequency && !RECURRENCE_SIGNAL_REGEX.test(ctx.rawInput)) {
    return;
  }

  const regex =
    /\bexcept\s+(.+?)(?=(?:\s+\b(?:until|ending|remind|alert|with|every|for|at|on|from|to|starting|start)\b|[,.;]|$))/gi;
  const matches = Array.from(ctx.maskedInput.matchAll(regex));

  for (const match of matches) {
    const fullText = match[0];
    const start = match.index ?? -1;
    const end = start + fullText.length;
    if (!isSpanAvailable(ctx, start, end)) {
      continue;
    }

    const snippets = chrono.parse(match[1] || '', ctx.now, { forwardDate: true });
    const dates: string[] = [];
    for (const snippet of snippets) {
      const year = snippet.start.get('year');
      const month = snippet.start.get('month');
      const day = snippet.start.get('day');
      if (year && month && day) {
        const iso = toIsoDate(year, month, day);
        if (!dates.includes(iso)) {
          dates.push(iso);
        }
      }
    }

    if (dates.length === 0) {
      continue;
    }

    const mergedDates = Array.from(new Set([...(ctx.result.fields.recurrence.exceptions ?? []), ...dates])).sort();
    ctx.result.fields.recurrence.exceptions = mergedDates;
    addFieldSpan(ctx, 'recurrence', {
      start,
      end,
      text: fullText,
      ruleId: 'recurrence.exceptions',
      confidence: 0.6,
    });
    setFieldConfidence(ctx, 'recurrence', 0.6);
    addDebugStep(ctx, {
      pass: 'recurrence',
      ruleId: 'recurrence.exceptions',
      start,
      end,
      text: fullText,
      confidence: 0.6,
      note: 'detected recurrence exception dates',
    });
    maskMatch(ctx, { start, end, text: fullText, ruleId: 'recurrence.exceptions', confidence: 0.6 });
  }
};

const runRecurrenceRules = (ctx: ParseContext): void => {
  for (const rule of RECURRENCE_RULES) {
    const matches = Array.from(ctx.maskedInput.matchAll(rule.regex));

    for (const match of matches) {
      const fullText = match[0];
      const start = match.index ?? -1;
      const end = start + fullText.length;

      if (!isSpanAvailable(ctx, start, end)) {
        continue;
      }

      const intervalToken =
        typeof rule.intervalGroup === 'number' && typeof match[rule.intervalGroup] === 'string'
          ? match[rule.intervalGroup]
          : null;
      const intervalFromToken = intervalToken ? parseNumberToken(intervalToken) : null;
      const interval = rule.interval ?? (intervalFromToken && intervalFromToken > 0 ? Math.round(intervalFromToken) : null);

      if (!interval || interval <= 0) {
        continue;
      }

      const daysFromGroup =
        typeof rule.daysGroup === 'number' && typeof match[rule.daysGroup] === 'string'
          ? normalizeWeekdayList(match[rule.daysGroup])
          : null;
      const resolvedDays = rule.days || daysFromGroup || null;

      applyRecurrence(
        ctx,
        {
          frequency: rule.frequency,
          interval,
          days: resolvedDays,
        },
        start,
        end,
        fullText,
        rule.id,
        rule.confidence,
        rule.note,
      );
    }
  }
};

const runWeeklyInlineOnDaysRule = (ctx: ParseContext): void => {
  if (!/\bweekly\b/i.test(ctx.rawInput)) {
    return;
  }

  const regex = new RegExp(`\\bon\\s+(${DAY_LIST})\\b`, 'gi');
  const matches = Array.from(ctx.maskedInput.matchAll(regex));

  for (const match of matches) {
    const fullText = match[0];
    const start = match.index ?? -1;
    const end = start + fullText.length;
    if (!isSpanAvailable(ctx, start, end)) {
      continue;
    }

    const days = normalizeWeekdayList(match[1] || '');
    if (!days || days.length === 0) {
      continue;
    }

    applyRecurrence(
      ctx,
      {
        frequency: 'weekly',
        interval: 1,
        days,
      },
      start,
      end,
      fullText,
      'recurrence.weekly_inline_on_days',
      0.9,
      'weekly phrase with explicit on <days> clause',
    );
  }
};

export const recurrencePass = (ctx: ParseContext): void => {
  runRecurrenceRules(ctx);
  runEndDateRule(ctx);
  runExceptionRule(ctx);
  runWeeklyInlineOnDaysRule(ctx);
};
