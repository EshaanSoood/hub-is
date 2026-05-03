import { useCallback, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { archiveRecord, updateRecord } from '../../services/hub/records';
import type { HubProjectMember, HubRecordSummary, HubTaskSummary } from '../../services/hub/types';
import { dialogLayoutIds } from '../../styles/motion';
import { TaskCreateDialog } from './TaskCreateDialog';
import { TasksTab, type SortChain, type TaskItem, type TaskStatus } from './TasksTab';
import { adaptTaskSummaries } from './taskAdapter';
import { KanbanWidgetSkin } from './KanbanWidgetSkin';
import type { KanbanWidgetGroup } from './KanbanWidgetSkin/types';

type TaskViewMode = 'list' | 'board';

interface TasksSurfaceProps {
  accessToken: string;
  projectId: string;
  sourceProjectId?: string | null;
  tasks: HubTaskSummary[];
  tasksLoading: boolean;
  tasksError: string | null;
  onRefreshTasks: () => void;
  projectMembers?: HubProjectMember[];
  onOpenRecord?: (recordId: string) => void;
}

const taskViewModes: Array<{ id: TaskViewMode; label: string }> = [
  { id: 'list', label: 'List' },
  { id: 'board', label: 'Board' },
];

const toCategoryLabel = (categoryId: string) =>
  categoryId
    .split(/[-_]/g)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');

const statusLabels: Record<TaskStatus, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  done: 'Done',
  cancelled: 'Cancelled',
};

const taskToRecordSummary = (task: TaskItem): HubRecordSummary => ({
  record_id: task.id,
  collection_id: task.categoryId || 'tasks',
  title: task.label,
  fields: {},
  updated_at: task.dueAt ?? '',
  source_project: null,
});

const buildKanbanGroups = (tasks: TaskItem[]): KanbanWidgetGroup[] =>
  (Object.keys(statusLabels) as TaskStatus[]).map((status) => ({
    id: status,
    label: statusLabels[status],
    records: tasks.filter((task) => task.status === status).map(taskToRecordSummary),
  }));

export const TasksSurface = ({
  accessToken,
  projectId,
  sourceProjectId = null,
  tasks,
  tasksLoading,
  tasksError,
  onRefreshTasks,
  projectMembers = [],
  onOpenRecord = () => {},
}: TasksSurfaceProps) => {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const taskCreateTriggerRef = useRef<HTMLElement | null>(null);
  const lastSubtaskParentRef = useRef<{ id: string; title: string; at: number } | null>(null);
  const [taskCreateOpen, setTaskCreateOpen] = useState(false);
  const [subtaskParent, setSubtaskParent] = useState<{ id: string; title: string } | null>(null);
  const [subtaskParentRemembered, setSubtaskParentRemembered] = useState(false);
  const [sortChain, setSortChain] = useState<SortChain>(['date', 'priority', 'category']);
  const [tasksUserId, setTasksUserId] = useState('all');
  const [tasksCategoryId, setTasksCategoryId] = useState('all');
  const [viewMode, setViewMode] = useState<TaskViewMode>('list');

  const adaptedTasks = useMemo(() => adaptTaskSummaries(tasks), [tasks]);
  const kanbanGroups = useMemo(() => buildKanbanGroups(adaptedTasks), [adaptedTasks]);
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
  const taskMemberOptions = useMemo(
    () => projectMembers.map((member) => ({ user_id: member.user_id, display_name: member.display_name })),
    [projectMembers],
  );
  const openTaskDialog = (options?: { parent?: { id: string; title: string } | null; remembered?: boolean }) => {
    taskCreateTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setSubtaskParent(options?.parent ?? null);
    setSubtaskParentRemembered(Boolean(options?.remembered && options?.parent));
    setTaskCreateOpen(true);
  };

  const handleUpdateStatus = useCallback(
    async (taskId: string, status: TaskStatus) => {
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
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <motion.button
          layoutId={!prefersReducedMotion && taskCreateOpen ? dialogLayoutIds.taskCreate : undefined}
          type="button"
          className="interactive interactive-fold rounded-control bg-primary px-3 py-2 text-sm font-semibold text-on-primary disabled:cursor-not-allowed disabled:opacity-60"
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
        </motion.button>
        <div role="group" aria-label="Task view" className="flex items-center gap-1 rounded-panel bg-surface-low p-1">
          {taskViewModes.map((mode) => (
            <button
              key={mode.id}
              type="button"
              className={`rounded-control px-3 py-1.5 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
                viewMode === mode.id ? 'bg-primary text-on-primary' : 'bg-surface text-secondary hover:bg-surface-container hover:text-secondary-strong'
              }`}
              aria-pressed={viewMode === mode.id}
              onClick={() => setViewMode(mode.id)}
            >
              {mode.label}
            </button>
          ))}
        </div>
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
      {!tasksLoading && !tasksError && viewMode === 'list' ? (
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
          onOpenRecord={onOpenRecord}
          onAddSubtask={(task) => {
            openTaskDialog({ parent: { id: task.id, title: task.label } });
          }}
        />
      ) : null}
      {!tasksLoading && !tasksError && viewMode === 'board' ? (
        <div className="min-h-[32rem]">
          <KanbanWidgetSkin
            sizeTier="L"
            groups={kanbanGroups}
            groupOptions={(Object.keys(statusLabels) as TaskStatus[]).map((status) => ({ id: status, label: statusLabels[status] }))}
            loading={false}
            groupingConfigured
            onOpenRecord={onOpenRecord}
            onMoveRecord={(recordId, nextStatus) => {
              void handleUpdateStatus(recordId, nextStatus as TaskStatus);
            }}
            onUpdateRecord={async (recordId, fields) => {
              if (typeof fields.title === 'string') {
                await updateRecord(accessToken, recordId, { title: fields.title });
                onRefreshTasks();
              }
            }}
            onDeleteRecord={handleDeleteTask}
          />
        </div>
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
          void onRefreshTasks();
          setTaskCreateOpen(false);
          setSubtaskParent(null);
          setSubtaskParentRemembered(false);
        }}
        accessToken={accessToken}
        projectId={projectId}
        sourceProjectId={sourceProjectId ?? undefined}
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
  );
};
