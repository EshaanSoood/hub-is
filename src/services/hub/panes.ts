import { hubRequest } from './transport';

import type { HubPaneSummary } from './types';

export const listPanes = async (accessToken: string, projectId: string): Promise<HubPaneSummary[]> => {
  const data = await hubRequest<{ panes: HubPaneSummary[] }>(
    accessToken,
    `/api/hub/projects/${encodeURIComponent(projectId)}/panes`,
    {
      method: 'GET',
    },
  );
  return data.panes;
};

export const createPane = async (
  accessToken: string,
  projectId: string,
  payload: {
    name: string;
    sort_order?: number;
    pinned?: boolean;
    layout_config?: Record<string, unknown>;
    member_user_ids?: string[];
  },
): Promise<HubPaneSummary> => {
  const data = await hubRequest<{ pane: HubPaneSummary }>(
    accessToken,
    `/api/hub/projects/${encodeURIComponent(projectId)}/panes`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
  return data.pane;
};

export const updatePane = async (
  accessToken: string,
  paneId: string,
  payload: { name?: string; sort_order?: number; pinned?: boolean; layout_config?: Record<string, unknown> },
): Promise<HubPaneSummary> => {
  const data = await hubRequest<{ pane: HubPaneSummary }>(accessToken, `/api/hub/panes/${encodeURIComponent(paneId)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return data.pane;
};

export const deletePane = async (accessToken: string, paneId: string): Promise<void> => {
  await hubRequest<{ deleted: boolean }>(accessToken, `/api/hub/panes/${encodeURIComponent(paneId)}`, {
    method: 'DELETE',
  });
};

export const addPaneMember = async (accessToken: string, paneId: string, userId: string): Promise<HubPaneSummary> => {
  const data = await hubRequest<{ pane: HubPaneSummary }>(accessToken, `/api/hub/panes/${encodeURIComponent(paneId)}/members`, {
    method: 'POST',
    body: JSON.stringify({ user_id: userId }),
  });
  return data.pane;
};

export const removePaneMember = async (accessToken: string, paneId: string, userId: string): Promise<void> => {
  await hubRequest<{ removed: boolean }>(
    accessToken,
    `/api/hub/panes/${encodeURIComponent(paneId)}/members/${encodeURIComponent(userId)}`,
    {
      method: 'DELETE',
    },
  );
};
