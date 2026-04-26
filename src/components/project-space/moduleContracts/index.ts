import type { CreateReminderPayload, HubReminderSummary } from '../../../services/hub/reminders';
import type { HubCollectionField, HubRecordSummary } from '../../../services/hub/types';
import type { CalendarScope } from '../CalendarModuleSkin';
import type { FilesModuleItem } from '../FilesModuleSkin';
import type { TaskItem } from '../TasksTab';
import type { TimelineCluster, TimelineEventType, TimelineFilterValue } from '../TimelineFeed';

interface BoundViewSummary {
  view_id: string;
  name: string;
}

interface TableViewData {
  schema: {
    collection_id: string;
    name: string;
    fields: HubCollectionField[];
  } | null;
  records: HubRecordSummary[];
  loading: boolean;
  error?: string;
}

export type ModuleInsertItemType = 'task' | 'record' | 'file' | 'reminder' | 'quick-thought' | null;

export interface TasksModuleContract {
  items: TaskItem[];
  loading: boolean;
  onCreateTask: (task: { title: string; priority: string | null; due_at: string | null; parent_record_id?: string | null }) => Promise<void>;
  onUpdateTaskStatus: (taskId: string, status: string) => void;
  onUpdateTaskPriority: (taskId: string, priority: string | null) => void;
  onUpdateTaskDueDate: (taskId: string, dueAt: string | null) => void;
  onDeleteTask: (taskId: string) => void;
  onInsertToEditor?: (item: { id: string; type: string; title: string }) => void;
}

export interface KanbanModuleContract {
  views: BoundViewSummary[];
  defaultViewId: string | null;
  creatingViewByModuleId?: Record<string, boolean>;
  dataByViewId: Record<
    string,
    {
      groups: Array<{ id: string; label: string; records: HubRecordSummary[] }>;
      groupOptions: Array<{ id: string; label: string }>;
      loading: boolean;
      groupingConfigured: boolean;
      groupingMessage?: string;
      groupFieldId: string | null;
      groupableFields?: Array<{ field_id: string; name: string }>;
      metadataFieldIds?: {
        priority?: string | null;
        assignee?: string | null;
        dueDate?: string | null;
      };
      wipLimits?: Record<string, number>;
      error?: string;
    }
  >;
  onMoveRecord: (viewId: string, recordId: string, nextGroup: string) => void;
  onCreateRecord?: (viewId: string, payload: { title: string; groupFieldValue: string }) => Promise<void>;
  onConfigureGrouping?: (viewId: string, fieldId: string) => Promise<void>;
  onUpdateRecord?: (viewId: string, recordId: string, fields: Record<string, unknown>) => Promise<void>;
  onDeleteRecord?: (viewId: string, recordId: string) => Promise<void>;
  onEnsureView?: (moduleInstanceId: string, ownedViewId?: string | null) => Promise<string | null>;
  onInsertToEditor?: (item: { id: string; type: string; title: string }) => void;
}

export interface CalendarModuleContract {
  events: Array<{
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
  }>;
  loading: boolean;
  scope: CalendarScope;
  onScopeChange: (scope: CalendarScope) => void;
  onCreateEvent?: (payload: {
    title: string;
    start_dt: string;
    end_dt: string;
    timezone: string;
    location?: string;
  }) => Promise<void>;
  onRescheduleEvent?: (payload: {
    record_id: string;
    start_dt: string;
    end_dt: string;
    timezone: string;
  }) => Promise<void>;
}

export interface TableModuleContract {
  views: BoundViewSummary[];
  defaultViewId: string | null;
  dataByViewId: Record<string, TableViewData>;
  titleColumnLabel?: string;
  onCreateRecord?: (viewId: string, payload: { title: string; fields: Record<string, unknown> }) => Promise<void>;
  onUpdateRecord?: (viewId: string, recordId: string, fields: Record<string, unknown>) => Promise<void>;
  onDeleteRecords?: (viewId: string, recordIds: string[]) => Promise<void>;
  onBulkUpdateRecords?: (viewId: string, recordIds: string[], fields: Record<string, unknown>) => Promise<void>;
}

export interface RemindersModuleContract {
  items: HubReminderSummary[];
  loading: boolean;
  error?: string | null;
  onDismiss: (reminderId: string) => Promise<void>;
  onCreate: (payload: CreateReminderPayload) => Promise<void>;
  onInsertToEditor?: (item: { id: string; type: string; title: string }) => void;
}

export interface FilesModuleContract {
  paneFiles: FilesModuleItem[];
  projectFiles: FilesModuleItem[];
  onUploadPaneFiles: (files: File[]) => void;
  onUploadProjectFiles: (files: File[]) => void;
  onOpenFile: (file: FilesModuleItem) => void;
  onInsertToEditor?: (item: { id: string; type: string; title: string }) => void;
}

export interface QuickThoughtsModuleContract {
  storageKeyBase: string;
  legacyStorageKeyBase?: string;
  initialEntries?: Array<{
    id: string;
    text: string;
    createdAt: string;
    updatedAt: string | null;
    archived: boolean;
  }>;
  onInsertToEditor?: (item: { id: string; type: string; title: string }) => void;
}

export interface TimelineModuleContract {
  clusters: TimelineCluster[];
  activeFilters: TimelineEventType[];
  loading: boolean;
  hasMore: boolean;
  onFilterToggle: (type: TimelineFilterValue) => void;
  onLoadMore: () => void;
  onItemClick: (recordId: string, recordType: string) => void;
}

export interface WorkViewModuleContracts {
  tableContract: TableModuleContract;
  kanbanContract: KanbanModuleContract;
  calendarContract: CalendarModuleContract;
  filesContract: FilesModuleContract;
  quickThoughtsContract: QuickThoughtsModuleContract;
  tasksContract: TasksModuleContract;
  timelineContract: TimelineModuleContract;
  remindersContract: RemindersModuleContract;
}
