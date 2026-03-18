import { useCallback, useEffect, useRef, useState } from 'react';
import { listProjectTasks } from '../services/hub/records';

type OverviewView = 'timeline' | 'calendar' | 'tasks' | 'kanban';
type ProjectSpaceTab = 'overview' | 'work' | 'tools';

const PROJECT_TASK_PAGE_SIZE = 50;

interface UseProjectTasksRuntimeParams {
  accessToken: string;
  projectId: string;
  activeTab: ProjectSpaceTab;
  overviewView: OverviewView;
}

export const useProjectTasksRuntime = ({
  accessToken,
  projectId,
  activeTab,
  overviewView,
}: UseProjectTasksRuntimeParams) => {
  const [projectTasks, setProjectTasks] = useState<Awaited<ReturnType<typeof listProjectTasks>>>({
    tasks: [],
    next_cursor: null,
  });
  const [projectTasksLoading, setProjectTasksLoading] = useState(false);
  const [projectTasksLoadingMore, setProjectTasksLoadingMore] = useState(false);
  const [projectTasksError, setProjectTasksError] = useState<string | null>(null);
  const projectTasksSentinelRef = useRef<HTMLDivElement | null>(null);
  const projectTasksInFlightCursorRef = useRef<string | null>(null);
  const loadedProjectIdRef = useRef<string | null>(null);
  const hasTaskData = loadedProjectIdRef.current === projectId && projectTasks.tasks.length > 0;

  const loadProjectTaskPage = useCallback(
    async ({ cursor = '', append = false }: { cursor?: string; append?: boolean } = {}) => {
      const requestedCursor = cursor || '';
      if (append && requestedCursor && projectTasksInFlightCursorRef.current === requestedCursor) {
        return;
      }
      if (append && requestedCursor) {
        projectTasksInFlightCursorRef.current = requestedCursor;
      }
      if (append) {
        setProjectTasksLoadingMore(true);
      } else {
        setProjectTasksLoading(true);
      }

      try {
        const page = await listProjectTasks(accessToken, projectId, {
          limit: PROJECT_TASK_PAGE_SIZE,
          cursor: requestedCursor || undefined,
        });
        loadedProjectIdRef.current = projectId;
        setProjectTasks((current) => ({
          tasks: append ? [...current.tasks, ...page.tasks] : page.tasks,
          next_cursor: page.next_cursor,
        }));
        setProjectTasksError(null);
      } catch (error) {
        if (!append) {
          loadedProjectIdRef.current = null;
          setProjectTasks({ tasks: [], next_cursor: null });
        }
        setProjectTasksError(error instanceof Error ? error.message : 'Failed to load project tasks.');
        if (!append) {
          console.warn('[project-space] failed to load project tasks', error);
        }
      } finally {
        if (append && projectTasksInFlightCursorRef.current === requestedCursor) {
          projectTasksInFlightCursorRef.current = null;
        }
        if (append) {
          setProjectTasksLoadingMore(false);
        } else {
          setProjectTasksLoading(false);
        }
      }
    },
    [accessToken, projectId],
  );

  useEffect(() => {
    const shouldLoadTasks = !hasTaskData && (activeTab === 'work' || (activeTab === 'overview' && overviewView === 'tasks'));
    if (!shouldLoadTasks) {
      return;
    }
    void loadProjectTaskPage();
  }, [activeTab, hasTaskData, loadProjectTaskPage, overviewView]);

  useEffect(() => {
    if (activeTab !== 'overview' || overviewView !== 'tasks' || !projectTasks.next_cursor || projectTasksLoading || projectTasksLoadingMore) {
      return;
    }
    const sentinel = projectTasksSentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === 'undefined') {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadProjectTaskPage({ cursor: projectTasks.next_cursor || '', append: true });
        }
      },
      { rootMargin: '240px 0px' },
    );

    observer.observe(sentinel);
    return () => {
      observer.disconnect();
    };
  }, [activeTab, loadProjectTaskPage, overviewView, projectTasks.next_cursor, projectTasksLoading, projectTasksLoadingMore]);

  return {
    loadProjectTaskPage,
    projectTasksError,
    projectTasksLoading,
    projectTasksLoadingMore,
    projectTasksNextCursor: projectTasks.next_cursor,
    projectTasksSentinelRef,
    tasksOverviewRows: projectTasks.tasks,
  };
};
