import { hubRequest } from './transport.ts';
import type {
  CreateProjectRequest,
  CreateProjectResponse,
  GetProjectResponse,
  ListProjectsResponse,
  ProjectSummary,
} from '../../shared/api-types';

import type { HubProjectInvite, HubProjectMember } from './types.ts';

export const listProjects = async (accessToken: string): Promise<ProjectSummary[]> => {
  const data = await hubRequest<ListProjectsResponse>(accessToken, '/api/hub/projects', {
    method: 'GET',
  });
  return data.projects;
};

export const createProject = async (
  accessToken: string,
  payload: CreateProjectRequest,
): Promise<ProjectSummary> => {
  const data = await hubRequest<CreateProjectResponse>(accessToken, '/api/hub/projects', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return data.project;
};

export const getProject = async (accessToken: string, projectId: string): Promise<ProjectSummary> => {
  const data = await hubRequest<GetProjectResponse>(accessToken, `/api/hub/projects/${encodeURIComponent(projectId)}`, {
    method: 'GET',
  });
  return data.project;
};

export const updateProject = async (
  accessToken: string,
  projectId: string,
  payload: { name?: string; position?: number | null },
): Promise<ProjectSummary> => {
  const data = await hubRequest<{ project: ProjectSummary }>(
    accessToken,
    `/api/hub/projects/${encodeURIComponent(projectId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
  );
  return data.project;
};

export const listProjectMembers = async (accessToken: string, projectId: string): Promise<HubProjectMember[]> => {
  const data = await hubRequest<{ members: HubProjectMember[] }>(
    accessToken,
    `/api/hub/projects/${encodeURIComponent(projectId)}/members`,
    { method: 'GET' },
  );
  return data.members;
};

export const addProjectMember = async (
  accessToken: string,
  projectId: string,
  payload: { user_id?: string; email?: string; display_name?: string; role?: string },
): Promise<{ project_id: string; user_id: string; role: string }> => {
  return hubRequest<{ project_id: string; user_id: string; role: string }>(
    accessToken,
    `/api/hub/projects/${encodeURIComponent(projectId)}/members`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
};

export const createProjectInvite = async (
  accessToken: string,
  projectId: string,
  payload: { email: string; role?: string },
): Promise<HubProjectInvite> => {
  const data = await hubRequest<{ pending_invite: HubProjectInvite }>(accessToken, `/api/hub/projects/${encodeURIComponent(projectId)}/invites`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return data.pending_invite;
};

export const removeProjectMember = async (accessToken: string, projectId: string, userId: string): Promise<void> => {
  await hubRequest<{ removed: boolean }>(
    accessToken,
    `/api/hub/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(userId)}`,
    {
      method: 'DELETE',
    },
  );
};
