import type { DebugStep, FieldSpan, ParseWarning } from '../shared/types.ts';

export type TaskPriority = 'high' | 'medium' | 'low' | null;

export interface TaskFields {
  title: string;
  due_at: string | null;
  priority: TaskPriority;
  assignee_hints: string[];
}

export interface TaskParseMeta {
  confidence: {
    title: number;
    due_at: number;
    priority: number;
    assignee_hints: number;
  };
  spans: {
    title: FieldSpan[];
    due_at: FieldSpan[];
    priority: FieldSpan[];
    assignee_hints: FieldSpan[];
  };
  debugSteps: DebugStep[];
  maskedInput: string;
}

export interface TaskParseResult {
  fields: TaskFields;
  meta: TaskParseMeta;
  warnings: ParseWarning[] | null;
}

export interface TaskParseOptions {
  now?: Date | string;
  timezone?: string;
  knownAssignees?: string[];
  debug?: boolean;
}

export interface TaskParseContext {
  rawInput: string;
  working: string;
  maskedInput: string;
  now: Date;
  options: { timezone: string; knownAssignees?: string[]; debug: boolean };
  result: TaskParseResult;
  state: {
    dueForcedToday: boolean;
    preferNextWeekStart: boolean;
  };
}

export type TaskParsePass = (ctx: TaskParseContext) => void;
