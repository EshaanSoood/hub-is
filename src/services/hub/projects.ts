import { hubRequest } from './transport.ts';

import type { HubProjectSummary } from './types.ts';

export const listProjects = async (accessToken: string, spaceId: string): Promise<HubProjectSummary[]> => {
  const data = await hubRequest<{ projects: HubProjectSummary[] }>(
    accessToken,
    `/api/hub/spaces/${encodeURIComponent(spaceId)}/projects`,
    {
      method: 'GET',
    },
  );
  return data.projects;
};

export const createProject = async (
  accessToken: string,
  spaceId: string,
  payload: {
    name: string;
    sort_order?: number;
    position?: number | null;
    pinned?: boolean;
    layout_config?: Record<string, unknown>;
    member_user_ids?: string[];
  },
): Promise<HubProjectSummary> => {
  const data = await hubRequest<{ project: HubProjectSummary }>(
    accessToken,
    `/api/hub/spaces/${encodeURIComponent(spaceId)}/projects`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
  return data.project;
};

export const updateProject = async (
  accessToken: string,
  projectId: string,
  payload: { name?: string; sort_order?: number; position?: number | null; pinned?: boolean; layout_config?: Record<string, unknown> },
): Promise<HubProjectSummary> => {
  const data = await hubRequest<{ project: HubProjectSummary }>(accessToken, `/api/hub/projects/${encodeURIComponent(projectId)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return data.project;
};

export const deleteProject = async (accessToken: string, projectId: string): Promise<void> => {
  await hubRequest<{ deleted: boolean }>(accessToken, `/api/hub/projects/${encodeURIComponent(projectId)}`, {
    method: 'DELETE',
  });
};

export const addProjectMember = async (accessToken: string, projectId: string, userId: string): Promise<HubProjectSummary> => {
  const data = await hubRequest<{ project: HubProjectSummary }>(accessToken, `/api/hub/projects/${encodeURIComponent(projectId)}/members`, {
    method: 'POST',
    body: JSON.stringify({ user_id: userId }),
  });
  return data.project;
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
