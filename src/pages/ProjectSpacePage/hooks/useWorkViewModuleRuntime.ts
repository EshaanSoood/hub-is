import { useMemo, type Dispatch, type SetStateAction } from 'react';
import {
  archiveRecord,
  createEventFromNlp,
  createRecord,
  updateRecord,
} from '../../../services/hub/records';
import type {
  WorkViewCalendarRuntime,
  WorkViewFilesRuntime,
  WorkViewKanbanRuntime,
  WorkViewModuleRuntime,
  WorkViewRemindersRuntime,
  WorkViewTableRuntime,
  WorkViewTasksRuntime,
  WorkViewTimelineRuntime,
} from '../../../components/project-space/WorkView';

type CreateTableRecord = (
  viewId: string,
  payload: Parameters<NonNullable<WorkViewTableRuntime['onCreateRecord']>>[1],
  sourcePaneId: string | null,
) => Promise<void>;

type UpdateTableRecord = (
  viewId: string,
  recordId: string,
  fields: Parameters<NonNullable<WorkViewTableRuntime['onUpdateRecord']>>[2],
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
  payload: Parameters<NonNullable<WorkViewKanbanRuntime['onCreateRecord']>>[1],
  sourcePaneId: string | null,
) => Promise<void>;

type UpdateKanbanRecord = (
  viewId: string,
  recordId: string,
  fields: Parameters<NonNullable<WorkViewKanbanRuntime['onUpdateRecord']>>[2],
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

  tableViews: WorkViewTableRuntime['views'];
  tableViewRuntimeDataById: WorkViewTableRuntime['dataByViewId'];
  onCreateTableRecord: CreateTableRecord;
  onUpdateTableRecord: UpdateTableRecord;
  onDeleteTableRecords: DeleteTableRecords;
  onBulkUpdateTableRecords: BulkUpdateTableRecords;

  kanbanViews: WorkViewKanbanRuntime['views'];
  kanbanRuntimeDataByViewId: WorkViewKanbanRuntime['dataByViewId'];
  onMoveKanbanRecord: MoveKanbanRecord;
  onCreateKanbanRecord: CreateKanbanRecord;
  onUpdateKanbanRecord: UpdateKanbanRecord;
  onDeleteKanbanRecord: DeleteKanbanRecord;

  calendarEvents: WorkViewCalendarRuntime['events'];
  calendarLoading: boolean;
  calendarMode: WorkViewCalendarRuntime['scope'];
  refreshCalendar: () => Promise<void>;
  setCalendarMode: WorkViewCalendarRuntime['onScopeChange'];

  paneFiles: WorkViewFilesRuntime['paneFiles'];
  projectFiles: WorkViewFilesRuntime['projectFiles'];
  onUploadPaneFiles: WorkViewFilesRuntime['onUploadPaneFiles'];
  onUploadProjectFiles: WorkViewFilesRuntime['onUploadProjectFiles'];
  onOpenPaneFile: WorkViewFilesRuntime['onOpenFile'];

  paneTaskItems: WorkViewTasksRuntime['items'];
  projectTasksLoading: boolean;
  taskCollectionId: string | null;
  loadProjectTaskPage: () => Promise<void>;

  timelineClusters: WorkViewTimelineRuntime['clusters'];
  timelineFilters: WorkViewTimelineRuntime['activeFilters'];
  toggleTimelineFilter: WorkViewTimelineRuntime['onFilterToggle'];
  refreshProjectData: () => Promise<void>;
  openInspectorWithFocusRestore: (recordId: string, options?: { mutationPaneId?: string | null }) => Promise<void>;

  reminders: WorkViewRemindersRuntime['items'];
  remindersLoading: WorkViewRemindersRuntime['loading'];
  remindersError: WorkViewRemindersRuntime['error'];
  onDismissReminder: WorkViewRemindersRuntime['onDismiss'];
  onCreateReminder: WorkViewRemindersRuntime['onCreate'];
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
}: UseWorkViewModuleRuntimeParams): WorkViewModuleRuntime => {
  return useMemo<WorkViewModuleRuntime>(
    () => ({
      table: {
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
      kanban: {
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
      },
      calendar: {
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
      files: {
        paneFiles,
        projectFiles,
        onUploadPaneFiles,
        onUploadProjectFiles,
        onOpenFile: onOpenPaneFile,
      },
      quickThoughts: {
        storageKeyBase: `hub:quick-thoughts:${projectId}`,
        legacyStorageKeyBase: `hub:capture:${projectId}`,
      },
      tasks: {
        items: paneTaskItems,
        loading: projectTasksLoading,
        onCreateTask: async (task) => {
          if (!taskCollectionId) {
            console.error('onCreateTask: no task collection found for this project');
            alert('No task collection found for this project. Create a task from a pane first.');
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
      },
      timeline: {
        clusters: timelineClusters,
        activeFilters: timelineFilters,
        loading: false,
        hasMore: false,
        onFilterToggle: toggleTimelineFilter,
        onLoadMore: () => {
          void refreshProjectData();
        },
        onItemClick: (recordId) => {
          void openInspectorWithFocusRestore(recordId);
        },
      },
      reminders: {
        items: reminders,
        loading: remindersLoading,
        error: remindersError,
        onDismiss: onDismissReminder,
        onCreate: onCreateReminder,
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
