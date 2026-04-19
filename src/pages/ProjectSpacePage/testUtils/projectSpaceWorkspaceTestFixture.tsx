import type { HubPaneSummary, HubProject, HubProjectMember, HubView } from '../../../services/hub/types';
import type { HubRecordDetail } from '../../../shared/api-types/records';
import type { TimelineEvent } from '../ProjectSpaceWorkspace/types';

export interface ProjectSpaceWorkspaceFixture {
  project: HubProject;
  panes: HubPaneSummary[];
  projectMembers: HubProjectMember[];
  timeline: TimelineEvent[];
  sharedPane: HubPaneSummary;
  privatePane: HubPaneSummary;
  tableView: HubView;
  kanbanView: HubView;
  inspectorRecord: HubRecordDetail;
}

export const createProjectSpaceWorkspaceFixture = (): ProjectSpaceWorkspaceFixture => {
  const sharedPane: HubPaneSummary = {
    pane_id: 'pane-shared',
    project_id: 'project-1',
    name: 'Shared Work',
    sort_order: 1,
    position: 1,
    pinned: false,
    layout_config: {
      modules_enabled: true,
      workspace_enabled: true,
    },
    doc_id: 'doc-shared',
    members: [
      { user_id: 'user-1', display_name: 'Owner Person' },
      { user_id: 'user-2', display_name: 'Viewer Person' },
    ],
    can_edit: true,
  };

  const privatePane: HubPaneSummary = {
    pane_id: 'pane-private',
    project_id: 'project-1',
    name: 'Private Work',
    sort_order: 2,
    position: 2,
    pinned: true,
    layout_config: {
      modules_enabled: true,
      workspace_enabled: true,
    },
    doc_id: 'doc-private',
    members: [{ user_id: 'user-1', display_name: 'Owner Person' }],
    can_edit: false,
  };

  const project: HubProject = {
    project_id: 'project-1',
    name: 'Project Atlas',
    created_by: 'user-1',
    created_at: '2026-04-19T00:00:00.000Z',
    updated_at: '2026-04-19T00:00:00.000Z',
    position: 1,
    is_personal: false,
    membership_role: 'owner',
  };

  const projectMembers: HubProjectMember[] = [
    {
      user_id: 'user-1',
      role: 'owner',
      joined_at: '2026-04-19T00:00:00.000Z',
      display_name: 'Owner Person',
      email: 'owner@example.com',
    },
    {
      user_id: 'user-2',
      role: 'viewer',
      joined_at: '2026-04-19T00:00:00.000Z',
      display_name: 'Viewer Person',
      email: 'viewer@example.com',
    },
  ];

  const tableView: HubView = {
    view_id: 'view-table',
    project_id: 'project-1',
    collection_id: 'collection-1',
    type: 'table',
    name: 'Tasks Table',
    config: {},
  };

  const kanbanView: HubView = {
    view_id: 'view-kanban',
    project_id: 'project-1',
    collection_id: 'collection-1',
    type: 'kanban',
    name: 'Tasks Board',
    config: {},
  };

  const inspectorRecord: HubRecordDetail = {
    record_id: 'record-1',
    project_id: 'project-1',
    collection_id: 'collection-1',
    title: 'Audit task',
    origin_kind: 'pane',
    source_view_id: 'view-table',
    source_pane: {
      pane_id: 'pane-shared',
      pane_name: 'Shared Work',
      doc_id: 'doc-shared',
    },
    schema: {
      collection_id: 'collection-1',
      name: 'Tasks',
      fields: [
        { field_id: 'field-title', name: 'Title', type: 'text', config: {}, sort_order: 1 },
      ],
    },
    values: {
      'field-title': 'Audit task',
    },
    capabilities: {
      capability_types: ['task'],
      task_state: {
        status: 'todo',
        priority: 'medium',
        completed_at: null,
        updated_at: '2026-04-19T00:00:00.000Z',
      },
      event_state: null,
      recurrence_rule: null,
      reminders: [],
      participants: [],
      assignments: [],
    },
    relations: {
      outgoing: [],
      incoming: [],
    },
    attachments: [],
    comments: [],
    activity: [],
    created_at: '2026-04-19T00:00:00.000Z',
    updated_at: '2026-04-19T00:00:00.000Z',
    archived_at: null,
  };

  return {
    project,
    panes: [sharedPane, privatePane],
    projectMembers,
    timeline: [
      {
        timeline_event_id: 'timeline-1',
        event_type: 'task.created',
        primary_entity_type: 'record',
        primary_entity_id: 'record-1',
        summary_json: { message: 'Task created' },
        created_at: '2026-04-19T00:00:00.000Z',
      },
    ],
    sharedPane,
    privatePane,
    tableView,
    kanbanView,
    inspectorRecord,
  };
};
