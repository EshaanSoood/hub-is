import type {
  DayStripEventItem,
  DayStripReminderItem,
  DayStripTaskItem,
  TriageReminderItem,
  TriageTaskItem,
} from '../../components/hub-home/types';
import type { EventSummary, HubHomeResponse, TaskSummary } from '../../shared/api-types';

export type HubHomeData = HubHomeResponse;
export type HubTask = TaskSummary;
export type HubEvent = EventSummary;

export type HubDashboardView = 'project-lens' | 'stream';
export type StreamSort = 'due' | 'updated';
export type StreamTypeFilter = 'all' | 'tasks' | 'events';

export interface ProjectOption {
  value: string;
  label: string;
}

export type HubDashboardItem =
  | {
      id: string;
      kind: 'task';
      recordId: string;
      title: string;
      projectId: string | null;
      projectName: string | null;
      dueAt: string | null;
      updatedAt: string;
      unread: boolean;
      badgeLabel: 'Task';
      taskStatus: HubTask['task_state']['status'];
      subtitle?: string;
      explicitHref: string;
    }
  | {
      id: string;
      kind: 'event';
      recordId: string;
      title: string;
      projectId: string | null;
      projectName: string | null;
      dueAt: string | null;
      updatedAt: string;
      unread: boolean;
      badgeLabel: 'Event';
      subtitle?: string;
      explicitHref: string;
    };

export interface DashboardDailyData {
  dayEvents: DayStripEventItem[];
  timedTasks: DayStripTaskItem[];
  untimedTasks: TriageTaskItem[];
  overdueTasks: TriageTaskItem[];
  timedReminders: DayStripReminderItem[];
  missedReminders: TriageReminderItem[];
}

export interface DashboardDayCounts {
  events: number;
  tasks: number;
  reminders: number;
  triage: number;
}

export interface DashboardPipCounts {
  events: number;
  tasks: number;
  reminders: number;
}
