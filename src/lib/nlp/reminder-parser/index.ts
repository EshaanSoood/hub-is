import type { RecurrenceInfo, ReminderParseResult } from './types';

export type { ReminderParseResult, RecurrenceInfo };

const FILLER_PREFIXES = [
  /^remind me (to|about|that)\s+/i,
  /^remind me\s+/i,
  /^don'?t forget (to|about)\s+/i,
  /^remember (to|about)\s+/i,
  /^set (a )?reminder (to|for|about)\s+/i,
  /^alert me (to|about|when)\s+/i,
] as const;

const DAY_NAMES: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const NAMED_TIMES: Record<string, [number, number]> = {
  morning: [8, 0],
  afternoon: [13, 0],
  evening: [18, 0],
  tonight: [20, 0],
  noon: [12, 0],
  midnight: [0, 0],
  night: [20, 0],
};

const addMinutes = (date: Date, minutes: number): Date => {
  const result = new Date(date);
  result.setMinutes(result.getMinutes() + minutes);
  return result;
};

const addHours = (date: Date, hours: number): Date => {
  const result = new Date(date);
  result.setHours(result.getHours() + hours);
  return result;
};

const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const setTime = (date: Date, hour: number, minute: number): Date => {
  const result = new Date(date);
  result.setHours(hour, minute, 0, 0);
  return result;
};

const stripMatched = (input: string, matched: string): string =>
  input.replace(matched, ' ').replace(/\s{2,}/g, ' ').trim();

const nextWeekday = (from: Date, targetDay: number, includeToday = false): Date => {
  const result = new Date(from);
  const current = result.getDay();
  let daysAhead = targetDay - current;
  if (daysAhead < 0 || (daysAhead === 0 && !includeToday)) {
    daysAhead += 7;
  }
  result.setDate(result.getDate() + daysAhead);
  return result;
};

const capitalizeFirst = (value: string): string =>
  value.length > 0 ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : value;

const formatHint = (date: Date): string => {
  const now = new Date();
  const tomorrow = addDays(now, 1);
  const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  if (date.toDateString() === now.toDateString()) {
    return `Today at ${timeStr}`;
  }
  if (date.toDateString() === tomorrow.toDateString()) {
    return `Tomorrow at ${timeStr}`;
  }
  const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${dayName}, ${dateStr} at ${timeStr}`;
};

const formatRecurrenceLabel = (recurrence: RecurrenceInfo, weekdayHint: string | null): string => {
  const singularUnit =
    recurrence.frequency === 'daily'
      ? 'day'
      : recurrence.frequency === 'weekly'
        ? 'week'
        : recurrence.frequency === 'monthly'
          ? 'month'
          : 'year';

  if (recurrence.interval && recurrence.interval > 1) {
    return `Every ${recurrence.interval} ${singularUnit}s`;
  }
  if (weekdayHint && recurrence.frequency === 'weekly') {
    return `Every week on ${capitalizeFirst(weekdayHint)}`;
  }
  return `Every ${singularUnit}`;
};

const parseRecurrence = (input: string): {
  recurrence: RecurrenceInfo | null;
  weekdayHint: string | null;
  nextInput: string;
} => {
  let working = input;
  let recurrence: RecurrenceInfo | null = null;
  let weekdayHint: string | null = null;

  const intervalPatterns: Array<{ pattern: RegExp; frequency: RecurrenceInfo['frequency'] }> = [
    { pattern: /\bevery\s+(\d+)\s+days?\b/i, frequency: 'daily' },
    { pattern: /\bevery\s+(\d+)\s+weeks?\b/i, frequency: 'weekly' },
    { pattern: /\bevery\s+(\d+)\s+months?\b/i, frequency: 'monthly' },
    { pattern: /\bevery\s+(\d+)\s+years?\b/i, frequency: 'yearly' },
  ];

  for (const entry of intervalPatterns) {
    const match = working.match(entry.pattern);
    if (!match) {
      continue;
    }
    recurrence = { frequency: entry.frequency, interval: Number.parseInt(match[1], 10) };
    working = stripMatched(working, match[0]);
    return { recurrence, weekdayHint, nextInput: working };
  }

  const weekdayMatch = working.match(/\bevery\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);
  if (weekdayMatch) {
    recurrence = { frequency: 'weekly' };
    weekdayHint = weekdayMatch[1].toLowerCase();
    working = stripMatched(working, weekdayMatch[0]);
    return { recurrence, weekdayHint, nextInput: working };
  }

  const simplePatterns: Array<{ pattern: RegExp; recurrence: RecurrenceInfo }> = [
    { pattern: /\b(?:every\s+day|daily)\b/i, recurrence: { frequency: 'daily' } },
    { pattern: /\b(?:every\s+week|weekly)\b/i, recurrence: { frequency: 'weekly' } },
    { pattern: /\b(?:every\s+month|monthly)\b/i, recurrence: { frequency: 'monthly' } },
    { pattern: /\b(?:every\s+year|yearly|annually)\b/i, recurrence: { frequency: 'yearly' } },
  ];

  for (const entry of simplePatterns) {
    const match = working.match(entry.pattern);
    if (!match) {
      continue;
    }
    recurrence = entry.recurrence;
    working = stripMatched(working, match[0]);
    break;
  }

  return { recurrence, weekdayHint, nextInput: working };
};

const parseRelativeReminder = (input: string, now: Date): { remindAt: Date | null; nextInput: string } => {
  const match = input.match(/\bin\s+(\d+)\s+(minute|hour|day)s?\b/i);
  if (!match) {
    return { remindAt: null, nextInput: input };
  }

  const amount = Number.parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const remindAt =
    unit === 'minute'
      ? addMinutes(now, amount)
      : unit === 'hour'
        ? addHours(now, amount)
        : setTime(addDays(now, amount), 8, 0);

  return {
    remindAt,
    nextInput: stripMatched(input, match[0]),
  };
};

const parseAbsoluteTime = (input: string): {
  time: { hour: number; minute: number } | null;
  nextInput: string;
} => {
  const match = input.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i)
    || input.match(/\b(\d{1,2}):(\d{2})\b/);
  if (!match) {
    return { time: null, nextInput: input };
  }

  let hour = Number.parseInt(match[1], 10);
  const minute = match[2] ? Number.parseInt(match[2], 10) : 0;
  const meridiem = match[3]?.toLowerCase() ?? null;

  if (meridiem === 'pm' && hour < 12) {
    hour += 12;
  }
  if (meridiem === 'am' && hour === 12) {
    hour = 0;
  }
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour > 23 || minute > 59) {
    return { time: null, nextInput: input };
  }

  return {
    time: { hour, minute },
    nextInput: stripMatched(input, match[0]),
  };
};

const parseNamedTime = (input: string): {
  time: { hour: number; minute: number } | null;
  label: string | null;
  nextInput: string;
} => {
  for (const [name, [hour, minute]] of Object.entries(NAMED_TIMES)) {
    const pattern = new RegExp(`\\b${name}\\b`, 'i');
    const match = input.match(pattern);
    if (!match) {
      continue;
    }
    return {
      time: { hour, minute },
      label: name,
      nextInput: stripMatched(input, match[0]),
    };
  }
  return { time: null, label: null, nextInput: input };
};

const parseDayReference = (input: string, now: Date): {
  baseDate: Date | null;
  label: string | null;
  nextInput: string;
} => {
  const patterns: Array<{ pattern: RegExp; resolve: (match: RegExpMatchArray) => { date: Date; label: string } }> = [
    {
      pattern: /\bthis\s+weekend\b/i,
      resolve: () => ({ date: setTime(nextWeekday(now, 6, now.getDay() === 6), 9, 0), label: 'This weekend' }),
    },
    {
      pattern: /\bnext\s+week\b/i,
      resolve: () => ({ date: setTime(addDays(now, 7), 8, 0), label: 'Next week' }),
    },
    {
      pattern: /\btoday\b/i,
      resolve: () => ({ date: new Date(now), label: 'Today' }),
    },
    {
      pattern: /\btomorrow\b/i,
      resolve: () => ({ date: addDays(now, 1), label: 'Tomorrow' }),
    },
    {
      pattern: /\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
      resolve: (match) => {
        const weekday = match[1].toLowerCase();
        return { date: nextWeekday(addDays(now, 1), DAY_NAMES[weekday] ?? now.getDay()), label: `Next ${capitalizeFirst(weekday)}` };
      },
    },
    {
      pattern: /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
      resolve: (match) => {
        const weekday = match[1].toLowerCase();
        return { date: nextWeekday(now, DAY_NAMES[weekday] ?? now.getDay()), label: capitalizeFirst(weekday) };
      },
    },
  ];

  for (const entry of patterns) {
    const match = input.match(entry.pattern);
    if (!match) {
      continue;
    }
    const resolved = entry.resolve(match);
    return {
      baseDate: resolved.date,
      label: resolved.label,
      nextInput: stripMatched(input, match[0]),
    };
  }

  return { baseDate: null, label: null, nextInput: input };
};

const buildReminderDate = (
  baseDate: Date | null,
  time: { hour: number; minute: number } | null,
  now: Date,
): Date | null => {
  if (!baseDate && !time) {
    return null;
  }

  if (baseDate && time) {
    return setTime(baseDate, time.hour, time.minute);
  }
  if (baseDate) {
    return baseDate;
  }
  const candidate = setTime(now, time?.hour ?? 8, time?.minute ?? 0);
  return candidate > now ? candidate : setTime(addDays(now, 1), time?.hour ?? 8, time?.minute ?? 0);
};

const cleanupTitle = (input: string): string =>
  capitalizeFirst(
    input
      .replace(/\b(?:to|about|that|on|at|in|next|this)\b/gi, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim(),
  );

export const parseReminderInput = (raw: string, now: Date = new Date()): ReminderParseResult => {
  let working = raw.trim();
  for (const pattern of FILLER_PREFIXES) {
    working = working.replace(pattern, '');
  }

  const { recurrence, weekdayHint, nextInput: withoutRecurrence } = parseRecurrence(working);
  working = withoutRecurrence;

  const { remindAt: relativeRemindAt, nextInput: withoutRelative } = parseRelativeReminder(working, now);
  working = withoutRelative;

  let remindAt: Date | null = relativeRemindAt;
  let dayLabel: string | null = null;
  let namedTimeLabel: string | null = null;

  if (!remindAt) {
    const { baseDate, label, nextInput: withoutDay } = parseDayReference(working, now);
    working = withoutDay;
    dayLabel = label;

    const absoluteTime = parseAbsoluteTime(working);
    let parsedTime = absoluteTime.time;
    if (parsedTime) {
      working = absoluteTime.nextInput;
    } else {
      const namedTime = parseNamedTime(working);
      parsedTime = namedTime.time;
      namedTimeLabel = namedTime.label;
      working = namedTime.nextInput;
    }

    remindAt = buildReminderDate(baseDate, parsedTime, now);
  }

  let contextHint: string | null = remindAt ? formatHint(remindAt) : null;
  if (dayLabel && namedTimeLabel && remindAt) {
    contextHint = `${dayLabel} ${namedTimeLabel}`;
  }
  if (recurrence) {
    const recurrenceLabel = formatRecurrenceLabel(recurrence, weekdayHint);
    contextHint = contextHint ? `${recurrenceLabel} — next: ${contextHint}` : recurrenceLabel;
  }

  const title = cleanupTitle(working) || capitalizeFirst(raw.trim());

  return {
    title,
    remind_at: remindAt ? remindAt.toISOString() : null,
    recurrence,
    context_hint: contextHint,
  };
};
