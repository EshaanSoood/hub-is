import { hubRequest } from './transport';

import type { HubProject, HubProjectInvite, HubProjectMember } from './types';

export const listProjects = async (accessToken: string): Promise<HubProject[]> => {
  const data = await hubRequest<{ projects: HubProject[] }>(accessToken, '/api/hub/projects', {
    method: 'GET',
  });
  return data.projects;
};

export const createProject = async (
  accessToken: string,
  payload: { name: string; project_id?: string },
): Promise<HubProject> => {
  const data = await hubRequest<{ project: HubProject }>(accessToken, '/api/hub/projects', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return data.project;
};

export const getProject = async (accessToken: string, projectId: string): Promise<HubProject> => {
  const data = await hubRequest<{ project: HubProject }>(accessToken, `/api/hub/projects/${encodeURIComponent(projectId)}`, {
    method: 'GET',
  });
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
