import type { HubRecordDetail } from './records';
import type { SourceProjectContext } from './tasks';

export interface EventState {
  /** ISO 8601 event start datetime. */
  start_dt: string;
  /** ISO 8601 event end datetime. */
  end_dt: string;
  /** IANA timezone identifier used for event rendering. */
  timezone: string;
  /** Optional free-form event location text. */
  location: string | null;
  /** ISO 8601 timestamp of the latest event-state update. */
  updated_at: string;
}

export interface EventParticipant {
  /** User identifier attached to the event. */
  user_id: string;
  /** Optional participant role label. */
  role: string | null;
  /** ISO 8601 timestamp when the participant was added. */
  added_at: string;
}

export interface EventReminderSeed {
  /** ISO 8601 datetime for reminder delivery. */
  remind_at: string;
  /** Delivery channel list for the event reminder. */
  channels: string[];
}

export interface EventSummary {
  /** Stable record identifier for the event. */
  record_id: string;
  /** Parent space identifier for the event record. */
  space_id: string;
  /** Space display name; null when unavailable. */
  space_name: string | null;
  /** Collection identifier containing the event record. */
  collection_id: string;
  /** Collection display name; null when unavailable. */
  collection_name: string | null;
  /** Event title shown in dashboards and calendars. */
  title: string;
  /** User identifier that created the event record. */
  created_by?: string;
  /** ISO 8601 timestamp when the event record was last updated. */
  updated_at: string;
  /** Canonical event scheduling state. */
  event_state: EventState;
  /** Event participants visible to the current user. */
  participants: EventParticipant[];
  /** Optional project context used to deep-link into work views. */
  source_project: SourceProjectContext | null;
}

export interface CreateEventRequest {
  /** Optional destination project identifier for the new event record. */
  project_id?: string;
  /** Optional source project identifier for routing and provenance. */
  source_project_id?: string;
  /** Optional source document identifier for provenance metadata. */
  source_doc_id?: string;
  /** Optional source node key for provenance metadata. */
  source_node_key?: string;
  /** Optional NLP parse payload that may include title/date/time fields. */
  nlp_fields_json?: Record<string, unknown>;
  /** Optional event title override. */
  title?: string;
  /** Optional ISO 8601 event start datetime. */
  start_dt?: string;
  /** Optional ISO 8601 event end datetime. */
  end_dt?: string;
  /** Optional legacy alias for `start_dt`. */
  start?: string;
  /** Optional legacy alias for `end_dt`. */
  end?: string;
  /** Optional IANA timezone identifier. */
  timezone?: string;
  /** Optional event location. */
  location?: string;
  /** Optional participant user IDs. */
  participants_user_ids?: string[];
  /** Optional legacy participant user IDs alias. */
  participant_user_ids?: string[];
  /** Optional reminder descriptors attached to the event. */
  reminders?: EventReminderSeed[];
  /** Optional recurrence-rule payload. */
  recurrence_rule?: Record<string, unknown>;
  /** Optional legacy recurrence-rule payload alias. */
  rule_json?: Record<string, unknown>;
}

export interface CreateEventResponse {
  /** Full record detail payload for the newly created calendar event. */
  record: HubRecordDetail;
}
