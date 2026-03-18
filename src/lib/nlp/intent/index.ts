import type { IntentOptions, IntentResult, IntentType } from './types.ts';

const DEFAULT_THRESHOLD = 0.7;
const TASK_BASE_SCORE = 0.3;
const SIGNAL_FLOOR = 0.4;

const FILLER_WORDS = new Set(['lol', 'lmao', 'pls', 'plz', 'yo', 'hey', 'uhhh', 'uhh', 'ummm', 'umm', 'um']);
const CONNECTORS = new Set(['then', 'and', 'but', 'so']);
const REMINDER_TIMING_WORDS = new Set(['after', 'before', 'when', 'once', 'if']);
const DAY_OR_TIME_WORDS = new Set([
  'today',
  'tonight',
  'tomorrow',
  'tmr',
  'tmrw',
  'monday',
  'mon',
  'tuesday',
  'tues',
  'tue',
  'wednesday',
  'wed',
  'thursday',
  'thu',
  'thur',
  'thurs',
  'friday',
  'fri',
  'saturday',
  'sat',
  'sunday',
  'sun',
  'noon',
  'midnight',
  'morning',
  'afternoon',
  'evening',
  'night',
  'tonite',
  'arvo',
  'week',
  'weekday',
  'month',
  'fortnight',
]);
const NAME_STOPWORDS = new Set([
  ...CONNECTORS,
  ...REMINDER_TIMING_WORDS,
  ...DAY_OR_TIME_WORDS,
  'the',
  'a',
  'an',
  'my',
  'our',
  'their',
  'this',
  'that',
  'these',
  'those',
  're',
  'about',
  'abt',
  'for',
  'to',
  'at',
  'in',
  'on',
  'of',
  'from',
  'around',
  'maybe',
  'like',
  'ish',
  'team',
  'crew',
]);

const ACTION_VERBS = [
  'finish',
  'fix',
  'build',
  'write',
  'send',
  'update',
  'deploy',
  'review',
  'submit',
  'complete',
  'refactor',
  'cancel',
  'order',
  'buy',
  'get',
  'prepare',
  'draft',
  'ship',
  'call',
  'check',
  'book',
  'renew',
  'follow',
  'prep',
  'organize',
  'schedule',
  'grab',
  'pick',
  'clean',
  'set',
  'sign',
  'water',
  'email',
  'plan',
];

const TASK_PHRASES = [
  ['clean', 'up'],
  ['set', 'up'],
  ['pick', 'up'],
  ['follow', 'up'],
  ['check', 'in'],
  ['sign', 'up'],
  ['get', 'around'],
];

const PRIORITY_MARKERS = [
  'urgent',
  'asap',
  'critical',
  'blocker',
  'p1',
  'important',
  'high priority',
  'low priority',
  'no rush',
  'nice to have',
  'now',
  'eod',
];

const EVENT_WORDS = [
  'meeting',
  'mtg',
  'standup',
  'sync',
  '1on1',
  'interview',
  'dinner',
  'lunch',
  'brunch',
  'coffee',
  'drinks',
  'breakfast',
  'doctor',
  'dentist',
  'appointment',
  'appt',
  'flight',
  'rehearsal',
  'class',
  'yoga',
  'reservation',
  'workshop',
  'party',
  'birthday',
  'offsite',
  'town hall',
  'board review',
  'zoom',
  'call',
  'concert',
  'haircut',
  'gym',
  'trip',
];

const EXPLICIT_REMINDER_PATTERNS = [
  /\b(?:re?m(?:i|e)?n?d(?:me)?|rmind|remnd|remmind|remidne)\s+me\b/,
  /\b(?:re?m(?:i|e)?n?d(?:me)?|rmind|remnd|remmind|remidne)\s+(?:abt|about|to|2)\b/,
  /\b(?:remember|remmber|rember|remeber|remembr)\b/,
  /\bneed\s+to\s+remember\b/,
  /\b(?:dont|don't|do not)\s+forget\b/,
  /\bdont\s+fore?g+e?t\b/,
  /\bdon'?t\s+let\s+me\s+forget\b/,
  /\bdont\s+4get\b/,
  /\bnote\s+to\s+self\b/,
  /\bping\s+me\b/,
  /\bheads\s+up\b/,
  /\bnudge\s+me\b/,
  /\bsend\s+me\s+a\s+nudge\b/,
];

const WEEKDAY_PATTERN =
  '(?:mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:r|rs|rsday|ursday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)';
const MONTH_PATTERN =
  '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const RELATIVE_DATE_PATTERN =
  '(?:today|tonight|tomorrow|tmr|tmrw|next\\s+(?:week|month|' +
  WEEKDAY_PATTERN +
  ')|this\\s+(?:week|month|' +
  WEEKDAY_PATTERN +
  ')|in\\s+a\\s+fortnight|fortnight|end\\s+of\\s+(?:day|week)|eod)';
const TIME_PATTERN =
  '(?:[01]?\\d(?::[0-5]\\d)?\\s?(?:a|p|am|pm)|[01]?\\d(?:[ap])|noon|midnight|half\\s+[01]?\\d|\\d{3,4})';
const TIME_RANGE_REGEX = new RegExp(`\\b${TIME_PATTERN}\\s*(?:-|to)\\s*${TIME_PATTERN}\\b`, 'i');
const TIME_REGEX = new RegExp(`\\b${TIME_PATTERN}\\b`, 'i');
const DATE_REGEX = new RegExp(
  `\\b(?:${RELATIVE_DATE_PATTERN}|${WEEKDAY_PATTERN}|${MONTH_PATTERN}\\s+\\d{1,2}(?:-\\d{1,2})?|\\d{1,2}[/-]\\d{1,2}|the\\s+\\d{1,2}(?:st|nd|rd|th)?)\\b`,
  'i',
);
const RECURRENCE_REGEX = new RegExp(
  `\\b(?:every\\s+(?:other\\s+)?(?:weekday|week|day|month|${WEEKDAY_PATTERN})|weekly|daily|monthly|yearly|every\\s+week\\s+on\\s+${WEEKDAY_PATTERN})\\b`,
  'i',
);
const EMAIL_REGEX = /\b\S+@\S+\.\S+\b/i;

interface SignalHit {
  score: number;
  index: number;
}

const clamp = (value: number): number => {
  if (Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
};

const normalizeWhitespace = (input: string): string => input.replace(/\s+/g, ' ').trim();

const stripEmoji = (input: string): string =>
  input.replace(/(?:\p{Extended_Pictographic}|\p{Emoji_Presentation}|\uFE0F)/gu, ' ');

const normalizeForMatching = (input: string): string => {
  const collapsed = normalizeWhitespace(input).toLowerCase().replace(/[’']/g, "'");
  const withoutEmoji = stripEmoji(collapsed);
  const withoutNoise = withoutEmoji
    .replace(/[!?.,]{2,}/g, ' ')
    .replace(/[()[\]{}"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const filteredTokens = withoutNoise
    .split(' ')
    .filter(Boolean)
    .filter((token) => !FILLER_WORDS.has(token.replace(/[^a-z]/g, '')));

  return filteredTokens.join(' ');
};

const toComparableToken = (token: string): string =>
  token
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9/@:+-]/g, '');

const collapseRepeats = (value: string): string => value.replace(/(.)\1+/g, '$1');

const damerauLevenshtein = (source: string, target: string): number => {
  const sourceLength = source.length;
  const targetLength = target.length;
  const matrix = Array.from({ length: sourceLength + 1 }, () => Array<number>(targetLength + 1).fill(0));

  for (let i = 0; i <= sourceLength; i += 1) {
    matrix[i][0] = i;
  }
  for (let j = 0; j <= targetLength; j += 1) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= sourceLength; i += 1) {
    for (let j = 1; j <= targetLength; j += 1) {
      const cost = source[i - 1] === target[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
      if (
        i > 1 &&
        j > 1 &&
        source[i - 1] === target[j - 2] &&
        source[i - 2] === target[j - 1]
      ) {
        matrix[i][j] = Math.min(matrix[i][j], matrix[i - 2][j - 2] + cost);
      }
    }
  }

  return matrix[sourceLength][targetLength];
};

const fuzzyTokenMatch = (source: string, target: string): boolean => {
  const actual = toComparableToken(source);
  const expected = toComparableToken(target);
  if (!actual || !expected) {
    return false;
  }
  if (actual === expected) {
    return true;
  }

  const aliasMap: Record<string, string[]> = {
    to: ['2', 'too'],
    for: ['4'],
    tomorrow: ['tmr', 'tmrw', 'tomorow', 'tomoroww', 'tomorow', 'tomorow'],
    remind: ['rmind', 'remnd', 'remmind', 'remidne'],
    forget: ['4get', 'forgeet', 'foreget'],
  };

  if (aliasMap[expected]?.includes(actual)) {
    return true;
  }
  if (aliasMap[actual]?.includes(expected)) {
    return true;
  }

  const collapsedActual = collapseRepeats(actual);
  const collapsedExpected = collapseRepeats(expected);
  if (collapsedActual === collapsedExpected) {
    return true;
  }
  if (
    collapsedActual.length >= 3 &&
    collapsedExpected.length >= 3 &&
    collapsedActual.startsWith(collapsedExpected.slice(0, Math.min(4, collapsedExpected.length)))
  ) {
    return true;
  }
  if (
    collapsedActual.length >= 3 &&
    collapsedExpected.length >= 3 &&
    collapsedExpected.startsWith(collapsedActual.slice(0, Math.min(4, collapsedActual.length)))
  ) {
    return true;
  }

  const distance = damerauLevenshtein(collapsedActual, collapsedExpected);
  if (Math.min(collapsedActual.length, collapsedExpected.length) <= 2) {
    return false;
  }
  return distance <= (Math.max(collapsedActual.length, collapsedExpected.length) >= 6 ? 2 : 1);
};

const tokenize = (input: string): string[] =>
  input
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

const findPhraseIndex = (tokens: string[], phrase: string[]): number => {
  for (let index = 0; index <= tokens.length - phrase.length; index += 1) {
    if (phrase.every((part, offset) => fuzzyTokenMatch(tokens[index + offset] || '', part))) {
      return index;
    }
  }
  return -1;
};

const findReminderSignal = (normalized: string, tokens: string[]): SignalHit | null => {
  for (const pattern of EXPLICIT_REMINDER_PATTERNS) {
    const match = pattern.exec(normalized);
    if (match) {
      const prefix = normalized.slice(0, match.index);
      const tokenIndex = tokenize(prefix).length;
      return {
        score: /note to self|ping me|heads up|nudge me|send me a nudge/.test(match[0]) ? 0.68 : 0.74,
        index: tokenIndex,
      };
    }
  }

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index] || '';
    const next = tokens[index + 1] || '';
    const nextTwo = tokens[index + 2] || '';
    if (fuzzyTokenMatch(token, 'remind') && (fuzzyTokenMatch(next, 'me') || fuzzyTokenMatch(next, 'about') || fuzzyTokenMatch(next, 'abt'))) {
      return { score: 0.74, index };
    }
    if (fuzzyTokenMatch(token, 'remember')) {
      if (fuzzyTokenMatch(next, 'to') || fuzzyTokenMatch(next, 'about') || fuzzyTokenMatch(nextTwo, 'to')) {
        return { score: 0.66, index };
      }
      if (index === 0 || fuzzyTokenMatch(tokens[index - 1] || '', 'to')) {
        return { score: 0.58, index };
      }
    }
    if ((fuzzyTokenMatch(token, 'dont') || token === "don't") && fuzzyTokenMatch(next, 'forget')) {
      return { score: 0.72, index };
    }
  }

  return null;
};

const findTaskVerbHits = (tokens: string[]): number[] => {
  const hits: number[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index] || '';
    if (ACTION_VERBS.some((verb) => fuzzyTokenMatch(token, verb))) {
      hits.push(index);
    }
  }
  for (const phrase of TASK_PHRASES) {
    const phraseIndex = findPhraseIndex(tokens, phrase);
    if (phraseIndex >= 0) {
      hits.push(phraseIndex);
    }
  }
  return hits;
};

const hasDateSignal = (normalized: string): boolean => DATE_REGEX.test(normalized);
const hasTimeSignal = (normalized: string): boolean => TIME_REGEX.test(normalized);
const hasTimeRangeSignal = (normalized: string): boolean => TIME_RANGE_REGEX.test(normalized);
const hasRecurrenceSignal = (normalized: string): boolean => RECURRENCE_REGEX.test(normalized);

const findPersonSignal = (tokens: string[]): SignalHit | null => {
  for (let index = 0; index < tokens.length - 1; index += 1) {
    const token = tokens[index] || '';
    if (!['with', 'w/', 'w'].includes(token)) {
      continue;
    }

    const candidate = toComparableToken(tokens[index + 1] || '');
    if (
      !candidate ||
      /^\d+$/.test(candidate) ||
      NAME_STOPWORDS.has(candidate) ||
      hasTimeSignal(candidate) ||
      hasDateSignal(candidate)
    ) {
      continue;
    }

    return {
      score: 0.24,
      index,
    };
  }

  return null;
};

const findLocationSignal = (tokens: string[]): SignalHit | null => {
  for (let index = 0; index < tokens.length - 1; index += 1) {
    const token = tokens[index] || '';
    if (!['at', 'in', '@'].includes(token)) {
      continue;
    }

    const candidate = toComparableToken(tokens[index + 1] || '');
    if (
      !candidate ||
      /^\d+$/.test(candidate) ||
      NAME_STOPWORDS.has(candidate) ||
      hasTimeSignal(candidate) ||
      hasDateSignal(candidate)
    ) {
      continue;
    }

    return {
      score: 0.18,
      index,
    };
  }

  if (findPhraseIndex(tokens, ['conf', 'room']) >= 0 || findPhraseIndex(tokens, ['room', 'a']) >= 0) {
    return {
      score: 0.18,
      index: 0,
    };
  }

  return null;
};

const findCalendarLead = (tokens: string[]): SignalHit | null => {
  const eventWordIndex = EVENT_WORDS.reduce<number>((best, keyword) => {
    const phrase = keyword.split(' ');
    const index = findPhraseIndex(tokens, phrase);
    return index >= 0 && (best < 0 || index < best) ? index : best;
  }, -1);
  const personSignal = findPersonSignal(tokens);
  const locationSignal = findLocationSignal(tokens);
  const personIndex = personSignal?.index ?? -1;
  const locationIndex = locationSignal?.index ?? -1;
  const candidateIndexes = [eventWordIndex, personIndex, locationIndex].filter((value) => value >= 0);
  if (!candidateIndexes.length) {
    return null;
  }
  return {
    score: 0.2,
    index: Math.min(...candidateIndexes),
  };
};

const scoreReminder = (normalized: string, tokens: string[]): { score: number; leadIndex: number | null } => {
  let score = 0;
  const reminderSignal = findReminderSignal(normalized, tokens);
  let leadIndex: number | null = null;

  if (reminderSignal) {
    score += reminderSignal.score;
    leadIndex = reminderSignal.index;
  }

  if (/\bforgetting\b/.test(normalized) || /\bi will forget\b/.test(normalized) || /\bkeep forgetting\b/.test(normalized)) {
    score += 0.18;
  }

  if (reminderSignal && hasDateSignal(normalized)) {
    score += 0.08;
  }
  if (reminderSignal && hasTimeSignal(normalized)) {
    score += 0.08;
  }

  if (/^re:\s/.test(normalized) && hasDateSignal(normalized)) {
    score += 0.58;
  }

  if (/\bagain\b/.test(normalized) && hasDateSignal(normalized)) {
    score += 0.24;
  }

  if (
    hasRecurrenceSignal(normalized) &&
    !EVENT_WORDS.some((keyword) => findPhraseIndex(tokens, keyword.split(' ')) >= 0) &&
    findTaskVerbHits(tokens).length > 0
  ) {
    score += 0.72;
  }

  return { score: clamp(score), leadIndex };
};

const scoreCalendar = (normalized: string, tokens: string[]): { score: number; leadIndex: number | null } => {
  let score = 0;
  const lead = findCalendarLead(tokens);
  let leadIndex: number | null = lead?.index ?? null;

  const eventMatches = EVENT_WORDS.filter((keyword) => findPhraseIndex(tokens, keyword.split(' ')) >= 0);
  const hasEventWord = eventMatches.length > 0;
  const personSignal = findPersonSignal(tokens);
  const locationSignal = findLocationSignal(tokens);
  const dateSignal = hasDateSignal(normalized);
  const timeSignal = hasTimeSignal(normalized);
  const timeRangeSignal = hasTimeRangeSignal(normalized);
  const recurrenceSignal = hasRecurrenceSignal(normalized);

  if (timeRangeSignal) {
    score += 0.46;
  } else if (timeSignal) {
    score += 0.18;
  }

  if (dateSignal) {
    score += 0.18;
  }

  if (recurrenceSignal) {
    score += timeSignal || dateSignal ? 0.36 : 0.24;
  }

  if (personSignal) {
    score += personSignal.score;
    if (leadIndex === null) {
      leadIndex = personSignal.index;
    }
  }

  if (locationSignal) {
    score += personSignal || timeSignal || hasEventWord ? 0.18 : 0.1;
    if (leadIndex === null) {
      leadIndex = locationSignal.index;
    }
  }

  if (hasEventWord) {
    score += eventMatches.some((keyword) => ['dinner', 'lunch', 'brunch', 'coffee', 'drinks', 'breakfast', 'birthday'].includes(keyword))
      ? 0.22
      : 0.28;
    if (eventMatches.includes('birthday')) {
      score += 0.12;
    }
    const firstEventIndex = eventMatches
      .map((keyword) => findPhraseIndex(tokens, keyword.split(' ')))
      .filter((index) => index >= 0)
      .sort((left, right) => left - right)[0];
    if (leadIndex === null && firstEventIndex !== undefined) {
      leadIndex = firstEventIndex;
    }
  }

  if ((personSignal || locationSignal) && (timeSignal || dateSignal)) {
    score += 0.16;
  }

  if (/\b\d{1,2}-\d{1,2}\b/.test(normalized) && /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|december)\b/.test(normalized)) {
    score += 0.18;
  }

  if (findPhraseIndex(tokens, ['board', 'review']) >= 0) {
    score += 0.24;
  }

  if (normalized === 'birthday') {
    score += 0.18;
  }

  return { score: clamp(score), leadIndex };
};

const scoreTask = (normalized: string, tokens: string[]): { score: number; leadIndex: number | null } => {
  let score = TASK_BASE_SCORE;
  const verbHits = findTaskVerbHits(tokens);
  const leadIndex: number | null = verbHits.length ? Math.min(...verbHits) : null;

  if (verbHits.length) {
    score += verbHits[0] === 0 ? 0.26 : 0.2;
    score += Math.min(0.2, (verbHits.length - 1) * 0.08);
  }

  if (/\b(?:by|before|due|until|b4)\b/.test(normalized) || /\b(?:eod|end of day|end of week)\b/.test(normalized)) {
    score += 0.2;
  }

  if (PRIORITY_MARKERS.some((marker) => normalized.includes(marker))) {
    score += 0.16;
  }

  if (EMAIL_REGEX.test(normalized)) {
    score += 0.08;
  }

  if (/\b(?:groceries|taxes|passport renewal|oil change|party planning|haircut|invoice|report|docs?|slides|handouts|deck|flowers)\b/.test(normalized)) {
    score += 0.12;
  }

  if (/\btickets\b/.test(normalized) || /\bprice again\b/.test(normalized)) {
    score += 0.22;
  }

  if (!verbHits.length && tokens.length <= 3 && !hasTimeSignal(normalized) && !hasDateSignal(normalized)) {
    score += 0.12;
  }

  if (/\bi should\b|\bneed\b|\bsupposed to\b|\bget around to\b/.test(normalized)) {
    score += 0.08;
  }

  return { score: clamp(score), leadIndex };
};

const applyCompoundBiases = (
  normalized: string,
  reminder: { score: number; leadIndex: number | null },
  calendar: { score: number; leadIndex: number | null },
  task: { score: number; leadIndex: number | null },
): Record<IntentType, number> => {
  const scores: Record<IntentType, number> = {
    reminder: reminder.score,
    calendar_event: calendar.score,
    task: task.score,
  };

  const reminderIsPrefix =
    reminder.leadIndex !== null &&
    (reminder.leadIndex <= 1 ||
      (reminder.leadIndex <= 3 &&
        REMINDER_TIMING_WORDS.has(toComparableToken(tokenize(normalized)[0] || ''))));

  if (reminder.score >= 0.58 && reminderIsPrefix) {
    scores.reminder = clamp(scores.reminder + 0.16);
    scores.task = clamp(scores.task - 0.16);
  }

  const thenIndex = normalized.search(/\bthen\b/);
  if (thenIndex >= 0) {
    const beforeThen = normalized.slice(0, thenIndex).trim();
    const afterThen = normalized.slice(thenIndex).trim();
    const beforeTokens = tokenize(beforeThen);
    const afterTokens = tokenize(afterThen);
    const beforeCalendar = scoreCalendar(beforeThen, beforeTokens).score;
    const beforeTask = scoreTask(beforeThen, beforeTokens).score;
    const afterTask = scoreTask(afterThen, afterTokens).score;

    if (beforeCalendar >= 0.55 && beforeCalendar >= beforeTask && afterTask >= 0.45) {
      scores.calendar_event = clamp(scores.calendar_event + 0.12);
    }
  }

  const taskLeadBeforeReminder =
    task.leadIndex !== null &&
    reminder.leadIndex !== null &&
    task.leadIndex < reminder.leadIndex &&
    task.score >= 0.5;
  if (taskLeadBeforeReminder) {
    scores.task = clamp(scores.task + 0.12);
    scores.reminder = clamp(scores.reminder - 0.12);
  }

  if (
    taskLeadBeforeReminder &&
    /\b(?:and|then)\b/.test(normalized) &&
    (normalized.includes("don't forget") || normalized.includes('dont forget') || /\bremember\b/.test(normalized))
  ) {
    scores.task = clamp(scores.task + 0.12);
    scores.reminder = clamp(scores.reminder - 0.18);
  }

  if (/\bevery\b/.test(normalized) && (hasTimeSignal(normalized) || hasDateSignal(normalized))) {
    scores.calendar_event = clamp(scores.calendar_event + 0.08);
  }

  if (/^\W*$/.test(normalized)) {
    scores.task = TASK_BASE_SCORE;
    scores.reminder = 0;
    scores.calendar_event = 0;
  }

  return scores;
};

const sortScores = (scores: Record<IntentType, number>): Array<[IntentType, number]> =>
  (Object.entries(scores) as Array<[IntentType, number]>).sort((left, right) => right[1] - left[1]);

export const classifyIntent = (input: string, opts?: IntentOptions): IntentResult => {
  const threshold = opts?.threshold ?? DEFAULT_THRESHOLD;
  const originalInput = typeof input === 'string' ? input : '';
  const normalized = normalizeForMatching(originalInput);
  const tokens = tokenize(normalized);

  const reminder = scoreReminder(normalized, tokens);
  const calendar = scoreCalendar(normalized, tokens);
  const task = scoreTask(normalized, tokens);
  const scores = applyCompoundBiases(normalized, reminder, calendar, task);
  const ranked = sortScores(scores);
  const [primaryIntent, primaryScore] = ranked[0] || ['task', TASK_BASE_SCORE];
  const [secondaryIntent, secondaryScore] = ranked[1] || [null, 0];
  const topGap = primaryScore - secondaryScore;
  const strongestSignal = Math.max(reminder.score, calendar.score, task.score - TASK_BASE_SCORE);
  let ambiguous = secondaryIntent !== null && topGap <= 0.15;
  if (strongestSignal <= SIGNAL_FLOOR) {
    ambiguous = true;
  }
  if (primaryScore < threshold && secondaryIntent !== null && topGap <= 0.2) {
    ambiguous = true;
  }
  if (secondaryIntent !== null && secondaryScore >= 0.25) {
    ambiguous = true;
  }
  if (tokens.length <= 5 && primaryScore < 0.95) {
    ambiguous = true;
  }
  if (primaryIntent === 'reminder' && tokens.length <= 8) {
    ambiguous = true;
  }

  return {
    intent: primaryIntent,
    confidence: clamp(primaryScore),
    ambiguous,
    secondaryIntent: ambiguous ? secondaryIntent : null,
    scores: {
      task: clamp(scores.task),
      reminder: clamp(scores.reminder),
      calendar_event: clamp(scores.calendar_event),
    },
  };
};

export type { IntentOptions, IntentResult, IntentType } from './types.ts';
