import { test as setup } from '@playwright/test';
import { resolveLinkedTestAccounts, mintTokensForAccounts } from './utils/tokenMint';
import {
  addProjectMember,
  createCollection,
  createEventFromNlp,
  createField,
  createProject,
  createWorkProject,
  createRecord,
  createView,
  getHubHome,
  loadSessionSummary,
  waitForProjectMember,
  resolveApiBaseUrl,
  resolveAppBaseUrl,
  writeAuthStateFiles,
  writeAuditFixture,
} from './support/audit';

setup('authenticate once and seed the E2E audit fixture', async () => {
  const baseUrl = resolveAppBaseUrl();
  const apiBaseUrl = resolveApiBaseUrl();
  const { accountA, accountB } = await resolveLinkedTestAccounts();
  const { tokenA, tokenB } = await mintTokensForAccounts(accountA, accountB);

  const [ownerSession, viewerSession, ownerHome] = await Promise.all([
    loadSessionSummary(apiBaseUrl, tokenA),
    loadSessionSummary(apiBaseUrl, tokenB),
    getHubHome(apiBaseUrl, tokenA),
  ]);

  const runId = `audit-${Date.now().toString(36)}`;
  const mainProject = await createProject(apiBaseUrl, tokenA, `E2E Audit ${runId}`);
  const auxProject = await createProject(apiBaseUrl, tokenA, `E2E Audit Aux ${runId}`);

  await addProjectMember(apiBaseUrl, tokenA, mainProject.space_id, {
    user_id: viewerSession.userId,
    role: 'viewer',
  });
  await waitForProjectMember(apiBaseUrl, tokenA, mainProject.space_id, viewerSession.userId);

  const collection = await createCollection(apiBaseUrl, tokenA, mainProject.space_id, `Audit Records ${runId}`);
  const auxCollection = await createCollection(apiBaseUrl, tokenA, auxProject.space_id, `Audit Tasks ${runId}`);

  const statusField = await createField(apiBaseUrl, tokenA, collection.collection_id, {
    name: 'Status',
    type: 'select',
    sort_order: 1,
    config: { options: ['todo', 'in-progress', 'done'] },
  });
  const notesField = await createField(apiBaseUrl, tokenA, collection.collection_id, {
    name: 'Notes',
    type: 'text',
    sort_order: 2,
    config: {},
  });

  const tableView = await createView(apiBaseUrl, tokenA, mainProject.space_id, {
    collection_id: collection.collection_id,
    type: 'table',
    name: `Audit Table ${runId}`,
    config: { visible_field_ids: [statusField.field_id, notesField.field_id] },
  });
  const kanbanView = await createView(apiBaseUrl, tokenA, mainProject.space_id, {
    collection_id: collection.collection_id,
    type: 'kanban',
    name: `Audit Kanban ${runId}`,
    config: { group_by_field_id: statusField.field_id },
  });

  const sharedProject = await createWorkProject(apiBaseUrl, tokenA, mainProject.space_id, {
    name: `Audit Shared ${runId}`,
    member_user_ids: [viewerSession.userId],
    layout_config: {
      modules_enabled: true,
      workspace_enabled: true,
      modules: [
        {
          module_instance_id: `table-${runId}`,
          module_type: 'table',
          size_tier: 'L',
          lens: 'project',
          binding: { view_id: tableView.view_id },
        },
        {
          module_instance_id: `kanban-${runId}`,
          module_type: 'kanban',
          size_tier: 'L',
          lens: 'project',
          binding: { view_id: kanbanView.view_id },
        },
        {
          module_instance_id: `files-${runId}`,
          module_type: 'files',
          size_tier: 'M',
          lens: 'project',
        },
      ],
    },
  });

  const privateProject = await createWorkProject(apiBaseUrl, tokenA, mainProject.space_id, {
    name: `Audit Private ${runId}`,
    member_user_ids: [],
    layout_config: {
      modules_enabled: true,
      workspace_enabled: true,
      modules: [
        {
          module_instance_id: `table-${runId}-private`,
          module_type: 'table',
          size_tier: 'M',
          lens: 'project',
          binding: { view_id: tableView.view_id },
        },
      ],
    },
  });

  const now = new Date();
  const dueToday = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
  const dueTomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  const eventStart = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const eventEnd = new Date(now.getTime() + 3 * 60 * 60 * 1000);

  const todoTitle = `Audit Todo ${runId}`;
  const inProgressTitle = `Audit In Progress ${runId}`;
  const doneTitle = `Audit Done ${runId}`;
  const auxTitle = `Audit Aux Task ${runId}`;
  const eventTitle = `Audit Event ${runId}`;

  await createRecord(apiBaseUrl, tokenA, mainProject.space_id, {
    collection_id: collection.collection_id,
    title: todoTitle,
    source_project_id: sharedProject.project_id,
    values: {
      [statusField.field_id]: 'todo',
      [notesField.field_id]: 'Seeded todo task',
    },
    capability_types: ['task'],
    task_state: {
      status: 'todo',
      priority: 'high',
      due_at: dueToday,
    },
    assignment_user_ids: [ownerSession.userId],
  });

  await createRecord(apiBaseUrl, tokenA, mainProject.space_id, {
    collection_id: collection.collection_id,
    title: inProgressTitle,
    source_project_id: sharedProject.project_id,
    values: {
      [statusField.field_id]: 'in-progress',
      [notesField.field_id]: 'Seeded in-progress task',
    },
    capability_types: ['task'],
    task_state: {
      status: 'in-progress',
      priority: 'medium',
      due_at: dueTomorrow,
    },
    assignment_user_ids: [ownerSession.userId],
  });

  await createRecord(apiBaseUrl, tokenA, mainProject.space_id, {
    collection_id: collection.collection_id,
    title: doneTitle,
    source_project_id: sharedProject.project_id,
    values: {
      [statusField.field_id]: 'done',
      [notesField.field_id]: 'Seeded done task',
    },
    capability_types: ['task'],
    task_state: {
      status: 'done',
      priority: 'low',
      completed_at: now.toISOString(),
      due_at: dueTomorrow,
    },
    assignment_user_ids: [ownerSession.userId],
  });

  await createEventFromNlp(apiBaseUrl, tokenA, mainProject.space_id, {
    source_project_id: sharedProject.project_id,
    title: eventTitle,
    start_dt: eventStart.toISOString(),
    end_dt: eventEnd.toISOString(),
    timezone: 'America/New_York',
    location: 'Audit Calendar',
    participants_user_ids: [ownerSession.userId],
  });

  await createRecord(apiBaseUrl, tokenA, auxProject.space_id, {
    collection_id: auxCollection.collection_id,
    title: auxTitle,
    capability_types: ['task'],
    task_state: {
      status: 'todo',
      priority: null,
      due_at: dueTomorrow,
    },
    assignment_user_ids: [ownerSession.userId],
  });

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const home = await getHubHome(apiBaseUrl, tokenA);
    const hasMainTask = home.tasks.some((task) => task.title === todoTitle);
    const hasAuxTask = home.tasks.some((task) => task.title === auxTitle);
    if (hasMainTask && hasAuxTask) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 750));
  }

  await writeAuthStateFiles(baseUrl, tokenA, tokenB);
  await writeAuditFixture({
    baseUrl,
    apiBaseUrl,
    owner: {
      email: accountA.email,
      token: tokenA,
      session: ownerSession,
      personalSpaceId: ownerHome.personal_space_id,
    },
    viewer: {
      email: accountB.email,
      token: tokenB,
      session: viewerSession,
    },
    project: {
      id: mainProject.space_id,
      name: mainProject.name,
    },
    auxProject: {
      id: auxProject.space_id,
      name: auxProject.name,
    },
    collection: {
      id: collection.collection_id,
      auxId: auxCollection.collection_id,
    },
    fields: {
      statusId: statusField.field_id,
      notesId: notesField.field_id,
    },
    views: {
      tableId: tableView.view_id,
      kanbanId: kanbanView.view_id,
    },
    projects: {
      sharedId: sharedProject.project_id,
      sharedDocId: sharedProject.doc_id || '',
      privateId: privateProject.project_id,
    },
    tasks: {
      todoTitle,
      inProgressTitle,
      doneTitle,
      auxTitle,
    },
    event: {
      title: eventTitle,
    },
  });
});
