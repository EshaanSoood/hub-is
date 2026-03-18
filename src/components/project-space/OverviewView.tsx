import { useCallback, useMemo, useRef, useState } from 'react';
import { archiveRecord, updateRecord } from '../../services/hub/records';
import type { HubProjectMember, HubTaskSummary } from '../../services/hub/types';
import { Card, TabButton, Tabs, TabsList } from '../primitives';
import { CalendarTab, type CalendarEvent, type CalendarLensOption, type CalendarTimeView } from './CalendarTab';
import { FilterBarOverlay, type FilterGroup } from './FilterBarOverlay';
import { OverviewHeader } from './OverviewHeader';
import { TaskCreateDialog } from './TaskCreateDialog';
import { TasksTab, type SortChain } from './TasksTab';
import { TimelineTab, type TimelineCluster } from './TimelineTab';
import { adaptTaskSummaries } from './taskAdapter';
import type { ClientReference, Collaborator, OverviewViewId } from './types';

interface OverviewViewProps {
  projectName: string;
  projectSummary: string;
  collaborators: Collaborator[];
  clients: ClientReference[];
  activeView: OverviewViewId;
  onSelectView: (viewId: OverviewViewId) => void;
  accessToken: string;
  projectId: string;
  tasks: HubTaskSummary[];
  tasksLoading: boolean;
  tasksError: string | null;
  onRefreshTasks: () => void;
  projectMembers: HubProjectMember[];
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

const toCategoryLabel = (categoryId: string) =>
  categoryId
    .split(/[-_]/g)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');

export const OverviewView = ({
  projectName,
  projectSummary,
  collaborators,
  clients,
  activeView,
  onSelectView,
  accessToken,
  projectId,
  tasks,
  tasksLoading,
  tasksError,
  onRefreshTasks,
  projectMembers,
}: OverviewViewProps) => {
  const [titleDraft, setTitleDraft] = useState(projectName);
  const taskCreateTriggerRef = useRef<HTMLElement | null>(null);
  const lastSubtaskParentRef = useRef<{ id: string; title: string; at: number } | null>(null);
  const [taskCreateOpen, setTaskCreateOpen] = useState(false);
  const [subtaskParent, setSubtaskParent] = useState<{ id: string; title: string } | null>(null);
  const [subtaskParentRemembered, setSubtaskParentRemembered] = useState(false);

  const calendarCollaboratorOptions: CalendarLensOption[] = useMemo(
    () => [
      { id: 'all', label: 'All' },
      ...collaborators.map((member) => ({
        id: member.id,
        label: member.name,
      })),
    ],
    [collaborators],
  );

  const taskCollaboratorOptions = useMemo(
    () => [
      { id: 'all', label: 'All' },
      ...projectMembers.map((member) => ({
        id: member.user_id,
        label: member.display_name,
      })),
    ],
    [projectMembers],
  );

  const [calendarTimeView, setCalendarTimeView] = useState<CalendarTimeView>('month');
  const [calendarUserId, setCalendarUserId] = useState('all');
  const [calendarCategoryId, setCalendarCategoryId] = useState('all');

  const [sortChain, setSortChain] = useState<SortChain>(['date', 'priority', 'category']);
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

  const calendarEvents = useMemo(() => buildCalendarEvents(calendarCollaboratorOptions), [calendarCollaboratorOptions]);
  const adaptedTasks = useMemo(() => adaptTaskSummaries(tasks), [tasks]);
  const taskCategoryOptions = useMemo(() => {
    const ids = [...new Set(adaptedTasks.map((task) => task.categoryId).filter((categoryId) => categoryId !== ''))];
    return [
      { id: 'all', label: 'All' },
      ...ids.map((id) => ({
        id,
        label: toCategoryLabel(id),
      })),
    ];
  }, [adaptedTasks]);
  const tasksCollectionId = tasks[0]?.collection_id ?? null;
  const kanbanColumns = useMemo(
    () => [
      { id: 'todo', label: 'To Do', items: adaptedTasks.filter((task) => task.status === 'todo') },
      { id: 'in_progress', label: 'In Progress', items: adaptedTasks.filter((task) => task.status === 'in_progress') },
      { id: 'done', label: 'Done', items: adaptedTasks.filter((task) => task.status === 'done') },
    ],
    [adaptedTasks],
  );
  const taskMemberOptions = useMemo(
    () => projectMembers.map((member) => ({ user_id: member.user_id, display_name: member.display_name })),
    [projectMembers],
  );

  const handleUpdateStatus = useCallback(
    async (taskId: string, status: 'todo' | 'in_progress' | 'done' | 'cancelled') => {
      try {
        await updateRecord(accessToken, taskId, { task_state: { status } });
        onRefreshTasks();
      } catch (error) {
        console.error('Failed to update task status', error);
        throw error;
      }
    },
    [accessToken, onRefreshTasks],
  );

  const handleUpdatePriority = useCallback(
    async (taskId: string, priority: 'low' | 'medium' | 'high' | 'urgent' | null) => {
      try {
        await updateRecord(accessToken, taskId, { task_state: { priority } });
        onRefreshTasks();
      } catch (error) {
        console.error('Failed to update task priority', error);
        throw error;
      }
    },
    [accessToken, onRefreshTasks],
  );

  const handleUpdateDueDate = useCallback(
    async (taskId: string, dueAt: string | null) => {
      try {
        await updateRecord(accessToken, taskId, { task_state: { due_at: dueAt } });
        onRefreshTasks();
      } catch (error) {
        console.error('Failed to update task due date', error);
        throw error;
      }
    },
    [accessToken, onRefreshTasks],
  );

  const handleUpdateCategory = useCallback(
    async (taskId: string, category: string | null) => {
      try {
        await updateRecord(accessToken, taskId, { task_state: { category } });
        onRefreshTasks();
      } catch (error) {
        console.error('Failed to update task category', error);
        throw error;
      }
    },
    [accessToken, onRefreshTasks],
  );

  const handleDeleteTask = useCallback(
    async (taskId: string) => {
      try {
        await archiveRecord(accessToken, taskId);
        onRefreshTasks();
      } catch (error) {
        console.error('Failed to archive task', error);
        throw error;
      }
    },
    [accessToken, onRefreshTasks],
  );

  const openTaskDialog = (options?: { parent?: { id: string; title: string } | null; remembered?: boolean }) => {
    taskCreateTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setSubtaskParent(options?.parent ?? null);
    setSubtaskParentRemembered(Boolean(options?.remembered && options?.parent));
    setTaskCreateOpen(true);
  };

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
              collaborators={calendarCollaboratorOptions}
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
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  className="rounded-control bg-primary px-3 py-2 text-sm font-semibold text-on-primary disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => {
                    const rememberedParent = lastSubtaskParentRef.current;
                    if (rememberedParent && Date.now() - rememberedParent.at < 300000) {
                      openTaskDialog({
                        parent: { id: rememberedParent.id, title: rememberedParent.title },
                        remembered: true,
                      });
                      return;
                    }
                    openTaskDialog();
                  }}
                  aria-label="New Task"
                >
                  New Task
                </button>
              </div>
              {tasksLoading ? <p role="status" aria-live="polite" className="text-sm text-muted">Loading tasks...</p> : null}
              {tasksError ? (
                <div className="flex flex-wrap items-center gap-3">
                  <p role="alert" className="text-sm text-danger">{tasksError}</p>
                  <button
                    type="button"
                    onClick={() => onRefreshTasks()}
                    className="rounded-control border border-border-muted bg-surface px-2 py-1 text-xs font-semibold text-primary"
                  >
                    Retry
                  </button>
                </div>
              ) : null}
              {!tasksLoading && !tasksError ? (
                <TasksTab
                  tasks={adaptedTasks}
                  collaborators={taskCollaboratorOptions}
                  categories={taskCategoryOptions}
                  activeUserId={tasksUserId}
                  activeCategoryId={tasksCategoryId}
                  sortChain={sortChain}
                  onSortChainChange={setSortChain}
                  onUserChange={setTasksUserId}
                  onCategoryChange={setTasksCategoryId}
                  onUpdateTaskStatus={handleUpdateStatus}
                  onUpdateTaskPriority={handleUpdatePriority}
                  onUpdateTaskDueDate={handleUpdateDueDate}
                  onUpdateTaskCategory={handleUpdateCategory}
                  onDeleteTask={handleDeleteTask}
                  onAddSubtask={(task) => {
                    openTaskDialog({ parent: { id: task.id, title: task.label } });
                  }}
                />
              ) : null}

              <TaskCreateDialog
                open={taskCreateOpen}
                onClose={() => {
                  setTaskCreateOpen(false);
                  setSubtaskParent(null);
                  setSubtaskParentRemembered(false);
                }}
                onCreated={() => {
                  if (subtaskParent) {
                    lastSubtaskParentRef.current = { id: subtaskParent.id, title: subtaskParent.title, at: Date.now() };
                  }
                  void onRefreshTasks();
                  setTaskCreateOpen(false);
                  setSubtaskParent(null);
                  setSubtaskParentRemembered(false);
                }}
                accessToken={accessToken}
                projectId={projectId}
                tasksCollectionId={tasksCollectionId}
                projectMembers={taskMemberOptions}
                parentRecordId={subtaskParent?.id ?? null}
                parentTaskTitle={subtaskParent?.title ?? null}
                showRememberedParentNote={subtaskParentRemembered}
                onSwitchToStandaloneTask={() => {
                  setSubtaskParent(null);
                  setSubtaskParentRemembered(false);
                }}
                triggerRef={taskCreateTriggerRef}
              />
            </div>
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
                {kanbanColumns.map((column) => (
                  <div key={column.id} className="rounded-panel border border-border-muted bg-surface p-3">
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
