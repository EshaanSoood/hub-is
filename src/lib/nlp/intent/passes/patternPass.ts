import { EVENT_KEYWORDS, TASK_BASE_SCORE, TASK_VERB_LIST } from '../constants.ts';
import {
  EMAIL_REGEX,
  NAME_STOPWORDS,
  clamp,
  findPhraseIndex,
  fuzzyTokenMatch,
  hasDateSignal,
  hasRecurrenceSignal,
  hasTimeRangeSignal,
  hasTimeSignal,
  toComparableToken,
  type ScoreLead,
} from '../utils.ts';
import type { IntentPass } from '../types.ts';

const ACTION_VERBS = TASK_VERB_LIST;

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
];

const escapeRegexLiteral = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const PRIORITY_MARKER_REGEXES = PRIORITY_MARKERS.map((marker) => new RegExp(`\\b${escapeRegexLiteral(marker)}\\b`));

const EVENT_WORDS = EVENT_KEYWORDS;

interface SignalHit {
  score: number;
  index: number;
}

interface ScoringStep {
  ruleId: string;
  delta: number;
  note: string;
}

interface ScoredLead extends ScoreLead {
  steps: ScoringStep[];
}

const isScoredLead = (value: unknown): value is ScoredLead => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Partial<ScoredLead>;
  return typeof candidate.score === 'number' && Array.isArray(candidate.steps);
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

  const roomPhraseIndexes = [findPhraseIndex(tokens, ['conf', 'room']), findPhraseIndex(tokens, ['room', 'a'])].filter(
    (index) => index >= 0,
  );
  if (roomPhraseIndexes.length > 0) {
    return {
      score: 0.18,
      index: Math.min(...roomPhraseIndexes),
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

const scoreTask = (normalized: string, tokens: string[]): ScoredLead => {
  let score = TASK_BASE_SCORE;
  const steps: ScoringStep[] = [];
  const verbHits = findTaskVerbHits(tokens);
  const leadIndex: number | null = verbHits.length ? Math.min(...verbHits) : null;

  if (verbHits.length) {
    const delta = verbHits[0] === 0 ? 0.26 : 0.2;
    score += delta;
    steps.push({
      ruleId: 'pattern.task.verb_hit',
      delta,
      note: 'action verb cue for task intent',
    });
  }

  if (verbHits.length > 1) {
    const delta = Math.min(0.2, (verbHits.length - 1) * 0.08);
    score += delta;
    steps.push({
      ruleId: 'pattern.task.multi_verb_bonus',
      delta,
      note: 'multiple action verbs increase task certainty',
    });
  }

  if (/\b(?:by|before|due|until|b4)\b/.test(normalized) || /\b(?:eod|end of day|end of week)\b/.test(normalized)) {
    score += 0.2;
    steps.push({
      ruleId: 'pattern.task.deadline_marker',
      delta: 0.2,
      note: 'deadline marker indicates actionable task',
    });
  }

  if (PRIORITY_MARKER_REGEXES.some((pattern) => pattern.test(normalized))) {
    score += 0.16;
    steps.push({
      ruleId: 'pattern.task.priority_marker',
      delta: 0.16,
      note: 'priority language boosts task signal',
    });
  }

  if (EMAIL_REGEX.test(normalized)) {
    score += 0.08;
    steps.push({
      ruleId: 'pattern.task.email_signal',
      delta: 0.08,
      note: 'email-like pattern often appears in tasks',
    });
  }

  if (
    /\b(?:groceries|taxes|passport renewal|oil change|party planning|haircut|invoice|report|docs?|readme|changelog|spec|slides|handouts|deck|flowers)\b/.test(
      normalized,
    )
  ) {
    score += 0.12;
    steps.push({
      ruleId: 'pattern.task.domain_noun',
      delta: 0.12,
      note: 'task-domain noun detected',
    });
  }

  if (/\btickets\b/.test(normalized) || /\bprice again\b/.test(normalized)) {
    score += 0.22;
    steps.push({
      ruleId: 'pattern.task.ticket_price_signal',
      delta: 0.22,
      note: 'ticket/price follow-up phrase indicates task',
    });
  }

  if (!verbHits.length && tokens.length <= 3 && !hasTimeSignal(normalized) && !hasDateSignal(normalized)) {
    score += 0.12;
    steps.push({
      ruleId: 'pattern.task.short_imperative_like',
      delta: 0.12,
      note: 'short phrase without schedule cues leans task',
    });
  }

  if (/\bi should\b|\bneed\b|\bsupposed to\b|\bget around to\b/.test(normalized)) {
    score += 0.08;
    steps.push({
      ruleId: 'pattern.task.soft_intent_language',
      delta: 0.08,
      note: 'soft intent language still suggests tasks',
    });
  }

  return {
    score: clamp(score),
    leadIndex,
    steps,
  };
};

const scoreEvent = (normalized: string, tokens: string[]): ScoredLead => {
  let score = 0;
  const steps: ScoringStep[] = [];
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
    steps.push({
      ruleId: 'pattern.event.time_range',
      delta: 0.46,
      note: 'explicit time range strongly indicates event',
    });
  } else if (timeSignal) {
    score += 0.18;
    steps.push({
      ruleId: 'pattern.event.time_signal',
      delta: 0.18,
      note: 'explicit time signal supports event intent',
    });
  }

  if (dateSignal) {
    score += 0.18;
    steps.push({
      ruleId: 'pattern.event.date_signal',
      delta: 0.18,
      note: 'date-like signal supports event intent',
    });
  }

  if (recurrenceSignal) {
    const delta = timeSignal || dateSignal ? 0.36 : 0.24;
    score += delta;
    steps.push({
      ruleId: 'pattern.event.recurrence_signal',
      delta,
      note: 'recurrence language indicates scheduling intent',
    });
  }

  if (personSignal) {
    score += personSignal.score;
    if (leadIndex === null) {
      leadIndex = personSignal.index;
    }
    steps.push({
      ruleId: 'pattern.event.person_signal',
      delta: personSignal.score,
      note: 'person mention supports event intent',
    });
  }

  if (locationSignal) {
    const delta = personSignal || timeSignal || hasEventWord ? 0.18 : 0.1;
    score += delta;
    if (leadIndex === null) {
      leadIndex = locationSignal.index;
    }
    steps.push({
      ruleId: 'pattern.event.location_signal',
      delta,
      note: 'location mention supports event intent',
    });
  }

  if (hasEventWord) {
    const delta = eventMatches.some((keyword) => ['dinner', 'lunch', 'brunch', 'coffee', 'drinks', 'breakfast', 'birthday'].includes(keyword))
      ? 0.22
      : 0.28;
    score += delta;
    steps.push({
      ruleId: 'pattern.event.keyword_match',
      delta,
      note: 'event keyword match detected',
    });

    if (eventMatches.includes('birthday')) {
      score += 0.12;
      steps.push({
        ruleId: 'pattern.event.birthday_bonus',
        delta: 0.12,
        note: 'birthday keyword receives extra event weight',
      });
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
    steps.push({
      ruleId: 'pattern.event.person_or_location_with_time_or_date',
      delta: 0.16,
      note: 'person/location + schedule cue forms event structure',
    });
  }

  if (
    /\b\d{1,2}-\d{1,2}\b/.test(normalized) &&
    /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/.test(
      normalized,
    )
  ) {
    score += 0.18;
    steps.push({
      ruleId: 'pattern.event.month_date_range',
      delta: 0.18,
      note: 'month + date range indicates event schedule',
    });
  }

  if (findPhraseIndex(tokens, ['board', 'review']) >= 0) {
    score += 0.24;
    steps.push({
      ruleId: 'pattern.event.board_review',
      delta: 0.24,
      note: 'board review phrase indicates event',
    });
  }

  if (normalized === 'birthday') {
    score += 0.18;
    steps.push({
      ruleId: 'pattern.event.birthday_single_word',
      delta: 0.18,
      note: 'single-word birthday input is treated as an event',
    });
  }

  return {
    score: clamp(score),
    leadIndex,
    steps,
  };
};

export const patternPass: IntentPass = (ctx) => {
  const scoredTask = isScoredLead(ctx.state.task) ? ctx.state.task : scoreTask(ctx.normalizedInput, ctx.tokens);
  ctx.state.task = scoredTask;

  const scoredEvent = isScoredLead(ctx.state.event) ? ctx.state.event : scoreEvent(ctx.normalizedInput, ctx.tokens);
  ctx.state.event = scoredEvent;

  ctx.scores.task = scoredTask.score;
  ctx.scores.event = scoredEvent.score;

  if (scoredTask.score > 0) {
    ctx.signals.push({
      type: 'task',
      pattern: 'task_patterns',
      weight: scoredTask.score,
    });
  }

  if (scoredEvent.score > 0) {
    ctx.signals.push({
      type: 'event',
      pattern: 'event_patterns',
      weight: scoredEvent.score,
    });
  }

  for (const step of [...scoredTask.steps, ...scoredEvent.steps]) {
    ctx.debugSteps.push({
      pass: 'patternPass',
      ruleId: step.ruleId,
      start: 0,
      end: ctx.rawInput.length,
      text: ctx.rawInput,
      confidence: clamp(step.delta),
      note: step.note,
    });
  }

  ctx.debugSteps.push({
    pass: 'patternPass',
    ruleId: 'pattern.task_event_score_total',
    start: 0,
    end: ctx.rawInput.length,
    text: ctx.rawInput,
    confidence: Math.max(scoredTask.score, scoredEvent.score),
    note: `final task=${scoredTask.score.toFixed(2)} event=${scoredEvent.score.toFixed(2)}`,
  });
};
