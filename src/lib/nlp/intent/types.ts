export type IntentType = 'task' | 'reminder' | 'calendar_event';

export interface IntentResult {
  intent: IntentType;
  confidence: number;
  ambiguous: boolean;
  secondaryIntent: IntentType | null;
  scores: Record<IntentType, number>;
}

export interface IntentOptions {
  threshold?: number;
}
