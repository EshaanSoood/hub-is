import { hubRequest } from './transport.ts';
import type {
  CreateSpaceRequest,
  CreateSpaceResponse,
  GetSpaceResponse,
  ListSpacesResponse,
  SpaceSummary,
} from '../../shared/api-types';

import type { HubProjectInvite, HubProjectMember, HubProjectAccessSummary } from './types.ts';

export const listSpaces = async (accessToken: string): Promise<SpaceSummary[]> => {
  const data = await hubRequest<ListSpacesResponse>(accessToken, '/api/hub/spaces', {
    method: 'GET',
  });
  return data.spaces;
};

export const createSpace = async (
  accessToken: string,
  payload: CreateSpaceRequest,
): Promise<SpaceSummary> => {
  const data = await hubRequest<CreateSpaceResponse>(accessToken, '/api/hub/spaces', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return data.space;
};

export const getSpace = async (accessToken: string, spaceId: string): Promise<SpaceSummary> => {
  const data = await hubRequest<GetSpaceResponse>(accessToken, `/api/hub/spaces/${encodeURIComponent(spaceId)}`, {
    method: 'GET',
  });
  return data.space;
};

export const updateSpace = async (
  accessToken: string,
  spaceId: string,
  payload: { name?: string; position?: number | null },
): Promise<SpaceSummary> => {
  const data = await hubRequest<{ space: SpaceSummary }>(
    accessToken,
    `/api/hub/spaces/${encodeURIComponent(spaceId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
  );
  return data.space;
};

export const listSpaceMembers = async (accessToken: string, spaceId: string): Promise<HubProjectMember[]> => {
  const data = await hubRequest<{ members: HubProjectMember[] }>(
    accessToken,
    `/api/hub/spaces/${encodeURIComponent(spaceId)}/members`,
    { method: 'GET' },
  );
  return data.members;
};

export const addSpaceMember = async (
  accessToken: string,
  spaceId: string,
  payload: { user_id?: string; email?: string; display_name?: string; role?: string },
): Promise<{ space_id: string; user_id: string; role: string }> => {
  return hubRequest<{ space_id: string; user_id: string; role: string }>(
    accessToken,
    `/api/hub/spaces/${encodeURIComponent(spaceId)}/members`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
};

export const createSpaceInvite = async (
  accessToken: string,
  spaceId: string,
  payload: { email: string; role?: string; project_ids?: string[]; expires_after_days?: number },
): Promise<HubProjectInvite> => {
  const data = await hubRequest<{ pending_invite: HubProjectInvite }>(accessToken, `/api/hub/spaces/${encodeURIComponent(spaceId)}/invites`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return data.pending_invite;
};

export const removeSpaceMember = async (accessToken: string, spaceId: string, userId: string): Promise<void> => {
  await hubRequest<{ removed: boolean }>(
    accessToken,
    `/api/hub/spaces/${encodeURIComponent(spaceId)}/members/${encodeURIComponent(userId)}`,
    {
      method: 'DELETE',
    },
  );
};

export const updateSpaceMember = async (
  accessToken: string,
  spaceId: string,
  userId: string,
  payload: { role?: string; expires_at?: string | null },
): Promise<HubProjectMember> => {
  const data = await hubRequest<{ member: HubProjectMember }>(
    accessToken,
    `/api/hub/spaces/${encodeURIComponent(spaceId)}/members/${encodeURIComponent(userId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
  );
  return data.member;
};

export const addSpaceMemberProjectAccess = async (
  accessToken: string,
  spaceId: string,
  userId: string,
  projectId: string,
): Promise<HubProjectAccessSummary> => {
  const data = await hubRequest<{ project_access: HubProjectAccessSummary }>(
    accessToken,
    `/api/hub/spaces/${encodeURIComponent(spaceId)}/members/${encodeURIComponent(userId)}/project-access`,
    {
      method: 'POST',
      body: JSON.stringify({ project_id: projectId }),
    },
  );
  return data.project_access;
};
