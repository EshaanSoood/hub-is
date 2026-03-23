import { EVENT_KEYWORDS, TASK_BASE_SCORE, TASK_VERB_LIST } from '../constants.ts';
import { clamp, fuzzyTokenMatch, hasDateSignal, hasTimeSignal, toComparableToken, tokenize } from '../utils.ts';
import type { IntentPass } from '../types.ts';

const REMINDER_TIMING_WORDS = new Set(['after', 'before', 'when', 'once', 'if']);
const SOCIAL_EVENT_KEYWORDS = ['lunch', 'dinner', 'coffee', 'meeting', 'mtg', '1on1', 'standup', 'sync'];

export const structurePass: IntentPass = (ctx) => {
  const reminder = ctx.state.reminder;
  const event = ctx.state.event;
  const task = ctx.state.task;

  if (!reminder || !event || !task) {
    return;
  }

  const scores = {
    reminder: reminder.score,
    event: event.score,
    task: task.score,
  };

  const reminderIsPrefix =
    reminder.leadIndex !== null &&
    (reminder.leadIndex <= 1 ||
      (reminder.leadIndex <= 3 && REMINDER_TIMING_WORDS.has(toComparableToken(ctx.tokens[0] || ''))));

  if (reminder.score >= 0.58 && reminderIsPrefix) {
    scores.reminder = clamp(scores.reminder + 0.16);
    scores.task = clamp(scores.task - 0.16);
    ctx.debugSteps.push({
      pass: 'structurePass',
      ruleId: 'structure.reminder_prefix_boost',
      start: 0,
      end: ctx.rawInput.length,
      text: ctx.rawInput,
      confidence: 0.16,
      note: 'reminder prefix lead boosts reminder and reduces task score',
    });
  }

  const thenIndex = ctx.normalizedInput.search(/\bthen\b/);
  if (thenIndex >= 0) {
    const beforeThen = ctx.normalizedInput.slice(0, thenIndex).trim();
    const afterThen = ctx.normalizedInput.slice(thenIndex).trim();
    const afterThenTokens = tokenize(afterThen);
    const beforeHasEventWord = EVENT_KEYWORDS.some((keyword) => beforeThen.includes(keyword));
    const beforeHasTimeOrDate = hasTimeSignal(beforeThen) || hasDateSignal(beforeThen);
    const beforeLooksLikeEvent = beforeHasEventWord && beforeHasTimeOrDate;
    const afterHasTaskVerb = afterThenTokens.some((token) =>
      TASK_VERB_LIST.some((verb) => fuzzyTokenMatch(token, verb)),
    );

    if (beforeLooksLikeEvent && afterHasTaskVerb) {
      scores.event = clamp(scores.event + 0.12);
      ctx.debugSteps.push({
        pass: 'structurePass',
        ruleId: 'structure.then_clause_event_task',
        start: 0,
        end: ctx.rawInput.length,
        text: ctx.rawInput,
        confidence: 0.12,
        note: 'event-like lead clause before "then" with task-like tail boosts event score',
      });
    }

    if (
      SOCIAL_EVENT_KEYWORDS.some((keyword) => beforeThen.includes(keyword)) &&
      /\bat\s+\d{1,2}\b/.test(beforeThen)
    ) {
      scores.event = clamp(scores.event + 0.12);
      ctx.debugSteps.push({
        pass: 'structurePass',
        ruleId: 'structure.then_clause_meal_meeting_time',
        start: 0,
        end: ctx.rawInput.length,
        text: ctx.rawInput,
        confidence: 0.12,
        note: 'meal/meeting phrase with explicit time before "then" boosts event score',
      });
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
    ctx.debugSteps.push({
      pass: 'structurePass',
      ruleId: 'structure.task_lead_before_reminder',
      start: 0,
      end: ctx.rawInput.length,
      text: ctx.rawInput,
      confidence: 0.12,
      note: 'task lead preceding reminder lead shifts confidence toward task',
    });
  }

  if (
    taskLeadBeforeReminder &&
    /\b(?:and|then)\b/.test(ctx.normalizedInput) &&
    (ctx.normalizedInput.includes("don't forget") ||
      ctx.normalizedInput.includes('dont forget') ||
      /\bremember\b/.test(ctx.normalizedInput))
  ) {
    scores.task = clamp(scores.task + 0.12);
    scores.reminder = clamp(scores.reminder - 0.18);
    ctx.debugSteps.push({
      pass: 'structurePass',
      ruleId: 'structure.task_then_remember_clause',
      start: 0,
      end: ctx.rawInput.length,
      text: ctx.rawInput,
      confidence: 0.18,
      note: 'task lead with connector + reminder phrase reinforces task interpretation',
    });
  }

  if (/\bevery\b/.test(ctx.normalizedInput) && (hasTimeSignal(ctx.normalizedInput) || hasDateSignal(ctx.normalizedInput))) {
    scores.event = clamp(scores.event + 0.08);
    ctx.debugSteps.push({
      pass: 'structurePass',
      ruleId: 'structure.every_with_schedule_signal',
      start: 0,
      end: ctx.rawInput.length,
      text: ctx.rawInput,
      confidence: 0.08,
      note: '"every" with date/time signal nudges toward event scheduling intent',
    });
  }

  if (/^\W*$/.test(ctx.normalizedInput)) {
    scores.task = TASK_BASE_SCORE;
    scores.reminder = 0;
    scores.event = 0;
    ctx.debugSteps.push({
      pass: 'structurePass',
      ruleId: 'structure.empty_input_reset',
      start: 0,
      end: ctx.rawInput.length,
      text: ctx.rawInput,
      confidence: 0.3,
      note: 'empty input resets scores to baseline defaults',
    });
  }

  ctx.scores.task = scores.task;
  ctx.scores.reminder = scores.reminder;
  ctx.scores.event = scores.event;
  ctx.scores.note = 0;

  ctx.debugSteps.push({
    pass: 'structurePass',
    ruleId: 'structure.compound_biases',
    start: 0,
    end: ctx.rawInput.length,
    text: ctx.rawInput,
    confidence: Math.min(1, Math.max(scores.task, scores.reminder, scores.event)),
    note: `applied compound biases task=${scores.task.toFixed(2)} reminder=${scores.reminder.toFixed(2)} event=${scores.event.toFixed(2)}`,
  });
};
