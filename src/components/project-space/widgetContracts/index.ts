import type { CreateReminderPayload, HubReminderSummary } from '../../../services/hub/reminders';
import type { HubCollectionField, HubRecordSummary } from '../../../services/hub/types';
import type { CalendarScope } from '../CalendarWidgetSkin';
import type { FilesWidgetItem } from '../FilesWidgetSkin';
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

export type WidgetInsertItemType = 'task' | 'record' | 'file' | 'reminder' | 'quick-thought' | null;

export interface TasksWidgetContract {
  items: TaskItem[];
  loading: boolean;
  onCreateTask: (task: { title: string; priority: string | null; due_at: string | null; parent_record_id?: string | null }) => Promise<void>;
  onUpdateTaskStatus: (taskId: string, status: string) => void;
  onUpdateTaskPriority: (taskId: string, priority: string | null) => void;
  onUpdateTaskDueDate: (taskId: string, dueAt: string | null) => void;
  onDeleteTask: (taskId: string) => void;
  onInsertToEditor?: (item: { id: string; type: string; title: string }) => void;
}

export interface KanbanWidgetContract {
  views: BoundViewSummary[];
  defaultViewId: string | null;
  creatingViewByWidgetId?: Record<string, boolean>;
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
  onEnsureView?: (widgetInstanceId: string, ownedViewId?: string | null) => Promise<string | null>;
  onInsertToEditor?: (item: { id: string; type: string; title: string }) => void;
}

export interface CalendarWidgetContract {
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

export interface TableWidgetContract {
  views: BoundViewSummary[];
  defaultViewId: string | null;
  dataByViewId: Record<string, TableViewData>;
  titleColumnLabel?: string;
  onCreateRecord?: (viewId: string, payload: { title: string; fields: Record<string, unknown> }) => Promise<void>;
  onUpdateRecord?: (viewId: string, recordId: string, fields: Record<string, unknown>) => Promise<void>;
  onDeleteRecords?: (viewId: string, recordIds: string[]) => Promise<void>;
  onBulkUpdateRecords?: (viewId: string, recordIds: string[], fields: Record<string, unknown>) => Promise<void>;
}

export interface RemindersWidgetContract {
  items: HubReminderSummary[];
  loading: boolean;
  error?: string | null;
  onDismiss: (reminderId: string) => Promise<void>;
  onCreate: (payload: CreateReminderPayload) => Promise<void>;
  onInsertToEditor?: (item: { id: string; type: string; title: string }) => void;
}

export interface FilesWidgetContract {
  projectFiles: FilesWidgetItem[];
  spaceFiles: FilesWidgetItem[];
  onUploadProjectFiles: (files: File[]) => void;
  onUploadSpaceFiles: (files: File[]) => void;
  onOpenFile: (file: FilesWidgetItem) => void;
  onInsertToEditor?: (item: { id: string; type: string; title: string }) => void;
}

export interface QuickThoughtsWidgetContract {
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

export interface TimelineWidgetContract {
  clusters: TimelineCluster[];
  activeFilters: TimelineEventType[];
  loading: boolean;
  hasMore: boolean;
  onFilterToggle: (type: TimelineFilterValue) => void;
  onLoadMore: () => void;
  onItemClick: (recordId: string, recordType: string) => void;
}

export interface WorkViewWidgetContracts {
  tableContract: TableWidgetContract;
  kanbanContract: KanbanWidgetContract;
  calendarContract: CalendarWidgetContract;
  filesContract: FilesWidgetContract;
  quickThoughtsContract: QuickThoughtsWidgetContract;
  tasksContract: TasksWidgetContract;
  timelineContract: TimelineWidgetContract;
  remindersContract: RemindersWidgetContract;
}
