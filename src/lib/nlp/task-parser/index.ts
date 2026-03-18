import * as chrono from 'chrono-node';

import type { TaskParseOptions, TaskParseResult, TaskPriority } from './types.ts';

const DEFAULT_TIMEZONE = 'UTC';
const PRIORITY_ORDER: Record<Exclude<TaskPriority, null>, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

const ACRONYM_MAP: Record<string, string> = {
  api: 'API',
  svg: 'SVG',
  pr: 'PR',
  ssl: 'SSL',
  aws: 'AWS',
  fcp: 'FCP',
  dnd: 'DnD',
  eod: 'EOD',
  readme: 'README',
  os: 'OS',
};

const KNOWN_LOWERCASE_ASSIGNEES = new Set([
  'alex',
  'diego',
  'jake',
  'james',
  'jamie',
  'jen',
  'jester',
  'john',
  'lee',
  'mark',
  'mike',
  'maria',
  'nate',
  'priya',
  'rachel',
  'sam',
  'sarah',
]);

const TITLE_WORD_CORRECTIONS: Record<string, string> = {
  adn: 'and',
  borring: 'boring',
  brokn: 'broken',
  cancle: 'cancel',
  cert: 'certificate',
  chck: 'check',
  clnic: 'clinic',
  deplpy: 'deploy',
  desktp: 'desktop',
  docunents: 'documents',
  finishe: 'finish',
  financal: 'financial',
  flrs: 'flowers',
  hotfx: 'hotfix',
  importnt: 'important',
  instanc: 'instance',
  moble: 'mobile',
  monitering: 'monitoring',
  notifcation: 'notification',
  persentation: 'presentation',
  reciepts: 'receipts',
  replce: 'replace',
  reviw: 'review',
  shoud: 'should',
  summry: 'summary',
  teh: 'the',
  uptade: 'update',
  urgnt: 'urgent',
  wrte: 'write',
};

const PHRASE_CORRECTIONS: Array<[RegExp, string]> = [
  [/\bre-do\b/gi, 'redo'],
  [/\bre do\b/gi, 'redo'],
  [/\bwe dont\b/gi, "we don't"],
  [/\blast years\b/gi, "last year's"],
  [/\bhub os\b/gi, 'hub OS'],
  [/\bprod login\b/gi, 'production login'],
  [/\bpitch deck draft\b/gi, 'pitch deck, draft'],
  [/\bdraft it send\b/gi, 'draft and send'],
  [/\bto clint\b/gi, 'to client'],
  [/\bbday\b/gi, 'bday'],
];

const DATE_TYPO_CORRECTIONS: Array<[RegExp, string]> = [
  [/\btmrw\b/gi, 'tomorrow'],
  [/\btmr\b/gi, 'tomorrow'],
  [/\btomorow\b/gi, 'tomorrow'],
  [/\btonite\b/gi, 'tonight'],
  [/\barvo\b/gi, 'afternoon'],
  [/\bthurrsday\b/gi, 'thursday'],
  [/\bthurdsay\b/gi, 'thursday'],
  [/\bwendesday\b/gi, 'wednesday'],
  [/\bwednsday\b/gi, 'wednesday'],
  [/\bnext tues\b/gi, 'next tuesday'],
  [/\bnext fri\b/gi, 'next friday'],
  [/\bnext mon\b/gi, 'next monday'],
  [/\bthurs\b/gi, 'thursday'],
  [/\bthur\b/gi, 'thursday'],
  [/\bfri\b/gi, 'friday'],
  [/\bmon\b/gi, 'monday'],
  [/\btues\b/gi, 'tuesday'],
  [/\bwed\b/gi, 'wednesday'],
  [/\bsat\b/gi, 'saturday'],
  [/\bsun\b/gi, 'sunday'],
];

const HIGH_PRIORITY_PATTERNS: RegExp[] = [
  /\burgent\b/gi,
  /\burgnt\b/gi,
  /\basap\b/gi,
  /\bcritical\b/gi,
  /\bcritcal\b/gi,
  /\bblocker\b/gi,
  /\bp1\b/gi,
  /\bimportant\b/gi,
  /\bimportnt\b/gi,
  /\bhigh\s+priority\b/gi,
  /\bhigh\s+pri(?:o)?\b/gi,
  /!{3,}\s*urgent!*/gi,
  /🚨/g,
  /\bNOW\b/g,
];

const MEDIUM_PRIORITY_PATTERNS: RegExp[] = [
  /\bnormal\s+priority\b/gi,
  /\bmedium\s+prio\b/gi,
  /\bmedium\b/gi,
  /\bnormal\b/gi,
];

const LOW_PRIORITY_PATTERNS: RegExp[] = [
  /\blow\s+priority\b/gi,
  /\blow\s+pri(?:o)?\b/gi,
  /\bno\s+rush\b/gi,
  /\bnice\s+to\s+have\b/gi,
  /\bwhen\s+you\s+can\b/gi,
  /\bwhen\s+you\s+get\s+a\s+chance\b/gi,
  /\bwhenever(?:\s+you\s+can)?\b/gi,
  /\bthis\s+can\s+wait\b/gi,
  /\bnot\s+urgent\b/gi,
];

const LEADING_FILLER_PATTERNS: RegExp[] = [
  /^\s*i think\b[\s,.-]*/i,
  /^\s*we should\b[\s,.-]*/i,
  /^\s*we shoud\b[\s,.-]*/i,
  /^\s*we need to\b[\s,.-]*/i,
  /^\s*we need\b[\s,.-]*/i,
  /^\s*i need to\b[\s,.-]*/i,
  /^\s*i need\b[\s,.-]*/i,
  /^\s*need to\b[\s,.-]*/i,
  /^\s*need\b[\s,.-]*/i,
  /^\s*pls\b[\s,.-]*/i,
  /^\s*please\b[\s,.-]*/i,
  /^\s*but\b[\s,.-]*/i,
  /^\s*can\b[\s,.-]*/i,
  /^\s*task\b[\s,.:-]*/i,
  /^\s*super\b[\s,.-]*/i,
  /^\s*maybe\b[\s,.-]*/i,
];

const TRAILING_FILLER_PATTERNS: RegExp[] = [
  /[\s,.-]+\bpls\b\.?$/i,
  /[\s,.-]+\bplease\b\.?$/i,
  /[\s,.-]+\blol\b\.?$/i,
  /[\s,.-]+\bmaybe\b\.?$/i,
  /[\s,.-]+\bidk\b\.?$/i,
  /[\s,.-]+\bboth\b\.?$/i,
  /[\s,.-]+\bbut\b\.?$/i,
];

const SMALL_WORDS = new Set([
  'a',
  'an',
  'and',
  'as',
  'at',
  'but',
  'by',
  'for',
  'in',
  'of',
  'on',
  'or',
  'the',
  'to',
  'with',
]);

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

const getZonedDateParts = (date: Date, timezone: string): { year: number; month: number; day: number; weekday: number } => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  });
  const parts = formatter.formatToParts(date);
  const year = Number(parts.find((part) => part.type === 'year')?.value || NaN);
  const month = Number(parts.find((part) => part.type === 'month')?.value || NaN);
  const day = Number(parts.find((part) => part.type === 'day')?.value || NaN);
  const weekdayToken = (parts.find((part) => part.type === 'weekday')?.value || '').toLowerCase();
  const weekdayMap: Record<string, number> = {
    sun: 0,
    mon: 1,
    tue: 2,
    wed: 3,
    thu: 4,
    fri: 5,
    sat: 6,
  };

  return {
    year,
    month,
    day,
    weekday: weekdayMap[weekdayToken.slice(0, 3)] ?? 0,
  };
};

const toIsoDate = (year: number, month: number, day: number): string =>
  `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

const formatDateInTimezone = (date: Date, timezone: string): string => {
  const parts = getZonedDateParts(date, timezone);
  return toIsoDate(parts.year, parts.month, parts.day);
};

const addDays = (date: Date, days: number): Date => new Date(date.getTime() + days * 86400000);

const endOfMonthIso = (now: Date, timezone: string): string => {
  const parts = getZonedDateParts(now, timezone);
  const lastDay = new Date(Date.UTC(parts.year, parts.month, 0)).getUTCDate();
  return toIsoDate(parts.year, parts.month, lastDay);
};

const fridayOfCurrentWeekIso = (now: Date, timezone: string): string => {
  const parts = getZonedDateParts(now, timezone);
  const isoWeekday = (parts.weekday + 6) % 7;
  const delta = isoWeekday <= 4 ? 4 - isoWeekday : 11 - isoWeekday;
  return formatDateInTimezone(addDays(now, delta), timezone);
};

const sundayOfCurrentWeekendIso = (now: Date, timezone: string): string => {
  const parts = getZonedDateParts(now, timezone);
  const delta = parts.weekday === 6 ? 1 : parts.weekday === 0 ? 0 : 6 - parts.weekday;
  return formatDateInTimezone(addDays(now, delta), timezone);
};

const nextDayIso = (now: Date, timezone: string): string => formatDateInTimezone(addDays(now, 1), timezone);
const nextWeekIso = (now: Date, timezone: string): string => formatDateInTimezone(addDays(now, 7), timezone);
const nextMondayIso = (now: Date, timezone: string): string => {
  const parts = getZonedDateParts(now, timezone);
  const delta = parts.weekday === 1 ? 7 : (8 - parts.weekday) % 7 || 7;
  return formatDateInTimezone(addDays(now, delta), timezone);
};

const detectPriority = (input: string): { priority: TaskPriority; working: string; dueForcedToday: boolean } => {
  let working = input;
  let priority: TaskPriority = null;

  const applyPatterns = (patterns: RegExp[], nextPriority: Exclude<TaskPriority, null>) => {
    let matched = false;
    for (const pattern of patterns) {
      if (pattern.test(working)) {
        matched = true;
      }
      pattern.lastIndex = 0;
      working = working.replace(pattern, ' ');
    }
    if (matched && (priority === null || PRIORITY_ORDER[nextPriority] > PRIORITY_ORDER[priority])) {
      priority = nextPriority;
    }
  };

  applyPatterns(LOW_PRIORITY_PATTERNS, 'low');
  applyPatterns(MEDIUM_PRIORITY_PATTERNS, 'medium');
  applyPatterns(HIGH_PRIORITY_PATTERNS, 'high');

  const dueForcedToday = /\b(?:now|immediately)\b/i.test(input);
  working = working.replace(/\s*:\s*/g, ' ');
  working = normalizeWhitespace(working);
  return { priority, working, dueForcedToday };
};

const nameCase = (value: string): string => {
  if (/@/.test(value)) {
    return value;
  }
  if (/\b(?:team|group)\b/i.test(value)) {
    return value.toLowerCase();
  }
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
};

const uniqueHints = (values: string[]): string[] => {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    const cleaned = value.trim();
    if (!cleaned) {
      continue;
    }
    const key = cleaned.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(nameCase(cleaned));
  }
  return output;
};

const splitAssigneeGroup = (value: string): string[] =>
  value
    .split(/\s+(?:and|or|n)\s+/i)
    .map((part) => part.trim().replace(/^the\s+/i, (match) => match.toLowerCase()))
    .filter(Boolean);

const isAssigneeLike = (value: string): boolean => {
  const cleaned = value.replace(/[,:]+$/g, '').trim();
  if (!cleaned) {
    return false;
  }
  if (/@/.test(cleaned)) {
    return true;
  }
  if (/^(?:the\s+)?[a-z]+\s+(?:team|group)$/i.test(cleaned)) {
    return true;
  }
  if (/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*$/.test(cleaned)) {
    return true;
  }
  return KNOWN_LOWERCASE_ASSIGNEES.has(cleaned.toLowerCase());
};

const normalizeAssigneeCapture = (value: string): string[] =>
  splitAssigneeGroup(value.replace(/[,:]+$/g, '').trim()).filter((part) => isAssigneeLike(part));

const applyAssigneeTransform = (
  working: string,
  regex: RegExp,
  buildReplacement: (...args: string[]) => { assignees: string[]; replacement: string } | null,
): { working: string; assignees: string[] } => {
  const assignees: string[] = [];
  let matched = false;
  const nextWorking = working.replace(regex, (...args) => {
    const captures = args.slice(1, -2);
    const transformed = buildReplacement(...captures);
    if (!transformed) {
      return args[0];
    }
    matched = true;
    assignees.push(...transformed.assignees);
    return transformed.replacement;
  });

  return {
    working: matched ? normalizeWhitespace(nextWorking) : working,
    assignees,
  };
};

const extractAssignees = (input: string): { working: string; assigneeHints: string[]; directed: boolean } => {
  let working = input;
  const assignees: string[] = [];
  let directed = false;

  const transforms: Array<{
    regex: RegExp;
    build: (...captures: string[]) => { assignees: string[]; replacement: string } | null;
  }> = [
    {
      regex: /^\s*task\s+for\s+([a-z@.\s]+?)\s*:\s*(.+)$/i,
      build: (group, task) => {
        const normalized = normalizeAssigneeCapture(group);
        return normalized.length ? { assignees: normalized, replacement: task } : null;
      },
    },
    {
      regex: /^\s*([a-z0-9@.+-]+(?:\s+(?:and|or|n)\s+[a-z0-9@.+-]+)*)\s+needs\s+to\s+(.+)$/i,
      build: (group, task) => {
        const normalized = normalizeAssigneeCapture(group);
        return normalized.length ? { assignees: normalized, replacement: task } : null;
      },
    },
    {
      regex: /^\s*([a-z0-9@.+-]+(?:\s+(?:and|or|n)\s+[a-z0-9@.+-]+)*)\s+should\s+(.+)$/i,
      build: (group, task) => {
        const normalized = normalizeAssigneeCapture(group);
        return normalized.length ? { assignees: normalized, replacement: task } : null;
      },
    },
    {
      regex: /^\s*([a-z0-9@.+-]+(?:\s+(?:and|or|n)\s+[a-z0-9@.+-]+)*)\s+shud\s+(.+)$/i,
      build: (group, task) => {
        const normalized = normalizeAssigneeCapture(group);
        return normalized.length ? { assignees: normalized, replacement: task } : null;
      },
    },
    {
      regex: /^\s*([a-z0-9@.+-]+)\s+can\s+u\s+(.+)$/i,
      build: (group, task) => {
        const normalized = normalizeAssigneeCapture(group);
        return normalized.length ? { assignees: normalized, replacement: task } : null;
      },
    },
    {
      regex: /^\s*have\s+([a-z0-9@.+-]+(?:\s+(?:or|and|n)\s+[a-z0-9@.+-]+)*)\s+(.+)$/i,
      build: (group, task) => {
        const normalized = normalizeAssigneeCapture(group);
        return normalized.length ? { assignees: normalized, replacement: task } : null;
      },
    },
    {
      regex: /^\s*tell\s+([a-z0-9@.+-]+(?:\s+(?:or|and|n)\s+[a-z0-9@.+-]+)*)\s+to\s+(.+)$/i,
      build: (group, task) => {
        const normalized = normalizeAssigneeCapture(group);
        return normalized.length ? { assignees: normalized, replacement: task } : null;
      },
    },
    {
      regex: /^\s*can\s+([a-z0-9@.+-]+(?:\s+(?:or|and|n)\s+[a-z0-9@.+-]+)*)\s+(.+)$/i,
      build: (group, task) => {
        const normalized = normalizeAssigneeCapture(group);
        return normalized.length ? { assignees: normalized, replacement: task } : null;
      },
    },
    {
      regex: /^\s*need\s+([a-z0-9@.+-]+(?:\s+(?:or|and|n)\s+[a-z0-9@.+-]+)*)\s+on\s+(.+)$/i,
      build: (group, task) => {
        const normalized = normalizeAssigneeCapture(group);
        return normalized.length ? { assignees: normalized, replacement: `handle ${task}` } : null;
      },
    },
    {
      regex: /^\s*[,.-]*\s*([a-z0-9@.+-]+)\s+plz\s+(.+)$/i,
      build: (group, task) => {
        const normalized = normalizeAssigneeCapture(group);
        return normalized.length ? { assignees: normalized, replacement: task } : null;
      },
    },
    {
      regex: /^\s*[,.-]*\s*([a-z0-9@.+-]+)\s+pls\s+(.+)$/i,
      build: (group, task) => {
        const normalized = normalizeAssigneeCapture(group);
        return normalized.length ? { assignees: normalized, replacement: task } : null;
      },
    },
    {
      regex: /^\s*email\s+([a-z0-9.+-]+@[a-z0-9.-]+\.[a-z]{2,})\s+(.+)$/i,
      build: (email, rest) => ({
        assignees: [email],
        replacement: `email ${email.split('@')[0]} ${rest}`,
      }),
    },
    {
      regex: /^\s*assign\s+the\s+(.+?)\s+to\s+([a-z0-9@.+-]+)$/i,
      build: (task, group) => {
        const normalized = normalizeAssigneeCapture(group);
        return normalized.length ? { assignees: normalized, replacement: task } : null;
      },
    },
    {
      regex: /\bassign\s+to\s+([a-z0-9@.+-]+)$/i,
      build: (group) => {
        const normalized = normalizeAssigneeCapture(group);
        return normalized.length ? { assignees: normalized, replacement: '' } : null;
      },
    },
    {
      regex: /\bfor\s+((?:the\s+)?[a-z]+\s+(?:team|group))$/i,
      build: (group) => {
        const normalized = normalizeAssigneeCapture(group);
        return normalized.length ? { assignees: normalized, replacement: '' } : null;
      },
    },
    {
      regex: /\bfor\s+([a-z0-9@.+-]+(?:\s+(?:team|group))?(?:\s+(?:and|or|n)\s+[a-z0-9@.+-]+(?:\s+(?:team|group))?)*)\b/i,
      build: (group) => {
        const normalized = normalizeAssigneeCapture(group);
        return normalized.length ? { assignees: normalized, replacement: '' } : null;
      },
    },
    {
      regex: /\bfrom\s+([a-z0-9@.+-]+(?:\s+(?:team|group))?)\b/i,
      build: (group) => {
        const normalized = normalizeAssigneeCapture(group);
        return normalized.length ? { assignees: normalized, replacement: '' } : null;
      },
    },
    {
      regex: /\bwith\s+([a-z0-9@.+-]+(?:\s+(?:and|or|n)\s+[a-z0-9@.+-]+)*)\b/i,
      build: (group) => {
        const normalized = normalizeAssigneeCapture(group);
        return normalized.length ? { assignees: normalized, replacement: '' } : null;
      },
    },
    {
      regex: /\bto\s+([a-z0-9@.+-]+@[a-z0-9.-]+\.[a-z]{2,})\b/i,
      build: (group) => ({ assignees: normalizeAssigneeCapture(group), replacement: '' }),
    },
    {
      regex: /\bto\s+([A-Z][a-z]+)\b/,
      build: (group) => {
        const normalized = normalizeAssigneeCapture(group);
        return normalized.length ? { assignees: normalized, replacement: '' } : null;
      },
    },
    {
      regex: /\bto\s+([a-z]+)\b/i,
      build: (group) => {
        const normalized = normalizeAssigneeCapture(group);
        return normalized.length ? { assignees: normalized, replacement: '' } : null;
      },
    },
  ];

  for (const transform of transforms) {
    const result = applyAssigneeTransform(working, transform.regex, transform.build);
    working = result.working;
    assignees.push(...result.assignees);
    if (result.assignees.length > 0 && /^\s*(?:task for|have |tell |can |need |[a-z0-9@.+-]+\s+(?:needs to|should|shud|can u|pls|plz))/i.test(input)) {
      directed = true;
    }
  }

  return {
    working: normalizeWhitespace(working),
    assigneeHints: uniqueHints(assignees),
    directed,
  };
};

const preprocessDateText = (input: string): string => {
  let output = input;
  for (const [pattern, replacement] of DATE_TYPO_CORRECTIONS) {
    output = output.replace(pattern, replacement);
  }
  output = output.replace(/\bclose of business\b/gi, 'end of day');
  output = output.replace(/\bcob\b/gi, 'end of day');
  output = output.replace(/\beod\b/gi, 'end of day');
  return normalizeWhitespace(output);
};

const resolveSpecialDate = (text: string, now: Date, timezone: string, preferNextWeekStart: boolean): string | null => {
  if (/\b(?:tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next\s+\w+|march|april|\d{1,2}\/\d{1,2})\b/i.test(text) && /\bend of day\b/i.test(text)) {
    return null;
  }
  if (/\bend of (?:the )?month\b/i.test(text)) {
    return endOfMonthIso(now, timezone);
  }
  if (/\b(?:end of week|this week)\b/i.test(text)) {
    return fridayOfCurrentWeekIso(now, timezone);
  }
  if (/\bthis weekend\b/i.test(text)) {
    return sundayOfCurrentWeekendIso(now, timezone);
  }
  if (/\bnext week\b/i.test(text)) {
    return preferNextWeekStart ? nextMondayIso(now, timezone) : nextWeekIso(now, timezone);
  }
  if (/\bstandup\b/i.test(text)) {
    return nextDayIso(now, timezone);
  }
  if (/\b(?:tonight|today|now|immediately|end of day)\b/i.test(text)) {
    return formatDateInTimezone(now, timezone);
  }
  return null;
};

const parseDueDate = (candidate: string, now: Date, timezone: string, preferNextWeekStart: boolean): string | null => {
  const special = resolveSpecialDate(candidate, now, timezone, preferNextWeekStart);
  if (special) {
    return special;
  }
  const parsed = chrono.parse(candidate, now, { forwardDate: true });
  const best = parsed[0];
  if (!best) {
    return null;
  }
  return formatDateInTimezone(best.start.date(), timezone);
};

const chooseChronoCandidate = (working: string): Array<{ text: string; start: number; fromMarker: boolean }> => {
  const candidates: Array<{ text: string; start: number; fromMarker: boolean }> = [];
  const markerRegex = /\b(?:by|before|due(?:\s+by)?|due|until|b4)\b/gi;
  let markerMatch: RegExpExecArray | null;
  while ((markerMatch = markerRegex.exec(working)) !== null) {
    candidates.push({
      text: working.slice(markerMatch.index),
      start: markerMatch.index,
      fromMarker: true,
    });
  }

  const fallbackRegex =
    /\b(?:tonight|tomorrow(?:\s+morning|\s+afternoon)?|next\s+\w+|this\s+weekend|end of (?:the )?month|end of week|in \d+ days|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}|[A-Za-z]+\s+\d{1,2}|\d{1,2}\s+[A-Za-z]+|\d+(?::\d{2})?\s*(?:am|pm)|noon)\b/gi;
  let fallbackMatch: RegExpExecArray | null;
  while ((fallbackMatch = fallbackRegex.exec(working)) !== null) {
    candidates.push({
      text: fallbackMatch[0],
      start: fallbackMatch.index,
      fromMarker: false,
    });
  }

  return candidates.sort((left, right) => left.start - right.start);
};

const extractDueDate = (
  input: string,
  now: Date,
  timezone: string,
  dueForcedToday: boolean,
  preferNextWeekStart: boolean,
): { working: string; dueAt: string | null } => {
  let working = preprocessDateText(input);
  let dueAt: string | null = dueForcedToday ? formatDateInTimezone(now, timezone) : null;
  if (dueForcedToday) {
    working = normalizeWhitespace(working.replace(/\b(?:now|immediately)\b/gi, ' '));
  }

  const candidates = chooseChronoCandidate(working);
  for (const candidate of candidates) {
    const parsedResults = chrono.parse(candidate.text, now, { forwardDate: true });
    const bestResult = parsedResults[0];
    const parsed = parseDueDate(candidate.text, now, timezone, preferNextWeekStart);
    if (!parsed) {
      continue;
    }
    dueAt = parsed;
    const parsedStart = candidate.start + (bestResult?.index ?? 0);
    const parsedEnd = parsedStart + (bestResult?.text.length ?? candidate.text.length);
    const removalEnd =
      candidate.fromMarker &&
      /\b(?:end of week|end of month|end of day|this weekend|standup|next week)\b/i.test(candidate.text)
        ? candidate.start + candidate.text.length
        : parsedEnd;
    working = normalizeWhitespace(`${working.slice(0, candidate.start)} ${working.slice(removalEnd)}`);
    working = working
      .replace(/\b(?:by|before|due(?:\s+by)?|due|until|b4)\b\s*$/i, '')
      .replace(/^\b(?:by|before|due(?:\s+by)?|due|until|b4)\b\s*/i, '');
    break;
  }

  return { working: normalizeWhitespace(working), dueAt };
};

const cleanPunctuation = (input: string): string =>
  input
    .replace(/(?:\p{Emoji}|\p{Emoji_Modifier}|\p{Emoji_Component}|\uFE0F|\u200D)+/gu, ' ')
    .replace(/[!?.,]{2,}/g, ' ')
    .replace(/[“”"]/g, '')
    .replace(/\s*-\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const fixTitleWord = (word: string): string => {
  const match = word.match(/^([^A-Za-z0-9#']*)([A-Za-z0-9#']+)([^A-Za-z0-9#']*)$/);
  if (!match) {
    return word;
  }
  const [, prefix, core, suffix] = match;
  const lowerCore = core.toLowerCase();
  const corrected = TITLE_WORD_CORRECTIONS[lowerCore] ?? lowerCore;
  return `${prefix}${corrected}${suffix}`;
};

const normalizeTitleText = (input: string): string => {
  let output = cleanPunctuation(input);
  for (const pattern of LEADING_FILLER_PATTERNS) {
    output = output.replace(pattern, '');
  }
  for (const pattern of TRAILING_FILLER_PATTERNS) {
    output = output.replace(pattern, '');
  }
  output = output.replace(/\b(?:plz|pls)\b/gi, ' ');
  output = output.replace(/\bn\b/gi, ' and ');
  output = output.replace(/\bcan u\b/gi, ' ');
  output = output.replace(/\bshould\b/gi, ' ');
  output = output.replace(/\bprobly\b/gi, ' ');
  output = output.replace(/\beventually\b/gi, ' ');
  output = output.replace(/\bshud\b/gi, ' ');
  output = output.replace(/\bpriority\b/gi, ' ');
  output = output.replace(/\byou can\b/gi, ' ');
  output = output.replace(/\bend of day\b/gi, ' ');
  output = output.replace(/\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|tonight)\b$/i, ' ');
  output = output.replace(/\bfor the client\b/gi, 'to the client');
  for (const [pattern, replacement] of PHRASE_CORRECTIONS) {
    output = output.replace(pattern, replacement);
  }
  let previous = '';
  while (output !== previous) {
    previous = output;
    for (const pattern of LEADING_FILLER_PATTERNS) {
      output = output.replace(pattern, '');
    }
  }
  output = output
    .split(/\s+/)
    .map((word) => fixTitleWord(word))
    .join(' ');
  for (const pattern of TRAILING_FILLER_PATTERNS) {
    output = output.replace(pattern, '');
  }
  output = output.replace(/\bboth\b$/i, '');
  output = output.replace(/\bbut\b$/i, '');
  output = output.replace(/^[,.-]+\s*/g, '').replace(/\s+[,-]\s*$/g, '');
  output = output.replace(/\s+/g, ' ').trim();
  return output;
};

const titleCaseWord = (word: string, index: number): string => {
  const lower = word.toLowerCase();
  if (ACRONYM_MAP[lower]) {
    return ACRONYM_MAP[lower];
  }
  if (/^#/.test(word)) {
    return word;
  }
  if (index > 0 && SMALL_WORDS.has(lower)) {
    return lower;
  }
  return lower.charAt(0).toUpperCase() + lower.slice(1);
};

const smartTitleCase = (input: string): string =>
  input
    .split(/\s+/)
    .filter(Boolean)
    .map((word, index) => {
      if (/^[a-z]+['’]s$/i.test(word)) {
        const [base] = word.split(/['’]/);
        return `${titleCaseWord(base, index)}'s`;
      }
      if (word.includes("'")) {
        return word
          .split("'")
          .map((part, partIndex) => (part === 's' ? 's' : titleCaseWord(part, index + partIndex)))
          .join("'");
      }
      return titleCaseWord(word, index);
    })
    .join(' ')
    .replace(/\bDont\b/g, "Don't")
    .replace(/\bDon'T\b/g, "Don't")
    .replace(/\bIs on\b/g, 'Is On');

const fallbackTitle = (input: string): string => {
  const cleaned = normalizeTitleText(input);
  if (!cleaned) {
    return 'Task';
  }
  return smartTitleCase(cleaned);
};

export const parseTaskInput = (input: string, opts?: TaskParseOptions): TaskParseResult => {
  const original = normalizeWhitespace(input || '');
  const now = parseReferenceDate(opts?.now);
  const timezone = opts?.timezone || DEFAULT_TIMEZONE;

  const priorityState = detectPriority(original);
  const assigneeState = extractAssignees(priorityState.working.replace(/^\s*(?:pls|please)\b/i, '').replace(/^\s*but\s+/i, ''));
  const dueState = extractDueDate(
    assigneeState.working,
    now,
    timezone,
    priorityState.dueForcedToday,
    assigneeState.directed,
  );

  const title = fallbackTitle(dueState.working)
    .replace(/\bAnd and\b/g, 'And')
    .replace(/\bTo to\b/g, 'To')
    .replace(/\bThe group\b/g, 'the Group')
    .replace(/\s+Both$/g, '');

  return {
    title,
    due_at: dueState.dueAt,
    priority: priorityState.priority,
    assignee_hints: assigneeState.assigneeHints,
  };
};

export type { TaskParseOptions, TaskParseResult, TaskPriority } from './types.ts';
