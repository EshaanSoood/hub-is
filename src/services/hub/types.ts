export interface HubErrorPayload {
  code: string;
  message: string;
}

export interface HubEnvelope<T> {
  ok: boolean;
  data: T | null;
  error: HubErrorPayload | null;
}

export interface HubProject {
  project_id: string;
  name: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  membership_role: string | null;
}

export interface HubUserSummary {
  user_id: string;
  kc_sub: string;
  display_name: string;
  email: string | null;
}

export interface HubProjectMember {
  user_id: string;
  role: string;
  joined_at: string;
  display_name: string;
  email: string | null;
}

export interface HubProjectInvite {
  invite_request_id: string;
  project_id: string;
  email: string;
  role: string;
  requested_by_user_id: string;
  status: string;
  target_user_id: string | null;
  reviewed_by_user_id: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface HubPaneSummary {
  pane_id: string;
  project_id: string;
  name: string;
  sort_order: number;
  pinned: boolean;
  layout_config: Record<string, unknown>;
  doc_id: string | null;
  members: Array<{ user_id: string; display_name: string }>;
  can_edit?: boolean;
}

export interface HubSourcePaneContext {
  pane_id: string | null;
  pane_name: string | null;
  doc_id: string | null;
}

export interface HubCollabAuthorization {
  doc_id: string;
  pane_id: string;
  project_id: string;
  user_id: string;
  display_name: string;
  can_edit?: boolean;
  ws_ticket: string;
  ticket_issued_at: string;
  ticket_expires_at: string;
  ticket_expires_in_ms: number;
}

export interface HubLiveAuthorization {
  user_id: string;
  ws_ticket: string;
  ticket_issued_at: string;
  ticket_expires_at: string;
  ticket_expires_in_ms: number;
}

export interface HubCollection {
  collection_id: string;
  project_id: string;
  name: string;
  icon: string | null;
  color: string | null;
  created_at: string;
  updated_at: string;
}

export interface HubCollectionField {
  field_id: string;
  collection_id: string;
  name: string;
  type: string;
  config: Record<string, unknown>;
  sort_order: number;
}

export interface HubView {
  view_id: string;
  project_id: string;
  collection_id: string;
  type: string;
  name: string;
  config: Record<string, unknown>;
}

export interface HubEntityRef {
  entity_type: string;
  entity_id: string;
}

export interface HubMentionTarget {
  entity_ref: HubEntityRef;
  label: string;
  secondary_label: string | null;
  entity_type: 'user' | 'record';
  metadata: Record<string, unknown>;
}

export interface HubBacklink {
  mention_id: string;
  created_at: string;
  source_entity_type: string;
  source_entity_id: string;
  target_entity_type: string;
  target_entity_id: string;
  context: Record<string, unknown> | null;
  source: {
    doc_id: string | null;
    pane_id: string | null;
    pane_name: string | null;
    node_key: string | null;
    comment_target_entity_type: string | null;
    comment_target_entity_id: string | null;
    comment_author_user_id: string | null;
  };
}

export interface HubMaterializedMention {
  mention_id: string;
  project_id: string;
  source_entity_type: string;
  source_entity_id: string;
  target_entity_type: string;
  target_entity_id: string;
  context: Record<string, unknown> | null;
}

export interface HubRecordSummary {
  record_id: string;
  collection_id: string;
  title: string;
  fields: Record<string, unknown>;
  updated_at: string;
  source_pane: HubSourcePaneContext | null;
}

export interface HubRecordDetail {
  record_id: string;
  project_id: string;
  collection_id: string;
  title: string;
  origin_kind?: 'pane' | 'project' | 'personal' | null;
  source_view_id?: string | null;
  source_pane: HubSourcePaneContext | null;
  schema: {
    collection_id: string;
    name: string;
    fields: Array<{ field_id: string; name: string; type: string; config: Record<string, unknown>; sort_order: number }>;
  } | null;
  values: Record<string, unknown>;
  capabilities: {
    capability_types: string[];
    task_state: { status: string; priority: string | null; completed_at: string | null; updated_at: string } | null;
    event_state:
      | { start_dt: string; end_dt: string; timezone: string; location: string | null; updated_at: string }
      | null;
    recurrence_rule: Record<string, unknown> | null;
    reminders: Array<{ reminder_id: string; remind_at: string; channels: string[]; created_at: string; fired_at: string | null }>;
    participants: Array<{ user_id: string; role: string | null; added_at: string }>;
    assignments: Array<{ user_id: string; assigned_at: string }>;
  };
  relations: {
    outgoing: Array<{
      relation_id: string;
      to_record_id: string;
      via_field_id: string;
      to_record?: {
        record_id: string;
        title: string;
        collection_id: string | null;
        collection_name: string | null;
      };
    }>;
    incoming: Array<{
      relation_id: string;
      from_record_id: string;
      via_field_id: string;
      from_record?: {
        record_id: string;
        title: string;
        collection_id: string | null;
        collection_name: string | null;
      };
    }>;
  };
  attachments: Array<{
    attachment_id: string;
    provider: string;
    asset_root_id: string;
    asset_path: string;
    name: string;
    mime_type: string;
    size_bytes: number;
    metadata: Record<string, unknown>;
    proxy_url: string;
    created_at: string;
  }>;
  comments: Array<{
    comment_id: string;
    author_user_id: string;
    body_json: Record<string, unknown>;
    status: 'open' | 'resolved';
    created_at: string;
    updated_at: string;
  }>;
  activity: Array<{
    timeline_event_id: string;
    event_type: string;
    created_at: string;
    actor_user_id: string;
    summary_json: Record<string, unknown>;
  }>;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface HubRelationSearchRecord {
  record_id: string;
  collection_id: string;
  title: string;
  collection_name: string | null;
  collection_icon: string | null;
}

export interface HubTrackedFile {
  file_id: string;
  project_id: string;
  asset_root_id: string;
  provider: string;
  asset_path: string;
  provider_path: string;
  name: string;
  mime_type: string;
  size_bytes: number;
  created_by: string;
  created_at: string;
  scope: 'project' | 'pane';
  pane_id: string | null;
  metadata: Record<string, unknown>;
  proxy_url: string;
}

export interface HubTaskSummary {
  record_id: string;
  project_id: string | null;
  project_name: string | null;
  collection_id: string;
  collection_name: string | null;
  title: string;
  updated_at: string;
  task_state: {
    status: string;
    priority: string | null;
    completed_at: string | null;
    due_at?: string | null;
    updated_at: string;
  };
  assignments: Array<{ user_id: string; assigned_at: string }>;
  origin_kind: 'pane' | 'project' | 'personal';
  source_view_id: string | null;
  source_pane: HubSourcePaneContext | null;
}

export interface HubTaskPage {
  tasks: HubTaskSummary[];
  next_cursor: string | null;
}

export interface HubHomeCapture {
  record_id: string;
  project_id: string;
  collection_id: string;
  title: string;
  created_at: string;
}

export interface HubHomeEvent {
  record_id: string;
  project_id: string;
  project_name: string | null;
  collection_id: string;
  collection_name: string | null;
  title: string;
  updated_at: string;
  event_state: {
    start_dt: string;
    end_dt: string;
    timezone: string;
    location: string | null;
    updated_at: string;
  };
  participants: Array<{ user_id: string; role: string | null; added_at: string }>;
  source_pane: HubSourcePaneContext | null;
}

export interface HubNotification {
  notification_id: string;
  project_id: string;
  user_id: string;
  reason: string;
  entity_type: string;
  entity_id: string;
  payload: Record<string, unknown>;
  notification_scope: 'network' | 'local';
  read_at: string | null;
  created_at: string;
}
