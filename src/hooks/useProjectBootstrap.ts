import { useCallback, useEffect, useRef, useState } from 'react';
import { getProject, listProjectMembers } from '../services/hub/projects';
import { listPanes } from '../services/hub/panes';
import { listTimeline } from '../services/hub/records';
import type { HubPaneSummary, HubProject, HubProjectMember } from '../services/hub/types';
import { useProjects } from '../context/ProjectsContext';

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

export const useProjectBootstrap = ({ accessToken, projectId }: UseProjectBootstrapParams) => {
  const { refreshProjects } = useProjects();
  const [project, setProject] = useState<HubProject | null>(null);
  const [panes, setPanes] = useState<HubPaneSummary[]>([]);
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

    const [nextProject, nextPanes, nextTimeline, nextMembersResult] = await Promise.all([
      getProject(accessToken, projectId),
      listPanes(accessToken, projectId),
      listTimeline(accessToken, projectId),
      listProjectMembers(accessToken, projectId)
        .then((members) => ({ members, error: null as string | null }))
        .catch((membersError) => ({
          members: [] as HubProjectMember[],
          error: membersError instanceof Error ? membersError.message : 'Failed to load project members.',
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
    setPanes(nextPanes.sort((a, b) => a.sort_order - b.sort_order));
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
      setPanes([]);
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
          setError(loadError instanceof Error ? loadError.message : 'Failed to load project space.');
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

  return {
    error,
    loading,
    panes,
    project,
    projectMembers,
    refreshProjectData,
    setPanes,
    setTimeline,
    timeline,
  };
};
