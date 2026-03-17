export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface RecurrenceField {
  frequency: RecurrenceFrequency | null;
  interval: number | null;
  days: string[] | null;
  exceptions: string[] | null;
  end_date: string | null;
}

export interface AlertField {
  offset_minutes: number;
}

export interface EventFields {
  title: string | null;
  date: string | null;
  time: string | null;
  end_time: string | null;
  duration_minutes: number | null;
  location: string | null;
  recurrence: RecurrenceField;
  alerts: AlertField[] | null;
  attendees: string[] | null;
}

export type ConfidenceFields = {
  title: number;
  date: number;
  time: number;
  end_time: number;
  duration_minutes: number;
  location: number;
  recurrence: number;
  alerts: number;
  attendees: number;
};

export interface FieldSpan {
  start: number;
  end: number;
  text: string;
  ruleId: string;
  confidence: number;
}

export type SpanFields = {
  title: FieldSpan[];
  date: FieldSpan[];
  time: FieldSpan[];
  end_time: FieldSpan[];
  duration_minutes: FieldSpan[];
  location: FieldSpan[];
  recurrence: FieldSpan[];
  alerts: FieldSpan[];
  attendees: FieldSpan[];
};

export interface DebugStep {
  pass: string;
  ruleId: string;
  text: string;
  start: number;
  end: number;
  confidence: number;
  note: string;
}

export interface WarningSpan {
  start: number;
  end: number;
  text: string;
}

export interface ParseWarning {
  code: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
  fieldHints: string[] | null;
  spans: WarningSpan[] | null;
  details: Record<string, unknown> | null;
}

export interface EventParseMeta {
  locale: string;
  timezone: string;
  confidence: ConfidenceFields;
  spans: SpanFields;
  cleanedInput: string;
  maskedInput: string;
  debugSteps: DebugStep[];
}

export interface EventParseResult {
  fields: EventFields;
  meta: EventParseMeta;
  warnings: ParseWarning[] | null;
}

export interface ParseOptions {
  now?: Date | string;
  timezone?: string;
  locale?: string;
  debug?: boolean;
}

export interface ParseContext {
  rawInput: string;
  cleanedInput: string;
  maskedInput: string;
  now: Date;
  options: {
    timezone: string;
    locale: string;
    debug: boolean;
  };
  result: EventParseResult;
}

export type ParsePass = (ctx: ParseContext) => void;

export type FieldName = keyof EventFields;

export type ScalarFieldName = Exclude<FieldName, 'recurrence' | 'alerts' | 'attendees'>;

export interface PassMatch {
  start: number;
  end: number;
  text: string;
  ruleId: string;
  confidence: number;
}
