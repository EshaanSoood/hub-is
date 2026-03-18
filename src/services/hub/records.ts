import { hubRequest, normalizeRecordDetail, normalizeSourcePane } from './transport';

import type {
  HubBacklink,
  HubHomeCapture,
  HubHomeEvent,
  HubMaterializedMention,
  HubMentionTarget,
  HubNotification,
  HubRecordDetail,
  HubRelationSearchRecord,
  HubSourcePaneContext,
  HubTaskPage,
  HubTaskSummary,
} from './types';

export const createRecord = async (
  accessToken: string,
  projectId: string,
  payload: {
    collection_id: string;
    title: string;
    parent_record_id?: string | null;
    source_pane_id?: string;
    source_view_id?: string;
    values?: Record<string, unknown>;
    capability_types?: string[];
    task_state?: {
      status?: string;
      priority?: string | null;
      due_at?: string | null;
      category?: string | null;
    };
    event_state?: Record<string, unknown>;
    recurrence_rule?: Record<string, unknown>;
    reminders?: Array<{ remind_at: string; channels: string[] }>;
    assignment_user_ids?: string[];
  },
): Promise<{ record_id: string }> => {
  return hubRequest<{ record_id: string }>(accessToken, `/api/hub/projects/${encodeURIComponent(projectId)}/records`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const updateRecord = async (
  accessToken: string,
  recordId: string,
  payload: { title?: string; archived?: boolean },
): Promise<HubRecordDetail> => {
  const data = await hubRequest<{ record: HubRecordDetail }>(accessToken, `/api/hub/records/${encodeURIComponent(recordId)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return normalizeRecordDetail(data.record);
};

export const convertRecord = async (
  accessToken: string,
  recordId: string,
  payload: {
    mode: 'thought' | 'task' | 'reminder' | 'calendar';
    target_project_id: string;
    target_collection_id?: string;
    title?: string;
  },
): Promise<{ target_record_id: string; source_record_id: string }> => {
  return hubRequest<{ target_record_id: string; source_record_id: string }>(
    accessToken,
    `/api/hub/records/${encodeURIComponent(recordId)}/convert`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
};

export const getRecordDetail = async (
  accessToken: string,
  recordId: string,
  options?: { signal?: AbortSignal },
): Promise<HubRecordDetail> => {
  const data = await hubRequest<{ record: HubRecordDetail }>(accessToken, `/api/hub/records/${encodeURIComponent(recordId)}`, {
    method: 'GET',
    signal: options?.signal,
  });
  return normalizeRecordDetail(data.record);
};

export const setRecordValues = async (
  accessToken: string,
  recordId: string,
  values: Record<string, unknown>,
  options?: { mutation_context_pane_id?: string },
): Promise<Record<string, unknown>> => {
  const data = await hubRequest<{ values: Record<string, unknown> }>(
    accessToken,
    `/api/hub/records/${encodeURIComponent(recordId)}/values`,
    {
      method: 'POST',
      body: JSON.stringify({
        values,
        ...(options?.mutation_context_pane_id ? { mutation_context_pane_id: options.mutation_context_pane_id } : {}),
      }),
    },
  );
  return data.values;
};

export const addRelation = async (
  accessToken: string,
  recordId: string,
  payload: {
    project_id?: string;
    from_record_id?: string;
    to_record_id: string;
    via_field_id: string;
    mutation_context_pane_id?: string;
  },
): Promise<{
  relation: {
    relation_id: string;
    project_id: string;
    from_record_id: string;
    to_record_id: string;
    via_field_id: string;
    created_by: string;
    created_at: string;
  };
}> => {
  return hubRequest<{
    relation: {
      relation_id: string;
      project_id: string;
      from_record_id: string;
      to_record_id: string;
      via_field_id: string;
      created_by: string;
      created_at: string;
    };
  }>(accessToken, `/api/hub/records/${encodeURIComponent(recordId)}/relations`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const removeRelation = async (
  accessToken: string,
  relationId: string,
  options?: { mutation_context_pane_id?: string },
): Promise<void> => {
  const params = new URLSearchParams();
  if (options?.mutation_context_pane_id) {
    params.set('mutation_context_pane_id', options.mutation_context_pane_id);
  }
  const query = params.toString();
  await hubRequest<{ deleted: boolean }>(
    accessToken,
    `/api/hub/relations/${encodeURIComponent(relationId)}${query ? `?${query}` : ''}`,
    {
      method: 'DELETE',
    },
  );
};

export const searchRelationRecords = async (
  accessToken: string,
  projectId: string,
  query: string,
  options?: {
    collection_id?: string;
    exclude_record_id?: string;
    limit?: number;
  },
): Promise<HubRelationSearchRecord[]> => {
  const params = new URLSearchParams();
  params.set('query', query);
  params.set('limit', String(options?.limit ?? 20));
  if (options?.collection_id) {
    params.set('collection_id', options.collection_id);
  }
  if (options?.exclude_record_id) {
    params.set('exclude_record_id', options.exclude_record_id);
  }
  const data = await hubRequest<{ query: string; items: HubRelationSearchRecord[] }>(
    accessToken,
    `/api/hub/projects/${encodeURIComponent(projectId)}/records/search?${params.toString()}`,
    {
      method: 'GET',
    },
  );
  return data.items;
};

export const searchMentionTargets = async (
  accessToken: string,
  projectId: string,
  query: string,
  limit = 20,
): Promise<HubMentionTarget[]> => {
  const params = new URLSearchParams();
  params.set('q', query);
  params.set('limit', String(limit));
  const data = await hubRequest<{ query: string; items: HubMentionTarget[] }>(
    accessToken,
    `/api/hub/projects/${encodeURIComponent(projectId)}/mentions/search?${params.toString()}`,
    {
      method: 'GET',
    },
  );
  return data.items;
};

export const listBacklinks = async (
  accessToken: string,
  projectId: string,
  targetEntityType: string,
  targetEntityId: string,
): Promise<HubBacklink[]> => {
  const params = new URLSearchParams();
  params.set('target_entity_type', targetEntityType);
  params.set('target_entity_id', targetEntityId);
  const data = await hubRequest<{ backlinks: HubBacklink[] }>(
    accessToken,
    `/api/hub/projects/${encodeURIComponent(projectId)}/backlinks?${params.toString()}`,
    {
      method: 'GET',
    },
  );
  return data.backlinks;
};

export const createEventFromNlp = async (
  accessToken: string,
  projectId: string,
  payload: {
    pane_id?: string;
    source_pane_id?: string;
    nlp_fields_json?: Record<string, unknown>;
    title?: string;
    start_dt?: string;
    end_dt?: string;
    timezone?: string;
    location?: string;
    participants_user_ids?: string[];
    reminders?: Array<{ remind_at: string; channels: string[] }>;
    recurrence_rule?: Record<string, unknown>;
  },
): Promise<{ record: HubRecordDetail }> => {
  const data = await hubRequest<{ record: HubRecordDetail }>(
    accessToken,
    `/api/hub/projects/${encodeURIComponent(projectId)}/events/from-nlp`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
  return {
    record: normalizeRecordDetail(data.record),
  };
};

export const queryCalendar = async (
  accessToken: string,
  projectId: string,
  mode: 'relevant' | 'all',
): Promise<{
  mode: string;
  events: Array<{
    record_id: string;
    title: string;
    event_state: {
      start_dt: string;
      end_dt: string;
      timezone: string;
      location: string | null;
      updated_at: string;
    };
    participants: Array<{ user_id: string; role: string | null }>;
    source_pane: HubSourcePaneContext | null;
  }>;
}> => {
  const data = await hubRequest<{
    mode: string;
    events: Array<{
      record_id: string;
      title: string;
      event_state: {
        start_dt: string;
        end_dt: string;
        timezone: string;
        location: string | null;
        updated_at: string;
      };
      participants: Array<{ user_id: string; role: string | null }>;
      source_pane?: HubSourcePaneContext | null;
    }>;
  }>(accessToken, `/api/hub/projects/${encodeURIComponent(projectId)}/calendar?mode=${encodeURIComponent(mode)}`, {
    method: 'GET',
  });
  return {
    ...data,
    events: data.events.map((event) => ({
      ...event,
      source_pane: normalizeSourcePane(event.source_pane),
    })),
  };
};

export const createComment = async (
  accessToken: string,
  payload: {
    project_id: string;
    target_entity_type: string;
    target_entity_id: string;
    body_json: Record<string, unknown>;
    mention_user_ids?: string[];
    mentions?: Array<{ target_entity_type: string; target_entity_id: string; context?: Record<string, unknown> }>;
  },
): Promise<{
  comment_id: string;
  mentions?: HubMaterializedMention[];
}> => {
  return hubRequest<{
    comment_id: string;
    mentions?: HubMaterializedMention[];
  }>(accessToken, '/api/hub/comments', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const createDocAnchorComment = async (
  accessToken: string,
  payload: {
    project_id: string;
    doc_id: string;
    anchor_payload: {
      kind: 'node';
      nodeKey: string;
      context?: Record<string, unknown> | null;
    };
    body_json: Record<string, unknown>;
    mentions?: Array<{ target_entity_type: string; target_entity_id: string; context?: Record<string, unknown> }>;
  },
): Promise<{
  comment_id: string;
  mentions?: HubMaterializedMention[];
}> => {
  return hubRequest<{
    comment_id: string;
    mentions?: HubMaterializedMention[];
  }>(accessToken, '/api/hub/comments/doc-anchor', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const listComments = async (
  accessToken: string,
  query: { project_id: string; target_entity_type?: string; target_entity_id?: string; doc_id?: string },
): Promise<{
  comments: Array<{
    comment_id: string;
    project_id?: string;
    author_user_id: string;
    target_entity_type?: string;
    target_entity_id?: string;
    body_json: Record<string, unknown>;
    status: 'open' | 'resolved';
    created_at: string;
    updated_at?: string;
    doc_id?: string;
    anchor_payload?: {
      kind: 'node';
      nodeKey: string;
      context?: Record<string, unknown> | null;
    };
    orphaned?: boolean;
    is_orphaned?: boolean;
  }>;
  orphaned_comments: Array<{
    comment_id: string;
    project_id?: string;
    author_user_id: string;
    target_entity_type?: string;
    target_entity_id?: string;
    body_json: Record<string, unknown>;
    status: 'open' | 'resolved';
    created_at: string;
    updated_at?: string;
    doc_id?: string;
    anchor_payload?: {
      kind: 'node';
      nodeKey: string;
      context?: Record<string, unknown> | null;
    };
    orphaned?: boolean;
    is_orphaned?: boolean;
  }>;
}> => {
  const params = new URLSearchParams();
  params.set('project_id', query.project_id);
  if (query.target_entity_type) {
    params.set('target_entity_type', query.target_entity_type);
  }
  if (query.target_entity_id) {
    params.set('target_entity_id', query.target_entity_id);
  }
  if (query.doc_id) {
    params.set('doc_id', query.doc_id);
  }

  const data = await hubRequest<{
    comments: Array<{
      comment_id: string;
      project_id?: string;
      author_user_id: string;
      target_entity_type?: string;
      target_entity_id?: string;
      body_json: Record<string, unknown>;
      status: 'open' | 'resolved';
      created_at: string;
      updated_at?: string;
      doc_id?: string;
      anchor_payload?: {
        kind: 'node';
        nodeKey: string;
        context?: Record<string, unknown> | null;
      };
      orphaned?: boolean;
      is_orphaned?: boolean;
    }>;
    orphaned_comments?: Array<{
      comment_id: string;
      project_id?: string;
      author_user_id: string;
      target_entity_type?: string;
      target_entity_id?: string;
      body_json: Record<string, unknown>;
      status: 'open' | 'resolved';
      created_at: string;
      updated_at?: string;
      doc_id?: string;
      anchor_payload?: {
        kind: 'node';
        nodeKey: string;
        context?: Record<string, unknown> | null;
      };
      orphaned?: boolean;
      is_orphaned?: boolean;
    }>;
  }>(accessToken, `/api/hub/comments?${params.toString()}`, {
    method: 'GET',
  });

  return {
    comments: data.comments,
    orphaned_comments: data.orphaned_comments || [],
  };
};

export const setCommentStatus = async (
  accessToken: string,
  commentId: string,
  status: 'open' | 'resolved',
): Promise<void> => {
  await hubRequest<{ comment_id: string; status: 'open' | 'resolved' }>(
    accessToken,
    `/api/hub/comments/${encodeURIComponent(commentId)}/status`,
    {
      method: 'POST',
      body: JSON.stringify({ status }),
    },
  );
};

export const materializeMentions = async (
  accessToken: string,
  payload: {
    project_id: string;
    source_entity_type: string;
    source_entity_id: string;
    mentions: Array<{ target_entity_type: string; target_entity_id: string; context?: Record<string, unknown> }>;
    replace_source?: boolean;
  },
): Promise<HubMaterializedMention[]> => {
  const data = await hubRequest<{
    mentions: HubMaterializedMention[];
  }>(accessToken, '/api/hub/mentions/materialize', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return data.mentions;
};

export const listTimeline = async (
  accessToken: string,
  projectId: string,
): Promise<
  Array<{
    timeline_event_id: string;
    project_id: string;
    actor_user_id: string;
    event_type: string;
    primary_entity_type: string;
    primary_entity_id: string;
    secondary_entities_json: Array<{ entity_type: string; entity_id: string }>;
    summary_json: Record<string, unknown>;
    created_at: string;
  }>
> => {
  const data = await hubRequest<{
    timeline: Array<{
      timeline_event_id: string;
      project_id: string;
      actor_user_id: string;
      event_type: string;
      primary_entity_type: string;
      primary_entity_id: string;
      secondary_entities_json: Array<{ entity_type: string; entity_id: string }>;
      summary_json: Record<string, unknown>;
      created_at: string;
    }>;
  }>(accessToken, `/api/hub/projects/${encodeURIComponent(projectId)}/timeline`, {
    method: 'GET',
  });
  return data.timeline;
};

export const listProjectTasks = async (
  accessToken: string,
  projectId: string,
  options?: { limit?: number; cursor?: string; source_pane_id?: string },
): Promise<HubTaskPage> => {
  const params = new URLSearchParams();
  if (typeof options?.limit === 'number') {
    params.set('limit', String(options.limit));
  }
  if (options?.cursor) {
    params.set('cursor', options.cursor);
  }
  if (options?.source_pane_id) {
    params.set('source_pane_id', options.source_pane_id);
  }
  const query = params.toString();
  return hubRequest<HubTaskPage>(
    accessToken,
    `/api/hub/projects/${encodeURIComponent(projectId)}/tasks${query ? `?${query}` : ''}`,
    { method: 'GET' },
  );
};

export const queryTasks = async (
  accessToken: string,
  options:
    | { lens: 'project'; project_id: string; limit?: number; cursor?: string; source_pane_id?: string }
    | { lens: 'assigned'; limit?: number; cursor?: string; project_id?: string }
    | { lens: 'pane'; project_id: string; pane_id: string; limit?: number; cursor?: string },
): Promise<HubTaskPage> => {
  const params = new URLSearchParams();
  params.set('lens', options.lens);
  if ('project_id' in options && options.project_id) {
    params.set('project_id', options.project_id);
  }
  if ('pane_id' in options && options.pane_id) {
    params.set('pane_id', options.pane_id);
  }
  if ('source_pane_id' in options && options.source_pane_id) {
    params.set('source_pane_id', options.source_pane_id);
  }
  if (typeof options.limit === 'number') {
    params.set('limit', String(options.limit));
  }
  if (options.cursor) {
    params.set('cursor', options.cursor);
  }
  return hubRequest<HubTaskPage>(accessToken, `/api/hub/tasks?${params.toString()}`, { method: 'GET' });
};

export const createPersonalTask = async (
  accessToken: string,
  payload: { title: string; status?: string; priority?: string | null },
): Promise<{ task: HubTaskSummary }> => {
  return hubRequest<{ task: HubTaskSummary }>(accessToken, '/api/hub/tasks', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const getHubHome = async (
  accessToken: string,
  options?: { tasks_limit?: number; events_limit?: number; captures_limit?: number; notifications_limit?: number; unread?: boolean },
): Promise<{
  personal_project_id: string | null;
  tasks: HubTaskSummary[];
  tasks_next_cursor: string | null;
  captures: HubHomeCapture[];
  events: HubHomeEvent[];
  notifications: HubNotification[];
}> => {
  const params = new URLSearchParams();
  if (typeof options?.tasks_limit === 'number') {
    params.set('tasks_limit', String(options.tasks_limit));
  }
  if (typeof options?.events_limit === 'number') {
    params.set('events_limit', String(options.events_limit));
  }
  if (typeof options?.captures_limit === 'number') {
    params.set('captures_limit', String(options.captures_limit));
  }
  if (typeof options?.notifications_limit === 'number') {
    params.set('notifications_limit', String(options.notifications_limit));
  }
  if (options?.unread) {
    params.set('unread', '1');
  }
  const query = params.toString();
  const data = await hubRequest<{
    home: {
      personal_project_id: string | null;
      tasks: HubTaskSummary[];
      tasks_next_cursor: string | null;
      captures: HubHomeCapture[];
      events: HubHomeEvent[];
      notifications: HubNotification[];
    };
  }>(accessToken, `/api/hub/home${query ? `?${query}` : ''}`, {
    method: 'GET',
  });
  return {
    ...data.home,
    events: data.home.events.map((event) => ({
      ...event,
      source_pane: normalizeSourcePane(event.source_pane),
    })),
    notifications: data.home.notifications,
  };
};

export const attachFile = async (
  accessToken: string,
  payload: {
    project_id: string;
    entity_type: string;
    entity_id: string;
    provider: string;
    asset_root_id: string;
    asset_path: string;
    name: string;
    mime_type: string;
    size_bytes: number;
    mutation_context_pane_id?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<{ attachment_id: string }> => {
  const data = await hubRequest<{
    attachment_id: string;
  }>(accessToken, '/api/hub/attachments', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return { attachment_id: data.attachment_id };
};

export const detachFile = async (
  accessToken: string,
  attachmentId: string,
  options?: { mutation_context_pane_id?: string },
): Promise<void> => {
  const params = new URLSearchParams();
  if (options?.mutation_context_pane_id) {
    params.set('mutation_context_pane_id', options.mutation_context_pane_id);
  }
  const query = params.toString();
  await hubRequest<{ deleted: boolean }>(
    accessToken,
    `/api/hub/attachments/${encodeURIComponent(attachmentId)}${query ? `?${query}` : ''}`,
    {
      method: 'DELETE',
    },
  );
};

export const listAutomationRules = async (
  accessToken: string,
  projectId: string,
): Promise<
  Array<{
    automation_rule_id: string;
    name: string;
    enabled: boolean;
    trigger_json: Record<string, unknown>;
    actions_json: unknown[];
  }>
> => {
  const data = await hubRequest<{
    automation_rules: Array<{
      automation_rule_id: string;
      name: string;
      enabled: boolean;
      trigger_json: Record<string, unknown>;
      actions_json: unknown[];
    }>;
  }>(accessToken, `/api/hub/projects/${encodeURIComponent(projectId)}/automation-rules`, {
    method: 'GET',
  });

  return data.automation_rules;
};

export const createAutomationRule = async (
  accessToken: string,
  projectId: string,
  payload: { name: string; enabled: boolean; trigger_json: Record<string, unknown>; actions_json: unknown[] },
): Promise<{ automation_rule_id: string }> => {
  return hubRequest<{ automation_rule_id: string }>(
    accessToken,
    `/api/hub/projects/${encodeURIComponent(projectId)}/automation-rules`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
};

export const updateAutomationRule = async (
  accessToken: string,
  ruleId: string,
  payload: { name?: string; enabled?: boolean; trigger_json?: Record<string, unknown>; actions_json?: unknown[] },
): Promise<{ updated: boolean }> => {
  return hubRequest<{ updated: boolean }>(accessToken, `/api/hub/automation-rules/${encodeURIComponent(ruleId)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
};

export const deleteAutomationRule = async (accessToken: string, ruleId: string): Promise<{ deleted: boolean }> => {
  return hubRequest<{ deleted: boolean }>(accessToken, `/api/hub/automation-rules/${encodeURIComponent(ruleId)}`, {
    method: 'DELETE',
  });
};

export const listAutomationRuns = async (
  accessToken: string,
  projectId: string,
): Promise<
  Array<{
    automation_run_id: string;
    automation_rule_id: string;
    status: string;
    started_at: string;
    finished_at: string | null;
  }>
> => {
  const data = await hubRequest<{
    automation_runs: Array<{
      automation_run_id: string;
      automation_rule_id: string;
      status: string;
      started_at: string;
      finished_at: string | null;
    }>;
  }>(accessToken, `/api/hub/projects/${encodeURIComponent(projectId)}/automation-runs`, {
    method: 'GET',
  });

  return data.automation_runs;
};
