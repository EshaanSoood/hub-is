import type { EventSummary } from './events';
import type { TaskSummary } from './tasks';

export interface HomeCaptureSummary {
  /** Stable record identifier for a personal capture item. */
  record_id: string;
  /** Personal project identifier that owns the capture. */
  project_id: string;
  /** Collection identifier containing the capture record. */
  collection_id: string;
  /** Capture title shown in the inbox section. */
  title: string;
  /** ISO 8601 timestamp when the capture record was created. */
  created_at: string;
}

export interface NotificationSummary {
  /** Stable notification identifier. */
  notification_id: string;
  /** Project identifier scoped to the notification. */
  project_id: string;
  /** Recipient user identifier. */
  user_id: string;
  /** Notification reason/category key. */
  reason: string;
  /** Entity type connected to this notification. */
  entity_type: string;
  /** Entity identifier connected to this notification. */
  entity_id: string;
  /** Structured notification metadata payload. */
  payload: Record<string, unknown>;
  /** Delivery scope for the notification channel. */
  notification_scope: 'network' | 'local';
  /** ISO 8601 read timestamp, or null when unread. */
  read_at: string | null;
  /** ISO 8601 creation timestamp. */
  created_at: string;
}

export interface HubHomeResponse {
  /** Personal project identifier for the authenticated user. */
  personal_project_id: string | null;
  /** Assigned/personal task summaries for home view. */
  tasks: TaskSummary[];
  /** Opaque cursor for loading more home tasks. */
  tasks_next_cursor: string | null;
  /** Personal capture/inbox records. */
  captures: HomeCaptureSummary[];
  /** Upcoming or recent calendar event summaries. */
  events: EventSummary[];
  /** Home-scope notifications. */
  notifications: NotificationSummary[];
}

export interface HubHomeEnvelopeResponse {
  /** Home payload wrapped under the `home` key. */
  home: HubHomeResponse;
}
