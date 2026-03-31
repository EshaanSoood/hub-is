import type {
  EventSummary,
  HubRecordDetail as SharedHubRecordDetail,
  HomeCaptureSummary,
  NotificationSummary,
  ProjectSummary,
  SourcePaneContext,
  TaskPage,
  TaskSummary,
} from '../../shared/api-types';

export interface HubErrorPayload {
  code: string;
  message: string;
}

export interface HubEnvelope<T> {
  ok: boolean;
  data: T | null;
  error: HubErrorPayload | null;
}

export type HubProject = ProjectSummary;

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

export type HubSourcePaneContext = SourcePaneContext;

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

export type HubRecordDetail = SharedHubRecordDetail;

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

export type HubTaskSummary = TaskSummary;
export type HubTaskPage = TaskPage;
export type HubHomeCapture = HomeCaptureSummary;
export type HubHomeEvent = EventSummary;
export type HubNotification = NotificationSummary;
