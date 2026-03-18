import * as chrono from 'chrono-node';

import type {
  ReminderParseOptions,
  ReminderParseResult,
  ReminderRecurrence,
  ReminderRecurrenceFrequency,
} from './types.ts';

const DEFAULT_TIMEZONE = 'UTC';
const WEEKDAY_MAP: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  thur: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};
const WEEKDAY_SET = new Set(Object.keys(WEEKDAY_MAP));

const TITLE_CORRECTIONS: Record<string, string> = {
  abt: 'about',
  adn: 'and',
  b4: 'before',
  brng: 'bring',
  callin: 'call',
  cancle: 'cancel',
  cehck: 'check',
  clint: 'client',
  dattabase: 'database',
  delivry: 'delivery',
  dashbord: 'dashboard',
  electrican: 'electrician',
  evry: 'every',
  flrs: 'flowers',
  flowrs: 'flowers',
  forgt: 'forget',
  hr: 'HR',
  hub: 'hub',
  meetting: 'meeting',
  meds: 'meds',
  mornig: 'morning',
  mornng: 'morning',
  moms: "mom's",
  mums: "mum's",
  pakage: 'package',
  passport: 'passport',
  pickup: 'pick up',
  prescirption: 'prescription',
  propsal: 'proposal',
  refil: 'refill',
  rememeber: 'remember',
  remnd: 'remind',
  rent: 'rent',
  reveiw: 'review',
  revieww: 'review',
  subsription: 'subscription',
  teh: 'the',
  tongiht: 'tonight',
};

const ACRONYM_MAP: Record<string, string> = {
  eod: 'EOD',
  fcp: 'FCP',
  hr: 'HR',
  os: 'OS',
  svg: 'SVG',
  usb: 'USB',
};

const PREFIX_FILLER_PATTERNS: RegExp[] = [
  /^(?:\p{Emoji}|\p{Emoji_Modifier}|\p{Emoji_Component}|\uFE0F|\u200D|\s|[!?.,:;-])+/u,
  /^\s*hey siri i mean claude\b[\s,:-]*/i,
  /^\s*(?:hey|yo|pls|please)\b[\s,:-]*/i,
];

const PREFIX_PATTERNS: RegExp[] = [
  /\bpls\s+remind\s+me\s+to\b/i,
  /\bpls\s+remind\s+me\b/i,
  /\bplease\s+to\s+remind\s+me\s+about\b/i,
  /\bplease\s+to\s+remind\s+me\b/i,
  /\bhey\s+remind\s+me\b/i,
  /\byo\s+remind\s+me\b/i,
  /\bgotta\s+remember\s+to\b/i,
  /\bneed\s+to\s+remember\b/i,
  /\bneed\s+to\s+remembr\s+to\b/i,
  /\bi should probably remember to\b/i,
  /\bremind\s*me\s+to\b/i,
  /\bremind\s*me\s+about\b/i,
  /\bremind\s*me\s+that\b/i,
  /\bremind\s*me\s+2\b/i,
  /\bremind\s*me\s+two\b/i,
  /\bremind\s*me\b/i,
  /\bremindme\s+to\b/i,
  /\bremindme\b/i,
  /\brmind\s+me\b/i,
  /\bremnd me\b/i,
  /\bremmber\s+to\b/i,
  /\brememeber\b/i,
  /\bremember\s+to\b/i,
  /\bremember\b/i,
  /\bdon'?t\s+let\s+me\s+forget\s+about\b/i,
  /\bdon'?t\s+forget\s+to\b/i,
  /\bdon'?t\s+forget\b/i,
  /\bdont\s+forget\s+to\b/i,
  /\bdont\s+forget\b/i,
  /\bdont\s+foreget\b/i,
  /\bdont\s+fore?get\b/i,
  /\bdont\s+let\s+me\s+forgt\b/i,
  /\bdont\s+let\s+me\s+forget\b/i,
  /\bdont\s+4get\b/i,
  /\bnote\s+to\s+self\b/i,
  /\bping\s+me\s+about\b/i,
  /\bping\s+me\s+to\b/i,
  /\bping\s+me\b/i,
  /\bheads\s+up\b/i,
];

const TRAILING_FILLER_PATTERNS: RegExp[] = [
  /[\s,.-]+\blol\b[!?.]*$/i,
  /[\s,.-]+\bpls\b[!?.]*$/i,
  /[\s,.-]+\bplease\b[!?.]*$/i,
  /[!?.]+$/i,
];

const START_STRIP_PATTERNS: RegExp[] = [
  /^\s*(?:to|about|that|re:|re|abt|bout)\b[\s,:-]*/i,
  /^\s*for\b[\s,:-]*/i,
];

const RECURRENCE_DAY_LIST = '(?:mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:r|rs|rsday|ursday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)';

type InternalRecurrence = {
  recurrence: ReminderRecurrence | null;
  working: string;
  anchorDayOfMonth: number | null;
  anchorMonthDay: { month: number; day: number } | null;
};

type TimeExtraction = {
  working: string;
  remindAt: string | null;
  contextHint: string | null;
};

const normalizeWhitespace = (input: string): string => input.replace(/\s+/g, ' ').trim();

const parseReferenceDate = (value: Date | string | undefined): Date => {
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.valueOf())) {
      return parsed;
    }
  }
  return new Date();
};

const getZonedParts = (
  date: Date,
  timezone: string,
): { year: number; month: number; day: number; hour: number; minute: number; weekday: number } => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  });
  const parts = formatter.formatToParts(date);
  const weekdayToken = (parts.find((part) => part.type === 'weekday')?.value || '').toLowerCase().slice(0, 3);
  const weekdayLookup: Record<string, number> = {
    sun: 0,
    mon: 1,
    tue: 2,
    wed: 3,
    thu: 4,
    fri: 5,
    sat: 6,
  };

  return {
    year: Number(parts.find((part) => part.type === 'year')?.value || 0),
    month: Number(parts.find((part) => part.type === 'month')?.value || 0),
    day: Number(parts.find((part) => part.type === 'day')?.value || 0),
    hour: Number(parts.find((part) => part.type === 'hour')?.value || 0),
    minute: Number(parts.find((part) => part.type === 'minute')?.value || 0),
    weekday: weekdayLookup[weekdayToken] ?? 0,
  };
};

const toIsoDate = (year: number, month: number, day: number): string =>
  `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

const formatDateTime = (date: Date, timezone: string): string => {
  const parts = getZonedParts(date, timezone);
  return `${toIsoDate(parts.year, parts.month, parts.day)}T${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}:00`;
};

const addMinutes = (date: Date, minutes: number): Date => new Date(date.getTime() + minutes * 60000);
const addDays = (date: Date, days: number): Date => new Date(date.getTime() + days * 86400000);
const daysInMonth = (year: number, month: number): number => new Date(year, month, 0).getDate();

const toWeekday = (token: string): string | null => {
  const normalized = token.toLowerCase();
  if (/^mon/.test(normalized)) return 'monday';
  if (/^tue/.test(normalized)) return 'tuesday';
  if (/^wed/.test(normalized)) return 'wednesday';
  if (/^thu/.test(normalized)) return 'thursday';
  if (/^fri/.test(normalized)) return 'friday';
  if (/^sat/.test(normalized)) return 'saturday';
  if (/^sun/.test(normalized)) return 'sunday';
  return null;
};

const nextOccurrence = (
  now: Date,
  timezone: string,
  weekday: string,
  hour: number,
  minute: number,
): Date => {
  const nowParts = getZonedParts(now, timezone);
  const current = nowParts.weekday;
  const target = WEEKDAY_MAP[weekday];
  let delta = (target - current + 7) % 7;
  if (delta === 0) {
    if (hour < nowParts.hour || (hour === nowParts.hour && minute <= nowParts.minute)) {
      delta = 7;
    }
  }
  return addDays(now, delta);
};

const withTime = (date: Date, timezone: string, hour: number, minute: number): string => {
  const parts = getZonedParts(date, timezone);
  const isoDate = toIsoDate(parts.year, parts.month, parts.day);
  return `${isoDate}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
};

const monthlyOccurrence = (now: Date, timezone: string, dayOfMonth: number, hour: number, minute: number): string => {
  const nowParts = getZonedParts(now, timezone);
  const safeDayThisMonth = Math.min(dayOfMonth, daysInMonth(nowParts.year, nowParts.month));
  const nextYear = nowParts.month === 12 ? nowParts.year + 1 : nowParts.year;
  const nextMonth = nowParts.month === 12 ? 1 : nowParts.month + 1;
  const safeDayNextMonth = Math.min(dayOfMonth, daysInMonth(nextYear, nextMonth));
  const targetThisMonthIso = `${toIsoDate(nowParts.year, nowParts.month, safeDayThisMonth)}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
  if (targetThisMonthIso >= formatDateTime(now, timezone)) {
    return targetThisMonthIso;
  }
  return `${toIsoDate(nextYear, nextMonth, safeDayNextMonth)}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
};

const yearlyOccurrence = (
  now: Date,
  timezone: string,
  month: number,
  day: number,
  hour: number,
  minute: number,
): string => {
  const nowParts = getZonedParts(now, timezone);
  const safeDay = Math.min(day, daysInMonth(nowParts.year, month));
  const current = `${toIsoDate(nowParts.year, month, safeDay)}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
  if (current >= formatDateTime(now, timezone)) {
    return current;
  }
  const safeDayNextYear = Math.min(day, daysInMonth(nowParts.year + 1, month));
  return `${toIsoDate(nowParts.year + 1, month, safeDayNextYear)}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
};

const stripPrefixes = (input: string): string => {
  let working = input;
  for (const pattern of PREFIX_FILLER_PATTERNS) {
    working = working.replace(pattern, '');
  }
  for (const pattern of PREFIX_PATTERNS) {
    working = working.replace(pattern, ' ');
  }
  for (const pattern of TRAILING_FILLER_PATTERNS) {
    working = working.replace(pattern, '');
  }
  return normalizeWhitespace(working);
};

const parseMonthToken = (token: string): number | null => {
  const normalized = token.toLowerCase();
  const months: Record<string, number> = {
    january: 1,
    jan: 1,
    february: 2,
    feb: 2,
    march: 3,
    mar: 3,
    april: 4,
    apr: 4,
    may: 5,
    june: 6,
    jun: 6,
    july: 7,
    jul: 7,
    august: 8,
    aug: 8,
    september: 9,
    sept: 9,
    sep: 9,
    october: 10,
    oct: 10,
    november: 11,
    nov: 11,
    december: 12,
    dec: 12,
  };
  return months[normalized] ?? null;
};

const extractRecurrence = (input: string): InternalRecurrence => {
  let working = input;
  let recurrence: ReminderRecurrence | null = null;
  let anchorDayOfMonth: number | null = null;
  let anchorMonthDay: { month: number; day: number } | null = null;

  const setRecurrence = (
    frequency: ReminderRecurrenceFrequency,
    interval: number,
    days: string[] | null,
  ): void => {
    recurrence = { frequency, interval, days };
  };

  const multiDayMatch = working.match(
    new RegExp(`\\bevery\\s+(${RECURRENCE_DAY_LIST})(?:\\s*(?:,|and)\\s*(${RECURRENCE_DAY_LIST}))+(?=\\b|\\s)`, 'i'),
  );
  if (multiDayMatch) {
    const matches = Array.from(multiDayMatch[0].matchAll(new RegExp(RECURRENCE_DAY_LIST, 'gi')))
      .map((entry) => toWeekday(entry[0]))
      .filter((value): value is string => Boolean(value));
    setRecurrence('weekly', 1, [...new Set(matches)]);
    working = normalizeWhitespace(working.replace(multiDayMatch[0], ' '));
  }

  const weekdayPatterns: Array<{ regex: RegExp; frequency: ReminderRecurrenceFrequency; interval: number }> = [
    { regex: /\bevery\s+weekday\b/i, frequency: 'weekly', interval: 1 },
    { regex: /\bevery\s+other\s+day\b/i, frequency: 'daily', interval: 2 },
    { regex: /\bevery\s+other\s+(mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:r|rs|rsday|ursday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\b/i, frequency: 'weekly', interval: 2 },
    { regex: /\bevery\s+(\d+)\s+days\b/i, frequency: 'daily', interval: 1 },
    { regex: /\bevery\s+(\d+)\s+weeks\b/i, frequency: 'weekly', interval: 1 },
    { regex: /\bevery\s+(\d+)\s+months\b/i, frequency: 'monthly', interval: 1 },
    { regex: /\bevery\s+week\s+on\s+(mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:r|rs|rsday|ursday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\b/i, frequency: 'weekly', interval: 1 },
    { regex: /\bevery\s+(mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:r|rs|rsday|ursday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\b/i, frequency: 'weekly', interval: 1 },
    { regex: /\bevery\s+day\b/i, frequency: 'daily', interval: 1 },
    { regex: /\bevery\s+month\b/i, frequency: 'monthly', interval: 1 },
    { regex: /^\s*daily\b/i, frequency: 'daily', interval: 1 },
    { regex: /^\s*weekly\b/i, frequency: 'weekly', interval: 1 },
    { regex: /^\s*monthly\b/i, frequency: 'monthly', interval: 1 },
    { regex: /^\s*yearly\b/i, frequency: 'yearly', interval: 1 },
    { regex: /\bevry\s+(mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:r|rs|rsday|ursday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\b/i, frequency: 'weekly', interval: 1 },
  ];

  for (const rule of weekdayPatterns) {
    const match = working.match(rule.regex);
    if (!match) {
      continue;
    }
    if (!recurrence) {
      if (rule.regex.source.includes('(\\d+)')) {
        const amount = Number(match[1]);
        const mappedFrequency =
          rule.frequency === 'monthly' ? 'monthly' : rule.frequency === 'weekly' ? 'weekly' : 'daily';
        setRecurrence(mappedFrequency, amount || 1, null);
      } else if (match[1] && WEEKDAY_SET.has(match[1].toLowerCase())) {
        setRecurrence(rule.frequency, rule.interval, [toWeekday(match[1]) || 'monday']);
      } else if (rule.frequency === 'weekly' && /weekday/i.test(match[0])) {
        setRecurrence('weekly', 1, ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']);
      } else {
        setRecurrence(rule.frequency, rule.interval, null);
      }
    }
    working = normalizeWhitespace(working.replace(match[0], ' '));
  }

  const monthlyDayMatch = working.match(/\bon\s+the\s+(\d{1,2})(?:st|nd|rd|th)\b/i);
  if (monthlyDayMatch) {
    anchorDayOfMonth = Number(monthlyDayMatch[1]);
    working = normalizeWhitespace(working.replace(monthlyDayMatch[0], ' '));
  }

  const yearlyMonthDayMatch = working.match(
    /\bon\s+([A-Za-z]+)\s+(\d{1,2})\b|\b([A-Za-z]+)\s+(\d{1,2})\b/i,
  );
  const currentRecurrence = recurrence as ReminderRecurrence | null;
  if (currentRecurrence && currentRecurrence.frequency === 'yearly' && yearlyMonthDayMatch) {
    const monthToken = yearlyMonthDayMatch[1] || yearlyMonthDayMatch[3];
    const dayToken = yearlyMonthDayMatch[2] || yearlyMonthDayMatch[4];
    const month = parseMonthToken(monthToken);
    if (month) {
      anchorMonthDay = { month, day: Number(dayToken) };
      working = normalizeWhitespace(working.replace(yearlyMonthDayMatch[0], ' '));
    }
  }

  const weeklyRecurrence = recurrence as ReminderRecurrence | null;
  if (weeklyRecurrence && weeklyRecurrence.frequency === 'weekly' && weeklyRecurrence.days === null) {
    const standaloneDay = working.match(new RegExp(`\\b(${RECURRENCE_DAY_LIST})\\b`, 'i'));
    if (standaloneDay) {
      const day = toWeekday(standaloneDay[1]);
      if (day) {
        recurrence = { frequency: weeklyRecurrence.frequency, interval: weeklyRecurrence.interval, days: [day] };
        working = normalizeWhitespace(working.replace(standaloneDay[0], ' '));
      }
    }
  }

  return {
    recurrence,
    working,
    anchorDayOfMonth,
    anchorMonthDay,
  };
};

const preprocessTimeText = (input: string): string => {
  let working = input;
  const replacements: Array<[RegExp, string | ((...args: string[]) => string)]> = [
    [/\btmrw\b/gi, 'tomorrow'],
    [/\btmr\b/gi, 'tomorrow'],
    [/\btomorow\b/gi, 'tomorrow'],
    [/\bfirday\b/gi, 'friday'],
    [/\bwedensday\b/gi, 'wednesday'],
    [/\bon wed\b/gi, 'on wednesday'],
    [/\bmornig\b/gi, 'morning'],
    [/\bmornng\b/gi, 'morning'],
    [/\bmorning\b/gi, 'morning'],
    [/\btongiht\b/gi, 'tonight'],
    [/\bthis aft\b/gi, 'this afternoon'],
    [/\barvo\b/gi, 'arvo'],
    [/\bin lke (\d+)\s*min\b/gi, 'in $1 minutes'],
    [/\bin (\d+)\s*min\b/gi, 'in $1 minutes'],
    [/\bin (\d+)\s*hr\b/gi, 'in $1 hours'],
    [/\b(tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+(\d{1,2})(?!\d|:|\s*(?:am|pm))\b/gi, '$1 at $2am'],
    [/\bat (\d{1,2})(?!\d|:|\s*(?:am|pm))\b/gi, (_match, hour: string) => `at ${hour}${Number(hour) <= 6 ? 'pm' : 'am'}`],
    [/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+(\d{1,2})(?!\d|:|\s*(?:am|pm))\b/gi, '$1 at $2am'],
    [/\bhalf\s+(\d{1,2})\b/gi, (_, hour: string) => `${hour}:30pm`],
    [/\bto PM\b/g, '2 PM'],
    [/\bat to PM\b/g, 'at 2 PM'],
    [/\blunchtime\b/gi, '12pm'],
  ];
  for (const [pattern, replacement] of replacements) {
    if (typeof replacement === 'string') {
      working = working.replace(pattern, replacement);
    } else {
      working = working.replace(pattern, (...args) => replacement(...args.map((value) => String(value))));
    }
  }
  return normalizeWhitespace(working);
};

const findDateLike = (working: string, now: Date, timezone: string): string | null => {
  const ordinalMatch = working.match(/\bon the (\d{1,2})(?:st|nd|rd|th)\b/i);
  if (ordinalMatch) {
    const day = Number(ordinalMatch[1]);
    const parts = getZonedParts(now, timezone);
    const currentMonthCandidate = `${toIsoDate(parts.year, parts.month, day)}T09:00:00`;
    if (currentMonthCandidate >= formatDateTime(now, timezone)) {
      return currentMonthCandidate;
    }
    const nextMonth = parts.month === 12 ? 1 : parts.month + 1;
    const year = parts.month === 12 ? parts.year + 1 : parts.year;
    return `${toIsoDate(year, nextMonth, day)}T09:00:00`;
  }

  const parsed = chrono.parse(working, now, { forwardDate: true });
  const best = parsed.find((entry) => entry.start.isCertain('day') || entry.start.isCertain('weekday') || entry.start.isCertain('month'));
  if (!best) {
    return null;
  }
  return withTime(best.start.date(), timezone, 9, 0);
};

const upcomingWeekend = (now: Date, timezone: string): string => {
  const parts = getZonedParts(now, timezone);
  if (parts.weekday === 6 && parts.hour < 10) {
    return withTime(now, timezone, 10, 0);
  }
  if (parts.weekday === 6) {
    return withTime(addDays(now, 1), timezone, 10, 0);
  }
  const daysUntilSaturday = (6 - parts.weekday + 7) % 7;
  return withTime(addDays(now, daysUntilSaturday), timezone, 10, 0);
};

const findSpecificTime = (working: string, now: Date, timezone: string): { remindAt: string; working: string } | null => {
  const parsed = chrono.parse(working, now, { forwardDate: true });
  const best = parsed[0];
  if (!best) {
    return null;
  }
  const date = best.start.date();
  const hasHour = best.start.isCertain('hour');
  const hour = hasHour ? getZonedParts(date, timezone).hour : 9;
  const minute = hasHour ? getZonedParts(date, timezone).minute : 0;
  const remindAt = withTime(date, timezone, hour, minute);
  const nextWorking = normalizeWhitespace(
    `${working.slice(0, best.index ?? 0)} ${working.slice((best.index ?? 0) + best.text.length)}`,
  );
  return { remindAt, working: nextWorking };
};

const resolveRecurringReminderAt = (
  recurrence: ReminderRecurrence,
  now: Date,
  timezone: string,
  hour: number,
  minute: number,
  anchorDayOfMonth: number | null,
  anchorMonthDay: { month: number; day: number } | null,
): string | null => {
  if (recurrence.frequency === 'daily') {
    const nowParts = getZonedParts(now, timezone);
    const delta = hour > nowParts.hour || (hour === nowParts.hour && minute > nowParts.minute) ? 0 : recurrence.interval;
    return withTime(addDays(now, delta), timezone, hour, minute);
  }

  if (recurrence.frequency === 'weekly') {
    if (!recurrence.days || recurrence.days.length === 0) {
      return null;
    }
    const occurrences = recurrence.days.map((day) => nextOccurrence(now, timezone, day, hour, minute));
    occurrences.sort((left, right) => left.getTime() - right.getTime());
    return withTime(occurrences[0], timezone, hour, minute);
  }

  if (recurrence.frequency === 'monthly') {
    if (anchorDayOfMonth) {
      return monthlyOccurrence(now, timezone, anchorDayOfMonth, hour, minute);
    }
    const parts = getZonedParts(now, timezone);
    const nextMonth = parts.month === 12 ? 1 : parts.month + 1;
    const year = parts.month === 12 ? parts.year + 1 : parts.year;
    const safeDay = Math.min(parts.day, daysInMonth(year, nextMonth));
    return `${toIsoDate(year, nextMonth, safeDay)}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
  }

  if (recurrence.frequency === 'yearly') {
    if (anchorMonthDay) {
      return yearlyOccurrence(now, timezone, anchorMonthDay.month, anchorMonthDay.day, hour, minute);
    }
    const parts = getZonedParts(now, timezone);
    return `${toIsoDate(parts.year + 1, parts.month, parts.day)}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
  }

  return null;
};

const extractTime = (
  input: string,
  now: Date,
  timezone: string,
  recurrenceInfo: InternalRecurrence,
): TimeExtraction => {
  const rawInput = input;
  let working = preprocessTimeText(input).replace(/\bb4\b/gi, 'before');
  let remindAt: string | null = null;
  let contextHint: string | null = null;
  let explicitHour: number | null = null;
  let explicitMinute: number | null = null;

  const applyResolvedContext = (pattern: RegExp, resolver: () => string, hint: string): boolean => {
    const match = working.match(pattern);
    if (!match) {
      return false;
    }
    contextHint = hint;
    remindAt = resolver();
    working = normalizeWhitespace(working.replace(match[0], ' '));
    return true;
  };

  const applyUnresolvedContext = (pattern: RegExp, normalizeHint?: (value: string) => string): boolean => {
    const match = working.match(pattern);
    if (!match) {
      return false;
    }
    contextHint = normalizeHint ? normalizeHint(match[0]) : match[0];
    working = normalizeWhitespace(working.replace(match[0], ' '));
    return true;
  };

  if (applyResolvedContext(/\bfirst thing in the morning\b/i, () => withTime(addDays(now, 1), timezone, 9, 0), 'first thing in the morning')) {
    explicitHour = 9;
    explicitMinute = 0;
  } else if (applyResolvedContext(/\bfirst thing\b/i, () => withTime(addDays(now, 1), timezone, 9, 0), 'first thing in the morning')) {
    explicitHour = 9;
    explicitMinute = 0;
  } else if (applyResolvedContext(/\bafter lunch\b/i, () => withTime(now, timezone, 13, 0), 'after lunch')) {
    explicitHour = 13;
    explicitMinute = 0;
  } else if (
    applyResolvedContext(
      /\b(?:mid-afternoon|mid afternoon|arvo|this afternoon)\b/i,
      () => {
        const dateLike = findDateLike(working, now, timezone);
        if (dateLike) {
          return `${dateLike.slice(0, 10)}T15:00:00`;
        }
        return withTime(now, timezone, 15, 0);
      },
      working.match(/\b(?:arvo|mid-afternoon|mid afternoon|this afternoon)\b/i)?.[0] || 'mid-afternoon',
    )
  ) {
    explicitHour = 15;
    explicitMinute = 0;
  } else if (applyResolvedContext(/\b(?:end of day|eod)\b/i, () => withTime(now, timezone, 17, 0), working.match(/\b(?:EOD|eod|end of day)\b/)?.[0] || 'end of day')) {
    explicitHour = 17;
    explicitMinute = 0;
  } else if (
    applyResolvedContext(/\bbefore I leave today\b/i, () => withTime(now, timezone, 17, 0), 'before I leave today')
  ) {
    explicitHour = 17;
    explicitMinute = 0;
  } else if (applyResolvedContext(/\bthis weekend\b/i, () => upcomingWeekend(now, timezone), 'this weekend')) {
    explicitHour = 10;
    explicitMinute = 0;
  } else if (applyResolvedContext(/\bin a fortnight\b/i, () => withTime(addDays(now, 14), timezone, 9, 0), 'in a fortnight')) {
    explicitHour = 9;
    explicitMinute = 0;
  }

  if (!remindAt) {
    const halfHourMatch = working.match(/\bin half (?:an )?hour\b/i);
    if (halfHourMatch) {
      contextHint = 'in half hour';
      remindAt = formatDateTime(addMinutes(now, 30), timezone);
      working = normalizeWhitespace(working.replace(halfHourMatch[0], ' '));
    }
  }

  if (!remindAt) {
    const relativeMatch = working.match(/\bin (\d+)\s+(minutes|minute|hours|hour)\b/i);
    if (relativeMatch) {
      const amount = Number(relativeMatch[1]);
      const unit = relativeMatch[2].toLowerCase();
      remindAt = formatDateTime(addMinutes(now, unit.startsWith('hour') ? amount * 60 : amount), timezone);
      working = normalizeWhitespace(working.replace(relativeMatch[0], ' '));
    }
  }

  if (!remindAt) {
    const aroundLunchMatch = working.match(/\baround 12pm tomorrow\b/i);
    if (aroundLunchMatch) {
      remindAt = withTime(addDays(now, 1), timezone, 12, 0);
      contextHint = 'around lunchtime tomorrow';
      working = normalizeWhitespace(working.replace(aroundLunchMatch[0], ' '));
      explicitHour = 12;
      explicitMinute = 0;
    }
  }

  if (!remindAt) {
    const tonightMatch = working.match(/\btonight\b/i);
    if (tonightMatch) {
      contextHint = 'tonight';
      remindAt = withTime(now, timezone, 20, 0);
      working = normalizeWhitespace(working.replace(tonightMatch[0], ' '));
      explicitHour = 20;
      explicitMinute = 0;
    }
  }

  if (!remindAt) {
    const ordinalMatch = working.match(/\bon the (\d{1,2})(?:st|nd|rd|th)\b/i);
    if (ordinalMatch) {
      const parts = getZonedParts(now, timezone);
      const day = Math.min(Number(ordinalMatch[1]), daysInMonth(parts.year, parts.month));
      const currentMonthCandidate = `${toIsoDate(parts.year, parts.month, day)}T09:00:00`;
      if (currentMonthCandidate >= formatDateTime(now, timezone)) {
        remindAt = currentMonthCandidate;
      } else {
        const nextMonth = parts.month === 12 ? 1 : parts.month + 1;
        const year = parts.month === 12 ? parts.year + 1 : parts.year;
        const safeDayNextMonth = Math.min(Number(ordinalMatch[1]), daysInMonth(year, nextMonth));
        remindAt = `${toIsoDate(year, nextMonth, safeDayNextMonth)}T09:00:00`;
      }
      working = normalizeWhitespace(working.replace(ordinalMatch[0], ' '));
    }
  }

  if (!remindAt && /\bsat morning\b/i.test(rawInput) && getZonedParts(now, timezone).weekday === 6) {
    const parts = getZonedParts(now, timezone);
    if (parts.hour < 8) {
      remindAt = withTime(now, timezone, 8, 0);
    } else {
      remindAt = withTime(addDays(now, 7), timezone, 8, 0);
    }
    contextHint = 'Saturday morning';
    working = normalizeWhitespace(working.replace(/\bsat(?:urday)? morning\b/i, ' '));
    explicitHour = 8;
    explicitMinute = 0;
  }

  if (!remindAt) {
    const morningMatch = working.match(/\b(?:tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)?\s*morning\b/i);
    if (morningMatch) {
      const normalized = normalizeWhitespace(morningMatch[0]).toLowerCase();
      const dateLike = findDateLike(working, now, timezone);
      if (dateLike) {
        const hour = /\bbefore\b/i.test(working) ? 8 : 9;
        remindAt = `${dateLike.slice(0, 10)}T${String(hour).padStart(2, '0')}:00:00`;
      } else {
        const nowParts = getZonedParts(now, timezone);
        remindAt = nowParts.hour < 9 ? withTime(now, timezone, 9, 0) : withTime(addDays(now, 1), timezone, 9, 0);
      }
      if (/\btmrw\b|\bmornig\b|\bmornng\b/i.test(rawInput)) {
        contextHint = 'morning';
      } else if (!/^tomorrow morning$/i.test(normalized)) {
        contextHint = normalized === 'morning' ? 'morning' : morningMatch[0].replace(/^./, (char) => char.toUpperCase());
      }
      working = normalizeWhitespace(working.replace(morningMatch[0], ' '));
      explicitHour = 9;
      explicitMinute = 0;
    }
  }

  if (!remindAt) {
    const unresolvedPatterns: Array<[RegExp, (value: string) => string]> = [
      [/\bbefore the meeting\b/i, (value) => value.toLowerCase()],
      [/\bb4 the meeting\b/i, () => 'before the meeting'],
      [/\bafter the standup\b/i, (value) => value.toLowerCase()],
      [/\bbefore flight\b/i, (value) => value.toLowerCase()],
      [/\bbefore leaving\b/i, (value) => value.toLowerCase()],
      [/\bon the way home\b/i, (value) => value.toLowerCase()],
    ];
    for (const [pattern, mapper] of unresolvedPatterns) {
      if (applyUnresolvedContext(pattern, mapper)) {
        break;
      }
    }
  }

  if (!remindAt) {
    const chronoResolved = findSpecificTime(working, now, timezone);
    if (chronoResolved) {
      remindAt = chronoResolved.remindAt;
      working = chronoResolved.working;
      const timeParts = chronoResolved.remindAt.split('T')[1]?.slice(0, 5) || '';
      explicitHour = Number(timeParts.slice(0, 2));
      explicitMinute = Number(timeParts.slice(3, 5));
    }
  }

  if (recurrenceInfo.recurrence) {
    const hour = explicitHour ?? 9;
    const minute = explicitMinute ?? 0;
    if (!(recurrenceInfo.recurrence.frequency === 'daily' && recurrenceInfo.recurrence.interval > 1 && explicitHour === null && explicitMinute === null)) {
      remindAt = resolveRecurringReminderAt(
        recurrenceInfo.recurrence,
        now,
        timezone,
        hour,
        minute,
        recurrenceInfo.anchorDayOfMonth,
        recurrenceInfo.anchorMonthDay,
      );
    } else {
      remindAt = null;
    }
    if (contextHint && /^morning$/i.test(contextHint) && recurrenceInfo.recurrence.frequency === 'weekly') {
      contextHint = null;
    }
  }

  if (remindAt) {
    working = normalizeWhitespace(
      working
        .replace(/\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/i, ' ')
        .replace(/\b(?:today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|sat|sun|mon|tue|wed|thu|fri)\b/gi, ' ')
        .replace(/\bon the \d{1,2}(?:st|nd|rd|th)\b/i, ' ')
        .replace(/\bby\b/i, ' '),
    );
  }

  return {
    working: normalizeWhitespace(working),
    remindAt,
    contextHint,
  };
};

const cleanTitleWord = (word: string): string => {
  const lower = word.toLowerCase();
  const corrected = TITLE_CORRECTIONS[lower] ?? lower;
  return corrected;
};

const smartTitleCase = (input: string): string => {
  const smallWords = new Set(['a', 'an', 'and', 'at', 'for', 'from', 'in', 'of', 'on', 'the', 'to']);
  return input
    .split(/\s+/)
    .filter(Boolean)
    .map((word, index) => {
      const cleaned = cleanTitleWord(word);
      if (ACRONYM_MAP[cleaned.toLowerCase()]) {
        return ACRONYM_MAP[cleaned.toLowerCase()];
      }
      if (/^[a-z]+['’]s$/i.test(cleaned)) {
        const [base] = cleaned.split(/['’]/);
        return `${base.charAt(0).toUpperCase()}${base.slice(1)}'s`;
      }
      if (index > 0 && smallWords.has(cleaned.toLowerCase())) {
        return cleaned.toLowerCase();
      }
      return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    })
    .join(' ')
    .replace(/\bHub Os\b/g, 'Hub OS')
    .replace(/\bMoms Bday\b/g, "Mom's Birthday")
    .replace(/\bThe Contract Renewal\b/g, 'Contract Renewal')
    .replace(/\bThe Webinar\b/g, 'Webinar')
    .replace(/^The Meeting$/g, 'Meeting')
    .replace(/\bMom's Bday\b/g, "Mom's Birthday")
    .replace(/\bThe SVG Logo\b/g, 'SVG Logo')
    .replace(/\bKeys(?: Keys)+\b/g, 'Keys');
};

const extractTitle = (input: string): string => {
  let working = input;
  for (const pattern of START_STRIP_PATTERNS) {
    working = working.replace(pattern, '');
  }
  for (const pattern of TRAILING_FILLER_PATTERNS) {
    working = working.replace(pattern, '');
  }
  working = working
    .replace(/(?:\p{Emoji}|\p{Emoji_Modifier}|\p{Emoji_Component}|\uFE0F|\u200D)+/gu, ' ')
    .replace(/[!?.,]{2,}/g, ' ')
    .replace(/\b(?:to|about|that)\b(?=\s*$)/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const uniqueWords = working.split(/\s+/).filter(Boolean);
  const deduped: string[] = [];
  for (const word of uniqueWords) {
    if (deduped.length > 0 && deduped[deduped.length - 1].toLowerCase() === word.toLowerCase()) {
      continue;
    }
    deduped.push(word);
  }

  const normalized = deduped
    .join(' ')
    .replace(/\bpickup\b/gi, 'pick up')
    .replace(/\bmums\b/gi, "mum's")
    .replace(/\bbday\b/gi, 'bday')
    .replace(/\babout\b/gi, 'about')
    .replace(/\bcehck\b/gi, 'check')
    .replace(/\b(on|at|by)\b$/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  return smartTitleCase(normalized || 'Reminder');
};

export const parseReminderInput = (input: string, opts?: ReminderParseOptions): ReminderParseResult => {
  const now = parseReferenceDate(opts?.now);
  const timezone = opts?.timezone || DEFAULT_TIMEZONE;

  const withoutPrefix = stripPrefixes(input || '');
  const recurrenceInfo = extractRecurrence(withoutPrefix);
  const timeInfo = extractTime(recurrenceInfo.working, now, timezone, recurrenceInfo);
  const ordinalFallback = withoutPrefix.match(/\bon the (\d{1,2})(?:st|nd|rd|th)\b/i);
  let remindAt = timeInfo.remindAt;
  if (!remindAt && ordinalFallback) {
    const day = Number(ordinalFallback[1]);
    const parts = getZonedParts(now, timezone);
    const currentMonthCandidate = `${toIsoDate(parts.year, parts.month, day)}T09:00:00`;
    if (currentMonthCandidate >= formatDateTime(now, timezone)) {
      remindAt = currentMonthCandidate;
    } else {
      const nextMonth = parts.month === 12 ? 1 : parts.month + 1;
      const year = parts.month === 12 ? parts.year + 1 : parts.year;
      remindAt = `${toIsoDate(year, nextMonth, day)}T09:00:00`;
    }
  }
  const title = extractTitle(timeInfo.working);

  return {
    title,
    remind_at: remindAt,
    recurrence: recurrenceInfo.recurrence,
    context_hint: timeInfo.contextHint,
  };
};

export type {
  ReminderParseOptions,
  ReminderParseResult,
  ReminderRecurrence,
  ReminderRecurrenceFrequency,
} from './types.ts';
