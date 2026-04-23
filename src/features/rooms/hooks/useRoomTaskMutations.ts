import { useCallback } from 'react';

import { updateRecord } from '../../../services/hub/records';
import type { TaskPriorityValue, TaskStatus } from '../../../components/project-space/TasksTab';

interface UseRoomTaskMutationsParams {
  accessToken: string;
  onTasksChanged: () => Promise<void>;
  mutationContextPaneId: string | null;
}

export const useRoomTaskMutations = ({
  accessToken,
  onTasksChanged,
  mutationContextPaneId,
}: UseRoomTaskMutationsParams) => {
  const onUpdateTaskStatus = useCallback(async (taskId: string, status: TaskStatus) => {
    await updateRecord(accessToken, taskId, { task_state: { status } }, {
      mutation_context_pane_id: mutationContextPaneId || undefined,
    });
    await onTasksChanged();
  }, [accessToken, mutationContextPaneId, onTasksChanged]);

  const onUpdateTaskPriority = useCallback(async (taskId: string, priority: TaskPriorityValue) => {
    await updateRecord(accessToken, taskId, { task_state: { priority } }, {
      mutation_context_pane_id: mutationContextPaneId || undefined,
    });
    await onTasksChanged();
  }, [accessToken, mutationContextPaneId, onTasksChanged]);

  const onUpdateTaskDueDate = useCallback(async (taskId: string, dueAt: string | null) => {
    await updateRecord(accessToken, taskId, { task_state: { due_at: dueAt } }, {
      mutation_context_pane_id: mutationContextPaneId || undefined,
    });
    await onTasksChanged();
  }, [accessToken, mutationContextPaneId, onTasksChanged]);

  const onUpdateTaskCategory = useCallback(async (taskId: string, category: string | null) => {
    await updateRecord(accessToken, taskId, { task_state: { category } }, {
      mutation_context_pane_id: mutationContextPaneId || undefined,
    });
    await onTasksChanged();
  }, [accessToken, mutationContextPaneId, onTasksChanged]);

  const onDeleteTask = useCallback(async (taskId: string) => {
    await updateRecord(accessToken, taskId, { archived: true }, {
      mutation_context_pane_id: mutationContextPaneId || undefined,
    });
    await onTasksChanged();
  }, [accessToken, mutationContextPaneId, onTasksChanged]);

  return {
    onDeleteTask,
    onUpdateTaskCategory,
    onUpdateTaskDueDate,
    onUpdateTaskPriority,
    onUpdateTaskStatus,
  };
};
