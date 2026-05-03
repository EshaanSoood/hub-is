import type { EventParticipant } from './events';
import type { SourceProjectContext, TaskAssignment } from './tasks';

/** Supported recurrence frequencies for standalone reminders. */
export type ReminderFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type ReminderScope = 'personal' | 'space' | 'project';

export interface ReminderRecurrence {
  /** ISO 8601 datetime string for an explicit next reminder occurrence. */
  next_remind_at?: string;
  /** ISO 8601 datetime string used internally for follow-on recurrences. */
  subsequent_remind_at?: string;
  /** Recurrence cadence keyword. */
  frequency?: ReminderFrequency;
  /** Positive integer recurrence interval multiplier. */
  interval?: number;
}

export interface ReminderSummary {
  /** Stable reminder identifier. */
  reminder_id: string;
  /** Linked record identifier that owns this reminder. */
  record_id: string;
  /** Title of the linked record at response time. */
  record_title: string;
  /** Space identifier that owns the linked record. */
  space_id: string;
  /** User identifier that created the linked reminder record. */
  created_by?: string;
  /** Optional project context for project-origin reminders. */
  source_project?: SourceProjectContext | null;
  /** Task assignments on the linked record, when the record is a task. */
  record_assignments?: TaskAssignment[];
  /** Event participants on the linked record, when the record is an event. */
  record_participants?: EventParticipant[];
  /** ISO 8601 datetime string when the reminder should fire. */
  remind_at: string;
  /** Delivery channels (currently includes `in_app`). */
  channels: string[];
  /** Optional recurrence payload for generating future reminders. */
  recurrence_json: ReminderRecurrence | null;
  /** ISO 8601 datetime string when the reminder row was created. */
  created_at: string;
  /** ISO 8601 datetime string when fired, or null if not fired yet. */
  fired_at: string | null;
  /** True when the reminder time is in the past relative to server now. */
  overdue: boolean;
}

export interface ListRemindersResponse {
  /** Reminder list for the authenticated user. */
  reminders: ReminderSummary[];
}

export interface CreateReminderRequest {
  /** Required non-empty title for the reminder record. */
  title: string;
  /** Required ISO 8601 datetime string for first reminder trigger. */
  remind_at: string;
  /** Optional recurrence descriptor; null disables recurrence. */
  recurrence_json?: ReminderRecurrence | null;
  /** Optional reminder storage scope. Defaults to `personal` when omitted. */
  scope?: ReminderScope;
  /** Required for space-scoped reminders. */
  space_id?: string;
  /** Optional project binding for project-scoped reminders. */
  project_id?: string;
  /** Optional source view binding for traceability. */
  source_view_id?: string | null;
}

export interface CreateReminderResponse {
  /** Newly created reminder summary. */
  reminder: ReminderSummary;
}

export interface UpdateReminderRequest {
  /** Optional ISO 8601 datetime string for the next reminder trigger. */
  remind_at?: string;
  /** Optional recurrence descriptor; null clears recurrence. */
  recurrence_json?: ReminderRecurrence | null;
}

export interface UpdateReminderResponse {
  /** Updated reminder summary. */
  reminder: ReminderSummary;
}

export interface DismissReminderResponse {
  /** True when the dismissal operation succeeded. */
  dismissed: boolean;
  /** Identifier of the dismissed reminder. */
  reminder_id: string;
}
