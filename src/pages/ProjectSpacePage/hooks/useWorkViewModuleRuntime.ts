import { useCallback, useMemo, type Dispatch, type SetStateAction } from 'react';
import {
  archiveRecord,
  createEventFromNlp,
  createRecord,
  updateRecord,
} from '../../../services/hub/records';
import { recordRecentProjectContribution } from '../../../features/recentPlaces/store';
import { requestHubHomeRefresh } from '../../../lib/hubHomeRefresh';
import type {
  CalendarModuleContract,
  FilesModuleContract,
  KanbanModuleContract,
  RemindersModuleContract,
  TableModuleContract,
  TasksModuleContract,
  TimelineModuleContract,
  WorkViewModuleContracts,
} from '../../../components/project-space/moduleContracts';

type CreateTableRecord = (
  viewId: string,
  payload: Parameters<NonNullable<TableModuleContract['onCreateRecord']>>[1],
  sourceProjectId: string | null,
) => Promise<void>;

type UpdateTableRecord = (
  viewId: string,
  recordId: string,
  fields: Parameters<NonNullable<TableModuleContract['onUpdateRecord']>>[2],
  sourceProjectId: string | null,
) => Promise<void>;

type DeleteTableRecords = (
  viewId: string,
  recordIds: string[],
  sourceProjectId: string | null,
) => Promise<void>;

type BulkUpdateTableRecords = (
  viewId: string,
  recordIds: string[],
  fields: Record<string, unknown>,
  sourceProjectId: string | null,
) => Promise<void>;

type MoveKanbanRecord = (viewId: string, recordId: string, nextGroup: string, sourceProjectId: string | null) => void;

type CreateKanbanRecord = (
  viewId: string,
  payload: Parameters<NonNullable<KanbanModuleContract['onCreateRecord']>>[1],
  sourceProjectId: string | null,
) => Promise<void>;

type ConfigureKanbanGrouping = (
  viewId: string,
  fieldId: string,
  sourceProjectId: string | null,
) => Promise<void>;

type UpdateKanbanRecord = (
  viewId: string,
  recordId: string,
  fields: Parameters<NonNullable<KanbanModuleContract['onUpdateRecord']>>[2],
  sourceProjectId: string | null,
) => Promise<void>;

type DeleteKanbanRecord = (recordId: string, sourceProjectId: string | null) => Promise<void>;
type EnsureKanbanView = (moduleInstanceId: string, ownedViewId: string | null | undefined, sourceProjectId: string | null) => Promise<string | null>;

interface UseWorkViewModuleRuntimeParams {
  activeProjectId: string | null;
  activeProjectName: string | null;
  activeProjectCanEdit: boolean;
  accessToken: string;
  canWriteProject: boolean;
  projectId: string;
  projectName: string;
  setRecordsError: Dispatch<SetStateAction<string | null>>;

  tableViews: TableModuleContract['views'];
  tableViewRuntimeDataById: TableModuleContract['dataByViewId'];
  onCreateTableRecord: CreateTableRecord;
  onUpdateTableRecord: UpdateTableRecord;
  onDeleteTableRecords: DeleteTableRecords;
  onBulkUpdateTableRecords: BulkUpdateTableRecords;

  kanbanViews: KanbanModuleContract['views'];
  kanbanRuntimeDataByViewId: KanbanModuleContract['dataByViewId'];
  creatingKanbanViewByModuleId: Record<string, boolean>;
  onMoveKanbanRecord: MoveKanbanRecord;
  onCreateKanbanRecord: CreateKanbanRecord;
  onConfigureKanbanGrouping: ConfigureKanbanGrouping;
  onUpdateKanbanRecord: UpdateKanbanRecord;
  onDeleteKanbanRecord: DeleteKanbanRecord;
  onEnsureKanbanView: EnsureKanbanView;

  calendarEvents: CalendarModuleContract['events'];
  calendarLoading: boolean;
  calendarMode: CalendarModuleContract['scope'];
  refreshCalendar: () => Promise<void>;
  setCalendarMode: CalendarModuleContract['onScopeChange'];

  projectFiles: FilesModuleContract['projectFiles'];
  spaceFiles: FilesModuleContract['spaceFiles'];
  onUploadProjectFiles: FilesModuleContract['onUploadProjectFiles'];
  onUploadSpaceFiles: FilesModuleContract['onUploadSpaceFiles'];
  onOpenProjectFile: FilesModuleContract['onOpenFile'];

  projectTaskItems: TasksModuleContract['items'];
  projectTasksLoading: boolean;
  taskCollectionId: string | null;
  loadProjectTaskPage: () => Promise<void>;

  timelineClusters: TimelineModuleContract['clusters'];
  timelineFilters: TimelineModuleContract['activeFilters'];
  toggleTimelineFilter: TimelineModuleContract['onFilterToggle'];
  refreshProjectData: () => Promise<void>;
  openRecordInspector: (recordId: string, options?: { mutationProjectId?: string | null }) => Promise<void>;

  reminders: RemindersModuleContract['items'];
  remindersLoading: RemindersModuleContract['loading'];
  remindersError: RemindersModuleContract['error'];
  onDismissReminder: RemindersModuleContract['onDismiss'];
  onCreateReminder: RemindersModuleContract['onCreate'];
}

export const useWorkViewModuleRuntime = ({
  activeProjectId,
  activeProjectName,
  activeProjectCanEdit,
  accessToken,
  canWriteProject,
  projectId,
  projectName,
  setRecordsError,
  tableViews,
  tableViewRuntimeDataById,
  onCreateTableRecord,
  onUpdateTableRecord,
  onDeleteTableRecords,
  onBulkUpdateTableRecords,
  kanbanViews,
  kanbanRuntimeDataByViewId,
  creatingKanbanViewByModuleId,
  onMoveKanbanRecord,
  onCreateKanbanRecord,
  onConfigureKanbanGrouping,
  onUpdateKanbanRecord,
  onDeleteKanbanRecord,
  onEnsureKanbanView,
  calendarEvents,
  calendarLoading,
  calendarMode,
  refreshCalendar,
  setCalendarMode,
  projectFiles,
  spaceFiles,
  onUploadProjectFiles,
  onUploadSpaceFiles,
  onOpenProjectFile,
  projectTaskItems,
  projectTasksLoading,
  taskCollectionId,
  loadProjectTaskPage,
  timelineClusters,
  timelineFilters,
  toggleTimelineFilter,
  refreshProjectData,
  openRecordInspector,
  reminders,
  remindersLoading,
  remindersError,
  onDismissReminder,
  onCreateReminder,
}: UseWorkViewModuleRuntimeParams): WorkViewModuleContracts => {
  const recordActiveProjectContribution = useCallback((contributionKind: string) => {
    if (!activeProjectId || !activeProjectName) {
      return;
    }
    recordRecentProjectContribution({
      projectId: activeProjectId,
      projectName: activeProjectName,
      spaceId: projectId,
      spaceName: projectName,
    }, contributionKind);
  }, [activeProjectId, activeProjectName, projectId, projectName]);

  return useMemo<WorkViewModuleContracts>(
    () => ({
      tableContract: {
        views: tableViews,
        defaultViewId: tableViews[0]?.view_id || null,
        dataByViewId: tableViewRuntimeDataById,
        onCreateRecord: async (viewId, payload) => {
          await onCreateTableRecord(viewId, payload, activeProjectId);
        },
        onUpdateRecord: async (viewId, recordId, fields) => {
          await onUpdateTableRecord(viewId, recordId, fields, activeProjectId);
        },
        onDeleteRecords: async (viewId, recordIds) => {
          await onDeleteTableRecords(viewId, recordIds, activeProjectId);
        },
        onBulkUpdateRecords: async (viewId, recordIds, fields) => {
          await onBulkUpdateTableRecords(viewId, recordIds, fields, activeProjectId);
        },
      },
      kanbanContract: {
        views: kanbanViews,
        defaultViewId: kanbanViews[0]?.view_id || null,
        dataByViewId: kanbanRuntimeDataByViewId,
        creatingViewByModuleId: creatingKanbanViewByModuleId,
        onCreateRecord: async (viewId, payload) => {
          await onCreateKanbanRecord(viewId, payload, activeProjectId);
        },
        onConfigureGrouping: async (viewId, fieldId) => {
          await onConfigureKanbanGrouping(viewId, fieldId, activeProjectId);
        },
        onDeleteRecord: async (_viewId, recordId) => {
          await onDeleteKanbanRecord(recordId, activeProjectId);
        },
        onEnsureView: async (moduleInstanceId, ownedViewId) => onEnsureKanbanView(moduleInstanceId, ownedViewId, activeProjectId),
        onMoveRecord: (viewId, recordId, nextGroup) => {
          void onMoveKanbanRecord(viewId, recordId, nextGroup, activeProjectId);
        },
        onUpdateRecord: async (viewId, recordId, fields) => {
          await onUpdateKanbanRecord(viewId, recordId, fields, activeProjectId);
        },
        // TODO(phase8): wire module insert-to-editor callbacks from workspace-doc runtime.
        onInsertToEditor: undefined,
      },
      calendarContract: {
        events: calendarEvents,
        loading: calendarLoading,
        scope: calendarMode,
        onScopeChange: setCalendarMode,
        onCreateEvent:
          activeProjectCanEdit && canWriteProject
            ? async (payload) => {
                if (!accessToken) {
                  return;
                }
                await createEventFromNlp(accessToken, projectId, {
                  ...payload,
                  source_project_id: activeProjectId ?? undefined,
                });
                requestHubHomeRefresh();
                await refreshCalendar();
                recordActiveProjectContribution('calendar-create-event');
              }
            : undefined,
        onRescheduleEvent:
          activeProjectCanEdit && canWriteProject
            ? async (payload) => {
                if (!accessToken) {
                  return;
                }
                try {
                  await updateRecord(accessToken, payload.record_id, {
                    event_state: {
                      start_dt: payload.start_dt,
                      end_dt: payload.end_dt,
                      timezone: payload.timezone,
                    },
                  });
                  await refreshCalendar();
                  recordActiveProjectContribution('calendar-reschedule-event');
                } catch (error) {
                  const message = error instanceof Error ? error.message : 'Failed to reschedule event.';
                  console.error('onRescheduleEvent: failed to update record', error);
                  setRecordsError(message);
                }
              }
            : undefined,
      },
      filesContract: {
        projectFiles,
        spaceFiles,
        onUploadProjectFiles,
        onUploadSpaceFiles,
        onOpenFile: onOpenProjectFile,
        // TODO(phase8): wire module insert-to-editor callbacks from workspace-doc runtime.
        onInsertToEditor: undefined,
      },
      quickThoughtsContract: {
        storageKeyBase: `hub:quick-thoughts:${projectId}`,
        legacyStorageKeyBase: `hub:capture:${projectId}`,
        // TODO(phase8): wire module insert-to-editor callbacks from workspace-doc runtime.
        onInsertToEditor: undefined,
      },
      tasksContract: {
        items: projectTaskItems,
        loading: projectTasksLoading,
        onCreateTask: async (task) => {
          if (!taskCollectionId) {
            console.error('onCreateTask: no task collection found for this project', { projectId });
            setRecordsError('No task list found for this space. Create a task in this space to initialize its task list.');
            return;
          }
          if (!accessToken) {
            return;
          }
          await createRecord(accessToken, projectId, {
            collection_id: taskCollectionId,
            title: task.title,
            capability_types: ['task'],
            task_state: {
              status: 'todo',
              priority: task.priority,
              due_at: task.due_at,
            },
            parent_record_id: task.parent_record_id || null,
            source_project_id: activeProjectId ?? undefined,
          });
          requestHubHomeRefresh();
          await loadProjectTaskPage();
          recordActiveProjectContribution('task-create');
        },
        onUpdateTaskStatus: async (taskId, status) => {
          if (!accessToken) {
            return;
          }
          try {
            await updateRecord(accessToken, taskId, { task_state: { status } });
            await loadProjectTaskPage();
            recordActiveProjectContribution('task-status-update');
          } catch (err) {
            console.error('Failed to update task status:', err);
          }
        },
        onUpdateTaskPriority: async (taskId, priority) => {
          if (!accessToken) {
            return;
          }
          try {
            await updateRecord(accessToken, taskId, { task_state: { priority } });
            await loadProjectTaskPage();
            recordActiveProjectContribution('task-priority-update');
          } catch (err) {
            console.error('Failed to update task priority:', err);
          }
        },
        onUpdateTaskDueDate: async (taskId, dueAt) => {
          if (!accessToken) {
            return;
          }
          try {
            await updateRecord(accessToken, taskId, { task_state: { due_at: dueAt } });
            await loadProjectTaskPage();
            recordActiveProjectContribution('task-due-date-update');
          } catch (err) {
            console.error('Failed to update task due date:', err);
          }
        },
        onDeleteTask: async (taskId) => {
          if (!accessToken) {
            return;
          }
          try {
            await archiveRecord(accessToken, taskId);
            await loadProjectTaskPage();
            recordActiveProjectContribution('task-delete');
          } catch (err) {
            console.error('Failed to delete task:', err);
          }
        },
        // TODO(phase8): wire module insert-to-editor callbacks from workspace-doc runtime.
        onInsertToEditor: undefined,
      },
      timelineContract: {
        clusters: timelineClusters,
        activeFilters: timelineFilters,
        loading: false, // Timeline currently refreshes via refreshProjectData, not incremental loading.
        hasMore: false, // Pagination is intentionally not implemented for timeline yet.
        onFilterToggle: toggleTimelineFilter,
        onLoadMore: () => {
          void refreshProjectData();
        },
        onItemClick: (recordId) => {
          void openRecordInspector(recordId);
        },
      },
      remindersContract: {
        items: reminders,
        loading: remindersLoading,
        error: remindersError,
        onDismiss: async (reminderId) => {
          await onDismissReminder(reminderId);
          recordActiveProjectContribution('reminder-dismiss');
        },
        onCreate: async (payload) => {
          await onCreateReminder(payload);
          recordActiveProjectContribution('reminder-create');
        },
        // TODO(phase8): wire module insert-to-editor callbacks from workspace-doc runtime.
        onInsertToEditor: undefined,
      },
    }),
    [
      tableViews,
      tableViewRuntimeDataById,
      onCreateTableRecord,
      onUpdateTableRecord,
      onDeleteTableRecords,
      onBulkUpdateTableRecords,
      activeProjectId,
      kanbanViews,
      kanbanRuntimeDataByViewId,
      creatingKanbanViewByModuleId,
      onCreateKanbanRecord,
      onConfigureKanbanGrouping,
      onDeleteKanbanRecord,
      onEnsureKanbanView,
      onMoveKanbanRecord,
      onUpdateKanbanRecord,
      calendarEvents,
      calendarLoading,
      calendarMode,
      setCalendarMode,
      activeProjectCanEdit,
      canWriteProject,
      accessToken,
      projectId,
      refreshCalendar,
      recordActiveProjectContribution,
      setRecordsError,
      projectFiles,
      spaceFiles,
      onUploadProjectFiles,
      onUploadSpaceFiles,
      onOpenProjectFile,
      projectTaskItems,
      projectTasksLoading,
      taskCollectionId,
      loadProjectTaskPage,
      timelineClusters,
      timelineFilters,
      toggleTimelineFilter,
      refreshProjectData,
      openRecordInspector,
      reminders,
      remindersLoading,
      remindersError,
      onDismissReminder,
      onCreateReminder,
    ],
  );
};
