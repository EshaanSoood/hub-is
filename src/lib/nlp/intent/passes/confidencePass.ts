import { SIGNAL_FLOOR } from '../constants.ts';
import { clamp } from '../utils.ts';
import type { IntentPass } from '../types.ts';

const scoreStrength = (
  reminder: { score: number },
  event: { score: number },
  task: { score: number },
): number => Math.max(reminder.score, event.score, task.score);

export const confidencePass: IntentPass = (ctx) => {
  const reminder = ctx.state.reminder;
  const event = ctx.state.event;
  const task = ctx.state.task;

  if (!reminder || !event || !task) {
    return;
  }

  ctx.scores.task = clamp(ctx.scores.task ?? task.score);
  ctx.scores.reminder = clamp(ctx.scores.reminder ?? reminder.score);
  ctx.scores.event = clamp(ctx.scores.event ?? event.score);
  ctx.scores.note = 0;

  const ranked = (Object.entries({
    task: ctx.scores.task,
    reminder: ctx.scores.reminder,
    event: ctx.scores.event,
  }) as Array<['task' | 'reminder' | 'event', number]>).sort((left, right) => right[1] - left[1]);

  const [topIntent, topScore] = ranked[0] || ['task', 0];
  const [, secondScore] = ranked[1] || ['task', 0];
  ctx.topTwoGap = topScore - secondScore;

  const strongestSignal = scoreStrength(reminder, event, task);
  const ambiguitySteps: Array<{ ruleId: string; note: string }> = [];

  if (ctx.topTwoGap <= 0.15) {
    ambiguitySteps.push({
      ruleId: 'confidence.gap_too_small',
      note: `top gap ${ctx.topTwoGap.toFixed(2)} <= 0.15`,
    });
  }

  if (strongestSignal <= SIGNAL_FLOOR) {
    ambiguitySteps.push({
      ruleId: 'confidence.signal_floor',
      note: `strongest signal ${strongestSignal.toFixed(2)} <= ${SIGNAL_FLOOR.toFixed(2)}`,
    });
  }

  if (topScore < ctx.options.threshold && ctx.topTwoGap <= 0.2) {
    ambiguitySteps.push({
      ruleId: 'confidence.low_primary',
      note: `primary ${topScore.toFixed(2)} below threshold ${ctx.options.threshold.toFixed(2)} with small gap`,
    });
  }

  if (secondScore >= 0.35 && ctx.topTwoGap <= 0.25) {
    ambiguitySteps.push({
      ruleId: 'confidence.strong_secondary',
      note: `secondary ${secondScore.toFixed(2)} is strong with gap ${ctx.topTwoGap.toFixed(2)}`,
    });
  }

  if (topIntent === 'task' && topScore < 0.6 && (task.leadIndex === null || ctx.tokens.length <= 2)) {
    ambiguitySteps.push({
      ruleId: 'confidence.weak_task_lead',
      note: 'task lead is weak due to low score and sparse/unclear imperative lead',
    });
  }

  const forgetHits = ctx.normalizedInput.match(/\bforget\b/g) || [];
  const forgetReminder = /\b(?:dont|don't)\s+for(?:get|g+e?t)\b/.test(ctx.normalizedInput);
  if (
    topIntent === 'reminder' &&
    forgetReminder &&
    (ctx.tokens.length <= 4 || /\bthing\b/.test(ctx.normalizedInput) || forgetHits.length >= 2)
  ) {
    ambiguitySteps.push({
      ruleId: 'confidence.forget_reminder_short',
      note: 'short/repetitive forget-reminder phrasing can represent either task or reminder',
    });
  }

  if (
    topIntent === 'reminder' &&
    forgetReminder &&
    /\b(?:appointment|apointment|appt|docter|doctors)\b/.test(ctx.normalizedInput)
  ) {
    ambiguitySteps.push({
      ruleId: 'confidence.forget_reminder_appointment',
      note: 'forget-reminder phrasing with appointment words is intent-contested',
    });
  }

  if (topIntent === 'reminder' && /\bheads\s+up\b/.test(ctx.normalizedInput) && ctx.tokens.length <= 8) {
    ambiguitySteps.push({
      ruleId: 'confidence.heads_up_short',
      note: 'short heads-up phrasing is frequently ambiguous',
    });
  }

  if (topIntent === 'reminder' && /\bnote\s+to\s+self\b/.test(ctx.normalizedInput) && secondScore >= 0.4) {
    ambiguitySteps.push({
      ruleId: 'confidence.note_to_self_contested',
      note: 'note-to-self language with strong secondary score is ambiguous',
    });
  }

  if (/\?/.test(ctx.normalizedInput) || /\b(?:ish|maybe|like)\b/.test(ctx.normalizedInput)) {
    ambiguitySteps.push({
      ruleId: 'confidence.uncertainty_markers',
      note: 'uncertainty marker found in text',
    });
  }

  ctx.ambiguous = ambiguitySteps.length > 0;
  ctx.resultIntent = topIntent;

  for (const step of ambiguitySteps) {
    ctx.debugSteps.push({
      pass: 'confidencePass',
      ruleId: step.ruleId,
      start: 0,
      end: ctx.rawInput.length,
      text: ctx.rawInput,
      confidence: topScore,
      note: step.note,
    });
  }

  ctx.debugSteps.push({
    pass: 'confidencePass',
    ruleId: 'confidence.finalize',
    start: 0,
    end: ctx.rawInput.length,
    text: ctx.rawInput,
    confidence: topScore,
    note: `top intent=${topIntent} topScore=${topScore.toFixed(2)} gap=${ctx.topTwoGap.toFixed(2)} ambiguous=${String(ctx.ambiguous)}`,
  });

  if (ctx.ambiguous) {
    ctx.warnings.push({
      code: 'intent_ambiguous',
      severity: 'info',
      message: 'Intent is ambiguous between multiple categories.',
      fieldHints: ['intent'],
      spans: [{ start: 0, end: ctx.rawInput.length, text: ctx.rawInput }],
      details: {
        scores: ctx.scores,
        topTwoGap: ctx.topTwoGap,
      },
    });
  }
};
