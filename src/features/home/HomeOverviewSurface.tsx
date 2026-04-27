import { useCallback, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { archiveRecord, updateRecord } from '../../services/hub/records';
import type { HubTaskSummary } from '../../services/hub/types';
import type { CalendarScope } from '../../components/project-space/CalendarModuleSkin/types';
import type { CreateReminderPayload, HubReminderSummary } from '../../services/hub/reminders';
import { dialogLayoutIds } from '../../styles/motion';
import { CalendarModuleSkin } from '../../components/project-space/CalendarModuleSkin';
import { RemindersModuleSkin } from '../../components/project-space/RemindersModuleSkin';
import { TaskCreateDialog } from '../../components/project-space/TaskCreateDialog';
import { TasksTab, type SortChain } from '../../components/project-space/TasksTab';
import { TimelineFeed, TimelineFilterMenu, type TimelineCluster, type TimelineEventType, type TimelineFilterValue } from '../../components/project-space/TimelineFeed';
import { adaptTaskSummaries } from '../../components/project-space/taskAdapter';
import { Card, InlineNotice, TabButton, Tabs, TabsList } from '../../components/primitives';
import { HomeProjectSectionHeader } from './HomeProjectSectionHeader';
import type { HomeOverlayId, HomeOverviewViewId, HomeTabId } from './navigation';

interface HomeOverviewSurfaceProps {
  accessToken: string;
  activeOverlay: HomeOverlayId | null;
  activeTab: HomeTabId;
  activeView: HomeOverviewViewId;
  autoFocusTabs?: boolean;
  calendarEvents: Array<{
    record_id: string;
    title: string;
    event_state: {
      start_dt: string;
      end_dt: string;
      timezone: string;
      location: string | null;
      updated_at: string;
    };
    participants: Array<{ user_id: string; role: string | null }>;
    source_pane: { pane_id: string | null; pane_name: string | null; doc_id: string | null } | null;
  }>;
  calendarLoading: boolean;
  calendarScope: CalendarScope;
  onCalendarScopeChange: (scope: CalendarScope) => void;
  onCreateReminder: (payload: CreateReminderPayload) => Promise<void>;
  onDismissReminder: (reminderId: string) => Promise<void>;
  onOpenRecord: (recordId: string) => void;
  onRefreshTasks: () => void;
  onSelectView: (view: HomeOverviewViewId) => void;
  onSelectTab: (tab: HomeTabId) => void;
  onSnoozeReminder: (reminderId: string, remindAtIso: string) => Promise<void>;
  projectId: string;
  projectName: string;
  reminders: HubReminderSummary[];
  remindersError: string | null;
  remindersLoading: boolean;
  tasks: HubTaskSummary[];
  tasksError: string | null;
  tasksLoading: boolean;
  timelineClusters: TimelineCluster[];
  timelineFilters: TimelineEventType[];
  onTimelineFilterToggle: (type: TimelineFilterValue) => void;
}

const overviewViews: Array<{ id: HomeOverviewViewId; label: string }> = [
  { id: 'timeline', label: 'Timeline' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'reminders', label: 'Reminders' },
];

const toCategoryLabel = (categoryId: string) =>
  categoryId
    .split(/[-_]/g)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');

export const HomeOverviewSurface = ({
  accessToken,
  activeOverlay,
  activeTab,
  activeView,
  autoFocusTabs = false,
  calendarEvents,
  calendarLoading,
  calendarScope,
  onCalendarScopeChange,
  onCreateReminder,
  onDismissReminder,
  onOpenRecord,
  onRefreshTasks,
  onSelectView,
  onSelectTab,
  onSnoozeReminder,
  projectId,
  projectName,
  reminders,
  remindersError,
  remindersLoading,
  tasks,
  tasksError,
  tasksLoading,
  timelineClusters,
  timelineFilters,
  onTimelineFilterToggle,
}: HomeOverviewSurfaceProps) => {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const taskCreateTriggerRef = useRef<HTMLElement | null>(null);
  const lastSubtaskParentRef = useRef<{ id: string; title: string; at: number } | null>(null);
  const [taskCreateOpen, setTaskCreateOpen] = useState(false);
  const [subtaskParent, setSubtaskParent] = useState<{ id: string; title: string } | null>(null);
  const [subtaskParentRemembered, setSubtaskParentRemembered] = useState(false);
  const [sortChain, setSortChain] = useState<SortChain>(['date', 'priority', 'category']);
  const [tasksUserId, setTasksUserId] = useState('all');
  const [tasksCategoryId, setTasksCategoryId] = useState('all');

  const adaptedTasks = useMemo(() => adaptTaskSummaries(tasks), [tasks]);
  const taskCollaboratorOptions = useMemo(
    () => [{ id: 'all', label: 'All' }],
    [],
  );
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

  const openTaskDialog = (options?: { parent?: { id: string; title: string } | null; remembered?: boolean }) => {
    taskCreateTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setSubtaskParent(options?.parent ?? null);
    setSubtaskParentRemembered(Boolean(options?.remembered && options?.parent));
    setTaskCreateOpen(true);
  };

  const handleUpdateStatus = useCallback(
    async (taskId: string, status: 'todo' | 'in_progress' | 'done' | 'cancelled') => {
      await updateRecord(accessToken, taskId, { task_state: { status } });
      onRefreshTasks();
    },
    [accessToken, onRefreshTasks],
  );

  const handleUpdatePriority = useCallback(
    async (taskId: string, priority: 'low' | 'medium' | 'high' | 'urgent' | null) => {
      await updateRecord(accessToken, taskId, { task_state: { priority } });
      onRefreshTasks();
    },
    [accessToken, onRefreshTasks],
  );

  const handleUpdateDueDate = useCallback(
    async (taskId: string, dueAt: string | null) => {
      await updateRecord(accessToken, taskId, { task_state: { due_at: dueAt } });
      onRefreshTasks();
    },
    [accessToken, onRefreshTasks],
  );

  const handleUpdateCategory = useCallback(
    async (taskId: string, category: string | null) => {
      await updateRecord(accessToken, taskId, { task_state: { category } });
      onRefreshTasks();
    },
    [accessToken, onRefreshTasks],
  );

  const handleDeleteTask = useCallback(
    async (taskId: string) => {
      await archiveRecord(accessToken, taskId);
      onRefreshTasks();
    },
    [accessToken, onRefreshTasks],
  );

  return (
    <section className="space-y-4">
      <Card className="flex h-[var(--home-ground-band-height)] min-h-0 flex-col px-5 pb-4 pt-5">
        <HomeProjectSectionHeader
          activeOverlay={activeOverlay}
          activeTab={activeTab}
          autoFocusTabs={autoFocusTabs}
          embedded
          onSelectTab={onSelectTab}
          projectName={projectName}
        />

        <div className="mt-2 grid items-center gap-x-8 gap-y-2 pl-[var(--home-ground-overview-indent)] xl:grid-cols-[minmax(0,1fr)_auto]">
          <Tabs value={activeView} onValueChange={(nextValue) => onSelectView(nextValue as HomeOverviewViewId)} activationMode="manual">
            <TabsList aria-label="Home overview subviews">
              {overviewViews.map((view) => (
                <TabButton
                  key={view.id}
                  id={`home-overview-view-${view.id}`}
                  value={view.id}
                  aria-controls={`home-overview-panel-${view.id}`}
                  selected={activeView === view.id}
                >
                  {view.label}
                </TabButton>
              ))}
            </TabsList>
          </Tabs>

          {activeView === 'timeline' ? (
            <div className="justify-self-start xl:justify-self-end">
              <TimelineFilterMenu activeFilters={timelineFilters} onFilterToggle={onTimelineFilterToggle} />
            </div>
          ) : null}
        </div>

        {activeView === 'timeline' ? (
          <div id="home-overview-panel-timeline" role="tabpanel" aria-labelledby="home-overview-view-timeline" className="mt-2 min-h-0 flex-1">
            <TimelineFeed
              bottomAnchor
              className="pl-[var(--home-ground-overview-indent)]"
              clusters={timelineClusters}
              activeFilters={timelineFilters}
              isLoading={false}
              hasMore={false}
              onFilterToggle={onTimelineFilterToggle}
              onLoadMore={() => {}}
              onItemClick={onOpenRecord}
              showFilters={false}
            />
          </div>
        ) : null}

        {activeView === 'calendar' ? (
          <div id="home-overview-panel-calendar" role="tabpanel" aria-labelledby="home-overview-view-calendar" className="mt-2 min-h-0 flex-1 overflow-y-auto pl-[var(--home-ground-overview-indent)]">
            <div className="home-overview-calendar-panel-min-h">
              <CalendarModuleSkin
                sizeTier="L"
                events={calendarEvents}
                loading={calendarLoading}
                scope={calendarScope}
                onScopeChange={onCalendarScopeChange}
                onOpenRecord={onOpenRecord}
              />
            </div>
          </div>
        ) : null}

        {activeView === 'tasks' ? (
          <div id="home-overview-panel-tasks" role="tabpanel" aria-labelledby="home-overview-view-tasks" className="mt-2 min-h-0 flex-1 space-y-3 overflow-y-auto pl-[var(--home-ground-overview-indent)]">
            <div className="flex items-center justify-between gap-3">
              <motion.button
                layoutId={!prefersReducedMotion && taskCreateOpen ? dialogLayoutIds.taskCreate : undefined}
                type="button"
                className="interactive interactive-fold cta-primary px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
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
                aria-label="New task"
              >
                New Task
              </motion.button>
            </div>

            {tasksLoading ? <p role="status" aria-live="polite" className="text-sm text-muted">Loading tasks...</p> : null}
            {tasksError ? (
              <InlineNotice variant="danger" title="Tasks unavailable">
                {tasksError}
              </InlineNotice>
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
              layoutId={dialogLayoutIds.taskCreate}
              onClose={() => {
                setTaskCreateOpen(false);
                setSubtaskParent(null);
                setSubtaskParentRemembered(false);
              }}
              onCreated={() => {
                if (subtaskParent) {
                  lastSubtaskParentRef.current = { id: subtaskParent.id, title: subtaskParent.title, at: Date.now() };
                }
                onRefreshTasks();
                setTaskCreateOpen(false);
                setSubtaskParent(null);
                setSubtaskParentRemembered(false);
              }}
              accessToken={accessToken}
              projectId={projectId}
              projectMembers={[]}
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
        ) : null}

        {activeView === 'reminders' ? (
          <div id="home-overview-panel-reminders" role="tabpanel" aria-labelledby="home-overview-view-reminders" className="mt-2 min-h-0 flex-1 overflow-y-auto pl-[var(--home-ground-overview-indent)]">
            <RemindersModuleSkin
              sizeTier="L"
              reminders={reminders}
              loading={remindersLoading}
              error={remindersError}
              onDismiss={onDismissReminder}
              onSnooze={(reminderId) => onSnoozeReminder(reminderId, new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString())}
              onCreate={onCreateReminder}
            />
          </div>
        ) : null}
      </Card>
    </section>
  );
};
