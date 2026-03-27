import type { ParseContext } from '../types.ts';
import { hasStructuredFields, setFieldConfidence, stripEdgeGlueWords } from '../utils.ts';

const cleanTitleNoise = (input: string): string =>
  input
    .replace(/[()[\]]/g, ' ')
    .replace(/[,;]+/g, ' ')
    .replace(/[–—]+/g, ' ')
    .replace(/\s+-\s+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const trimEdgePrepositions = (input: string): string =>
  input
    .replace(/^(?:on|at|with|from|to|for|and)\s+/i, '')
    .replace(/\s+(?:on|at|with|from|to|for|and)$/i, '')
    .trim();

const stripTrailingTemporalGlue = (input: string): string =>
  input
    .replace(/\s+(?:till|until)\s*[.,;:!?-]*\s*$/i, '')
    .replace(/[.]+$/g, '')
    .trim();

const stripTemporalNoise = (input: string): string =>
  input
    .replace(
      /\b(?:today|tomorrow|tonight|tmr|yesterday|next\s+week|this\s+week|next|this|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:r|rs|rsday|ursday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?|starting|start|weekly|daily|monthly|yearly|annually)\b/gi,
      ' ',
    )
    .replace(/\b(?:am|pm)\b/gi, ' ')
    .replace(/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\b/gi, ' ')
    .replace(/\b\d{4}\b/g, ' ')
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, ' ')
    .replace(/\bfrom\s+now\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const titleSpansFromMaskedInput = (ctx: ParseContext): Array<{ start: number; end: number; text: string }> => {
  const spans: Array<{ start: number; end: number; text: string }> = [];
  let rangeStart = -1;

  for (let index = 0; index < ctx.maskedInput.length; index += 1) {
    const char = ctx.maskedInput[index];
    if (/\S/.test(char)) {
      if (rangeStart === -1) {
        rangeStart = index;
      }
      continue;
    }

    if (rangeStart !== -1) {
      const end = index;
      const text = ctx.rawInput.slice(rangeStart, end);
      spans.push({ start: rangeStart, end, text });
      rangeStart = -1;
    }
  }

  if (rangeStart !== -1) {
    const text = ctx.rawInput.slice(rangeStart);
    spans.push({ start: rangeStart, end: ctx.rawInput.length, text });
  }

  return spans;
};

export const titlePass = (ctx: ParseContext): void => {
  const base = cleanTitleNoise(ctx.maskedInput);
  const title = stripEdgeGlueWords(stripTrailingTemporalGlue(trimEdgePrepositions(stripTemporalNoise(base))));

  if (!title) {
    ctx.result.fields.title = null;
    return;
  }

  ctx.result.fields.title = title;
  const confidence = hasStructuredFields(ctx.result) ? 0.9 : 0.74;
  setFieldConfidence(ctx, 'title', confidence);

  for (const span of titleSpansFromMaskedInput(ctx)) {
    ctx.result.meta.spans.title.push({
      start: span.start,
      end: span.end,
      text: span.text,
      ruleId: 'title.leftover',
      confidence,
    });
  }

  ctx.result.meta.debugSteps.push({
    pass: 'title',
    ruleId: 'title.leftover',
    start: 0,
    end: ctx.rawInput.length,
    text: title,
    confidence,
    note: 'title inferred from unmasked leftover text',
  });
};
