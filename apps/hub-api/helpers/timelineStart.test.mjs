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
});
