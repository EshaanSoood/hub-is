import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';

import {
  addProjectMember,
  createProject,
  deleteProject,
  listProjects,
  removeProjectMember,
  updateProject,
} from '../services/hub/projects';
import { buildDefaultProjectCreatePayload } from '../lib/projectTemplates';
import { notifyProjectListInvalidated } from '../lib/projectListInvalidation';
import { recordRecentProjectContribution } from '../features/recentPlaces/store';
import { listTimeline } from '../services/hub/records';
import type { HubProjectSummary } from '../services/hub/types';

type ProjectTimelineItem = {
  timeline_event_id: string;
  event_type: string;
  primary_entity_type: string;
  primary_entity_id: string;
  summary_json: Record<string, unknown>;
  created_at: string;
};

interface UseProjectMutationsParams {
  accessToken: string;
  projectId: string;
  projectName: string;
  projects: HubProjectSummary[];
  refreshProjectData: () => Promise<void>;
  setProjects: Dispatch<SetStateAction<HubProjectSummary[]>>;
  sessionUserId: string;
  setTimeline: Dispatch<SetStateAction<ProjectTimelineItem[]>>;
}

const compareProjectsBySidebarOrder = (left: HubProjectSummary, right: HubProjectSummary) => {
  const leftPosition = left.position ?? Number.MAX_SAFE_INTEGER;
  const rightPosition = right.position ?? Number.MAX_SAFE_INTEGER;
  if (leftPosition !== rightPosition) {
    return leftPosition - rightPosition;
  }
  return (left.sort_order ?? Number.MAX_SAFE_INTEGER) - (right.sort_order ?? Number.MAX_SAFE_INTEGER);
};

export const useProjectMutations = ({
  accessToken,
  projectId,
  projectName,
  projects,
  refreshProjectData,
  setProjects,
  sessionUserId,
  setTimeline,
}: UseProjectMutationsParams) => {
  const [projectMutationError, setProjectMutationError] = useState<string | null>(null);

  const updateProjectInState = useCallback(
    (nextProject: HubProjectSummary) => {
      setProjects((current) => current.map((project) => (project.project_id === nextProject.project_id ? nextProject : project)));
    },
    [setProjects],
  );

  const onCreateProject = useCallback(
    async (creatingProjectName: string): Promise<HubProjectSummary | null> => {
      const trimmed = creatingProjectName.trim();
      if (!trimmed) {
        setProjectMutationError('Project name is required.');
        return null;
      }

      setProjectMutationError(null);
      try {
        const nextProject = await createProject(
          accessToken,
          projectId,
          buildDefaultProjectCreatePayload({
            existingProjects: projects,
            name: trimmed,
            sessionUserId,
          }),
        );

        setProjects((current) =>
          [...current, nextProject].sort(compareProjectsBySidebarOrder),
        );
        notifyProjectListInvalidated(projectId);
        try {
          await refreshProjectData();
          const nextTimeline = await listTimeline(accessToken, projectId);
          setTimeline(nextTimeline);
          recordRecentProjectContribution({
            projectId: nextProject.project_id,
            projectName: nextProject.name,
            spaceId: projectId,
            spaceName: projectName,
          }, 'project-create');
        } catch (error) {
          setProjectMutationError(
            `Project created, but follow-up refresh failed: ${error instanceof Error ? error.message : 'unknown error'}`,
          );
        }
        return nextProject;
      } catch (error) {
        setProjectMutationError(error instanceof Error ? error.message : 'Failed to create project.');
        return null;
      }
    },
    [accessToken, projects, projectId, projectName, refreshProjectData, sessionUserId, setProjects, setTimeline],
  );

  const onRenameProject = useCallback(
    async (project: HubProjectSummary, nextName: string) => {
      const trimmed = nextName.trim();
      if (!trimmed || trimmed === project.name) {
        return;
      }

      try {
        const updated = await updateProject(accessToken, project.project_id, {
          name: trimmed,
        });
        updateProjectInState(updated);
        const nextTimeline = await listTimeline(accessToken, projectId);
        setTimeline(nextTimeline);
        recordRecentProjectContribution({
          projectId: updated.project_id,
          projectName: updated.name,
          spaceId: projectId,
          spaceName: projectName,
        }, 'project-rename');
      } catch (error) {
        setProjectMutationError(error instanceof Error ? error.message : 'Failed to rename project.');
      }
    },
    [accessToken, projectId, projectName, setTimeline, updateProjectInState],
  );

  const onMoveProject = useCallback(
    async (project: HubProjectSummary, direction: 'up' | 'down') => {
      const ordered = [...projects].sort(
        compareProjectsBySidebarOrder,
      );
      const index = ordered.findIndex((entry) => entry.project_id === project.project_id);
      if (index < 0) {
        return;
      }

      const nextIndex = direction === 'up' ? index - 1 : index + 1;
      if (nextIndex < 0 || nextIndex >= ordered.length) {
        return;
      }

      const target = ordered[nextIndex];
      const originalOrder = project.position ?? project.sort_order;
      const targetOrder = target.position ?? target.sort_order;
      try {
        await updateProject(accessToken, project.project_id, { sort_order: targetOrder, position: targetOrder });
        try {
          await updateProject(accessToken, target.project_id, { sort_order: originalOrder, position: originalOrder });
        } catch (error) {
          try {
            await updateProject(accessToken, project.project_id, { sort_order: originalOrder, position: originalOrder });
          } catch {
            // best-effort rollback
          }
          setProjectMutationError(error instanceof Error ? error.message : 'Failed to reorder projects.');
          return;
        }
      } catch (error) {
        setProjectMutationError(error instanceof Error ? error.message : 'Failed to reorder projects.');
        return;
      } finally {
        try {
          await refreshProjectData();
        } catch (refreshError) {
          console.warn('Project refresh failed after reorder:', refreshError);
        }
      }
    },
    [accessToken, projects, refreshProjectData],
  );

  const onTogglePinned = useCallback(
    async (project: HubProjectSummary) => {
      try {
        const updated = await updateProject(accessToken, project.project_id, { pinned: !project.pinned });
        updateProjectInState(updated);
      } catch (error) {
        setProjectMutationError(error instanceof Error ? error.message : 'Failed to toggle pin state.');
      }
    },
    [accessToken, updateProjectInState],
  );

  const onDeleteProject = useCallback(
    async (project: HubProjectSummary, activeProjectId: string | null): Promise<string | null> => {
      try {
        await deleteProject(accessToken, project.project_id);
        const remaining = projects.filter((entry) => entry.project_id !== project.project_id);
        setProjects(() => remaining);
        notifyProjectListInvalidated(projectId);
        if (activeProjectId === project.project_id) {
          const fallback = remaining[0];
          return fallback
            ? `/projects/${encodeURIComponent(projectId)}/work/${encodeURIComponent(fallback.project_id)}`
            : `/projects/${encodeURIComponent(projectId)}/overview`;
        }
        return null;
      } catch (error) {
        setProjectMutationError(error instanceof Error ? error.message : 'Failed to delete project.');
        return null;
      }
    },
    [accessToken, projects, projectId, setProjects],
  );

  const onToggleProjectMember = useCallback(
    async (project: HubProjectSummary, userId: string) => {
      try {
        const isMember = project.members.some((member) => member.user_id === userId);
        if (isMember) {
          await removeProjectMember(accessToken, project.project_id, userId);
        } else {
          await addProjectMember(accessToken, project.project_id, userId);
        }

        const refreshed = await listProjects(accessToken, projectId);
        setProjects([...refreshed].sort(compareProjectsBySidebarOrder));
      } catch (error) {
        setProjectMutationError(error instanceof Error ? error.message : 'Failed to update project members.');
      }
    },
    [accessToken, projectId, setProjects],
  );

  const onUpdateProjectFromWorkView = useCallback(
    async (
      projectIdToUpdate: string,
      payload: { name?: string; pinned?: boolean; sort_order?: number; position?: number | null; layout_config?: Record<string, unknown> },
    ) => {
      setProjectMutationError(null);
      try {
        const updated = await updateProject(accessToken, projectIdToUpdate, payload);
        updateProjectInState(updated);
        recordRecentProjectContribution({
          projectId: updated.project_id,
          projectName: updated.name,
          spaceId: projectId,
          spaceName: projectName,
        }, 'project-update');
        try {
          const nextTimeline = await listTimeline(accessToken, projectId);
          setTimeline(nextTimeline);
        } catch (error) {
          setProjectMutationError(
            `Project updated, but timeline refresh failed: ${error instanceof Error ? error.message : 'unknown error'}.`,
          );
        }
      } catch (error) {
        setProjectMutationError(error instanceof Error ? error.message : 'Failed to update project.');
      }
    },
    [accessToken, projectId, projectName, setTimeline, updateProjectInState],
  );

  return {
    projectMutationError,
    setProjectMutationError,
    onCreateProject,
    onRenameProject,
    onMoveProject,
    onTogglePinned,
    onDeleteProject,
    onToggleProjectMember,
    onUpdateProjectFromWorkView,
  };
};
