import { useCallback, useEffect, useRef, useState } from 'react';
import { listProjects } from '../services/hub/projects';
import { getSpace, listSpaceMembers } from '../services/hub/spaces';
import { listTimeline } from '../services/hub/records';
import type { HubProjectSummary, HubProject, HubProjectMember } from '../services/hub/types';
import { useProjects } from '../context/ProjectsContext';
import { subscribeToProjectListInvalidation } from '../lib/projectListInvalidation';

const LAST_PROJECT_KEY = 'hub:last-opened-project-id';

type ProjectTimelineEvent = {
  timeline_event_id: string;
  event_type: string;
  primary_entity_type: string;
  primary_entity_id: string;
  summary_json: Record<string, unknown>;
  created_at: string;
};

interface UseProjectBootstrapParams {
  accessToken: string | null | undefined;
  projectId: string;
}

const compareProjectsBySidebarOrder = (left: HubProjectSummary, right: HubProjectSummary) => {
  const leftPosition = left.position ?? Number.MAX_SAFE_INTEGER;
  const rightPosition = right.position ?? Number.MAX_SAFE_INTEGER;
  if (leftPosition !== rightPosition) {
    return leftPosition - rightPosition;
  }
  return (left.sort_order ?? Number.MAX_SAFE_INTEGER) - (right.sort_order ?? Number.MAX_SAFE_INTEGER);
};

export const useProjectBootstrap = ({ accessToken, projectId }: UseProjectBootstrapParams) => {
  const { refreshProjects } = useProjects();
  const [project, setProject] = useState<HubProject | null>(null);
  const [projects, setProjects] = useState<HubProjectSummary[]>([]);
  const [projectMembers, setProjectMembers] = useState<HubProjectMember[]>([]);
  const [timeline, setTimeline] = useState<ProjectTimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const latestAccessTokenRef = useRef(accessToken);
  const latestProjectIdRef = useRef(projectId);
  const latestRefreshRequestRef = useRef(0);
  const refreshProjectsRef = useRef(refreshProjects);
  latestAccessTokenRef.current = accessToken;
  latestProjectIdRef.current = projectId;
  refreshProjectsRef.current = refreshProjects;

  const refreshProjectData = useCallback(async () => {
    if (!accessToken || !projectId) {
      return;
    }
    const requestId = ++latestRefreshRequestRef.current;
    const requestAccessToken = accessToken;
    const requestProjectId = projectId;

    const [nextProject, nextProjects, nextTimeline, nextMembersResult] = await Promise.all([
      getSpace(accessToken, projectId),
      listProjects(accessToken, projectId),
      listTimeline(accessToken, projectId),
      listSpaceMembers(accessToken, projectId)
        .then((members) => ({ members, error: null as string | null }))
        .catch((membersError) => ({
          members: [] as HubProjectMember[],
          error: membersError instanceof Error ? membersError.message : 'Failed to load space members.',
        })),
    ]);

    if (
      latestAccessTokenRef.current !== requestAccessToken ||
      latestProjectIdRef.current !== requestProjectId ||
      requestId !== latestRefreshRequestRef.current
    ) {
      return;
    }

    setProject(nextProject);
    setProjects(nextProjects.sort(compareProjectsBySidebarOrder));
    setProjectMembers(nextMembersResult.members);
    setTimeline(nextTimeline);

    if (nextMembersResult.error) {
      console.warn('Project members unavailable:', nextMembersResult.error);
    }
  }, [accessToken, projectId]);

  useEffect(() => {
    if (!accessToken || !projectId) {
      setError(null);
      setProject(null);
      setProjects([]);
      setProjectMembers([]);
      setTimeline([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        await refreshProjectData();
        if (!cancelled) {
          window.localStorage.setItem(LAST_PROJECT_KEY, projectId);
          try {
            await refreshProjectsRef.current();
          } catch (refreshError) {
            console.warn('Projects refresh failed after project bootstrap:', refreshError);
          }
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load space.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [accessToken, projectId, refreshProjectData]);

  useEffect(() => (
    subscribeToProjectListInvalidation(projectId, () => {
      void refreshProjectData();
    })
  ), [projectId, refreshProjectData]);

  return {
    error,
    loading,
    projects,
    project,
    projectMembers,
    refreshProjectData,
    setProjects,
    setTimeline,
    timeline,
  };
};
