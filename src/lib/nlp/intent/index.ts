import {
  classifyIntent as classifyKalandarIntent,
  normalizeProductivityWarnings,
} from '../../productivity-parser/index.ts';
import type { IntentOptions, IntentResult } from './types.ts';

const mapIntent = (intent: 'task' | 'calendar' | 'reminder' | 'none'): IntentResult['intent'] => {
  if (intent === 'calendar') {
    return 'event';
  }
  if (intent === 'none') {
    return 'ambiguous';
  }
  return intent;
};

export const classifyIntent = (input: string, opts?: IntentOptions): IntentResult => {
  const result = classifyKalandarIntent(input, opts);

  return {
    intent: mapIntent(result.intent),
    scores: {
      task: result.scores.task,
      reminder: result.scores.reminder,
      event: result.scores.calendar,
      note: result.scores.none,
    },
    ambiguous: result.intent === 'none' ? true : result.ambiguous,
    meta: {
      debugSteps: result.meta.debugSteps,
      topTwoGap: result.meta.topTwoGap,
      signals: result.meta.signals.map((signal) => ({
        type: mapIntent(signal.intent),
        pattern: signal.source,
        weight: signal.weight,
      })),
    },
    warnings: normalizeProductivityWarnings(result.warnings),
  };
};

export type { IntentOptions, IntentResult, IntentScores, IntentType } from './types.ts';
