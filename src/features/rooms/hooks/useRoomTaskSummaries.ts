import { useCallback, useEffect, useRef, useState } from 'react';

import type { HubTaskSummary } from '../../../services/hub/types';
import { listProjectTasks } from '../../../services/hub/records';

interface UseRoomTaskSummariesParams {
  accessToken: string | null | undefined;
  projectId: string | null | undefined;
}

const fetchAllProjectTasks = async (accessToken: string, projectId: string): Promise<HubTaskSummary[]> => {
  const tasks: HubTaskSummary[] = [];
  let cursor: string | undefined;
  let previousCursor: string | undefined;
  let pageCount = 0;
  const maxPages = 50;

  do {
    const page = await listProjectTasks(accessToken, projectId, {
      cursor,
      limit: 200,
    });
    tasks.push(...page.tasks);
    previousCursor = cursor;
    cursor = page.next_cursor ?? undefined;
    pageCount += 1;
  } while (cursor && cursor !== previousCursor && pageCount < maxPages);

  return tasks;
};

export const useRoomTaskSummaries = ({
  accessToken,
  projectId,
}: UseRoomTaskSummariesParams) => {
  const [tasks, setTasks] = useState<HubTaskSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestVersionRef = useRef(0);

  const refreshTasks = useCallback(async () => {
    if (!accessToken || !projectId) {
      requestVersionRef.current += 1;
      setTasks([]);
      setError(null);
      setLoading(false);
      return [];
    }

    const requestVersion = ++requestVersionRef.current;
    setLoading(true);
    try {
      const nextTasks = await fetchAllProjectTasks(accessToken, projectId);
      if (requestVersion === requestVersionRef.current) {
        setTasks(nextTasks);
        setError(null);
      }
      return nextTasks;
    } catch (loadError) {
      if (requestVersion === requestVersionRef.current) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load room tasks.');
      }
      throw loadError;
    } finally {
      if (requestVersion === requestVersionRef.current) {
        setLoading(false);
      }
    }
  }, [accessToken, projectId]);

  useEffect(() => {
    if (!accessToken || !projectId) {
      requestVersionRef.current += 1;
      setTasks([]);
      setError(null);
      setLoading(false);
      return;
    }

    void refreshTasks().catch(() => {});
  }, [accessToken, projectId, refreshTasks]);

  return {
    error,
    loading,
    refreshTasks,
    tasks,
  };
};
