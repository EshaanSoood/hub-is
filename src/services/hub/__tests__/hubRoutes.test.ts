/// <reference types="node" />

import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import { buildEventDestinationHref, buildTaskDestinationHref } from '../../../lib/hubRoutes.ts';
import type { HubHomeEvent, HubTaskSummary } from '../types.ts';

const baseTask = (): HubTaskSummary => ({
  record_id: 'rec-1',
  space_id: 'proj-1',
  space_name: null,
  collection_id: 'col-1',
  collection_name: null,
  title: 'Task',
  created_at: '2026-03-22T00:00:00Z',
  updated_at: '2026-03-22T00:00:00Z',
  subtask_count: 0,
  task_state: {
    status: 'todo',
    priority: null,
    completed_at: null,
    due_at: null,
    category: null,
    updated_at: '2026-03-22T00:00:00Z',
  },
  assignments: [],
  origin_kind: 'project',
  source_view_id: null,
  source_project: null,
});

const baseEvent = (): HubHomeEvent => ({
  record_id: 'evt-1',
  space_id: 'proj-1',
  space_name: null,
  collection_id: 'col-1',
  collection_name: null,
  title: 'Event',
  updated_at: '2026-03-22T00:00:00Z',
  event_state: {
    start_dt: '2026-03-22T15:00:00Z',
    end_dt: '2026-03-22T16:00:00Z',
    timezone: 'America/New_York',
    location: null,
    updated_at: '2026-03-22T00:00:00Z',
  },
  participants: [],
  source_project: null,
});

describe('hubRoutes URL builders', () => {
  test('buildTaskDestinationHref handles project and personal task URLs', () => {
    const projectTaskHref = buildTaskDestinationHref(baseTask());
    const personalTaskHref = buildTaskDestinationHref({
      ...baseTask(),
      origin_kind: 'personal',
      space_id: null,
    });

    assert.equal(projectTaskHref, '/projects/proj-1/work');
    assert.equal(personalTaskHref, '/projects?intent=open&task_id=rec-1');
  });

  test('buildEventDestinationHref builds project overview and project routes', () => {
    const eventOverviewHref = buildEventDestinationHref(baseEvent());
    const eventProjectHref = buildEventDestinationHref({
      ...baseEvent(),
      source_project: { project_id: 'project#1', project_name: null, doc_id: null },
    });

    assert.equal(eventOverviewHref, '/projects/proj-1/overview?view=calendar');
    assert.equal(eventProjectHref, '/projects/proj-1/work/project%231');
  });

  test('handles missing IDs and encodes special characters', () => {
    const missingProjectTaskHref = buildTaskDestinationHref({
      ...baseTask(),
      space_id: null,
    });
    const missingRecordPersonalHref = buildTaskDestinationHref({
      ...baseTask(),
      origin_kind: 'personal',
      record_id: '',
    });
    const missingProjectEventHref = buildEventDestinationHref({
      ...baseEvent(),
      space_id: '',
    });
    const encodedTaskHref = buildTaskDestinationHref({
      ...baseTask(),
      space_id: 'proj/with spaces',
      source_project: { project_id: 'project/&?', project_name: null, doc_id: null },
    });
    const encodedEventHref = buildEventDestinationHref({
      ...baseEvent(),
      space_id: 'proj id/%',
      source_project: { project_id: 'project id/&', project_name: null, doc_id: null },
    });

    assert.equal(missingProjectTaskHref, '/projects');
    assert.equal(missingRecordPersonalHref, '/projects?intent=open&task_id=');
    assert.equal(missingProjectEventHref, '/projects');
    assert.equal(encodedTaskHref, '/projects/proj%2Fwith%20spaces/work/project%2F%26%3F');
    assert.equal(encodedEventHref, '/projects/proj%20id%2F%25/work/project%20id%2F%26');
  });
});
