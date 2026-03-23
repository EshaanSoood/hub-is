import type { TaskParsePass } from '../types.ts';
import { addDebugStep, addFieldSpan, detectPriority, setFieldConfidence } from '../utils.ts';

export const priorityPass: TaskParsePass = (ctx) => {
  const extraction = detectPriority(ctx.working);
  ctx.working = extraction.working;
  ctx.maskedInput = extraction.working;
  ctx.result.meta.maskedInput = extraction.working;
  ctx.state.dueForcedToday = extraction.dueForcedToday;

  if (!extraction.priority) {
    return;
  }

  ctx.result.fields.priority = extraction.priority;
  setFieldConfidence(ctx, 'priority', extraction.priority === 'high' ? 1 : 0.95);

  for (const match of extraction.matches) {
    addFieldSpan(ctx, 'priority', { start: match.start, end: match.end, text: match.text });
    addDebugStep(ctx, {
      pass: 'priorityPass',
      ruleId: match.ruleId,
      start: match.start,
      end: match.end,
      text: match.text,
      confidence: match.confidence,
      note: match.note,
    });
  }

  if (extraction.dueForcedToday) {
    addDebugStep(ctx, {
      pass: 'priorityPass',
      ruleId: 'priority.immediacy.force_due_today',
      start: 0,
      end: ctx.rawInput.length,
      text: ctx.rawInput,
      confidence: 0.95,
      note: 'immediacy language found; due date pass should force today when no explicit date exists',
    });
  }
};
