import { EVENT_KEYWORDS, TASK_VERB_LIST } from '../constants.ts';
import {
  clamp,
  findPhraseIndex,
  fuzzyTokenMatch,
  hasDateSignal,
  hasRecurrenceSignal,
  hasTimeSignal,
  tokenize,
  type ScoreLead,
} from '../utils.ts';
import type { IntentPass } from '../types.ts';

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

const REMINDER_TIMING_WORDS = new Set(['after', 'before', 'when', 'once', 'if']);

interface ReminderSignal {
  score: number;
  index: number;
  start: number;
  end: number;
  text: string;
  ruleId: string;
}

const hasTaskVerbHits = (tokens: string[]): boolean =>
  tokens.some((token) => TASK_VERB_LIST.some((verb) => fuzzyTokenMatch(token, verb)));

const findReminderSignal = (normalized: string, tokens: string[]): ReminderSignal | null => {
  for (const pattern of EXPLICIT_REMINDER_PATTERNS) {
    const match = pattern.exec(normalized);
    if (match) {
      const prefix = normalized.slice(0, match.index);
      const tokenIndex = tokenize(prefix).length;
      return {
        score: /note to self|ping me|heads up|nudge me|send me a nudge/.test(match[0]) ? 0.68 : 0.74,
        index: tokenIndex,
        start: match.index ?? 0,
        end: (match.index ?? 0) + match[0].length,
        text: match[0],
        ruleId: 'keyword.explicit_reminder',
      };
    }
  }

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index] || '';
    const next = tokens[index + 1] || '';
    const nextTwo = tokens[index + 2] || '';

    if (fuzzyTokenMatch(token, 'remind') && (fuzzyTokenMatch(next, 'me') || fuzzyTokenMatch(next, 'about') || fuzzyTokenMatch(next, 'abt'))) {
      return {
        score: 0.74,
        index,
        start: 0,
        end: normalized.length,
        text: `${token} ${next}`,
        ruleId: 'keyword.remind_token_pair',
      };
    }

    if (fuzzyTokenMatch(token, 'remember')) {
      if (fuzzyTokenMatch(next, 'to') || fuzzyTokenMatch(next, 'about') || fuzzyTokenMatch(nextTwo, 'to')) {
        return {
          score: 0.66,
          index,
          start: 0,
          end: normalized.length,
          text: token,
          ruleId: 'keyword.remember_construct',
        };
      }
      if (index === 0 || fuzzyTokenMatch(tokens[index - 1] || '', 'to')) {
        return {
          score: 0.58,
          index,
          start: 0,
          end: normalized.length,
          text: token,
          ruleId: 'keyword.remember_single',
        };
      }
    }

    if ((fuzzyTokenMatch(token, 'dont') || token === "don't") && fuzzyTokenMatch(next, 'forget')) {
      return {
        score: 0.72,
        index,
        start: 0,
        end: normalized.length,
        text: `${token} ${next}`,
        ruleId: 'keyword.dont_forget',
      };
    }
  }

  return null;
};

export const keywordPass: IntentPass = (ctx) => {
  if (ctx.state.reminder) {
    return;
  }

  let score = 0;
  let leadIndex: number | null = null;

  const reminderSignal = findReminderSignal(ctx.normalizedInput, ctx.tokens);
  if (reminderSignal) {
    score += reminderSignal.score;
    leadIndex = reminderSignal.index;
    ctx.debugSteps.push({
      pass: 'keywordPass',
      ruleId: reminderSignal.ruleId,
      start: reminderSignal.start,
      end: reminderSignal.end,
      text: reminderSignal.text,
      confidence: clamp(reminderSignal.score),
      note: 'explicit reminder keyword signal',
    });
  }

  if (/\bforgetting\b/.test(ctx.normalizedInput) || /\bi will forget\b/.test(ctx.normalizedInput) || /\bkeep forgetting\b/.test(ctx.normalizedInput)) {
    score += 0.18;
    ctx.debugSteps.push({
      pass: 'keywordPass',
      ruleId: 'keyword.forgetting_signal',
      start: 0,
      end: ctx.rawInput.length,
      text: ctx.rawInput,
      confidence: 0.18,
      note: 'forgetting language boosts reminder intent',
    });
  }

  if (reminderSignal && hasDateSignal(ctx.normalizedInput)) {
    score += 0.08;
    ctx.debugSteps.push({
      pass: 'keywordPass',
      ruleId: 'keyword.reminder_with_date',
      start: 0,
      end: ctx.rawInput.length,
      text: ctx.rawInput,
      confidence: 0.08,
      note: 'reminder signal combined with date-like phrase',
    });
  }

  if (reminderSignal && hasTimeSignal(ctx.normalizedInput)) {
    score += 0.08;
    ctx.debugSteps.push({
      pass: 'keywordPass',
      ruleId: 'keyword.reminder_with_time',
      start: 0,
      end: ctx.rawInput.length,
      text: ctx.rawInput,
      confidence: 0.08,
      note: 'reminder signal combined with time-like phrase',
    });
  }

  if (/^re:\s/.test(ctx.normalizedInput) && hasDateSignal(ctx.normalizedInput)) {
    score += 0.58;
    ctx.debugSteps.push({
      pass: 'keywordPass',
      ruleId: 'keyword.reply_prefix_date',
      start: 0,
      end: ctx.rawInput.length,
      text: ctx.rawInput,
      confidence: 0.58,
      note: 'email-like reminder prefix with date context',
    });
  }

  if (/\bagain\b/.test(ctx.normalizedInput) && hasDateSignal(ctx.normalizedInput)) {
    score += 0.24;
    ctx.debugSteps.push({
      pass: 'keywordPass',
      ruleId: 'keyword.again_date',
      start: 0,
      end: ctx.rawInput.length,
      text: ctx.rawInput,
      confidence: 0.24,
      note: 'repeat cue with date context',
    });
  }

  const recurrenceWithVerb =
    hasRecurrenceSignal(ctx.normalizedInput) &&
    !EVENT_KEYWORDS.some((keyword) => findPhraseIndex(ctx.tokens, keyword.split(' ')) >= 0) &&
    hasTaskVerbHits(ctx.tokens);

  if (recurrenceWithVerb) {
    score += 0.72;
    ctx.debugSteps.push({
      pass: 'keywordPass',
      ruleId: 'keyword.recurrence_with_verb',
      start: 0,
      end: ctx.rawInput.length,
      text: ctx.rawInput,
      confidence: 0.72,
      note: 'recurrence language with action verb and no event keyword',
    });
  }

  if (leadIndex !== null && leadIndex <= 3 && REMINDER_TIMING_WORDS.has((ctx.tokens[0] || '').toLowerCase())) {
    ctx.debugSteps.push({
      pass: 'keywordPass',
      ruleId: 'keyword.timing_prefix_context',
      start: 0,
      end: ctx.rawInput.length,
      text: ctx.rawInput,
      confidence: 0.35,
      note: 'timing connector appears before reminder phrase',
    });
  }

  const reminder: ScoreLead = {
    score: clamp(score),
    leadIndex,
  };

  ctx.state.reminder = reminder;
  ctx.scores.reminder = reminder.score;

  if (reminder.score > 0) {
    ctx.signals.push({
      type: 'reminder',
      pattern: 'reminder_keywords',
      weight: reminder.score,
    });
  }

  ctx.debugSteps.push({
    pass: 'keywordPass',
    ruleId: 'keyword.reminder_score_total',
    start: 0,
    end: ctx.rawInput.length,
    text: ctx.rawInput,
    confidence: reminder.score,
    note: `final reminder score=${reminder.score.toFixed(2)}`,
  });
};
