import { DEFAULT_THRESHOLD } from './constants.ts';
import { normalizeForMatching, tokenize } from './utils.ts';
import { confidencePass } from './passes/confidencePass.ts';
import { keywordPass } from './passes/keywordPass.ts';
import { patternPass } from './passes/patternPass.ts';
import { structurePass } from './passes/structurePass.ts';
import type { IntentOptions, IntentParseContext, IntentPass, IntentResult } from './types.ts';

const PIPELINE: IntentPass[] = [keywordPass, patternPass, structurePass, confidencePass];

const createContext = (input: string, opts?: IntentOptions): IntentParseContext => {
  const rawInput = typeof input === 'string' ? input : '';
  const normalizedInput = normalizeForMatching(rawInput);

  return {
    rawInput,
    normalizedInput,
    tokens: tokenize(normalizedInput),
    options: {
      threshold: opts?.threshold ?? DEFAULT_THRESHOLD,
    },
    scores: {
      task: 0,
      reminder: 0,
      event: 0,
      note: 0,
    },
    topTwoGap: 0,
    resultIntent: 'ambiguous',
    ambiguous: true,
    debugSteps: [],
    signals: [],
    warnings: [],
    state: {
      reminder: null,
      event: null,
      task: null,
    },
  };
};

export const classifyIntent = (input: string, opts?: IntentOptions): IntentResult => {
  const ctx = createContext(input, opts);

  for (const pass of PIPELINE) {
    pass(ctx);
  }

  return {
    intent: ctx.resultIntent,
    scores: ctx.scores,
    ambiguous: ctx.ambiguous,
    meta: {
      debugSteps: ctx.debugSteps,
      topTwoGap: ctx.topTwoGap,
      signals: ctx.signals,
    },
    warnings: ctx.warnings.length > 0 ? ctx.warnings : null,
  };
};

export type { IntentOptions, IntentResult, IntentScores, IntentType } from './types.ts';
