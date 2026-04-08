import { useMemo, type Dispatch, type SetStateAction } from 'react';
import {
  archiveRecord,
  createEventFromNlp,
  createRecord,
  updateRecord,
} from '../../../services/hub/records';
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
  sourcePaneId: string | null,
) => Promise<void>;

type UpdateTableRecord = (
  viewId: string,
  recordId: string,
  fields: Parameters<NonNullable<TableModuleContract['onUpdateRecord']>>[2],
  sourcePaneId: string | null,
) => Promise<void>;

type DeleteTableRecords = (
  viewId: string,
  recordIds: string[],
  sourcePaneId: string | null,
) => Promise<void>;

type BulkUpdateTableRecords = (
  viewId: string,
  recordIds: string[],
  fields: Record<string, unknown>,
  sourcePaneId: string | null,
) => Promise<void>;

type MoveKanbanRecord = (viewId: string, recordId: string, nextGroup: string, sourcePaneId: string | null) => void;

type CreateKanbanRecord = (
  viewId: string,
  payload: Parameters<NonNullable<KanbanModuleContract['onCreateRecord']>>[1],
  sourcePaneId: string | null,
) => Promise<void>;

type UpdateKanbanRecord = (
  viewId: string,
  recordId: string,
  fields: Parameters<NonNullable<KanbanModuleContract['onUpdateRecord']>>[2],
  sourcePaneId: string | null,
) => Promise<void>;

type DeleteKanbanRecord = (recordId: string, sourcePaneId: string | null) => Promise<void>;

interface UseWorkViewModuleRuntimeParams {
  activePaneId: string | null;
  activePaneCanEdit: boolean;
  accessToken: string;
  canWriteProject: boolean;
  projectId: string;
  setRecordsError: Dispatch<SetStateAction<string | null>>;

  tableViews: TableModuleContract['views'];
  tableViewRuntimeDataById: TableModuleContract['dataByViewId'];
  onCreateTableRecord: CreateTableRecord;
  onUpdateTableRecord: UpdateTableRecord;
  onDeleteTableRecords: DeleteTableRecords;
  onBulkUpdateTableRecords: BulkUpdateTableRecords;

  kanbanViews: KanbanModuleContract['views'];
  kanbanRuntimeDataByViewId: KanbanModuleContract['dataByViewId'];
  onMoveKanbanRecord: MoveKanbanRecord;
  onCreateKanbanRecord: CreateKanbanRecord;
  onUpdateKanbanRecord: UpdateKanbanRecord;
  onDeleteKanbanRecord: DeleteKanbanRecord;

  calendarEvents: CalendarModuleContract['events'];
  calendarLoading: boolean;
  calendarMode: CalendarModuleContract['scope'];
  refreshCalendar: () => Promise<void>;
  setCalendarMode: CalendarModuleContract['onScopeChange'];

  paneFiles: FilesModuleContract['paneFiles'];
  projectFiles: FilesModuleContract['projectFiles'];
  onUploadPaneFiles: FilesModuleContract['onUploadPaneFiles'];
  onUploadProjectFiles: FilesModuleContract['onUploadProjectFiles'];
  onOpenPaneFile: FilesModuleContract['onOpenFile'];

  paneTaskItems: TasksModuleContract['items'];
  projectTasksLoading: boolean;
  taskCollectionId: string | null;
  loadProjectTaskPage: () => Promise<void>;

  timelineClusters: TimelineModuleContract['clusters'];
  timelineFilters: TimelineModuleContract['activeFilters'];
  toggleTimelineFilter: TimelineModuleContract['onFilterToggle'];
  refreshProjectData: () => Promise<void>;
  openInspectorWithFocusRestore: (recordId: string, options?: { mutationPaneId?: string | null }) => Promise<void>;

  reminders: RemindersModuleContract['items'];
  remindersLoading: RemindersModuleContract['loading'];
  remindersError: RemindersModuleContract['error'];
  onDismissReminder: RemindersModuleContract['onDismiss'];
  onCreateReminder: RemindersModuleContract['onCreate'];
}

export const useWorkViewModuleRuntime = ({
  activePaneId,
  activePaneCanEdit,
  accessToken,
  canWriteProject,
  projectId,
  setRecordsError,
  tableViews,
  tableViewRuntimeDataById,
  onCreateTableRecord,
  onUpdateTableRecord,
  onDeleteTableRecords,
  onBulkUpdateTableRecords,
  kanbanViews,
  kanbanRuntimeDataByViewId,
  onMoveKanbanRecord,
  onCreateKanbanRecord,
  onUpdateKanbanRecord,
  onDeleteKanbanRecord,
  calendarEvents,
  calendarLoading,
  calendarMode,
  refreshCalendar,
  setCalendarMode,
  paneFiles,
  projectFiles,
  onUploadPaneFiles,
  onUploadProjectFiles,
  onOpenPaneFile,
  paneTaskItems,
  projectTasksLoading,
  taskCollectionId,
  loadProjectTaskPage,
  timelineClusters,
  timelineFilters,
  toggleTimelineFilter,
  refreshProjectData,
  openInspectorWithFocusRestore,
  reminders,
  remindersLoading,
  remindersError,
  onDismissReminder,
  onCreateReminder,
}: UseWorkViewModuleRuntimeParams): WorkViewModuleContracts => {
  return useMemo<WorkViewModuleContracts>(
    () => ({
      tableContract: {
        views: tableViews,
        defaultViewId: tableViews[0]?.view_id || null,
        dataByViewId: tableViewRuntimeDataById,
        onCreateRecord: async (viewId, payload) => {
          await onCreateTableRecord(viewId, payload, activePaneId);
        },
        onUpdateRecord: async (viewId, recordId, fields) => {
          await onUpdateTableRecord(viewId, recordId, fields, activePaneId);
        },
        onDeleteRecords: async (viewId, recordIds) => {
          await onDeleteTableRecords(viewId, recordIds, activePaneId);
        },
        onBulkUpdateRecords: async (viewId, recordIds, fields) => {
          await onBulkUpdateTableRecords(viewId, recordIds, fields, activePaneId);
        },
      },
      kanbanContract: {
        views: kanbanViews,
        defaultViewId: kanbanViews[0]?.view_id || null,
        dataByViewId: kanbanRuntimeDataByViewId,
        onCreateRecord: async (viewId, payload) => {
          await onCreateKanbanRecord(viewId, payload, activePaneId);
        },
        onDeleteRecord: async (_viewId, recordId) => {
          await onDeleteKanbanRecord(recordId, activePaneId);
        },
        onMoveRecord: (viewId, recordId, nextGroup) => {
          void onMoveKanbanRecord(viewId, recordId, nextGroup, activePaneId);
        },
        onUpdateRecord: async (viewId, recordId, fields) => {
          await onUpdateKanbanRecord(viewId, recordId, fields, activePaneId);
        },
        onInsertToEditor: undefined,
      },
      calendarContract: {
        events: calendarEvents,
        loading: calendarLoading,
        scope: calendarMode,
        onScopeChange: setCalendarMode,
        onCreateEvent:
          activePaneCanEdit && canWriteProject
            ? async (payload) => {
                if (!accessToken) {
                  return;
                }
                await createEventFromNlp(accessToken, projectId, payload);
                await refreshCalendar();
              }
            : undefined,
        onRescheduleEvent:
          activePaneCanEdit && canWriteProject
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
                } catch (error) {
                  const message = error instanceof Error ? error.message : 'Failed to reschedule event.';
                  console.error('onRescheduleEvent: failed to update record', error);
                  setRecordsError(message);
                }
              }
            : undefined,
      },
      filesContract: {
        paneFiles,
        projectFiles,
        onUploadPaneFiles,
        onUploadProjectFiles,
        onOpenFile: onOpenPaneFile,
        onInsertToEditor: undefined,
      },
      quickThoughtsContract: {
        storageKeyBase: `hub:quick-thoughts:${projectId}`,
        legacyStorageKeyBase: `hub:capture:${projectId}`,
        onInsertToEditor: undefined,
      },
      tasksContract: {
        items: paneTaskItems,
        loading: projectTasksLoading,
        onCreateTask: async (task) => {
          if (!taskCollectionId) {
            console.error('onCreateTask: no task collection found for this project', { projectId });
            setRecordsError(`No task collection found for project ${projectId}. Create a task from a pane first.`);
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
            source_pane_id: activePaneId ?? undefined,
          });
          await loadProjectTaskPage();
        },
        onUpdateTaskStatus: async (taskId, status) => {
          if (!accessToken) {
            return;
          }
          try {
            await updateRecord(accessToken, taskId, { task_state: { status } });
            await loadProjectTaskPage();
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
          } catch (err) {
            console.error('Failed to delete task:', err);
          }
        },
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
          void openInspectorWithFocusRestore(recordId);
        },
      },
      remindersContract: {
        items: reminders,
        loading: remindersLoading,
        error: remindersError,
        onDismiss: onDismissReminder,
        onCreate: onCreateReminder,
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
      activePaneId,
      kanbanViews,
      kanbanRuntimeDataByViewId,
      onCreateKanbanRecord,
      onDeleteKanbanRecord,
      onMoveKanbanRecord,
      onUpdateKanbanRecord,
      calendarEvents,
      calendarLoading,
      calendarMode,
      setCalendarMode,
      activePaneCanEdit,
      canWriteProject,
      accessToken,
      projectId,
      refreshCalendar,
      setRecordsError,
      paneFiles,
      projectFiles,
      onUploadPaneFiles,
      onUploadProjectFiles,
      onOpenPaneFile,
      paneTaskItems,
      projectTasksLoading,
      taskCollectionId,
      loadProjectTaskPage,
      timelineClusters,
      timelineFilters,
      toggleTimelineFilter,
      refreshProjectData,
      openInspectorWithFocusRestore,
      reminders,
      remindersLoading,
      remindersError,
      onDismissReminder,
      onCreateReminder,
    ],
  );
};
