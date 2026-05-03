import { useCallback, useEffect, useState } from 'react';
import { listProjects } from '../services/hub/projects';
import type { HubProjectSummary } from '../services/hub/types';
import { subscribeToProjectListInvalidation } from '../lib/projectListInvalidation';

interface ProjectProjectsState {
  error: unknown;
  loading: boolean;
  projects: HubProjectSummary[];
  projectId: string | null;
}

interface UseProjectProjectsResult {
  error: unknown;
  loading: boolean;
  projects: HubProjectSummary[];
  refetch: () => void;
}

export const useProjectProjects = (
  accessToken: string | null | undefined,
  projectId: string | null,
): UseProjectProjectsResult => {
  const [state, setState] = useState<ProjectProjectsState>({
    error: null,
    loading: false,
    projects: [],
    projectId: null,
  });
  const [requestVersion, setRequestVersion] = useState(0);

  const refetch = useCallback(() => {
    if (!accessToken || !projectId) {
      return;
    }
    setState((current) => ({
      ...current,
      error: null,
      loading: true,
      projectId,
    }));
    setRequestVersion((current) => current + 1);
  }, [accessToken, projectId]);

  useEffect(() => {
    if (!accessToken || !projectId) {
      return;
    }

    let cancelled = false;

    void listProjects(accessToken, projectId)
      .then((projects) => {
        if (!cancelled) {
          setState({
            error: null,
            loading: false,
            projects,
            projectId,
          });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setState((current) => ({
            ...current,
            error,
            loading: false,
            projectId,
          }));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken, projectId, requestVersion]);

  useEffect(() => subscribeToProjectListInvalidation(projectId, refetch), [projectId, refetch]);

  return {
    error: accessToken && projectId && state.projectId === projectId ? state.error : null,
    loading: accessToken && projectId ? state.projectId !== projectId || state.loading : false,
    projects: accessToken && projectId ? state.projects : [],
    refetch,
  };
};
