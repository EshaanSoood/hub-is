import type { TaskParsePass } from '../types.ts';
import { addDebugStep, addFieldSpan, extractDueDate, setFieldConfidence } from '../utils.ts';

export const dueDatePass: TaskParsePass = (ctx) => {
  const extraction = extractDueDate(
    ctx.working,
    ctx.now,
    ctx.options.timezone,
    ctx.state.dueForcedToday,
    ctx.state.preferNextWeekStart,
  );

  ctx.working = extraction.working;
  ctx.maskedInput = extraction.working;
  ctx.result.meta.maskedInput = extraction.working;

  if (!extraction.dueAt) {
    return;
  }

  ctx.result.fields.due_at = extraction.dueAt;
  setFieldConfidence(ctx, 'due_at', extraction.confidence);

  if (extraction.span) {
    addFieldSpan(ctx, 'due_at', extraction.span);
    addDebugStep(ctx, {
      pass: 'dueDatePass',
      ruleId: 'due_date.extract',
      start: extraction.span.start,
      end: extraction.span.end,
      text: extraction.span.text,
      confidence: extraction.confidence,
      note: extraction.note,
    });
  }
};
