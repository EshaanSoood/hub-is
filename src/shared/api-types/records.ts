import type { SourcePaneContext } from './tasks';

export interface HubRecordDetail {
  record_id: string;
  project_id: string;
  collection_id: string;
  title: string;
  origin_kind?: 'pane' | 'project' | 'personal' | null;
  source_view_id?: string | null;
  source_pane: SourcePaneContext | null;
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
