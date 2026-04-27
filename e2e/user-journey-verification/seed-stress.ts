import {
  createCollection,
  createEventFromNlp,
  createField,
  createProject,
  createWorkProject,
  createRecord,
  createView,
  hubRequest,
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

const runInBatches = async <T>(
  values: T[],
  batchSize: number,
  worker: (value: T, index: number) => Promise<void>,
): Promise<void> => {
  for (let index = 0; index < values.length; index += batchSize) {
    const batch = values.slice(index, index + batchSize);
    await Promise.all(batch.map((value, offset) => worker(value, index + offset)));
  }
};

const main = async (): Promise<void> => {
  const scenario = resolveScenario();
  if (scenario !== 'stress') {
    throw new Error(`seed-stress.ts only supports stress scenario. Received ${scenario}.`);
  }

  const baseUrl = resolveAppBaseUrl();
  const apiBaseUrl = resolveApiBaseUrl();
  const { accountA, accountB } = await resolveLinkedTestAccounts();
  const { tokenA } = await mintTokensForAccounts(accountA, accountB);
  const session = await loadSessionSummary(apiBaseUrl, tokenA);
  const runId = createRunId(scenario);

  const project = await createProject(apiBaseUrl, tokenA, `Journey Stress ${runId}`);

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
  const statusCycle = ['todo', 'in-progress', 'done'] as const;

  const denseRecordIndexes = Array.from({ length: 90 }, (_, index) => index + 1);
  await runInBatches(denseRecordIndexes, 12, async (_value, index) => {
    const statusValue = statusCycle[index % statusCycle.length];
    await createRecord(apiBaseUrl, tokenA, project.space_id, {
      collection_id: collection.collection_id,
      title: withRunTag({ tags: { cleanupTag: titlePrefix, titlePrefix } }, `dense-record-${String(index + 1).padStart(3, '0')}`),
      source_project_id: primaryProject.project_id,
      values: {
        [statusField.field_id]: statusValue,
        [notesField.field_id]: `Dense seed row ${index + 1}`,
      },
    });
  });

  const taskIndexes = Array.from({ length: 50 }, (_, index) => index + 1);
  await runInBatches(taskIndexes, 10, async (_value, index) => {
    const statusValue = statusCycle[index % statusCycle.length];
    const dueAt = futureIsoFromNow((index + 1) * 20);
    await createRecord(apiBaseUrl, tokenA, project.space_id, {
      collection_id: collection.collection_id,
      title: withRunTag({ tags: { cleanupTag: titlePrefix, titlePrefix } }, `stress-task-${String(index + 1).padStart(3, '0')}`),
      source_project_id: primaryProject.project_id,
      values: {
        [statusField.field_id]: statusValue,
        [notesField.field_id]: `Task seed row ${index + 1}`,
      },
      capability_types: ['task'],
      task_state: {
        status: statusValue === 'in-progress' ? 'in_progress' : statusValue,
        priority: index % 2 === 0 ? 'high' : 'medium',
        due_at: dueAt,
      },
      assignment_user_ids: [session.userId],
    });
  });

  const reminderOffsets = [15, 45, 120, 240, 720, 1440, 2160, 4320, 5760, 7200];
  const reminderIndexes = Array.from({ length: 20 }, (_, index) => index + 1);
  await runInBatches(reminderIndexes, 5, async (_value, index) => {
    const minutes = reminderOffsets[index % reminderOffsets.length] + Math.floor(index / reminderOffsets.length) * 90;
    await hubRequest(apiBaseUrl, tokenA, '/api/hub/reminders', {
      method: 'POST',
      body: JSON.stringify({
        title: withRunTag({ tags: { cleanupTag: titlePrefix, titlePrefix } }, `stress-reminder-${String(index + 1).padStart(3, '0')}`),
        remind_at: futureIsoFromNow(minutes),
      }),
    });
  });

  const eventIndexes = Array.from({ length: 24 }, (_, index) => index + 1);
  await runInBatches(eventIndexes, 6, async (_value, index) => {
    const start = new Date(Date.now() + (index + 1) * 45 * 60_000);
    const end = new Date(start.getTime() + 45 * 60_000);
    await createEventFromNlp(apiBaseUrl, tokenA, project.space_id, {
      source_project_id: primaryProject.project_id,
      title: withRunTag({ tags: { cleanupTag: titlePrefix, titlePrefix } }, `stress-event-${String(index + 1).padStart(3, '0')}`),
      start_dt: start.toISOString(),
      end_dt: end.toISOString(),
      timezone: 'America/New_York',
      location: 'Journey Stress Seed',
      participants_user_ids: [session.userId],
    });
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
    `Seeded stress journey context for project ${project.space_id} and project ${primaryProject.project_id} as ${runId}.\n`,
  );
  process.stdout.write(`Session user: ${session.userId}\n`);
};

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
