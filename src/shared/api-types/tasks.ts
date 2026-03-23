/** Valid lifecycle states for task records. */
export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'cancelled';

/** Valid task urgency levels. */
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

/** Identifies where a task originated in Hub workflows. */
export type TaskOriginKind = 'pane' | 'project' | 'personal';

export interface SourcePaneContext {
  /** Stable pane identifier when the record is tied to a pane. */
  pane_id: string | null;
  /** Human-readable pane name at the time the context was generated. */
  pane_name: string | null;
  /** Backing document identifier for the pane, if one exists. */
  doc_id: string | null;
}

export interface TaskState {
  /** Workflow state for the task. */
  status: TaskStatus;
  /** Optional task priority; null means no priority is set. */
  priority: TaskPriority | null;
  /** ISO 8601 datetime string. Null means no due date is set. */
  due_at: string | null;
  /** Optional free-form grouping/category label. */
  category: string | null;
  /** ISO 8601 completion timestamp. Null means task is not completed. */
  completed_at: string | null;
  /** ISO 8601 timestamp for the last task-state update. */
  updated_at: string;
}

export interface TaskAssignment {
  /** User identifier assigned to this task. */
  user_id: string;
  /** ISO 8601 timestamp when this assignment was created. */
  assigned_at: string;
}

export interface TaskSummary {
  /** Stable record identifier for the task. */
  record_id: string;
  /** Parent project identifier; null for personal task shortcuts in some views. */
  project_id: string | null;
  /** Project display name; null when unknown or omitted. */
  project_name: string | null;
  /** Collection identifier containing the task record. */
  collection_id: string;
  /** Collection display name; null when unknown. */
  collection_name: string | null;
  /** Task title shown in task lists and dashboards. */
  title: string;
  /** ISO 8601 timestamp when the task record was created. */
  created_at: string;
  /** ISO 8601 timestamp when the task record was last updated. */
  updated_at: string;
  /** Number of direct subtasks linked to this task. */
  subtask_count: number;
  /** Current task-state payload from the `task_state` table. */
  task_state: TaskState;
  /** Users currently assigned to this task. */
  assignments: TaskAssignment[];
  /** Indicates whether this task came from pane, project, or personal context. */
  origin_kind: TaskOriginKind;
  /** Source view identifier for traceability; null when none exists. */
  source_view_id: string | null;
  /** Pane context used for route reconstruction; null when not pane-bound. */
  source_pane: SourcePaneContext | null;
}

export interface TaskPage {
  /** Paged task summaries. */
  tasks: TaskSummary[];
  /** Opaque cursor for loading the next page. Null means no additional page. */
  next_cursor: string | null;
}

export interface CreateTaskRequest {
  /** Required non-empty task title. */
  title: string;
  /** Optional initial task status. Defaults to `todo` when omitted. */
  status?: TaskStatus;
  /** Optional initial task priority; null explicitly clears priority. */
  priority?: TaskPriority | null;
  /** Optional task category label; null explicitly clears category. */
  category?: string | null;
}

export interface CreateTaskResponse {
  /** Newly created task summary. */
  task: TaskSummary;
}
