import { useCallback, useEffect, useRef, useState } from 'react';

import type { HubTaskSummary } from '../../../services/hub/types';
import { listProjectTasks } from '../../../services/hub/records';

interface UseRoomTaskSummariesParams {
  accessToken: string | null | undefined;
  projectId: string | null | undefined;
  sourcePaneId: string | null | undefined;
}

const fetchAllProjectTasks = async (
  accessToken: string,
  projectId: string,
  sourcePaneId: string,
): Promise<HubTaskSummary[]> => {
  const tasks: HubTaskSummary[] = [];
  let cursor: string | undefined;
  let previousCursor: string | undefined;
  let pageCount = 0;
  const maxPages = 50;

  do {
    const page = await listProjectTasks(accessToken, projectId, {
      cursor,
      limit: 200,
      source_pane_id: sourcePaneId,
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
  sourcePaneId,
}: UseRoomTaskSummariesParams) => {
  const [tasks, setTasks] = useState<HubTaskSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestVersionRef = useRef(0);

  const refreshTasks = useCallback(async () => {
    if (!accessToken || !projectId || !sourcePaneId) {
      requestVersionRef.current += 1;
      setTasks([]);
      setError(null);
      setLoading(false);
      return [];
    }

    const requestVersion = ++requestVersionRef.current;
    setLoading(true);
    try {
      const nextTasks = await fetchAllProjectTasks(accessToken, projectId, sourcePaneId);
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
  }, [accessToken, projectId, sourcePaneId]);

  useEffect(() => {
    if (!accessToken || !projectId || !sourcePaneId) {
      requestVersionRef.current += 1;
      setTasks([]);
      setError(null);
      setLoading(false);
      return;
    }

    void refreshTasks().catch(() => {});
  }, [accessToken, projectId, refreshTasks, sourcePaneId]);

  return {
    error,
    loading,
    refreshTasks,
    tasks,
  };
};
