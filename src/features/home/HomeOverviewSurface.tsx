import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { archiveRecord, updateRecord } from '../../services/hub/records';
import type { HubTaskSummary } from '../../services/hub/types';
import type { ProjectRecord } from '../../types/domain';
import type { CalendarScope } from '../../components/project-space/CalendarWidgetSkin/types';
import type { CreateReminderPayload, HubReminderSummary } from '../../services/hub/reminders';
import { dialogLayoutIds } from '../../styles/motion';
import { CalendarWidgetSkin } from '../../components/project-space/CalendarWidgetSkin';
import { RemindersWidgetSkin } from '../../components/project-space/RemindersWidgetSkin';
import { TaskCreateDialog } from '../../components/project-space/TaskCreateDialog';
import { TasksTab, type SortChain } from '../../components/project-space/TasksTab';
import { adaptTaskSummaries } from '../../components/project-space/taskAdapter';
import { Card, InlineNotice, TabButton, Tabs, TabsList } from '../../components/primitives';
import { ProjectLensView } from '../PersonalizedDashboardPanel/ProjectLensView';
import { StreamView } from '../PersonalizedDashboardPanel/StreamView';
import type { HubDashboardItem } from '../PersonalizedDashboardPanel/types';
import { HOME_SURFACE_IDS, type HomeSurfaceId } from './navigation';

interface HomeOverviewSurfaceProps {
  accessToken: string;
  activeSurface: HomeSurfaceId;
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
    source_project: { project_id: string | null; project_name: string | null; doc_id: string | null } | null;
  }>;
  calendarLoading: boolean;
  calendarScope: CalendarScope;
  items: HubDashboardItem[];
  now: Date;
  onCalendarScopeChange: (scope: CalendarScope) => void;
  onCreateReminder: (payload: CreateReminderPayload) => Promise<void>;
  onDismissReminder: (reminderId: string) => Promise<void>;
  onOpenRecord: (recordId: string) => void;
  onRefreshTasks: () => void;
  onSelectSurface: (surface: HomeSurfaceId) => void;
  onSnoozeReminder: (reminderId: string, remindAtIso: string) => Promise<void>;
  projects: ProjectRecord[];
  reminders: HubReminderSummary[];
  remindersError: string | null;
  remindersLoading: boolean;
  tasks: HubTaskSummary[];
  tasksError: string | null;
  tasksLoading: boolean;
  todaySection: ReactNode;
}

const homeSurfaceLabels: Record<HomeSurfaceId, string> = {
  hub: 'Hub',
  stream: 'Stream',
  calendar: 'Calendar',
  tasks: 'Tasks',
  reminders: 'Reminders',
};
const overviewViews = HOME_SURFACE_IDS.map((id) => ({ id, label: homeSurfaceLabels[id] }));

const toCategoryLabel = (categoryId: string) =>
  categoryId
    .split(/[-_]/g)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');

export const HomeOverviewSurface = ({
  accessToken,
  activeSurface,
  calendarEvents,
  calendarLoading,
  calendarScope,
  items,
  now,
  onCalendarScopeChange,
  onCreateReminder,
  onDismissReminder,
  onOpenRecord,
  onRefreshTasks,
  onSelectSurface,
  onSnoozeReminder,
  projects,
  reminders,
  remindersError,
  remindersLoading,
  tasks,
  tasksError,
  tasksLoading,
  todaySection,
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
  const [selectedTaskSpaceId, setSelectedTaskSpaceId] = useState(() =>
    projects.find((project) => project.isPersonal)?.id ?? projects[0]?.id ?? '',
  );

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
  const taskProjectOptions = useMemo(
    () => projects.map((project) => ({ value: project.id, label: project.name })),
    [projects],
  );

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
      <Card className="min-h-0 px-5 pb-4 pt-5">
        <div>
          <Tabs value={activeSurface} onValueChange={(nextValue) => onSelectSurface(nextValue as HomeSurfaceId)} activationMode="manual">
            <TabsList aria-label="Home surfaces">
              {overviewViews.map((view) => (
                <TabButton
                  key={view.id}
                  id={`home-surface-tab-${view.id}`}
                  value={view.id}
                  aria-controls={`home-surface-panel-${view.id}`}
                  selected={activeSurface === view.id}
                >
                  {view.label}
                </TabButton>
              ))}
            </TabsList>
          </Tabs>
        </div>

        <div
          id="home-surface-panel-hub"
          role="tabpanel"
          aria-labelledby="home-surface-tab-hub"
          aria-hidden={activeSurface !== 'hub'}
          className={`mt-4 space-y-4 ${activeSurface !== 'hub' ? 'hidden' : ''}`}
        >
          {todaySection}
          <ProjectLensView items={items} projects={projects} onOpenRecord={onOpenRecord} title="Hub" />
        </div>

        {activeSurface === 'stream' ? (
          <div id="home-surface-panel-stream" role="tabpanel" aria-labelledby="home-surface-tab-stream" className="mt-4">
            <StreamView items={items} projects={projects} onOpenRecord={onOpenRecord} now={now} />
          </div>
        ) : null}

        {activeSurface === 'calendar' ? (
          <div id="home-surface-panel-calendar" role="tabpanel" aria-labelledby="home-surface-tab-calendar" className="mt-4">
            <div className="home-overview-calendar-panel-min-h">
              <CalendarWidgetSkin
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

        {activeSurface === 'tasks' ? (
          <div id="home-surface-panel-tasks" role="tabpanel" aria-labelledby="home-surface-tab-tasks" className="mt-4 min-h-0 space-y-3">
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
              projectId={selectedTaskSpaceId || projects.find((project) => project.isPersonal)?.id || projects[0]?.id || ''}
              projectMembers={[]}
              projectOptions={taskProjectOptions}
              selectedProjectId={selectedTaskSpaceId}
              onSelectedProjectIdChange={setSelectedTaskSpaceId}
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

        {activeSurface === 'reminders' ? (
          <div id="home-surface-panel-reminders" role="tabpanel" aria-labelledby="home-surface-tab-reminders" className="mt-4 min-h-0">
            <RemindersWidgetSkin
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
