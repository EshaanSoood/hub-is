import {
  createCollection,
  createField,
  createProject,
  createWorkProject,
  createRecord,
  createView,
  loadSessionSummary,
  resolveApiBaseUrl,
  resolveAppBaseUrl,
} from '../support/audit.ts';
import { mintTokensForAccounts, resolveLinkedTestAccounts } from '../utils/tokenMint.ts';
import {
  createRunId,
  futureIsoFromNow,
  resolveScenario,
  withRunTag,
  writeJourneyContext,
  type JourneySeedContext,
} from './utils/stateTags.ts';

const main = async (): Promise<void> => {
  const scenario = resolveScenario();
  if (scenario !== 'baseline') {
    throw new Error(`seed-normal.ts only supports baseline scenario. Received ${scenario}.`);
  }

  const baseUrl = resolveAppBaseUrl();
  const apiBaseUrl = resolveApiBaseUrl();
  const { accountA, accountB } = await resolveLinkedTestAccounts();
  const { tokenA } = await mintTokensForAccounts(accountA, accountB);
  const session = await loadSessionSummary(apiBaseUrl, tokenA);
  const runId = createRunId(scenario);

  const project = await createProject(apiBaseUrl, tokenA, `Journey Baseline ${runId}`);

  const primaryProject = await createWorkProject(apiBaseUrl, tokenA, project.space_id, {
    name: `Journey Primary ${runId}`,
    member_user_ids: [session.userId],
    layout_config: {
      widgets_enabled: true,
      workspace_enabled: true,
      widgets: [],
    },
  });

  const secondaryProject = await createWorkProject(apiBaseUrl, tokenA, project.space_id, {
    name: `Journey Secondary ${runId}`,
    member_user_ids: [session.userId],
    layout_config: {
      widgets_enabled: true,
      workspace_enabled: true,
      widgets: [],
    },
  });

  const collection = await createCollection(apiBaseUrl, tokenA, project.space_id, `Journey Records ${runId}`);

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

  const tableView = await createView(apiBaseUrl, tokenA, project.space_id, {
    collection_id: collection.collection_id,
    type: 'table',
    name: `Journey Table ${runId}`,
    config: { visible_field_ids: [statusField.field_id, notesField.field_id] },
  });

  const kanbanView = await createView(apiBaseUrl, tokenA, project.space_id, {
    collection_id: collection.collection_id,
    type: 'kanban',
    name: `Journey Kanban ${runId}`,
    config: { group_by_field_id: statusField.field_id },
  });

  const titlePrefix = `[journey:${runId}]`;
  await createRecord(apiBaseUrl, tokenA, project.space_id, {
    collection_id: collection.collection_id,
    title: withRunTag({ tags: { cleanupTag: titlePrefix, titlePrefix } }, 'seed record'),
    source_project_id: primaryProject.project_id,
    values: {
      [statusField.field_id]: 'todo',
      [notesField.field_id]: 'baseline seed',
    },
  });

  await createRecord(apiBaseUrl, tokenA, project.space_id, {
    collection_id: collection.collection_id,
    title: withRunTag({ tags: { cleanupTag: titlePrefix, titlePrefix } }, 'seed task'),
    source_project_id: primaryProject.project_id,
    values: {
      [statusField.field_id]: 'todo',
      [notesField.field_id]: 'baseline task seed',
    },
    capability_types: ['task'],
    task_state: {
      status: 'todo',
      priority: 'medium',
      due_at: futureIsoFromNow(90),
    },
    assignment_user_ids: [session.userId],
  });

  const context: JourneySeedContext = {
    scenario,
    runId,
    createdAtIso: new Date().toISOString(),
    baseUrl,
    apiBaseUrl,
    project: {
      id: project.space_id,
      name: project.name,
    },
    projects: {
      primaryId: primaryProject.project_id,
      secondaryId: secondaryProject.project_id,
      primaryName: primaryProject.name || `Journey Primary ${runId}`,
      secondaryName: secondaryProject.name || `Journey Secondary ${runId}`,
    },
    collection: {
      id: collection.collection_id,
      statusFieldId: statusField.field_id,
      notesFieldId: notesField.field_id,
      tableViewId: tableView.view_id,
      kanbanViewId: kanbanView.view_id,
    },
    tags: {
      cleanupTag: titlePrefix,
      titlePrefix,
    },
  };

  await writeJourneyContext(context);

  process.stdout.write(
    `Seeded baseline journey context for project ${project.space_id} and project ${primaryProject.project_id} as ${runId}.\n`,
  );
  process.stdout.write(`Session user: ${session.userId}\n`);
};

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
