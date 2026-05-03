import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi, afterEach, afterAll } from 'vitest';
import type { ProjectRecord } from '../../../types/domain';
import type { HubCollectionField, HubRecordSummary } from '../../../services/hub/types';
import { buildCalendarEventsByDate } from '../../../components/project-space/CalendarWidgetSkin/utils';
import type { CalendarEventSummary } from '../../../components/project-space/CalendarWidgetSkin/types';
import { useTableFiltering } from '../../../components/project-space/TableWidgetSkin/hooks/useTableFiltering';
import type { TableSchema } from '../../../components/project-space/TableWidgetSkin/types';
import { useTasksTabFiltering } from '../../../components/project-space/TasksTab/hooks/useTasksTabFiltering';
import type { SortChain, TaskItem } from '../../../components/project-space/TasksTab';
import { buildKanbanRuntime, KANBAN_UNASSIGNED_ID } from '../../../hooks/projectViewsRuntime/shared';
import { useTimelineRuntime } from '../../../hooks/useTimelineRuntime';
import { useWorkViewWidgetRuntime } from '../../../pages/ProjectSpacePage/hooks/useWorkViewWidgetRuntime';
import { useProjectLens } from './useProjectLens';
import type { DashboardDailyData } from '../types';

const fixedNow = new Date('2026-04-24T14:00:00.000Z');
const reportPath = join(process.cwd(), 'test-results', 'aggregation-inventory-report.json');

interface AggregationInventoryReport {
  timestamp: string;
  totalPipelinesCovered: number;
  totalInvariantViolations: number;
  pipelines: Record<string, {
    inputCount: number;
    outputCount: number;
    inputIds: string[];
    output: unknown;
    invariantViolations: string[];
  }>;
}

const aggregationReport: AggregationInventoryReport = {
  timestamp: fixedNow.toISOString(),
  totalPipelinesCovered: 0,
  totalInvariantViolations: 0,
  pipelines: {},
};

const recordPipelineReport = (
  pipeline: string,
  entry: Omit<AggregationInventoryReport['pipelines'][string], 'invariantViolations'> & { invariantViolations?: string[] },
) => {
  aggregationReport.pipelines[pipeline] = {
    ...entry,
    invariantViolations: entry.invariantViolations ?? [],
  };
};

afterAll(() => {
  const pipelineEntries = Object.values(aggregationReport.pipelines);
  aggregationReport.totalPipelinesCovered = pipelineEntries.length;
  aggregationReport.totalInvariantViolations = pipelineEntries.reduce(
    (total, pipeline) => total + pipeline.invariantViolations.length,
    0,
  );
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(aggregationReport, null, 2)}\n`);
});

afterEach(() => {
  vi.useRealTimers();
});

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
    id: 'space_side',
    name: 'Side Work',
    status: 'active',
    summary: '',
    openProjectProjectId: null,
    isPersonal: false,
    membershipRole: 'member',
    position: 1,
  },
];

const record = (recordId: string, fields: Record<string, unknown>): HubRecordSummary => ({
  record_id: recordId,
  collection_id: 'collection_tasks',
  title: `Record ${recordId}`,
  fields,
  updated_at: '2026-04-24T12:00:00.000Z',
  source_project: null,
});

const event = (recordId: string, startDt: string): CalendarEventSummary => ({
  record_id: recordId,
  title: `Event ${recordId}`,
  event_state: {
    start_dt: startDt,
    end_dt: Number.isFinite(new Date(startDt).getTime())
      ? new Date(new Date(startDt).getTime() + 60 * 60 * 1000).toISOString()
      : startDt,
    timezone: 'America/New_York',
    location: null,
    updated_at: startDt,
  },
  participants: [],
});

const taskItem = ({
  id,
  dueAt,
  priority,
  categoryId,
  assigneeId,
}: {
  id: string;
  dueAt: string | null;
  priority: TaskItem['priority'];
  categoryId: string;
  assigneeId: string;
}): TaskItem => ({
  id,
  label: `Task ${id}`,
  dueAt,
  dueLabel: dueAt ?? 'No date',
  categoryId,
  categoryValue: categoryId === 'uncategorized' ? null : categoryId,
  assigneeId,
  assigneeLabel: assigneeId,
  priority,
  priorityValue: priority,
  status: 'todo',
  subtasks: [],
});

describe('aggregation inventory coverage', () => {
  it('filters Daily Brief buckets by project and recomputes counts', () => {
    const dailyData: DashboardDailyData = {
      dayEvents: [
        {
          id: 'event:main',
          recordId: 'event-main',
          projectId: 'space_main',
          projectName: 'Main Work',
          title: 'Main event',
          startAtIso: '2026-04-24T16:00:00.000Z',
          endAtIso: '2026-04-24T17:00:00.000Z',
        },
      ],
      timedTasks: [
        {
          id: 'task:main',
          recordId: 'task-main',
          projectId: 'space_main',
          projectName: 'Main Work',
          title: 'Main task',
          dueAtIso: '2026-04-24T18:00:00.000Z',
          status: 'todo',
        },
        {
          id: 'task:side',
          recordId: 'task-side',
          projectId: 'space_side',
          projectName: 'Side Work',
          title: 'Side task',
          dueAtIso: '2026-04-24T19:00:00.000Z',
          status: 'todo',
        },
      ],
      untimedTasks: [],
      overdueTasks: [],
      timedReminders: [
        {
          id: 'reminder:main',
          reminderId: 'reminder-main',
          recordId: 'record-main',
          projectId: 'space_main',
          projectName: 'Main Work',
          title: 'Main reminder',
          remindAtIso: '2026-04-24T20:00:00.000Z',
          dismissed: false,
        },
      ],
      missedReminders: [],
    };

    const { result } = renderHook(() => useProjectLens({ dailyData, projects }));
    act(() => {
      result.current.setProjectFilter('space_main');
    });

    expect(result.current.filteredDailyData.dayEvents.map((item) => item.id)).toEqual(['event:main']);
    expect(result.current.filteredDailyData.timedTasks.map((item) => item.id)).toEqual(['task:main']);
    expect(result.current.dayCounts).toEqual({ events: 1, tasks: 1, reminders: 1, backlog: 0 });
    recordPipelineReport('homeLens', {
      inputCount: 4,
      outputCount: 3,
      inputIds: ['event:main', 'task:main', 'task:side', 'reminder:main'],
      output: {
        activeProjectFilter: result.current.activeProjectFilter,
        dayEvents: result.current.filteredDailyData.dayEvents.map((item) => item.id),
        timedTasks: result.current.filteredDailyData.timedTasks.map((item) => item.id),
        timedReminders: result.current.filteredDailyData.timedReminders.map((item) => item.id),
        dayCounts: result.current.dayCounts,
      },
    });
  });

  it('clusters project timeline events by date and applies type filters', () => {
    vi.useFakeTimers();
    vi.setSystemTime(fixedNow);

    const timeline = [
      {
        timeline_event_id: 'timeline-task',
        event_type: 'record.created',
        primary_entity_type: 'record',
        primary_entity_id: 'task-1',
        summary_json: { record_kind: 'Task', message: 'Task created' },
        created_at: '2026-04-24T12:00:00.000Z',
      },
      {
        timeline_event_id: 'timeline-file',
        event_type: 'file.uploaded',
        primary_entity_type: 'file',
        primary_entity_id: 'file-1',
        summary_json: { message: 'File uploaded' },
        created_at: '2026-04-23T12:00:00.000Z',
      },
    ];
    const { result } = renderHook(() =>
      useTimelineRuntime({
        accessToken: 'token',
        projectId: 'space_main',
        timeline,
        setTimeline: vi.fn(),
      }),
    );

    expect(result.current.timelineClusters.map((cluster) => cluster.items.map((item) => item.id))).toEqual([
      ['timeline-task'],
      ['timeline-file'],
    ]);

    act(() => {
      result.current.toggleTimelineFilter('file');
    });

    expect(result.current.timelineClusters.flatMap((cluster) => cluster.items.map((item) => item.id))).toEqual(['timeline-task']);
    recordPipelineReport('timelineClusters', {
      inputCount: timeline.length,
      outputCount: result.current.timelineClusters.reduce((total, cluster) => total + cluster.items.length, 0),
      inputIds: timeline.map((item) => item.timeline_event_id),
      output: {
        activeFilters: result.current.timelineFilters,
        clusters: result.current.timelineClusters.map((cluster) => ({
          date: cluster.date,
          items: cluster.items.map((item) => ({ id: item.id, type: item.type, linkedRecordId: item.linkedRecordId ?? null })),
        })),
      },
    });
  });

  it('groups kanban records by configured select field and preserves unassigned records', () => {
    const groupField: HubCollectionField = {
      field_id: 'status',
      collection_id: 'collection_tasks',
      name: 'Status',
      type: 'select',
      config: {
        options: [
          { id: 'todo', label: 'To do' },
          { id: 'doing', label: 'Doing' },
        ],
      },
      sort_order: 0,
    };

    const runtime = buildKanbanRuntime({
      view: {
        view_id: 'view_kanban',
        space_id: 'space_main',
        collection_id: 'collection_tasks',
        type: 'kanban',
        name: 'Board',
        config: { group_by_field_id: 'status' },
      },
      schema: {
        collection_id: 'collection_tasks',
        name: 'Tasks',
        fields: [groupField],
      },
      records: [
        record('record-a', { status: 'todo' }),
        record('record-b', { status: 'doing' }),
        record('record-c', { status: null }),
        record('record-d', { status: 'blocked' }),
      ],
      next_cursor: null,
    });

    expect(runtime.groupingConfigured).toBe(true);
    expect(runtime.groups.map((group) => [group.id, group.records.map((item) => item.record_id)])).toEqual([
      ['todo', ['record-a']],
      ['doing', ['record-b']],
      ['blocked', ['record-d']],
      [KANBAN_UNASSIGNED_ID, ['record-c']],
    ]);
    recordPipelineReport('kanbanRuntime', {
      inputCount: 4,
      outputCount: runtime.groups.reduce((total, group) => total + group.records.length, 0),
      inputIds: ['record-a', 'record-b', 'record-c', 'record-d'],
      output: {
        groupFieldId: runtime.groupFieldId,
        groups: runtime.groups.map((group) => ({
          id: group.id,
          label: group.label,
          records: group.records.map((item) => item.record_id),
        })),
        groupOptions: runtime.groupOptions,
      },
    });
  });

  it('clusters task tab data by the active primary sort dimension after filters', () => {
    vi.useFakeTimers();
    vi.setSystemTime(fixedNow);

    const sortChain: SortChain = ['date', 'priority', 'category'];
    const { result } = renderHook(() =>
      useTasksTabFiltering({
        tasks: [
          taskItem({ id: 'overdue', dueAt: '2026-04-23T16:00:00.000Z', priority: 'high', categoryId: 'launch', assigneeId: 'user-a' }),
          taskItem({ id: 'today', dueAt: '2026-04-24T16:00:00.000Z', priority: 'medium', categoryId: 'launch', assigneeId: 'user-a' }),
          taskItem({ id: 'other-user', dueAt: '2026-04-24T18:00:00.000Z', priority: 'low', categoryId: 'ops', assigneeId: 'user-b' }),
          taskItem({ id: 'later', dueAt: null, priority: 'low', categoryId: 'ops', assigneeId: 'user-a' }),
        ],
        activeUserId: 'user-a',
        activeCategoryId: 'all',
        sortChain,
      }),
    );

    expect(result.current.filteredTasks.map((item) => item.id)).toEqual(['overdue', 'today', 'later']);
    expect(result.current.clusters.map((cluster) => [cluster.id, cluster.items.map((item) => item.id)])).toEqual([
      ['overdue', ['overdue']],
      ['today', ['today']],
      ['thisWeek', []],
      ['later', ['later']],
    ]);
    recordPipelineReport('taskTabClusters', {
      inputCount: 4,
      outputCount: result.current.filteredTasks.length,
      inputIds: ['overdue', 'today', 'other-user', 'later'],
      output: {
        filteredTasks: result.current.filteredTasks.map((item) => item.id),
        clusters: result.current.clusters.map((cluster) => ({
          id: cluster.id,
          label: cluster.label,
          dimension: cluster.dimension,
          items: cluster.items.map((item) => item.id),
        })),
      },
    });
  });

  it('filters table rows by select and date presets using schema-defined fields', () => {
    vi.useFakeTimers();
    vi.setSystemTime(fixedNow);

    const schema: TableSchema = {
      collection_id: 'collection_tasks',
      name: 'Tasks',
      fields: [
        {
          field_id: 'status',
          name: 'Status',
          type: 'select',
          config: { options: ['todo', 'doing'] },
          sort_order: 0,
        },
        {
          field_id: 'due',
          name: 'Due',
          type: 'date',
          config: {},
          sort_order: 1,
        },
      ],
    };
    const rows = [
      { recordId: 'row-a', title: 'A', fields: { status: 'todo', due: '2026-04-24' } },
      { recordId: 'row-b', title: 'B', fields: { status: 'doing', due: '2026-04-24' } },
      { recordId: 'row-c', title: 'C', fields: { status: 'todo', due: '2026-04-23' } },
    ];

    const { result } = renderHook(() => useTableFiltering(schema, rows));
    act(() => {
      result.current.setActiveFilters({ status: 'todo', due: 'today' });
    });

    expect(result.current.filteredRows.map((row) => row.recordId)).toEqual(['row-a']);
    expect(result.current.activeFilterCount).toBe(2);
    expect(result.current.statusOptions.map((option) => option.id)).toEqual(['todo', 'doing']);
    recordPipelineReport('tableFiltering', {
      inputCount: rows.length,
      outputCount: result.current.filteredRows.length,
      inputIds: rows.map((row) => row.recordId),
      output: {
        activeFilters: result.current.activeFilters,
        filteredRows: result.current.filteredRows.map((row) => row.recordId),
        activeFilterCount: result.current.activeFilterCount,
        statusOptions: result.current.statusOptions,
      },
    });
  });

  it('buckets calendar events by local date, sorts each bucket, and drops invalid starts', () => {
    const buckets = buildCalendarEventsByDate([
      event('later', '2026-04-24T18:00:00.000Z'),
      event('earlier', '2026-04-24T15:00:00.000Z'),
      event('tomorrow', '2026-04-25T15:00:00.000Z'),
      event('invalid', 'not-a-date'),
    ]);

    expect([...buckets.keys()]).toEqual(['2026-04-24', '2026-04-25']);
    expect(buckets.get('2026-04-24')?.map((item) => item.record_id)).toEqual(['earlier', 'later']);
    expect(buckets.get('2026-04-25')?.map((item) => item.record_id)).toEqual(['tomorrow']);
    recordPipelineReport('calendarDateBuckets', {
      inputCount: 4,
      outputCount: [...buckets.values()].reduce((total, bucket) => total + bucket.length, 0),
      inputIds: ['later', 'earlier', 'tomorrow', 'invalid'],
      output: {
        buckets: Object.fromEntries(
          [...buckets.entries()].map(([key, bucket]) => [key, bucket.map((item) => item.record_id)]),
        ),
        dropped: ['invalid'],
      },
    });
  });

  it('routes work widget contract callbacks with the active work-project id', async () => {
    const onCreateTableRecord = vi.fn().mockResolvedValue(undefined);
    const onMoveKanbanRecord = vi.fn();
    const onCreateKanbanRecord = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useWorkViewWidgetRuntime({
        activeProjectId: 'prj_active',
        activeProjectName: 'Active Project',
        activeProjectCanEdit: true,
        accessToken: 'token',
        canWriteProject: true,
        projectId: 'space_main',
        projectName: 'Main Work',
        setRecordsError: vi.fn(),
        tableViews: [{ view_id: 'view_table', name: 'Table' }],
        tableViewRuntimeDataById: {},
        onCreateTableRecord,
        onUpdateTableRecord: vi.fn(),
        onDeleteTableRecords: vi.fn(),
        onBulkUpdateTableRecords: vi.fn(),
        kanbanViews: [{ view_id: 'view_kanban', name: 'Kanban' }],
        kanbanRuntimeDataByViewId: {},
        creatingKanbanViewByWidgetId: {},
        onMoveKanbanRecord,
        onCreateKanbanRecord,
        onConfigureKanbanGrouping: vi.fn(),
        onUpdateKanbanRecord: vi.fn(),
        onDeleteKanbanRecord: vi.fn(),
        onEnsureKanbanView: vi.fn().mockResolvedValue('view_kanban'),
        calendarEvents: [],
        calendarLoading: false,
        calendarMode: 'relevant',
        refreshCalendar: vi.fn().mockResolvedValue(undefined),
        setCalendarMode: vi.fn(),
        projectFiles: [],
        spaceFiles: [],
        onUploadProjectFiles: vi.fn(),
        onUploadSpaceFiles: vi.fn(),
        onOpenProjectFile: vi.fn(),
        projectTaskItems: [],
        projectTasksLoading: false,
        taskCollectionId: 'collection_tasks',
        loadProjectTaskPage: vi.fn().mockResolvedValue(undefined),
        timelineClusters: [],
        timelineFilters: ['task', 'event', 'milestone', 'file', 'workspace'],
        toggleTimelineFilter: vi.fn(),
        refreshProjectData: vi.fn().mockResolvedValue(undefined),
        openRecordInspector: vi.fn().mockResolvedValue(undefined),
        reminders: [],
        remindersLoading: false,
        remindersError: null,
        onDismissReminder: vi.fn().mockResolvedValue(undefined),
        onCreateReminder: vi.fn().mockResolvedValue(undefined),
      }),
    );

    await act(async () => {
      await result.current.tableContract.onCreateRecord?.('view_table', { title: 'New', fields: {} });
      await result.current.kanbanContract.onCreateRecord?.('view_kanban', { title: 'Card', groupFieldValue: 'todo' });
      result.current.kanbanContract.onMoveRecord('view_kanban', 'record-a', 'doing');
    });

    expect(onCreateTableRecord).toHaveBeenCalledWith('view_table', { title: 'New', fields: {} }, 'prj_active');
    expect(onCreateKanbanRecord).toHaveBeenCalledWith('view_kanban', { title: 'Card', groupFieldValue: 'todo' }, 'prj_active');
    expect(onMoveKanbanRecord).toHaveBeenCalledWith('view_kanban', 'record-a', 'doing', 'prj_active');
    expect(result.current.tableContract.defaultViewId).toBe('view_table');
    expect(result.current.kanbanContract.defaultViewId).toBe('view_kanban');
    recordPipelineReport('workWidgetRouting', {
      inputCount: 3,
      outputCount: 3,
      inputIds: ['table:create', 'kanban:create', 'kanban:move'],
      output: {
        activeProjectId: 'prj_active',
        tableDefaultViewId: result.current.tableContract.defaultViewId,
        kanbanDefaultViewId: result.current.kanbanContract.defaultViewId,
        calls: {
          onCreateTableRecord: onCreateTableRecord.mock.calls,
          onCreateKanbanRecord: onCreateKanbanRecord.mock.calls,
          onMoveKanbanRecord: onMoveKanbanRecord.mock.calls,
        },
      },
    });
  });
});
