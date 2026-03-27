import * as chrono from 'chrono-node';

import { SHARED_ACRONYM_MAP } from '../shared/constants.ts';
import {
  addDays,
  formatDateInTimezone,
  formatDateTimeInTimezone,
  getZonedDateParts,
  normalizeWhitespace,
  parseReferenceDate,
} from '../shared/utils.ts';
import {
  DATE_TYPO_CORRECTIONS,
  DEFAULT_KNOWN_ASSIGNEES,
  HIGH_PRIORITY_PATTERNS,
  LEADING_FILLER_PATTERNS,
  LOW_PRIORITY_PATTERNS,
  MEDIUM_PRIORITY_PATTERNS,
  PHRASE_CORRECTIONS,
  PRIORITY_ORDER,
  SMALL_WORDS,
  TITLE_WORD_CORRECTIONS,
  TRAILING_FILLER_PATTERNS,
} from './constants.ts';
import type { TaskParseContext, TaskParseOptions, TaskParseResult, TaskPriority } from './types.ts';

type PatternMatch = {
  start: number;
  end: number;
  text: string;
  confidence: number;
  ruleId: string;
  note: string;
};

const TITLE_ACRONYM_MAP: Record<string, string> = {
  ...SHARED_ACRONYM_MAP,
  dnd: 'DnD',
};

export const clampConfidence = (value: number): number => {
  if (Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
};

export const createTaskParseResult = (maskedInput: string): TaskParseResult => ({
  fields: {
    title: '',
    due_at: null,
    priority: null,
    assignee_hints: [],
  },
  meta: {
    confidence: {
      title: 0,
      due_at: 0,
      priority: 0,
      assignee_hints: 0,
    },
    spans: {
      title: [],
      due_at: [],
      priority: [],
      assignee_hints: [],
    },
    debugSteps: [],
    maskedInput,
  },
  warnings: null,
});

export const createTaskParseContext = (input: string, opts?: TaskParseOptions): TaskParseContext => {
  const rawInput = normalizeWhitespace(input || '');
  const now = parseReferenceDate(opts?.now);
  const timezone = opts?.timezone || 'UTC';

  return {
    rawInput,
    working: rawInput,
    maskedInput: rawInput,
    now,
    options: {
      timezone,
      knownAssignees: opts?.knownAssignees,
      debug: Boolean(opts?.debug),
    },
    result: createTaskParseResult(rawInput),
    state: {
      dueForcedToday: false,
      preferNextWeekStart: false,
    },
  };
};

export const setFieldConfidence = (
  ctx: TaskParseContext,
  field: keyof TaskParseResult['meta']['confidence'],
  value: number,
): void => {
  const safe = clampConfidence(value);
  if (safe > ctx.result.meta.confidence[field]) {
    ctx.result.meta.confidence[field] = safe;
  }
};

export const addFieldSpan = (
  ctx: TaskParseContext,
  field: keyof TaskParseResult['meta']['spans'],
  span: { start: number; end: number; text: string },
): void => {
  ctx.result.meta.spans[field].push({
    start: span.start,
    end: span.end,
    text: span.text,
  });
};

export const addDebugStep = (
  ctx: TaskParseContext,
  step: {
    pass: string;
    ruleId: string;
    start: number;
    end: number;
    text: string;
    confidence: number;
    note: string;
  },
): void => {
  ctx.result.meta.debugSteps.push({
    ...step,
    confidence: clampConfidence(step.confidence),
  });
};

const collectPatternMatches = (
  input: string,
  pattern: RegExp,
  ruleId: string,
  confidence: number,
  note: string,
): PatternMatch[] => {
  const matches: PatternMatch[] = [];
  pattern.lastIndex = 0;
  for (const match of input.matchAll(pattern)) {
    const text = match[0] || '';
    const start = match.index ?? -1;
    if (start < 0 || !text) {
      continue;
    }
    matches.push({
      start,
      end: start + text.length,
      text,
      confidence,
      ruleId,
      note,
    });
  }
  pattern.lastIndex = 0;
  return matches;
};

const endOfMonthIso = (now: Date, timezone: string): string => {
  const parts = getZonedDateParts(now, timezone);
  const lastDay = new Date(Date.UTC(parts.year, parts.month, 0)).getUTCDate();
  return `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
};

const fridayOfCurrentWeekIso = (now: Date, timezone: string): string => {
  const parts = getZonedDateParts(now, timezone);
  const isoWeekday = (parts.weekday + 6) % 7;
  const delta = isoWeekday <= 4 ? 4 - isoWeekday : 11 - isoWeekday;
  return formatDateInTimezone(addDays(now, delta), timezone);
};

const sundayOfCurrentWeekendIso = (now: Date, timezone: string): string => {
  const parts = getZonedDateParts(now, timezone);
  const delta = parts.weekday === 0 ? 0 : 7 - parts.weekday;
  return formatDateInTimezone(addDays(now, delta), timezone);
};

const nextDayIso = (now: Date, timezone: string): string => formatDateInTimezone(addDays(now, 1), timezone);
const nextWeekIso = (now: Date, timezone: string): string => formatDateInTimezone(addDays(now, 7), timezone);

const nextMondayIso = (now: Date, timezone: string): string => {
  const parts = getZonedDateParts(now, timezone);
  const delta = parts.weekday === 1 ? 7 : (8 - parts.weekday) % 7 || 7;
  return formatDateInTimezone(addDays(now, delta), timezone);
};

export const detectPriority = (input: string): {
  priority: TaskPriority;
  working: string;
  dueForcedToday: boolean;
  matches: PatternMatch[];
} => {
  let working = input;
  let priority: TaskPriority = null;
  const matches: PatternMatch[] = [];

  const applyPatterns = (
    patterns: RegExp[],
    nextPriority: Exclude<TaskPriority, null>,
    confidence: number,
    rulePrefix: string,
  ) => {
    let matched = false;
    for (const pattern of patterns) {
      const found = collectPatternMatches(working, pattern, `${rulePrefix}.${pattern.source}`, confidence, `${nextPriority} priority signal`);
      if (found.length > 0) {
        matches.push(...found);
        matched = true;
      }
      working = working.replace(pattern, ' ');
      pattern.lastIndex = 0;
    }
    if (matched && (priority === null || PRIORITY_ORDER[nextPriority] > PRIORITY_ORDER[priority])) {
      priority = nextPriority;
    }
  };

  applyPatterns(LOW_PRIORITY_PATTERNS, 'low', 1, 'priority.low');
  applyPatterns(MEDIUM_PRIORITY_PATTERNS, 'medium', 1, 'priority.medium');
  applyPatterns(HIGH_PRIORITY_PATTERNS, 'high', 1, 'priority.high');

  const emphasisMatches = collectPatternMatches(working, /!{3,}/g, 'priority.high.emphasis', 0.7, 'exclamation emphasis suggests urgency');
  if (emphasisMatches.length > 0 && priority === null) {
    priority = 'high';
    matches.push(...emphasisMatches);
  }

  const immediacySignal = /\b(?:today|asap|urgent|now|immediately)\b/i.test(input);
  const deescalationSignal = /\b(?:not\s+urgent|no\s+rush|whenever|when\s+you\s+can)\b/i.test(input);
  const dueForcedToday = immediacySignal && !deescalationSignal;
  working = normalizeWhitespace(working.replace(/\s*:\s*/g, ' '));

  return { priority, working, dueForcedToday, matches };
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

const isAssigneeLike = (value: string, knownAssignees: Set<string>): boolean => {
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
  return knownAssignees.has(cleaned.toLowerCase());
};

const normalizeAssigneeCapture = (value: string, knownAssignees: Set<string>): string[] =>
  splitAssigneeGroup(value.replace(/[,:]+$/g, '').trim()).filter((part) => isAssigneeLike(part, knownAssignees));

const applyAssigneeTransform = (
  working: string,
  regex: RegExp,
  buildReplacement: (...args: string[]) => { assignees: string[]; replacement: string } | null,
): { working: string; assignees: string[]; spans: Array<{ start: number; end: number; text: string }> } => {
  const assignees: string[] = [];
  const spans: Array<{ start: number; end: number; text: string }> = [];
  let matched = false;
  const nextWorking = working.replace(regex, (...args) => {
    const full = String(args[0] || '');
    const captures = args.slice(1, -2).map((value) => String(value || ''));
    const offset = Number(args[args.length - 2]);
    const transformed = buildReplacement(...captures);
    if (!transformed) {
      return full;
    }
    matched = true;
    assignees.push(...transformed.assignees);
    if (Number.isFinite(offset)) {
      spans.push({
        start: offset,
        end: offset + full.length,
        text: full,
      });
    }
    return transformed.replacement;
  });

  return {
    working: matched ? normalizeWhitespace(nextWorking) : working,
    assignees,
    spans,
  };
};

export const extractAssignees = (
  input: string,
  knownAssigneesInput?: string[],
): {
  working: string;
  assigneeHints: string[];
  directed: boolean;
  spans: Array<{ start: number; end: number; text: string }>;
} => {
  let working = input;
  const assignees: string[] = [];
  const spans: Array<{ start: number; end: number; text: string }> = [];
  let directed = false;
  const knownAssignees = new Set((knownAssigneesInput || DEFAULT_KNOWN_ASSIGNEES).map((name) => name.toLowerCase()));

  for (const match of input.matchAll(/\B@[a-z0-9_.+-]+/gi)) {
    const text = match[0] || '';
    if (!text) {
      continue;
    }
    assignees.push(text);
    spans.push({
      start: match.index ?? 0,
      end: (match.index ?? 0) + text.length,
      text,
    });
    working = normalizeWhitespace(working.replace(text, ' '));
  }

  const transforms: Array<{
    regex: RegExp;
    build: (...captures: string[]) => { assignees: string[]; replacement: string } | null;
  }> = [
    {
      regex: /^\s*task\s+for\s+([a-z@.\s]+?)\s*:\s*(.+)$/i,
      build: (group, task) => {
        const normalized = normalizeAssigneeCapture(group, knownAssignees);
        return normalized.length ? { assignees: normalized, replacement: task } : null;
      },
    },
    {
      regex: /^\s*([a-z0-9@.+-]+(?:\s+(?:and|or|n)\s+[a-z0-9@.+-]+)*)\s+needs\s+to\s+(.+)$/i,
      build: (group, task) => {
        const normalized = normalizeAssigneeCapture(group, knownAssignees);
        return normalized.length ? { assignees: normalized, replacement: task } : null;
      },
    },
    {
      regex: /^\s*([a-z0-9@.+-]+(?:\s+(?:and|or|n)\s+[a-z0-9@.+-]+)*)\s+should\s+(.+)$/i,
      build: (group, task) => {
        const normalized = normalizeAssigneeCapture(group, knownAssignees);
        return normalized.length ? { assignees: normalized, replacement: task } : null;
      },
    },
    {
      regex: /^\s*([a-z0-9@.+-]+(?:\s+(?:and|or|n)\s+[a-z0-9@.+-]+)*)\s+shud\s+(.+)$/i,
      build: (group, task) => {
        const normalized = normalizeAssigneeCapture(group, knownAssignees);
        return normalized.length ? { assignees: normalized, replacement: task } : null;
      },
    },
    {
      regex: /^\s*([a-z0-9@.+-]+)\s+can\s+u\s+(.+)$/i,
      build: (group, task) => {
        const normalized = normalizeAssigneeCapture(group, knownAssignees);
        return normalized.length ? { assignees: normalized, replacement: task } : null;
      },
    },
    {
      regex: /^\s*have\s+([a-z0-9@.+-]+(?:\s+(?:or|and|n)\s+[a-z0-9@.+-]+)*)\s+(.+)$/i,
      build: (group, task) => {
        const normalized = normalizeAssigneeCapture(group, knownAssignees);
        return normalized.length ? { assignees: normalized, replacement: task } : null;
      },
    },
    {
      regex: /^\s*tell\s+([a-z0-9@.+-]+(?:\s+(?:or|and|n)\s+[a-z0-9@.+-]+)*)\s+to\s+(.+)$/i,
      build: (group, task) => {
        const normalized = normalizeAssigneeCapture(group, knownAssignees);
        return normalized.length ? { assignees: normalized, replacement: task } : null;
      },
    },
    {
      regex: /^\s*can\s+([a-z0-9@.+-]+(?:\s+(?:or|and|n)\s+[a-z0-9@.+-]+)*)\s+(.+)$/i,
      build: (group, task) => {
        const normalized = normalizeAssigneeCapture(group, knownAssignees);
        return normalized.length ? { assignees: normalized, replacement: task } : null;
      },
    },
    {
      regex: /^\s*need\s+([a-z0-9@.+-]+(?:\s+(?:or|and|n)\s+[a-z0-9@.+-]+)*)\s+on\s+(.+)$/i,
      build: (group, task) => {
        const normalized = normalizeAssigneeCapture(group, knownAssignees);
        return normalized.length ? { assignees: normalized, replacement: `handle ${task}` } : null;
      },
    },
    {
      regex: /^\s*[,.-]*\s*([a-z0-9@.+-]+)\s+plz\s+(.+)$/i,
      build: (group, task) => {
        const normalized = normalizeAssigneeCapture(group, knownAssignees);
        return normalized.length ? { assignees: normalized, replacement: task } : null;
      },
    },
    {
      regex: /^\s*[,.-]*\s*([a-z0-9@.+-]+)\s+pls\s+(.+)$/i,
      build: (group, task) => {
        const normalized = normalizeAssigneeCapture(group, knownAssignees);
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
        const normalized = normalizeAssigneeCapture(group, knownAssignees);
        return normalized.length ? { assignees: normalized, replacement: task } : null;
      },
    },
    {
      regex: /\bassign\s+to\s+([a-z0-9@.+-]+)$/i,
      build: (group) => {
        const normalized = normalizeAssigneeCapture(group, knownAssignees);
        return normalized.length ? { assignees: normalized, replacement: '' } : null;
      },
    },
    {
      regex: /\bfor\s+((?:the\s+)?[a-z]+\s+(?:team|group))$/i,
      build: (group) => {
        const normalized = normalizeAssigneeCapture(group, knownAssignees);
        return normalized.length ? { assignees: normalized, replacement: '' } : null;
      },
    },
    {
      regex: /\bfor\s+([a-z0-9@.+-]+(?:\s+(?:team|group))?(?:\s+(?:and|or|n)\s+[a-z0-9@.+-]+(?:\s+(?:team|group))?)*)\b/i,
      build: (group) => {
        const normalized = normalizeAssigneeCapture(group, knownAssignees);
        return normalized.length ? { assignees: normalized, replacement: '' } : null;
      },
    },
    {
      regex: /\bfrom\s+([a-z0-9@.+-]+(?:\s+(?:team|group))?)\b/i,
      build: (group) => {
        const normalized = normalizeAssigneeCapture(group, knownAssignees);
        return normalized.length ? { assignees: normalized, replacement: '' } : null;
      },
    },
    {
      regex: /\bwith\s+([a-z0-9@.+-]+(?:\s+(?:and|or|n)\s+[a-z0-9@.+-]+)*)\b/i,
      build: (group) => {
        const normalized = normalizeAssigneeCapture(group, knownAssignees);
        return normalized.length ? { assignees: normalized, replacement: '' } : null;
      },
    },
    {
      regex: /\bto\s+([a-z0-9@.+-]+@[a-z0-9.-]+\.[a-z]{2,})\b/i,
      build: (group) => ({ assignees: normalizeAssigneeCapture(group, knownAssignees), replacement: '' }),
    },
    {
      regex: /\bto\s+([A-Z][a-z]+)\b/,
      build: (group) => {
        const normalized = normalizeAssigneeCapture(group, knownAssignees);
        return normalized.length ? { assignees: normalized, replacement: '' } : null;
      },
    },
    {
      regex: /\bto\s+([a-z]+)\b/i,
      build: (group) => {
        const normalized = normalizeAssigneeCapture(group, knownAssignees);
        return normalized.length ? { assignees: normalized, replacement: '' } : null;
      },
    },
  ];

  for (const transform of transforms) {
    const result = applyAssigneeTransform(working, transform.regex, transform.build);
    working = result.working;
    assignees.push(...result.assignees);
    spans.push(...result.spans);
    if (result.assignees.length > 0 && /^\s*(?:task for|have |tell |can |need |[a-z0-9@.+-]+\s+(?:needs to|should|shud|can u|pls|plz))/i.test(input)) {
      directed = true;
    }
  }

  return {
    working: normalizeWhitespace(working),
    assigneeHints: uniqueHints(assignees),
    directed,
    spans,
  };
};

export const applyDateTypoCorrections = (input: string): {
  working: string;
  corrections: Array<{ start: number; end: number; text: string; replacement: string }>;
} => {
  let output = input;
  const corrections: Array<{ start: number; end: number; text: string; replacement: string }> = [];

  for (const [pattern, replacement] of DATE_TYPO_CORRECTIONS) {
    output = output.replace(pattern, (...args) => {
      const text = String(args[0] || '');
      const start = Number(args[args.length - 2]);
      if (Number.isFinite(start)) {
        corrections.push({ start, end: start + text.length, text, replacement });
      }
      return replacement;
    });
    pattern.lastIndex = 0;
  }

  return {
    working: normalizeWhitespace(output),
    corrections,
  };
};

const hasExplicitTimeExpression = (text: string): boolean =>
  /\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/i.test(text) ||
  /\bat\s+\d{1,2}(?::\d{2})?\b/i.test(text) ||
  /\b(?:noon|midnight)\b/i.test(text);

const resolveSpecialDate = (text: string, now: Date, timezone: string, preferNextWeekStart: boolean): string | null => {
  if (
    /\b(?:tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next\s+\w+|march|april|\d{1,2}\/\d{1,2})\b/i.test(
      text,
    ) &&
    /\bend of day\b/i.test(text)
  ) {
    return null;
  }
  if (/\bend of (?:the )?month\b/i.test(text)) {
    if (hasExplicitTimeExpression(text)) {
      return null;
    }
    return endOfMonthIso(now, timezone);
  }
  if (/\b(?:end of week|this week)\b/i.test(text)) {
    if (hasExplicitTimeExpression(text)) {
      return null;
    }
    return fridayOfCurrentWeekIso(now, timezone);
  }
  if (/\bthis weekend\b/i.test(text)) {
    if (hasExplicitTimeExpression(text)) {
      return null;
    }
    return sundayOfCurrentWeekendIso(now, timezone);
  }
  if (/\bnext week\b/i.test(text)) {
    if (hasExplicitTimeExpression(text)) {
      return null;
    }
    return preferNextWeekStart ? nextMondayIso(now, timezone) : nextWeekIso(now, timezone);
  }
  if (/\bstandup\b/i.test(text)) {
    if (hasExplicitTimeExpression(text)) {
      return null;
    }
    return nextDayIso(now, timezone);
  }
  if (/\bend of day\b/i.test(text)) {
    return formatDateInTimezone(now, timezone);
  }
  return null;
};

const SPECIAL_DATE_REGEX = /\b(?:end of (?:the )?month|end of week|this week|this weekend|next week|standup|end of day)\b/i;
const DUE_DATE_MARKER_TAIL_REGEX = /\b(?:by|before|due(?:\s+by)?|due|until|b4)\b\s*$/i;
const DUE_DATE_MARKER_HEAD_REGEX = /^\b(?:by|before|due(?:\s+by)?|due|until|b4)\b\s*/i;

const findSpecialDateMatch = (
  working: string,
  now: Date,
  timezone: string,
  preferNextWeekStart: boolean,
): { dueAt: string; start: number; end: number; text: string } | null => {
  const match = SPECIAL_DATE_REGEX.exec(working);
  if (!match || match.index == null) {
    return null;
  }

  const text = match[0];
  if (hasExplicitTimeExpression(working)) {
    return null;
  }

  const special = resolveSpecialDate(working, now, timezone, preferNextWeekStart);
  if (!special) {
    return null;
  }

  return {
    dueAt: `${special}T23:59:00`,
    start: match.index,
    end: match.index + text.length,
    text,
  };
};

const stripDueDateSpan = (working: string, start: number, end: number): string => {
  let removeStart = start;
  let removeEnd = end;
  const before = working.slice(0, start);
  const markerMatch = before.match(DUE_DATE_MARKER_TAIL_REGEX);
  if (markerMatch) {
    removeStart = start - markerMatch[0].length;
  } else {
    const recurrenceLeadMatch = before.match(/\bevery\s*$/i);
    if (recurrenceLeadMatch) {
      removeStart = start - recurrenceLeadMatch[0].length;
    } else {
      const prepositionLeadMatch = before.match(/\b(?:on|at)\s*$/i);
      if (prepositionLeadMatch) {
        removeStart = start - prepositionLeadMatch[0].length;
      }
    }
  }

  const after = working.slice(end);
  const trailingPunctuationMatch = after.match(/^\s*[.,;:]+/);
  if (trailingPunctuationMatch) {
    removeEnd = end + trailingPunctuationMatch[0].length;
  }

  return normalizeWhitespace(`${working.slice(0, removeStart)} ${working.slice(removeEnd)}`)
    .replace(DUE_DATE_MARKER_TAIL_REGEX, '')
    .replace(DUE_DATE_MARKER_HEAD_REGEX, '');
};

const scoreDueDateConfidence = (sourceText: string, bestResult: chrono.ParsedResult | null): number => {
  if (!bestResult) {
    if (/\b(?:tomorrow|today|tonight|next week|this weekend|end of)/i.test(sourceText)) {
      return 0.6;
    }
    return 0.5;
  }

  const hasExplicitTime = bestResult.start.isCertain('hour') || bestResult.start.isCertain('minute');
  const hasCertainDate =
    bestResult.start.isCertain('day') ||
    bestResult.start.isCertain('month') ||
    bestResult.start.isCertain('year') ||
    bestResult.start.isCertain('weekday');

  if (hasCertainDate && hasExplicitTime) {
    return 1;
  }
  if (hasCertainDate) {
    return 0.8;
  }
  if (/\b(?:today|tomorrow|tonight|next|this weekend)\b/i.test(bestResult.text || sourceText)) {
    return 0.6;
  }
  return 0.55;
};

export const extractDueDate = (
  input: string,
  now: Date,
  timezone: string,
  dueForcedToday: boolean,
  preferNextWeekStart: boolean,
): {
  working: string;
  dueAt: string | null;
  confidence: number;
  span: { start: number; end: number; text: string } | null;
  note: string;
} => {
  let working = input;
  let dueAt: string | null = dueForcedToday ? formatDateTimeInTimezone(now, timezone) : null;
  let confidence = dueForcedToday ? 0.95 : 0;
  let span: { start: number; end: number; text: string } | null = null;
  let note = dueForcedToday ? 'priority language forced due date to now' : 'no due date found';

  if (dueForcedToday) {
    working = normalizeWhitespace(working.replace(/\b(?:now|immediately)\b/gi, ' '));
  }

  const specialMatch = findSpecialDateMatch(working, now, timezone, preferNextWeekStart);
  if (specialMatch) {
    dueAt = specialMatch.dueAt;
    confidence = scoreDueDateConfidence(specialMatch.text, null);
    span = {
      start: specialMatch.start,
      end: specialMatch.end,
      text: specialMatch.text,
    };
    note = 'resolved due date from special-date rule';
    working = stripDueDateSpan(working, specialMatch.start, specialMatch.end);
  } else {
    const bestResult = chrono.parse(working, now, { forwardDate: true })[0] || null;
    if (bestResult) {
      const parsedStart = bestResult.index ?? 0;
      const parsedEnd = parsedStart + bestResult.text.length;

      dueAt = formatDateTimeInTimezone(bestResult.start.date(), timezone);
      confidence = scoreDueDateConfidence(working, bestResult);
      span = {
        start: parsedStart,
        end: parsedEnd,
        text: bestResult.text,
      };
      note = `resolved due date using chrono match "${bestResult.text}"`;
      working = stripDueDateSpan(working, parsedStart, parsedEnd);
    }
  }

  return {
    working: normalizeWhitespace(working),
    dueAt,
    confidence,
    span,
    note,
  };
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
  output = output.replace(/(?<=\b[A-Za-z]+)\s+n\s+(?=[A-Za-z]+\b)/gi, ' and ');
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

  return output
    .replace(/\bboth\b$/i, '')
    .replace(/\bbut\b$/i, '')
    .replace(/^[,.-]+\s*/g, '')
    .replace(/\s+[,-]\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

const titleCaseWord = (word: string, index: number): string => {
  const lower = word.toLowerCase();
  if (TITLE_ACRONYM_MAP[lower]) {
    return TITLE_ACRONYM_MAP[lower];
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
      if (/['’]/.test(word)) {
        const apostropheMatch = word.match(/['’]/);
        const apostropheChar = apostropheMatch ? apostropheMatch[0] : "'";
        return word
          .split(/['’]/)
          .map((part, partIndex) => (part === 's' ? 's' : titleCaseWord(part, index + partIndex)))
          .join(apostropheChar);
      }
      return titleCaseWord(word, index);
    })
    .join(' ')
    .replace(/\bDont\b/g, "Don't")
    .replace(/\bDon'T\b/g, "Don't")
    .replace(/\bIs on\b/g, 'Is On');

export const buildTaskTitle = (input: string): { title: string; confidence: number } => {
  const cleaned = normalizeTitleText(input);
  if (!cleaned) {
    return { title: 'Task', confidence: 0.3 };
  }
  const title = smartTitleCase(cleaned)
    .replace(/\bAnd and\b/g, 'And')
    .replace(/\bTo to\b/g, 'To')
    .replace(/\bThe group\b/g, 'the Group')
    .replace(/\s+Both$/g, '');

  const tokenCount = title.split(/\s+/).filter(Boolean).length;
  const confidence = tokenCount >= 3 ? 1 : tokenCount >= 2 ? 0.5 : 0.4;
  return { title, confidence };
};

export const getKnownAssigneeSet = (values?: string[]): Set<string> =>
  new Set((values || DEFAULT_KNOWN_ASSIGNEES).map((value) => value.trim().toLowerCase()).filter(Boolean));
