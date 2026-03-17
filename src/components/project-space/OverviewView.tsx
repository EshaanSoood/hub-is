import { useMemo, useState } from 'react';
import { Card, TabButton, Tabs, TabsList } from '../primitives';
import { CalendarTab, type CalendarEvent, type CalendarLensOption, type CalendarTimeView } from './CalendarTab';
import { FilterBarOverlay, type FilterGroup } from './FilterBarOverlay';
import { OverviewHeader } from './OverviewHeader';
import { TasksTab, type TaskItem, type TasksClusterMode } from './TasksTab';
import { TimelineTab, type TimelineCluster } from './TimelineTab';
import type { ClientReference, Collaborator, OverviewViewId } from './types';

interface OverviewViewProps {
  projectName: string;
  projectSummary: string;
  collaborators: Collaborator[];
  clients: ClientReference[];
  activeView: OverviewViewId;
  onSelectView: (viewId: OverviewViewId) => void;
}

const overviewViews: Array<{ id: OverviewViewId; label: string }> = [
  { id: 'timeline', label: 'Timeline' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'kanban', label: 'Kanban' },
];

const timelineDemo: TimelineCluster[] = [
  {
    id: 'today',
    dateLabel: 'Today',
    items: [
      { id: 't1', label: 'Kicked off brand review', type: 'event', priority: 'high' },
      { id: 't2', label: 'Script draft due', type: 'task', priority: 'high' },
      { id: 't3', label: 'Weekly sync with Alex', type: 'event', priority: 'medium' },
    ],
  },
  {
    id: 'mar-3',
    dateLabel: 'March 3, 2026',
    items: [
      { id: 't4', label: 'Uploaded campaign assets', type: 'event', priority: 'low' },
      { id: 't5', label: 'Client call with Acme Corp', type: 'milestone', priority: 'high' },
    ],
  },
];

const categoryOptions: CalendarLensOption[] = [
  { id: 'all', label: 'All' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'writing', label: 'Writing' },
  { id: 'design', label: 'Design' },
  { id: 'marketing', label: 'Marketing' },
];

const buildCalendarEvents = (users: CalendarLensOption[]): CalendarEvent[] => {
  const userA = users.find((user) => user.id !== 'all')?.id ?? 'current-user';
  const userB = users.find((user) => user.id !== 'all' && user.id !== userA)?.id ?? userA;

  return [
    { id: 'e1', date: new Date(2026, 2, 4), label: 'Brand kickoff', categoryId: 'marketing', assigneeId: userA, priority: 'high' },
    { id: 'e2', date: new Date(2026, 2, 4), label: 'Script due', categoryId: 'writing', assigneeId: userB, priority: 'high' },
    { id: 'e3', date: new Date(2026, 2, 5), label: 'Weekly sync', categoryId: 'youtube', assigneeId: userA, priority: 'medium' },
    { id: 'e4', date: new Date(2026, 2, 7), label: 'Figma review', categoryId: 'design', assigneeId: userB, priority: 'low' },
    { id: 'e5', date: new Date(2026, 2, 10), label: 'Client call', categoryId: 'marketing', assigneeId: userB, priority: 'high' },
  ];
};

const buildTasks = (users: CalendarLensOption[]): TaskItem[] => {
  const userA = users.find((user) => user.id !== 'all')?.id ?? 'current-user';
  const userB = users.find((user) => user.id !== 'all' && user.id !== userA)?.id ?? userA;

  return [
    {
      id: 'task-1',
      label: 'Write launch script',
      dueLabel: 'March 4, 2026',
      categoryId: 'writing',
      assigneeId: userA,
      priority: 'high',
      subtasks: [
        { id: 'task-1-sub-1', label: 'Draft intro section', dueLabel: 'Mar 4', priority: null },
        { id: 'task-1-sub-2', label: 'Review with Sam', dueLabel: 'Mar 4', priority: 'medium' },
      ],
    },
    {
      id: 'task-2',
      label: 'Design thumbnail',
      dueLabel: 'March 5, 2026',
      categoryId: 'design',
      assigneeId: userB,
      priority: 'medium',
      subtasks: [
        { id: 'task-2-sub-1', label: 'Sketch concepts', dueLabel: 'Mar 5', priority: null },
      ],
    },
    {
      id: 'task-3',
      label: 'Upload to YouTube',
      dueLabel: 'March 10, 2026',
      categoryId: 'youtube',
      assigneeId: userA,
      priority: 'low',
      subtasks: [
        { id: 'task-3-sub-1', label: 'Add captions', dueLabel: 'Mar 10', priority: null },
        { id: 'task-3-sub-2', label: 'Schedule publish time', dueLabel: 'Mar 10', priority: 'medium' },
      ],
    },
  ];
};

export const OverviewView = ({
  projectName,
  projectSummary,
  collaborators,
  clients,
  activeView,
  onSelectView,
}: OverviewViewProps) => {
  const [titleDraft, setTitleDraft] = useState(projectName);

  const collaboratorOptions: CalendarLensOption[] = useMemo(
    () => [
      { id: 'all', label: 'All' },
      ...collaborators.map((member) => ({
        id: member.id,
        label: member.name,
      })),
    ],
    [collaborators],
  );

  const [calendarTimeView, setCalendarTimeView] = useState<CalendarTimeView>('month');
  const [calendarUserId, setCalendarUserId] = useState('all');
  const [calendarCategoryId, setCalendarCategoryId] = useState('all');

  const [tasksClusterMode, setTasksClusterMode] = useState<TasksClusterMode>('chronological');
  const [tasksUserId, setTasksUserId] = useState('all');
  const [tasksCategoryId, setTasksCategoryId] = useState('all');

  const [timelineFilters, setTimelineFilters] = useState<string[]>([]);

  const timelineFilterGroups: FilterGroup[] = [
    {
      id: 'priority',
      label: 'Priority',
      options: [
        { id: 'high', label: 'High' },
        { id: 'medium', label: 'Medium' },
        { id: 'low', label: 'Low' },
      ],
    },
    {
      id: 'type',
      label: 'Type',
      options: [
        { id: 'event', label: 'Event' },
        { id: 'task', label: 'Task' },
        { id: 'milestone', label: 'Milestone' },
      ],
    },
  ];

  const filteredTimelineClusters = useMemo(() => {
    if (timelineFilters.length === 0) {
      return timelineDemo;
    }

    const active = new Set(timelineFilters);
    return timelineDemo
      .map((cluster) => ({
        ...cluster,
        items: cluster.items.filter((item) => active.has(item.priority) || active.has(item.type)),
      }))
      .filter((cluster) => cluster.items.length > 0);
  }, [timelineFilters]);

  const calendarEvents = useMemo(() => buildCalendarEvents(collaboratorOptions), [collaboratorOptions]);
  const tasks = useMemo(() => buildTasks(collaboratorOptions), [collaboratorOptions]);

  return (
    <section id="project-panel-overview" role="tabpanel" aria-labelledby="project-tab-overview" className="space-y-4">
      <OverviewHeader
        title={titleDraft}
        onTitleChange={setTitleDraft}
        startDateLabel="March 4, 2026"
        collaborators={collaborators}
        refs={clients}
        onInvite={() => undefined}
      />

      <Card className="pt-3">
        <p className="mb-3 text-sm text-muted">{projectSummary}</p>

        <Tabs value={activeView} onValueChange={(nextValue) => onSelectView(nextValue as OverviewViewId)}>
          <TabsList aria-label="Overview sub-views">
            {overviewViews.map((view) => (
              <TabButton key={view.id} id={`overview-view-${view.id}`} value={view.id} aria-controls={`overview-panel-${view.id}`}>
                {view.label}
              </TabButton>
            ))}
          </TabsList>
        </Tabs>

        {activeView === 'timeline' ? (
          <div id="overview-panel-timeline" role="tabpanel" aria-labelledby="overview-view-timeline" className="mt-4 space-y-3">
            <FilterBarOverlay
              groups={timelineFilterGroups}
              activeFilterIds={timelineFilters}
              onToggleFilter={(filterId) => {
                setTimelineFilters((current) =>
                  current.includes(filterId) ? current.filter((entry) => entry !== filterId) : [...current, filterId],
                );
              }}
              onClearAll={() => setTimelineFilters([])}
            />
            <TimelineTab clusters={filteredTimelineClusters} />
          </div>
        ) : null}

        {activeView === 'calendar' ? (
          <div id="overview-panel-calendar" role="tabpanel" aria-labelledby="overview-view-calendar" className="mt-4">
            <CalendarTab
              events={calendarEvents}
              collaborators={collaboratorOptions}
              categories={categoryOptions}
              timeView={calendarTimeView}
              activeUserId={calendarUserId}
              activeCategoryId={calendarCategoryId}
              onTimeViewChange={setCalendarTimeView}
              onUserChange={setCalendarUserId}
              onCategoryChange={setCalendarCategoryId}
            />
          </div>
        ) : null}

        {activeView === 'tasks' ? (
          <div id="overview-panel-tasks" role="tabpanel" aria-labelledby="overview-view-tasks" className="mt-4">
            <TasksTab
              tasks={tasks}
              collaborators={collaboratorOptions}
              categories={categoryOptions}
              activeUserId={tasksUserId}
              activeCategoryId={tasksCategoryId}
              clusterMode={tasksClusterMode}
              onUserChange={setTasksUserId}
              onCategoryChange={setTasksCategoryId}
              onClusterModeChange={setTasksClusterMode}
            />
          </div>
        ) : null}

        {activeView === 'kanban' ? (
          <div id="overview-panel-kanban" role="tabpanel" aria-labelledby="overview-view-kanban" className="mt-4">
            <Card className="space-y-3 p-4">
              <div>
                <p className="text-sm font-semibold text-text">Kanban overview</p>
                <p className="mt-1 text-sm text-muted">This legacy overview view now exposes a board summary instead of a blank panel.</p>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {[
                  { label: 'Backlog', items: tasks.slice(0, 1) },
                  { label: 'In Progress', items: tasks.slice(1, 2) },
                  { label: 'Done', items: tasks.slice(2) },
                ].map((column) => (
                  <div key={column.label} className="rounded-panel border border-border-muted bg-surface p-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-muted">{column.label}</p>
                    <div className="mt-3 space-y-2">
                      {column.items.length === 0 ? <p className="text-sm text-muted">No cards</p> : null}
                      {column.items.map((task) => (
                        <div key={task.id} className="rounded-control border border-border-muted bg-surface-elevated p-2">
                          <p className="text-sm font-medium text-text">{task.label}</p>
                          <p className="mt-1 text-xs text-muted">{task.dueLabel}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        ) : null}
      </Card>
    </section>
  );
};
