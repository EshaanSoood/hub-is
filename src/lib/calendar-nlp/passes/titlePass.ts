import type { ParseContext } from '../types.ts';
import { hasStructuredFields, setFieldConfidence, stripEdgeGlueWords } from '../utils.ts';
import { TITLE_SMALL_WORDS } from '../../nlp/shared/constants.ts';
import {
  stripLeadingTitleFiller,
  stripReminderLeadPrefix,
  stripTrailingDanglingPreposition,
} from '../../nlp/shared/title-utils.ts';

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
    .replace(/^(?:on|at|with|from|to|for|and|by|in)\s+/i, '')
    .replace(/\s+(?:on|at|with|from|to|for|and|by|in)$/i, '')
    .trim();

const stripTrailingTemporalGlue = (input: string): string =>
  input
    .replace(/\s+(?:till|until)\s*[.,;:!?-]*\s*$/i, '')
    .replace(/[.]+$/g, '')
    .trim();

const stripPriorityNoise = (input: string): string =>
  input
    .replace(/\b(?:high|medium|low)\s+priority\b/gi, ' ')
    .replace(/\b(?:urgent|critical|important)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const stripMentionNoise = (input: string): string =>
  input
    .replace(/\b(?:for|to|with|from)\s+@[a-z0-9_.+-]+\b/gi, ' ')
    .replace(/@[a-z0-9_.+-]+\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const stripTemporalNoise = (input: string): string =>
  input
    .replace(/\bin\s+\d+\s+(?:day|days|week|weeks|month|months)\b/gi, ' ')
    .replace(/\bevery\s+other\s+(?:day|week)\b/gi, ' ')
    .replace(/\b(?:next|this)\s+(?:week|month)\b/gi, ' ')
    .replace(
      /\b(?:today|tomorrow|tonight|tmr|yesterday|next|this|month|week|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:r|rs|rsday|ursday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?|starting|start|weekly|daily|monthly|yearly|annually)\b/gi,
      ' ',
    )
    .replace(/\b(?:morning|afternoon|evening|night|noon)\b/gi, ' ')
    .replace(/\b(?:end of (?:the )?day|end of (?:the )?week|end of (?:the )?month|eod|eow)\b/gi, ' ')
    .replace(/\b(?:am|pm)\b/gi, ' ')
    .replace(/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\b/gi, ' ')
    .replace(/\b\d{4}\b/g, ' ')
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, ' ')
    .replace(/\bfrom\s+now\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const smartCalendarTitleCase = (input: string): string =>
  input
    .split(/\s+/)
    .filter(Boolean)
    .map((token, index) => {
      if (/^[A-Z]{2,4}$/.test(token)) {
        return token;
      }
      const lower = token.toLowerCase();
      if (index > 0 && TITLE_SMALL_WORDS.has(lower)) {
        return lower;
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');

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
  const title = stripEdgeGlueWords(
    smartCalendarTitleCase(
      stripTrailingDanglingPreposition(
        stripTrailingTemporalGlue(
          stripLeadingTitleFiller(
            trimEdgePrepositions(stripTemporalNoise(stripMentionNoise(stripPriorityNoise(stripReminderLeadPrefix(base))))),
          ),
        ),
      ),
    ),
  );

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
