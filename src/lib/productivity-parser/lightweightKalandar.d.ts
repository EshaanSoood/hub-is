export interface KalandarFieldSpan {
  start: number;
  end: number;
  text: string;
}

export interface KalandarDebugStep {
  pass: string;
  ruleId: string;
  start: number;
  end: number;
  text: string;
  confidence: number;
  note: string;
}

export interface KalandarParseWarning {
  code: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
  fieldHints: string[] | null;
  spans: KalandarFieldSpan[] | null;
  details: Record<string, unknown> | null;
}

export interface KalandarIntentOptions {
  threshold?: number;
}

export interface KalandarIntentResult {
  intent: 'task' | 'calendar' | 'reminder' | 'none';
  scores: {
    task: number;
    calendar: number;
    reminder: number;
    none: number;
  };
  ambiguous: boolean;
  meta: {
    runtime: {
      mode: 'lightweight';
      model: 'tiny-linear';
      version: number;
    };
    debugSteps: KalandarDebugStep[];
    topTwoGap: number;
    signals: Array<{
      intent: 'task' | 'calendar' | 'reminder' | 'none';
      source: string;
      weight: number;
    }>;
  };
  warnings: KalandarParseWarning[] | null;
}

export interface KalandarTaskParseOptions {
  now?: Date | string;
  timezone?: string;
  knownAssignees?: string[];
  debug?: boolean;
}

export interface KalandarTaskParseResult {
  fields: {
    title: string;
    assignee: string[];
    project: string | null;
    tags: string[];
    priority: 'high' | 'medium' | 'low' | null;
    status: string | null;
    duration: string | null;
    due_date: string | null;
    due_time: string | null;
    recurrence: string | null;
    recurrence_start: string | null;
    recurrence_end: string | null;
    recurrence_exception: Array<{
      raw: string;
      condition: { type: string; date?: string } | null;
      action: { type: string } | null;
    }>;
  };
  meta: {
    runtime?: {
      mode: 'lightweight' | 'ml';
    };
    confidence: {
      title: number;
      assignee: number;
      project: number;
      tags: number;
      priority: number;
      status: number;
      duration: number;
      due_date: number;
      due_time: number;
      recurrence: number;
      recurrence_start: number;
      recurrence_end: number;
      recurrence_exception: number;
    };
    spans: {
      title: KalandarFieldSpan[];
      assignee: KalandarFieldSpan[];
      project: KalandarFieldSpan[];
      tags: KalandarFieldSpan[];
      priority: KalandarFieldSpan[];
      status: KalandarFieldSpan[];
      duration: KalandarFieldSpan[];
      due_date: KalandarFieldSpan[];
      due_time: KalandarFieldSpan[];
      recurrence: KalandarFieldSpan[];
      recurrence_start: KalandarFieldSpan[];
      recurrence_end: KalandarFieldSpan[];
      recurrence_exception: KalandarFieldSpan[];
    };
    debugSteps: KalandarDebugStep[];
    maskedInput: string;
  };
  warnings: KalandarParseWarning[] | null;
}

export interface KalandarReminderParseOptions {
  now?: Date | string;
  timezone?: string;
  debug?: boolean;
}

export interface KalandarReminderParseResult {
  fields: {
    title: string;
    remind_at: string | null;
    recurrence: {
      frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
      interval: number;
      days: string[] | null;
    } | null;
    recurrence_start: string | null;
    recurrence_end: string | null;
    recurrence_exception: Array<{
      raw: string;
      condition: { type: string; date?: string } | null;
      action: { type: string } | null;
    }>;
    recurrence_window: string | null;
    location: string | null;
    context_hint: string | null;
  };
  meta: {
    runtime?: {
      mode: 'lightweight' | 'ml';
    };
    confidence: {
      title: number;
      remind_at: number;
      recurrence: number;
      recurrence_start: number;
      recurrence_end: number;
      recurrence_exception: number;
      recurrence_window: number;
      location: number;
      context_hint: number;
    };
    spans: {
      title: KalandarFieldSpan[];
      remind_at: KalandarFieldSpan[];
      recurrence: KalandarFieldSpan[];
      recurrence_start: KalandarFieldSpan[];
      recurrence_end: KalandarFieldSpan[];
      recurrence_exception: KalandarFieldSpan[];
      recurrence_window: KalandarFieldSpan[];
      location: KalandarFieldSpan[];
      context_hint: KalandarFieldSpan[];
    };
    debugSteps: KalandarDebugStep[];
    maskedInput: string;
  };
  warnings: KalandarParseWarning[] | null;
}

export interface KalandarCalendarParseOptions {
  now?: Date | string;
  timezone?: string;
  locale?: string;
  debug?: boolean;
}

export interface KalandarCalendarParseResult {
  fields: {
    title: string | null;
    date: string | null;
    time: string | null;
    end_time: string | null;
    duration_minutes: number | null;
    location: string | null;
    recurrence: string | null;
    recurrence_start: string | null;
    recurrence_end: string | null;
    recurrence_exception: Array<{
      raw: string;
      condition: { type: string; date?: string } | null;
      action: { type: string } | null;
    }>;
    alerts: Array<{ offset_minutes: number }> | null;
    attendees: string[] | null;
    contact_suggestions: Array<{ text: string; source: string }> | null;
  };
  meta: {
    locale: string;
    timezone: string;
    runtime?: {
      mode: 'lightweight' | 'ml';
    };
    confidence: {
      title: number;
      date: number;
      time: number;
      end_time: number;
      duration_minutes: number;
      location: number;
      recurrence: number;
      recurrence_start: number;
      recurrence_end: number;
      recurrence_exception: number;
      alerts: number;
      attendees: number;
      contact_suggestions: number;
    };
    spans: {
      title: Array<KalandarFieldSpan & { ruleId: string; confidence: number }>;
      date: Array<KalandarFieldSpan & { ruleId: string; confidence: number }>;
      time: Array<KalandarFieldSpan & { ruleId: string; confidence: number }>;
      end_time: Array<KalandarFieldSpan & { ruleId: string; confidence: number }>;
      duration_minutes: Array<KalandarFieldSpan & { ruleId: string; confidence: number }>;
      location: Array<KalandarFieldSpan & { ruleId: string; confidence: number }>;
      recurrence: Array<KalandarFieldSpan & { ruleId: string; confidence: number }>;
      recurrence_start: Array<KalandarFieldSpan & { ruleId: string; confidence: number }>;
      recurrence_end: Array<KalandarFieldSpan & { ruleId: string; confidence: number }>;
      recurrence_exception: Array<KalandarFieldSpan & { ruleId: string; confidence: number }>;
      alerts: Array<KalandarFieldSpan & { ruleId: string; confidence: number }>;
      attendees: Array<KalandarFieldSpan & { ruleId: string; confidence: number }>;
      contact_suggestions: Array<KalandarFieldSpan & { ruleId: string; confidence: number }>;
    };
    cleanedInput: string;
    maskedInput: string;
    debugSteps: KalandarDebugStep[];
  };
  warnings: KalandarParseWarning[] | null;
}

export function classifyIntent(input: string, opts?: KalandarIntentOptions): KalandarIntentResult;
export function parseTaskInput(input: string, opts?: KalandarTaskParseOptions): KalandarTaskParseResult;
export function parseReminderInput(input: string, opts?: KalandarReminderParseOptions): KalandarReminderParseResult;
export function parseEventInput(input: string, opts?: KalandarCalendarParseOptions): KalandarCalendarParseResult;
