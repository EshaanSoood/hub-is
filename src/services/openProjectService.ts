import { mockTasks } from '../data/mockData';
import { env } from '../lib/env';
import type { IntegrationOutcome, TaskItem } from '../types/domain';

const browserOpenProjectIntegrationBlocked =
  'Browser OpenProject integration is disabled. Route task reads and writes through hub-api or the desktop bridge.';

export const listTasks = async (): Promise<IntegrationOutcome<TaskItem[]>> => {
  if (env.useMocks) {
    return { data: mockTasks };
  }

  return { blockedReason: browserOpenProjectIntegrationBlocked };
};

export const markTaskDone = async (taskId: string): Promise<IntegrationOutcome<{ taskId: string }>> => {
  if (env.useMocks) {
    return { data: { taskId } };
  }

  return { blockedReason: browserOpenProjectIntegrationBlocked };
};
