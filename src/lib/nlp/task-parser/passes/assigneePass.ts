import type { TaskParsePass } from '../types.ts';
import { addDebugStep, addFieldSpan, extractAssignees, setFieldConfidence } from '../utils.ts';

export const assigneePass: TaskParsePass = (ctx) => {
  const extraction = extractAssignees(ctx.working, ctx.options.knownAssignees);
  ctx.working = extraction.working;
  ctx.maskedInput = extraction.working;
  ctx.result.meta.maskedInput = extraction.working;
  ctx.state.preferNextWeekStart = extraction.directed;

  if (extraction.assigneeHints.length === 0) {
    return;
  }

  ctx.result.fields.assignee_hints = extraction.assigneeHints;
  const confidence = extraction.assigneeHints.some((hint) => hint.startsWith('@')) ? 1 : 0.6;
  setFieldConfidence(ctx, 'assignee_hints', confidence);

  for (const span of extraction.spans) {
    addFieldSpan(ctx, 'assignee_hints', span);
    addDebugStep(ctx, {
      pass: 'assigneePass',
      ruleId: span.text.startsWith('@') ? 'assignee.mention' : 'assignee.pattern',
      start: span.start,
      end: span.end,
      text: span.text,
      confidence,
      note: span.text.startsWith('@') ? 'captured explicit @mention assignee' : 'captured assignee hint from phrase pattern',
    });
  }
};
