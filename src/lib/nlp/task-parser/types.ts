export type TaskPriority = 'high' | 'medium' | 'low' | null;

export interface TaskParseResult {
  title: string;
  due_at: string | null;
  priority: TaskPriority;
  assignee_hints: string[];
}

export interface TaskParseOptions {
  now?: Date | string;
  timezone?: string;
}
