import { useCallback } from 'react';

import { archiveRecord, updateRecord } from '../../../services/hub/records';
import type { TaskPriorityValue, TaskStatus } from '../../../components/project-space/TasksTab';

interface UseRoomTaskMutationsParams {
  accessToken: string;
  onTasksChanged: () => Promise<void>;
}

export const useRoomTaskMutations = ({
  accessToken,
  onTasksChanged,
}: UseRoomTaskMutationsParams) => {
  const onUpdateTaskStatus = useCallback(async (taskId: string, status: TaskStatus) => {
    await updateRecord(accessToken, taskId, { task_state: { status } });
    await onTasksChanged();
  }, [accessToken, onTasksChanged]);

  const onUpdateTaskPriority = useCallback(async (taskId: string, priority: TaskPriorityValue) => {
    await updateRecord(accessToken, taskId, { task_state: { priority } });
    await onTasksChanged();
  }, [accessToken, onTasksChanged]);

  const onUpdateTaskDueDate = useCallback(async (taskId: string, dueAt: string | null) => {
    await updateRecord(accessToken, taskId, { task_state: { due_at: dueAt } });
    await onTasksChanged();
  }, [accessToken, onTasksChanged]);

  const onUpdateTaskCategory = useCallback(async (taskId: string, category: string | null) => {
    await updateRecord(accessToken, taskId, { task_state: { category } });
    await onTasksChanged();
  }, [accessToken, onTasksChanged]);

  const onDeleteTask = useCallback(async (taskId: string) => {
    await archiveRecord(accessToken, taskId);
    await onTasksChanged();
  }, [accessToken, onTasksChanged]);

  return {
    onDeleteTask,
    onUpdateTaskCategory,
    onUpdateTaskDueDate,
    onUpdateTaskPriority,
    onUpdateTaskStatus,
  };
};
