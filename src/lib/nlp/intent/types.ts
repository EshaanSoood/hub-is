import type { DebugStep, ParseWarning } from '../shared/types.ts';
import type { ScoreLead } from './utils.ts';

export type IntentType = 'task' | 'reminder' | 'event' | 'note' | 'ambiguous';

export interface IntentScores {
  task: number;
  reminder: number;
  event: number;
  note: number;
}

export interface IntentResult {
  intent: IntentType;
  scores: IntentScores;
  ambiguous: boolean;
  meta: {
    debugSteps: DebugStep[];
    topTwoGap: number;
    signals: Array<{ type: string; pattern: string; weight: number }>;
  };
  warnings: ParseWarning[] | null;
}

export interface IntentOptions {
  threshold?: number;
}

export interface IntentParseContext {
  rawInput: string;
  normalizedInput: string;
  tokens: string[];
  options: Required<IntentOptions>;
  scores: IntentScores;
  topTwoGap: number;
  resultIntent: IntentType;
  ambiguous: boolean;
  debugSteps: DebugStep[];
  signals: Array<{ type: string; pattern: string; weight: number }>;
  warnings: ParseWarning[];
  state: {
    reminder: ScoreLead | null;
    event: ScoreLead | null;
    task: ScoreLead | null;
  };
}

export type IntentPass = (ctx: IntentParseContext) => void;
