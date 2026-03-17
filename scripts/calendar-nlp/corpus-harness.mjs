import { readFileSync } from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { parseEventInput } from '../../src/lib/calendar-nlp/index.ts';
import { resolveRelativeWeekday } from '../../src/lib/calendar-nlp/passes/chronoPass.ts';
import { detectSystemTimezone, parseReferenceDate } from '../../src/lib/calendar-nlp/utils.ts';

const DEFAULT_CONFIDENCE_TOLERANCE = 0.2;

const FIELD_PATHS = [
  'title',
  'date',
  'time',
  'end_time',
  'duration_minutes',
  'location',
  'recurrence.frequency',
  'recurrence.interval',
  'recurrence.days',
  'recurrence.exceptions',
  'recurrence.end_date',
  'alerts',
  'attendees',
];

export const loadCorpus = (corpusPath) => {
  const absolutePath = path.resolve(corpusPath);
  const content = readFileSync(absolutePath, 'utf8');
  const parsed = JSON.parse(content);

  if (!parsed?.tiers || typeof parsed.tiers !== 'object') {
    throw new Error(`Invalid corpus file at ${absolutePath}: missing tiers object`);
  }

  return {
    path: absolutePath,
    meta: parsed.meta || {},
    tiers: parsed.tiers,
  };
};

const getAtPath = (value, dottedPath) =>
  dottedPath.split('.').reduce((current, segment) => (current === null || current === undefined ? undefined : current[segment]), value);

const add60ToIsoTime = (time) => {
  const match = /^(\d{2}):(\d{2})$/.exec(time || '');
  if (!match) {
    return null;
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
    return null;
  }

  const total = hour * 60 + minute + 60;
  const wrapped = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const nextHour = Math.floor(wrapped / 60);
  const nextMinute = wrapped % 60;
  return `${String(nextHour).padStart(2, '0')}:${String(nextMinute).padStart(2, '0')}`;
};

const NEXT_WEEKDAY_REGEX =
  /\bnext\s+(?!week\b)(mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:r|rs|rsday|ursday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\b/i;
const RECURRENCE_ANCHOR_REGEX = /\b(?:starting|from)\s+/i;

const getOptionBDateOverride = (input, parseOpts) => {
  const match = NEXT_WEEKDAY_REGEX.exec(input || '');
  if (!match) {
    return null;
  }

  const now = parseReferenceDate(parseOpts?.now);
  const timezone = parseOpts?.timezone || detectSystemTimezone();
  const resolved = resolveRelativeWeekday(match[1], 'next', now, timezone);
  return resolved?.dateISO || null;
};

const normalizeExpectedShape = (expected, input, parseOpts) => {
  const recurrenceFrequency = expected?.recurrence?.frequency ?? null;
  const hasRecurrenceAnchor = RECURRENCE_ANCHOR_REGEX.test(input || '');
  const expectedDate = expected?.date ?? null;
  const optionBDate = getOptionBDateOverride(input, parseOpts);
  const normalizedDate = recurrenceFrequency && hasRecurrenceAnchor ? null : optionBDate || expectedDate;
  const expectedTime = expected?.time ?? null;
  const shouldDefaultEnd = expected?.end_time == null && expected?.duration_minutes == null && typeof expectedTime === 'string';
  const normalizedEndTime = shouldDefaultEnd ? add60ToIsoTime(expectedTime) : expected?.end_time ?? null;
  const normalizedDuration = shouldDefaultEnd ? 60 : expected?.duration_minutes ?? null;

  return {
  // Treat null and [] as semantically equivalent for recurrence exceptions.
  // Both represent "no exception dates captured yet".
  title: expected?.title ?? null,
  date: normalizedDate,
  time: expectedTime,
  end_time: normalizedEndTime,
  duration_minutes: normalizedDuration,
  location: expected?.location ?? null,
  recurrence: {
    frequency: expected?.recurrence?.frequency ?? null,
    interval: expected?.recurrence?.interval ?? null,
    days: expected?.recurrence?.days ?? null,
    exceptions:
      Array.isArray(expected?.recurrence?.exceptions) && expected.recurrence.exceptions.length === 0
        ? null
        : expected?.recurrence?.exceptions ?? null,
    end_date: expected?.recurrence?.end_date ?? null,
  },
  alerts: expected?.alerts ?? null,
  attendees: expected?.attendees ?? null,
  };
};

const normalizeActualShape = (actual) => ({
  title: actual?.title ?? null,
  date: actual?.date ?? null,
  time: actual?.time ?? null,
  end_time: actual?.end_time ?? null,
  duration_minutes: actual?.duration_minutes ?? null,
  location: actual?.location ?? null,
  recurrence: {
    frequency: actual?.recurrence?.frequency ?? null,
    interval: actual?.recurrence?.interval ?? null,
    days: actual?.recurrence?.days ?? null,
    exceptions:
      Array.isArray(actual?.recurrence?.exceptions) && actual.recurrence.exceptions.length === 0
        ? null
        : actual?.recurrence?.exceptions ?? null,
    end_date: actual?.recurrence?.end_date ?? null,
  },
  alerts: actual?.alerts ?? null,
  attendees: actual?.attendees ?? null,
});

const extractExpectedConfidence = (example) => {
  if (example?.expected_confidence && typeof example.expected_confidence === 'object') {
    return example.expected_confidence;
  }
  if (example?.confidence && typeof example.confidence === 'object') {
    return example.confidence;
  }
  return null;
};

const pretty = (value) => JSON.stringify(value, null, 2);

const confidenceDiffs = (actualConfidence, expectedConfidence, tolerance) => {
  const diffs = [];
  for (const [field, expectedValue] of Object.entries(expectedConfidence || {})) {
    if (typeof expectedValue !== 'number') {
      continue;
    }
    const actualValue = actualConfidence?.[field];
    if (typeof actualValue !== 'number') {
      diffs.push({ field, expected: expectedValue, actual: actualValue, delta: null });
      continue;
    }
    const delta = Math.abs(actualValue - expectedValue);
    if (delta > tolerance) {
      diffs.push({ field, expected: expectedValue, actual: actualValue, delta });
    }
  }
  return diffs;
};

const findFieldDiffs = (expected, actual) => {
  const diffs = [];
  for (const fieldPath of FIELD_PATHS) {
    const expectedValue = getAtPath(expected, fieldPath);
    const actualValue = getAtPath(actual, fieldPath);
    if (!isDeepStrictEqual(actualValue, expectedValue)) {
      diffs.push({ fieldPath, expected: expectedValue, actual: actualValue });
    }
  }
  return diffs;
};

export const renderGoldenDiff = ({ example, actualResult, expectedFields, confidenceTolerance }) => {
  const actualFields = normalizeActualShape(actualResult.fields);
  const fieldDiffList = findFieldDiffs(expectedFields, actualFields);

  const expectedConfidence = extractExpectedConfidence(example);
  const confidenceDiffList = confidenceDiffs(
    actualResult.meta.confidence,
    expectedConfidence,
    confidenceTolerance ?? DEFAULT_CONFIDENCE_TOLERANCE,
  );

  if (fieldDiffList.length === 0 && confidenceDiffList.length === 0) {
    return '';
  }

  const lines = [];
  lines.push(`Example ${example.id}: ${example.input}`);

  if (fieldDiffList.length > 0) {
    lines.push('Field mismatches:');
    for (const diff of fieldDiffList) {
      lines.push(`  - ${diff.fieldPath}`);
      lines.push(`    expected: ${pretty(diff.expected)}`);
      lines.push(`    actual:   ${pretty(diff.actual)}`);
      const topField = diff.fieldPath.split('.')[0];
      const spans = actualResult.meta.spans[topField] || [];
      if (spans.length > 0) {
        lines.push(`    spans(${topField}): ${pretty(spans)}`);
      }
    }
  }

  if (confidenceDiffList.length > 0) {
    lines.push('Confidence mismatches:');
    for (const diff of confidenceDiffList) {
      lines.push(
        `  - ${diff.field}: expected ${String(diff.expected)}, actual ${String(diff.actual)}, delta ${
          diff.delta === null ? 'n/a' : diff.delta.toFixed(3)
        }`,
      );
    }
  }

  return lines.join('\n');
};

export const runCorpusExample = (example, parseOpts, confidenceTolerance) => {
  const expectedFields = normalizeExpectedShape(example.expected, example.input, parseOpts);
  const actualResult = parseEventInput(example.input, parseOpts);
  const actualFields = normalizeActualShape(actualResult.fields);
  const fieldsMatch = isDeepStrictEqual(actualFields, expectedFields);

  const expectedConfidence = extractExpectedConfidence(example);
  const confidenceDiffList = confidenceDiffs(
    actualResult.meta.confidence,
    expectedConfidence,
    confidenceTolerance ?? DEFAULT_CONFIDENCE_TOLERANCE,
  );

  const ok = fieldsMatch && confidenceDiffList.length === 0;

  return {
    ok,
    expectedFields,
    actualResult,
    diff: ok
      ? ''
      : renderGoldenDiff({
          example,
          actualResult,
          expectedFields,
          confidenceTolerance,
        }),
  };
};

export const flattenCorpusExamples = (tiers) => {
  const examples = [];
  for (const [tierName, tierExamples] of Object.entries(tiers)) {
    if (!Array.isArray(tierExamples)) {
      continue;
    }
    for (const example of tierExamples) {
      examples.push({ tier: tierName, ...example });
    }
  }
  return examples;
};
