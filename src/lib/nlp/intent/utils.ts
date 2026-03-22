export interface ScoreLead {
  score: number;
  leadIndex: number | null;
}

export const FILLER_WORDS = new Set(['lol', 'lmao', 'pls', 'plz', 'yo', 'hey', 'uhhh', 'uhh', 'ummm', 'umm', 'um']);
export const CONNECTORS = new Set(['then', 'and', 'but', 'so']);
export const DAY_OR_TIME_WORDS = new Set([
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
export const NAME_STOPWORDS = new Set([
  ...CONNECTORS,
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

export const WEEKDAY_PATTERN =
  '(?:mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:r|rs|rsday|ursday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)';
export const MONTH_PATTERN =
  '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
export const RELATIVE_DATE_PATTERN =
  '(?:today|tonight|tomorrow|tmr|tmrw|next\\s+(?:week|month|' +
  WEEKDAY_PATTERN +
  ')|this\\s+(?:week|month|' +
  WEEKDAY_PATTERN +
  ')|in\\s+a\\s+fortnight|fortnight|end\\s+of\\s+(?:day|week)|eod)';
export const TIME_PATTERN =
  '(?:[01]?\\d(?::[0-5]\\d)?\\s?(?:a|p|am|pm)|[01]?\\d(?:[ap])|noon|midnight|half\\s+[01]?\\d|\\d{3,4})';

export const TIME_RANGE_REGEX = new RegExp(`\\b${TIME_PATTERN}\\s*(?:-|to)\\s*${TIME_PATTERN}\\b`, 'i');
export const TIME_REGEX = new RegExp(`\\b${TIME_PATTERN}\\b`, 'i');
export const DATE_REGEX = new RegExp(
  `\\b(?:${RELATIVE_DATE_PATTERN}|${WEEKDAY_PATTERN}|${MONTH_PATTERN}\\s+\\d{1,2}(?:-\\d{1,2})?|\\d{1,2}[/-]\\d{1,2}|the\\s+\\d{1,2}(?:st|nd|rd|th)?)\\b`,
  'i',
);
export const RECURRENCE_REGEX = new RegExp(
  `\\b(?:every\\s+(?:other\\s+)?(?:weekday|week|day|month|${WEEKDAY_PATTERN})|weekly|daily|monthly|yearly|every\\s+week\\s+on\\s+${WEEKDAY_PATTERN})\\b`,
  'i',
);
export const EMAIL_REGEX = /\b\S+@\S+\.\S+\b/i;

export const clamp = (value: number): number => {
  if (Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
};

export const normalizeWhitespace = (input: string): string => input.replace(/\s+/g, ' ').trim();

export const stripEmoji = (input: string): string =>
  input.replace(/(?:\p{Extended_Pictographic}|\p{Emoji_Presentation}|\uFE0F)/gu, ' ');

export const normalizeForMatching = (input: string): string => {
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

export const toComparableToken = (token: string): string =>
  token
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9/@:+-]/g, '');

export const collapseRepeats = (value: string): string => value.replace(/(.)\1+/g, '$1');

export const damerauLevenshtein = (source: string, target: string): number => {
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

export const fuzzyTokenMatch = (source: string, target: string): boolean => {
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

export const tokenize = (input: string): string[] =>
  input
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

export const findPhraseIndex = (tokens: string[], phrase: string[]): number => {
  for (let index = 0; index <= tokens.length - phrase.length; index += 1) {
    if (phrase.every((part, offset) => fuzzyTokenMatch(tokens[index + offset] || '', part))) {
      return index;
    }
  }
  return -1;
};

export const hasDateSignal = (normalized: string): boolean => DATE_REGEX.test(normalized);
export const hasTimeSignal = (normalized: string): boolean => TIME_REGEX.test(normalized);
export const hasTimeRangeSignal = (normalized: string): boolean => TIME_RANGE_REGEX.test(normalized);
export const hasRecurrenceSignal = (normalized: string): boolean => RECURRENCE_REGEX.test(normalized);
