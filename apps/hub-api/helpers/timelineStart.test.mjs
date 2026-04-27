import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import { ensureProjectCreatedTimelineStart, projectCreatedTimelineMessage } from './timelineStart.mjs';

const project = {
  project_id: 'project-1',
  name: 'Main Work',
  created_by: 'user-1',
  created_at: '2026-04-20T00:00:00.000Z',
};

describe('timeline starting point helpers', () => {
  test('builds the project-created message from the space name', () => {
    assert.equal(projectCreatedTimelineMessage(project), 'Main Work created');
  });

  test('adds a project-created starting point when timeline rows are missing one', () => {
    const rows = ensureProjectCreatedTimelineStart([], project);

    assert.equal(rows.length, 1);
    assert.equal(rows[0].event_type, 'project.created');
    assert.equal(rows[0].primary_entity_id, project.project_id);
    assert.deepEqual(rows[0].summary_json, { message: 'Main Work created' });
  });

  test('normalizes existing project-created rows without duplicating them', () => {
    const rows = ensureProjectCreatedTimelineStart([
      {
        timeline_event_id: 'timeline-1',
        project_id: project.project_id,
        actor_user_id: project.created_by,
        event_type: 'project.created',
        primary_entity_type: 'project',
        primary_entity_id: project.project_id,
        secondary_entities: [],
        summary_json: { message: 'Space created: Main Work' },
        created_at: project.created_at,
      },
    ], project);

    assert.equal(rows.length, 1);
    assert.deepEqual(rows[0].summary_json, { message: 'Main Work created' });
  });

  test('returns rows unchanged when the project id is missing', () => {
    const rows = [{ timeline_event_id: 'timeline-1', created_at: '2026-04-21T00:00:00.000Z' }];

    assert.equal(ensureProjectCreatedTimelineStart(rows, null), rows);
    assert.equal(ensureProjectCreatedTimelineStart(rows, {}), rows);
  });

  test('falls back to the generic space-created message for blank names', () => {
    const blankProject = {
      ...project,
      name: '   ',
    };
    const rows = ensureProjectCreatedTimelineStart([], blankProject);

    assert.equal(projectCreatedTimelineMessage(blankProject), 'Space created');
    assert.deepEqual(rows[0].summary_json, { message: 'Space created' });
  });

  test('keeps the project-created starting point last when newer events exist', () => {
    const rows = ensureProjectCreatedTimelineStart([
      {
        timeline_event_id: 'timeline-newer',
        project_id: project.project_id,
        actor_user_id: project.created_by,
        event_type: 'record.created',
        primary_entity_type: 'record',
        primary_entity_id: 'record-1',
        secondary_entities: [],
        summary_json: { message: 'Record created' },
        created_at: '2026-04-21T00:00:00.000Z',
      },
      {
        timeline_event_id: 'timeline-created',
        project_id: project.project_id,
        actor_user_id: project.created_by,
        event_type: 'project.created',
        primary_entity_type: 'project',
        primary_entity_id: project.project_id,
        secondary_entities: [],
        summary_json: { message: 'Old message' },
        created_at: project.created_at,
      },
    ], project);

    assert.deepEqual(rows.map((row) => row.timeline_event_id), ['timeline-newer', 'timeline-created']);
    assert.equal(rows.at(-1)?.event_type, 'project.created');
    assert.deepEqual(rows.at(-1)?.summary_json, { message: 'Main Work created' });
  });
});
