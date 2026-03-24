import type { TaskPriority, TaskStatus } from '../../shared/api-types/tasks';

export type TimelineTypeFilter = 'all' | 'events' | 'tasks' | 'reminders';

export interface DayStripEventItem {
  id: string;
  recordId: string;
  projectId: string | null;
  projectName: string | null;
  title: string;
  startAtIso: string;
  endAtIso: string;
}

export interface DayStripTaskItem {
  id: string;
  recordId: string;
  projectId: string | null;
  projectName: string | null;
  title: string;
  dueAtIso: string;
  status: TaskStatus;
}

export interface DayStripReminderItem {
  id: string;
  reminderId: string;
  recordId: string;
  projectId: string;
  projectName: string | null;
  title: string;
  remindAtIso: string;
  dismissed: boolean;
}

export interface TriageTaskItem {
  id: string;
  recordId: string;
  projectId: string | null;
  projectName: string | null;
  title: string;
  dueAtIso: string | null;
  priority: TaskPriority | null;
}

export interface TriageReminderItem {
  id: string;
  reminderId: string;
  recordId: string;
  projectId: string;
  projectName: string | null;
  title: string;
  remindAtIso: string;
}

export type TriageDragPayload =
  | { kind: 'task'; recordId: string }
  | { kind: 'reminder'; reminderId: string };

export const HUB_TRIAGE_DRAG_MIME = 'application/x-hub-triage-item';
