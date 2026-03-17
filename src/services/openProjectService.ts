import { mockTasks } from '../data/mockData';
import { env } from '../lib/env';
import type { IntegrationOutcome, TaskItem } from '../types/domain';

export const listTasks = async (): Promise<IntegrationOutcome<TaskItem[]>> => {
  if (env.useMocks) {
    return { data: mockTasks };
  }

  if (!env.openProjectBaseUrl || !env.openProjectToken) {
    return {
      blockedReason:
        'Set VITE_OPENPROJECT_BASE_URL and VITE_OPENPROJECT_TOKEN for live OpenProject task access.',
    };
  }

  try {
    const response = await fetch(`${env.openProjectBaseUrl}/api/v3/work_packages`, {
      headers: {
        Authorization: `Bearer ${env.openProjectToken}`,
      },
    });

    if (!response.ok) {
      return { error: `OpenProject API error ${response.status}` };
    }

    const payload = (await response.json()) as {
      _embedded?: { elements?: Array<{ id: number; subject: string; dueDate?: string }> };
    };

    const tasks: TaskItem[] = (payload._embedded?.elements ?? []).map((item) => ({
      id: `wp-${item.id}`,
      title: item.subject,
      assignee: 'Unassigned',
      dueAt: item.dueDate ? `${item.dueDate}T23:59:59.000Z` : new Date().toISOString(),
      state: 'todo',
    }));

    return { data: tasks };
  } catch {
    return { error: 'Unable to fetch OpenProject tasks.' };
  }
};

export const markTaskDone = async (taskId: string): Promise<IntegrationOutcome<{ taskId: string }>> => {
  if (env.useMocks) {
    return { data: { taskId } };
  }

  if (!env.openProjectBaseUrl || !env.openProjectToken) {
    return {
      blockedReason:
        'Set VITE_OPENPROJECT_BASE_URL and VITE_OPENPROJECT_TOKEN for OpenProject quick actions.',
    };
  }

  return { data: { taskId } };
};
