import { useCallback, useEffect, useRef, useState } from 'react';
import { listProjectTasks, queryTasks } from '../services/hub/records';

type OverviewView = 'hub' | 'timeline' | 'calendar' | 'tasks';
type ProjectSpaceTab = 'overview' | 'work';

const PROJECT_TASK_PAGE_SIZE = 50;

interface UseProjectTasksRuntimeParams {
  accessToken: string;
  projectId?: string;
  activeTab?: ProjectSpaceTab;
  overviewView?: OverviewView;
  enabled?: boolean;
  autoload?: boolean;
  taskQuery?: Parameters<typeof queryTasks>[1];
}

export const useProjectTasksRuntime = ({
  accessToken,
  projectId,
  activeTab,
  overviewView,
  enabled = true,
  autoload,
  taskQuery,
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
  const loadedTaskScopeRef = useRef<string | null>(null);
  const taskScopeKey = taskQuery ? JSON.stringify(taskQuery) : `space:${projectId ?? ''}`;
  const isTaskScopeLoaded = loadedTaskScopeRef.current === taskScopeKey;
  const hasTaskRows = projectTasks.tasks.length > 0;

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
        if (!taskQuery && !projectId) {
          throw new Error('Tasks are unavailable without a query scope.');
        }
        const page = taskQuery
          ? await queryTasks(accessToken, {
              ...taskQuery,
              limit: PROJECT_TASK_PAGE_SIZE,
              cursor: requestedCursor || undefined,
            })
          : await listProjectTasks(accessToken, projectId as string, {
              limit: PROJECT_TASK_PAGE_SIZE,
              cursor: requestedCursor || undefined,
            });
        loadedTaskScopeRef.current = taskScopeKey;
        setProjectTasks((current) => ({
          tasks: append ? [...current.tasks, ...page.tasks] : page.tasks,
          next_cursor: page.next_cursor,
        }));
        setProjectTasksError(null);
      } catch (error) {
        if (!append) {
          loadedTaskScopeRef.current = null;
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
    [accessToken, projectId, taskQuery, taskScopeKey],
  );

  useEffect(() => {
    if (!enabled) {
      loadedTaskScopeRef.current = null;
      setProjectTasks({ tasks: [], next_cursor: null });
      setProjectTasksError(null);
      setProjectTasksLoading(false);
      setProjectTasksLoadingMore(false);
      return;
    }
    const shouldLoadTasks = autoload ?? (
      !isTaskScopeLoaded && (activeTab === 'work' || (activeTab === 'overview' && overviewView === 'tasks'))
    );
    if (!shouldLoadTasks) {
      return;
    }
    void loadProjectTaskPage();
  }, [activeTab, autoload, enabled, isTaskScopeLoaded, loadProjectTaskPage, overviewView]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const shouldObserveForMore = autoload ?? (activeTab === 'overview' && overviewView === 'tasks');
    if (
      !shouldObserveForMore
      || !projectTasks.next_cursor
      || projectTasksLoading
      || projectTasksLoadingMore
    ) {
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
  }, [activeTab, autoload, enabled, loadProjectTaskPage, overviewView, projectTasks.next_cursor, projectTasksLoading, projectTasksLoadingMore]);

  return {
    hasTaskRows,
    isTaskScopeLoaded,
    loadProjectTaskPage,
    projectTasksError,
    projectTasksLoading,
    projectTasksLoadingMore,
    projectTasksNextCursor: projectTasks.next_cursor,
    projectTasksSentinelRef,
    tasksOverviewRows: projectTasks.tasks,
  };
};
