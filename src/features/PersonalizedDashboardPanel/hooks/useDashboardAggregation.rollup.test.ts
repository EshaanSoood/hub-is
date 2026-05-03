import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import fc from 'fast-check';
import { describe, expect, it, afterAll } from 'vitest';
import * as Y from 'yjs';
import type { ProjectRecord } from '../../../types/domain';
import type { HubReminderSummary } from '../../../services/hub/reminders';
import type { HubHomeData, HubTask, HubEvent } from '../types';
import {
  buildDashboardAggregation,
  buildSpaceRollup,
  type DashboardQuickThoughtInput,
  type DashboardRollupItemSummary,
  type DashboardRollupPipeline,
  type DashboardRollupSurface,
  type SpaceRollupItemSummary,
} from './useDashboardAggregation';

type RollupReportItemSummary = Pick<
  DashboardRollupItemSummary,
  'id' | 'type' | 'sourceModule' | 'targetSurface' | 'rollupBucket'
>;

interface RollupReport {
  timestamp: string;
  totalItemsIn: number;
  totalItemsRouted: number;
  totalOrphans: number;
  totalGhosts: number;
  surfaces: Record<DashboardRollupSurface, {
    received: RollupReportItemSummary[];
    ghosts: string[];
  }>;
  orphans: RollupReportItemSummary[];
  spaceRollup?: {
    received: Array<Pick<SpaceRollupItemSummary, 'id' | 'type' | 'origin' | 'sourceProjectId' | 'rollupBucket' | 'homeReason'>>;
    home: Array<Pick<SpaceRollupItemSummary, 'id' | 'type' | 'origin' | 'sourceProjectId' | 'rollupBucket' | 'homeReason'>>;
    orphans: Array<Pick<SpaceRollupItemSummary, 'id' | 'type' | 'origin' | 'sourceProjectId' | 'rollupBucket' | 'homeReason'>>;
  };
  invariantViolations: string[];
}

const now = new Date('2026-04-24T14:00:00.000Z');
const reportPath = join(process.cwd(), 'test-results', 'rollup-report.json');

let latestReport: RollupReport | null = null;

const projects: ProjectRecord[] = [
  {
    id: 'space_main',
    name: 'Main Work',
    status: 'active',
    summary: '',
    openProjectProjectId: null,
    isPersonal: false,
    membershipRole: 'owner',
    position: 0,
  },
  {
    id: 'space_personal',
    name: 'Personal',
    status: 'active',
    summary: '',
    openProjectProjectId: null,
    isPersonal: true,
    membershipRole: 'owner',
    position: 1,
  },
];

const reportItem = (item: DashboardRollupItemSummary): RollupReportItemSummary => ({
  id: item.id,
  type: item.type,
  sourceModule: item.sourceModule,
  targetSurface: item.targetSurface,
  rollupBucket: item.rollupBucket,
});

const buildRollupReport = (rollup: DashboardRollupPipeline): RollupReport => {
  const surfaces: RollupReport['surfaces'] = {
    dailyBrief: {
      received: rollup.surfaces.dailyBrief.received.map(reportItem),
      ghosts: rollup.surfaces.dailyBrief.ghosts,
    },
    homeGround: {
      received: rollup.surfaces.homeGround.received.map(reportItem),
      ghosts: rollup.surfaces.homeGround.ghosts,
    },
    timeline: {
      received: rollup.surfaces.timeline.received.map(reportItem),
      ghosts: rollup.surfaces.timeline.ghosts,
    },
  };
  const totalGhosts = Object.values(surfaces).reduce((total, surface) => total + surface.ghosts.length, 0);
  return {
    timestamp: new Date('2026-04-24T14:00:00.000Z').toISOString(),
    totalItemsIn: rollup.totalItemsIn,
    totalItemsRouted: Object.values(surfaces).reduce((total, surface) => total + surface.received.length, 0),
    totalOrphans: rollup.unrouted.length,
    totalGhosts,
    surfaces,
    orphans: rollup.unrouted.map(reportItem),
    invariantViolations: rollup.invariantViolations,
  };
};

const formatRollupReport = (report: RollupReport): string => {
  const rows = [
    ['Input item', 'Surface', 'Roll-up bucket'],
    ...Object.values(report.surfaces).flatMap((surface) =>
      surface.received.map((item) => [
        `${item.sourceModule}:${item.id}`,
        item.targetSurface ?? 'orphan',
        item.rollupBucket,
      ]),
    ),
    ...report.orphans.map((item) => [
      `${item.sourceModule}:${item.id}`,
      'ORPHAN',
      item.rollupBucket,
    ]),
  ];
  const widths = rows[0].map((_, columnIndex) =>
    Math.max(...rows.map((row) => row[columnIndex]?.length ?? 0)),
  );
  const table = rows
    .map((row) => row.map((cell, columnIndex) => cell.padEnd(widths[columnIndex])).join(' | '))
    .join('\n');
  const ghosts = Object.entries(report.surfaces)
    .flatMap(([surface, summary]) => summary.ghosts.map((ghost) => `${surface}:${ghost}`));
  return [
    '',
    'Roll-up pipeline report',
    table,
    report.orphans.length > 0 ? `ORPHANS: ${report.orphans.map((item) => item.id).join(', ')}` : 'ORPHANS: none',
    ghosts.length > 0 ? `GHOSTS: ${ghosts.join(', ')}` : 'GHOSTS: none',
    report.invariantViolations.length > 0
      ? `INVARIANT VIOLATIONS: ${report.invariantViolations.join('; ')}`
      : 'INVARIANT VIOLATIONS: none',
    '',
  ].join('\n');
};

const writeRollupReport = (report: RollupReport) => {
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(formatRollupReport(report));
};

afterAll(() => {
  if (latestReport) {
    writeRollupReport(latestReport);
  }
});

const homeData = (tasks: HubTask[], events: HubEvent[]): HubHomeData => ({
  personal_space_id: 'space_personal',
  tasks,
  tasks_next_cursor: null,
  captures: [],
  events,
  notifications: [],
});

const task = ({
  id,
  dueAt,
  status = 'todo',
  updatedAt,
  spaceId = 'space_main',
  createdBy = 'user-alice',
  assigneeIds = [],
  sourceProject = null,
}: {
  id: string;
  dueAt: string | null;
  status?: HubTask['task_state']['status'];
  updatedAt: string;
  spaceId?: string | null;
  createdBy?: string;
  assigneeIds?: string[];
  sourceProject?: HubTask['source_project'];
}): HubTask => ({
  record_id: id,
  space_id: spaceId,
  space_name: spaceId === 'space_main' ? 'Main Work' : null,
  collection_id: `collection-${id}`,
  collection_name: 'Tasks',
  title: `Task ${id}`,
  created_at: '2026-04-20T12:00:00.000Z',
  created_by: createdBy,
  updated_at: updatedAt,
  subtask_count: 0,
  task_state: {
    status,
    priority: 'medium',
    due_at: dueAt,
    category: null,
    completed_at: status === 'done' ? updatedAt : null,
    updated_at: updatedAt,
  },
  assignments: assigneeIds.map((userId) => ({ user_id: userId, assigned_at: '2026-04-20T12:00:00.000Z' })),
  origin_kind: sourceProject ? 'project' : spaceId ? 'space' : 'personal',
  source_view_id: null,
  source_project: sourceProject,
});

const event = ({
  id,
  startAt,
  endAt,
  updatedAt,
  createdBy = 'user-alice',
  participantIds = [],
  sourceProject = null,
}: {
  id: string;
  startAt: string;
  endAt: string;
  updatedAt: string;
  createdBy?: string;
  participantIds?: string[];
  sourceProject?: HubEvent['source_project'];
}): HubEvent => ({
  record_id: id,
  space_id: 'space_main',
  space_name: 'Main Work',
  collection_id: `collection-${id}`,
  collection_name: 'Events',
  title: `Event ${id}`,
  created_by: createdBy,
  updated_at: updatedAt,
  event_state: {
    start_dt: startAt,
    end_dt: endAt,
    timezone: 'America/New_York',
    location: null,
    updated_at: updatedAt,
  },
  participants: participantIds.map((userId) => ({ user_id: userId, role: null, added_at: '2026-04-20T12:00:00.000Z' })),
  source_project: sourceProject,
});

const reminder = ({
  id,
  remindAt,
  createdBy = 'user-alice',
  sourceProject = null,
  recordAssignments = [],
  recordParticipants = [],
}: {
  id: string;
  remindAt: string;
  createdBy?: string;
  sourceProject?: HubReminderSummary['source_project'];
  recordAssignments?: string[];
  recordParticipants?: string[];
}): HubReminderSummary => ({
  reminder_id: id,
  record_id: `record-${id}`,
  record_title: `Reminder ${id}`,
  space_id: 'space_main',
  created_by: createdBy,
  source_project: sourceProject,
  record_assignments: recordAssignments.map((userId) => ({ user_id: userId, assigned_at: '2026-04-20T12:00:00.000Z' })),
  record_participants: recordParticipants.map((userId) => ({ user_id: userId, role: null, added_at: '2026-04-20T12:00:00.000Z' })),
  remind_at: remindAt,
  channels: ['in_app'],
  recurrence_json: null,
  created_at: '2026-04-20T12:00:00.000Z',
  fired_at: null,
  overdue: false,
});

const monotonic = (items: DashboardRollupItemSummary[]): boolean =>
  items.every((item, index) => {
    if (index === 0) {
      return true;
    }
    const previous = items[index - 1].sortKey ?? '';
    const current = item.sortKey ?? '';
    return previous <= current;
  });

const validIsoArbitrary = fc.date({
  min: new Date('2026-04-20T00:00:00.000Z'),
  max: new Date('2026-05-02T23:59:59.999Z'),
  noInvalidDate: true,
}).map((date) => date.toISOString());
const maybeIsoArbitrary = fc.oneof(validIsoArbitrary, fc.constant(null));
const invalidDateArbitrary = fc.constantFrom('not-a-date', '', '2026-99-99T99:99:99.999Z');

describe('dashboard roll-up property invariants', () => {
  it('routes each generated module item into exactly one bucket or the explicit unrouted list', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            dueAt: maybeIsoArbitrary,
            status: fc.constantFrom<HubTask['task_state']['status']>('todo', 'in_progress', 'done', 'cancelled'),
            updatedAt: validIsoArbitrary,
            spaceId: fc.option(fc.constantFrom('space_main', 'space_personal'), { nil: null }),
          }),
          { maxLength: 20 },
        ),
        fc.array(
          fc.record({
            startAt: fc.oneof(validIsoArbitrary, invalidDateArbitrary),
            endAt: validIsoArbitrary,
            updatedAt: validIsoArbitrary,
          }),
          { maxLength: 20 },
        ),
        fc.array(
          fc.record({
            remindAt: fc.oneof(validIsoArbitrary, invalidDateArbitrary),
          }),
          { maxLength: 20 },
        ),
        fc.array(
          fc.record({
            createdAt: validIsoArbitrary,
            targetSurface: fc.option(fc.constantFrom<DashboardRollupSurface>('dailyBrief', 'homeGround', 'timeline'), {
              nil: null,
            }),
          }),
          { maxLength: 20 },
        ),
        (taskInputs, eventInputs, reminderInputs, thoughtInputs) => {
          const tasks = taskInputs.map((input, index) => task({
            id: `generated-task-${index}`,
            dueAt: input.dueAt,
            status: input.status,
            updatedAt: input.updatedAt,
            spaceId: input.spaceId,
          }));
          const events = eventInputs.map((input, index) => event({
            id: `generated-event-${index}`,
            startAt: input.startAt,
            endAt: input.endAt,
            updatedAt: input.updatedAt,
          }));
          const reminders = reminderInputs.map((input, index) => reminder({
            id: `generated-reminder-${index}`,
            remindAt: input.remindAt,
          }));
          const quickThoughts = thoughtInputs.map((input, index): DashboardQuickThoughtInput => ({
            id: `generated-thought-${index}`,
            title: `Thought ${index}`,
            createdAt: input.createdAt,
            targetSurface: input.targetSurface,
          }));

          const { rollup } = buildDashboardAggregation({
            homeData: homeData(tasks, events),
            reminders,
            projects,
            now,
            quickThoughts,
          });
          const allBucketItems = Object.values(rollup.buckets).flat();
          const ids = allBucketItems.map((item) => item.id);
          const unroutedIds = new Set(rollup.unrouted.map((item) => item.id));

          expect(ids).toHaveLength(tasks.length + events.length + reminders.length + quickThoughts.length);
          expect(new Set(ids).size).toBe(ids.length);
          expect(rollup.invariantViolations).toEqual([]);
          expect(Object.values(rollup.buckets).every(monotonic)).toBe(true);
          expect(rollup.unrouted.every((item) => item.targetSurface === null && unroutedIds.has(item.id))).toBe(true);
          expect(
            Object.values(rollup.surfaces)
              .flatMap((surface) => surface.received)
              .every((item) => item.targetSurface === 'dailyBrief' || item.targetSurface === 'homeGround' || item.targetSurface === 'timeline'),
          ).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('produces no phantom entries for empty input', () => {
    const { rollup } = buildDashboardAggregation({
      homeData: homeData([], []),
      reminders: [],
      projects,
      now,
    });

    expect(rollup.totalItemsIn).toBe(0);
    expect(Object.values(rollup.buckets).flat()).toEqual([]);
    expect(rollup.unrouted).toEqual([]);
    expect(rollup.invariantViolations).toEqual([]);
  });
});

const seedPipelineDoc = () => {
  const doc = new Y.Doc();
  doc.getArray<HubTask>('tasks').push([
    task({ id: 'today-task', dueAt: '2026-04-24T16:00:00.000Z', updatedAt: '2026-04-24T12:00:00.000Z' }),
    task({ id: 'future-task', dueAt: '2026-04-26T16:00:00.000Z', updatedAt: '2026-04-23T12:00:00.000Z' }),
    task({ id: 'unscheduled-task', dueAt: null, updatedAt: '2026-04-22T12:00:00.000Z' }),
  ]);
  doc.getArray<HubEvent>('events').push([
    event({
      id: 'today-event',
      startAt: '2026-04-24T18:00:00.000Z',
      endAt: '2026-04-24T19:00:00.000Z',
      updatedAt: '2026-04-23T18:00:00.000Z',
    }),
    event({
      id: 'future-event',
      startAt: '2026-04-29T18:00:00.000Z',
      endAt: '2026-04-29T19:00:00.000Z',
      updatedAt: '2026-04-23T19:00:00.000Z',
    }),
  ]);
  doc.getArray<HubReminderSummary>('reminders').push([
    reminder({ id: 'today-reminder', remindAt: '2026-04-24T20:00:00.000Z' }),
    reminder({ id: 'orphan-reminder', remindAt: 'not-a-date' }),
  ]);
  doc.getArray<DashboardQuickThoughtInput>('quickThoughts').push([
    {
      id: 'loose-thought',
      title: 'Remember to clarify launch notes',
      createdAt: '2026-04-24T13:00:00.000Z',
      targetSurface: null,
    },
  ]);
  return doc;
};

describe('dashboard roll-up snapshot pipeline', () => {
  it('rolls project and direct Space work into Space, then only user-relevant Space work into Home', () => {
    const alphaProject = { project_id: 'project-alpha', project_name: 'Alpha', doc_id: null };
    const betaProject = { project_id: 'project-beta', project_name: 'Beta', doc_id: null };
    const otherSpaceProject = { project_id: 'project-elsewhere', project_name: 'Elsewhere', doc_id: null };

    const spaceRollup = buildSpaceRollup({
      spaceId: 'space_main',
      userId: 'user-alice',
      workProjects: [
        { projectId: 'project-alpha', spaceId: 'space_main', name: 'Alpha' },
        { projectId: 'project-beta', spaceId: 'space_main', name: 'Beta' },
        { projectId: 'project-elsewhere', spaceId: 'space_elsewhere', name: 'Elsewhere' },
      ],
      tasks: [
        task({
          id: 'alice-space-task',
          dueAt: '2026-04-24T15:00:00.000Z',
          updatedAt: '2026-04-24T12:00:00.000Z',
          createdBy: 'user-alice',
          sourceProject: null,
        }),
        task({
          id: 'alpha-assigned-task',
          dueAt: '2026-04-24T16:00:00.000Z',
          updatedAt: '2026-04-24T12:05:00.000Z',
          createdBy: 'user-bob',
          assigneeIds: ['user-alice'],
          sourceProject: alphaProject,
        }),
        task({
          id: 'beta-bob-task',
          dueAt: '2026-04-24T17:00:00.000Z',
          updatedAt: '2026-04-24T12:10:00.000Z',
          createdBy: 'user-bob',
          sourceProject: betaProject,
        }),
        task({
          id: 'invalid-project-task',
          dueAt: '2026-04-24T18:00:00.000Z',
          updatedAt: '2026-04-24T12:15:00.000Z',
          createdBy: 'user-alice',
          sourceProject: otherSpaceProject,
        }),
      ],
      events: [
        event({
          id: 'alpha-participant-event',
          startAt: '2026-04-24T19:00:00.000Z',
          endAt: '2026-04-24T20:00:00.000Z',
          updatedAt: '2026-04-24T12:20:00.000Z',
          createdBy: 'user-bob',
          participantIds: ['user-alice'],
          sourceProject: alphaProject,
        }),
        event({
          id: 'space-bob-event',
          startAt: '2026-04-24T21:00:00.000Z',
          endAt: '2026-04-24T22:00:00.000Z',
          updatedAt: '2026-04-24T12:25:00.000Z',
          createdBy: 'user-bob',
          sourceProject: null,
        }),
      ],
      reminders: [
        reminder({
          id: 'beta-assigned-reminder',
          remindAt: '2026-04-24T23:00:00.000Z',
          createdBy: 'user-bob',
          sourceProject: betaProject,
          recordAssignments: ['user-alice'],
        }),
        reminder({
          id: 'space-bob-reminder',
          remindAt: '2026-04-25T13:00:00.000Z',
          createdBy: 'user-bob',
          sourceProject: null,
        }),
      ],
    });

    const reportSummary = {
      received: Object.values(spaceRollup.buckets)
        .flat()
        .filter((item) => item.rollupBucket !== 'space.orphans')
        .map((item) => ({
          id: item.id,
          type: item.type,
          origin: item.origin,
          sourceProjectId: item.sourceProjectId,
          rollupBucket: item.rollupBucket,
          homeReason: item.homeReason,
        })),
      home: spaceRollup.home.map((item) => ({
        id: item.id,
        type: item.type,
        origin: item.origin,
        sourceProjectId: item.sourceProjectId,
        rollupBucket: item.rollupBucket,
        homeReason: item.homeReason,
      })),
      orphans: spaceRollup.orphans.map((item) => ({
        id: item.id,
        type: item.type,
        origin: item.origin,
        sourceProjectId: item.sourceProjectId,
        rollupBucket: item.rollupBucket,
        homeReason: item.homeReason,
      })),
    };

    expect(spaceRollup.invariantViolations).toEqual([]);
    expect(spaceRollup.buckets['space.tasks'].map((item) => item.id)).toEqual([
      'task:alice-space-task',
      'task:alpha-assigned-task',
      'task:beta-bob-task',
    ]);
    expect(spaceRollup.buckets['space.events'].map((item) => item.id)).toEqual([
      'event:alpha-participant-event',
      'event:space-bob-event',
    ]);
    expect(spaceRollup.buckets['space.reminders'].map((item) => item.id)).toEqual([
      'reminder:beta-assigned-reminder',
      'reminder:space-bob-reminder',
    ]);
    expect(spaceRollup.home.map((item) => [item.id, item.homeReason])).toEqual([
      ['task:alice-space-task', 'createdByUser'],
      ['task:alpha-assigned-task', 'assignedToUser'],
      ['event:alpha-participant-event', 'eventParticipant'],
      ['reminder:beta-assigned-reminder', 'assignedToUser'],
    ]);
    expect(spaceRollup.orphans.map((item) => item.id)).toEqual(['task:invalid-project-task']);

    latestReport = {
      ...(latestReport ?? buildRollupReport(buildDashboardAggregation({
        homeData: homeData([], []),
        reminders: [],
        projects,
        now,
      }).rollup)),
      spaceRollup: reportSummary,
    };
  });

  it('routes deterministic Yjs module data to surface buckets and reports orphans and ghosts', () => {
    const doc = seedPipelineDoc();
    const tasks = doc.getArray<HubTask>('tasks').toArray();
    const events = doc.getArray<HubEvent>('events').toArray();
    const reminders = doc.getArray<HubReminderSummary>('reminders').toArray();
    const quickThoughts = doc.getArray<DashboardQuickThoughtInput>('quickThoughts').toArray();

    const { rollup } = buildDashboardAggregation({
      homeData: homeData(tasks, events),
      reminders,
      projects,
      now,
      quickThoughts,
    });
    latestReport = {
      ...buildRollupReport(rollup),
      spaceRollup: latestReport?.spaceRollup,
    };

    expect(latestReport.invariantViolations).toEqual([]);
    expect(latestReport.surfaces.dailyBrief.received.map((item) => item.id)).toEqual([
      'task:today-task',
      'event:today-event',
      'reminder:today-reminder',
    ]);
    expect(latestReport.surfaces.homeGround.received.map((item) => item.id)).toEqual([
      'task:unscheduled-task',
    ]);
    expect(latestReport.surfaces.timeline.received.map((item) => item.id)).toEqual([
      'task:future-task',
      'event:future-event',
    ]);
    expect(latestReport.orphans.map((item) => item.id)).toEqual([
      'quickThought:loose-thought',
      'reminder:orphan-reminder',
    ]);
    expect(latestReport.totalGhosts).toBe(0);
    expect(latestReport).toMatchInlineSnapshot(`
      {
        "invariantViolations": [],
        "orphans": [
          {
            "id": "quickThought:loose-thought",
            "rollupBucket": "unrouted",
            "sourceModule": "quickThoughts",
            "targetSurface": null,
            "type": "quickThought",
          },
          {
            "id": "reminder:orphan-reminder",
            "rollupBucket": "unrouted",
            "sourceModule": "reminders",
            "targetSurface": null,
            "type": "reminder",
          },
        ],
        "spaceRollup": {
          "home": [
            {
              "homeReason": "createdByUser",
              "id": "task:alice-space-task",
              "origin": "space",
              "rollupBucket": "space.tasks",
              "sourceProjectId": null,
              "type": "task",
            },
            {
              "homeReason": "assignedToUser",
              "id": "task:alpha-assigned-task",
              "origin": "project",
              "rollupBucket": "space.tasks",
              "sourceProjectId": "project-alpha",
              "type": "task",
            },
            {
              "homeReason": "eventParticipant",
              "id": "event:alpha-participant-event",
              "origin": "project",
              "rollupBucket": "space.events",
              "sourceProjectId": "project-alpha",
              "type": "event",
            },
            {
              "homeReason": "assignedToUser",
              "id": "reminder:beta-assigned-reminder",
              "origin": "project",
              "rollupBucket": "space.reminders",
              "sourceProjectId": "project-beta",
              "type": "reminder",
            },
          ],
          "orphans": [
            {
              "homeReason": "invalid",
              "id": "task:invalid-project-task",
              "origin": null,
              "rollupBucket": "space.orphans",
              "sourceProjectId": "project-elsewhere",
              "type": "task",
            },
          ],
          "received": [
            {
              "homeReason": "createdByUser",
              "id": "task:alice-space-task",
              "origin": "space",
              "rollupBucket": "space.tasks",
              "sourceProjectId": null,
              "type": "task",
            },
            {
              "homeReason": "assignedToUser",
              "id": "task:alpha-assigned-task",
              "origin": "project",
              "rollupBucket": "space.tasks",
              "sourceProjectId": "project-alpha",
              "type": "task",
            },
            {
              "homeReason": "notRelevant",
              "id": "task:beta-bob-task",
              "origin": "project",
              "rollupBucket": "space.tasks",
              "sourceProjectId": "project-beta",
              "type": "task",
            },
            {
              "homeReason": "eventParticipant",
              "id": "event:alpha-participant-event",
              "origin": "project",
              "rollupBucket": "space.events",
              "sourceProjectId": "project-alpha",
              "type": "event",
            },
            {
              "homeReason": "notRelevant",
              "id": "event:space-bob-event",
              "origin": "space",
              "rollupBucket": "space.events",
              "sourceProjectId": null,
              "type": "event",
            },
            {
              "homeReason": "assignedToUser",
              "id": "reminder:beta-assigned-reminder",
              "origin": "project",
              "rollupBucket": "space.reminders",
              "sourceProjectId": "project-beta",
              "type": "reminder",
            },
            {
              "homeReason": "notRelevant",
              "id": "reminder:space-bob-reminder",
              "origin": "space",
              "rollupBucket": "space.reminders",
              "sourceProjectId": null,
              "type": "reminder",
            },
          ],
        },
        "surfaces": {
          "dailyBrief": {
            "ghosts": [],
            "received": [
              {
                "id": "task:today-task",
                "rollupBucket": "dailyBrief.timedTasks",
                "sourceModule": "tasks",
                "targetSurface": "dailyBrief",
                "type": "task",
              },
              {
                "id": "event:today-event",
                "rollupBucket": "dailyBrief.dayEvents",
                "sourceModule": "events",
                "targetSurface": "dailyBrief",
                "type": "event",
              },
              {
                "id": "reminder:today-reminder",
                "rollupBucket": "dailyBrief.timedReminders",
                "sourceModule": "reminders",
                "targetSurface": "dailyBrief",
                "type": "reminder",
              },
            ],
          },
          "homeGround": {
            "ghosts": [],
            "received": [
              {
                "id": "task:unscheduled-task",
                "rollupBucket": "homeGround.unscheduledTasks",
                "sourceModule": "tasks",
                "targetSurface": "homeGround",
                "type": "task",
              },
            ],
          },
          "timeline": {
            "ghosts": [],
            "received": [
              {
                "id": "task:future-task",
                "rollupBucket": "timeline.tasks",
                "sourceModule": "tasks",
                "targetSurface": "timeline",
                "type": "task",
              },
              {
                "id": "event:future-event",
                "rollupBucket": "timeline.events",
                "sourceModule": "events",
                "targetSurface": "timeline",
                "type": "event",
              },
            ],
          },
        },
        "timestamp": "2026-04-24T14:00:00.000Z",
        "totalGhosts": 0,
        "totalItemsIn": 8,
        "totalItemsRouted": 6,
        "totalOrphans": 2,
      }
    `);
  });
});
