import { hubRequest, normalizeRecordSummary } from './transport.ts';

import type { HubCollectionField, HubRecordSummary, HubView } from './types.ts';

export const listViews = async (accessToken: string, projectId: string): Promise<HubView[]> => {
  const data = await hubRequest<{ views: HubView[] }>(accessToken, `/api/hub/spaces/${encodeURIComponent(projectId)}/views`, {
    method: 'GET',
  });
  return data.views;
};

export const createView = async (
  accessToken: string,
  projectId: string,
  payload: {
    collection_id: string;
    type: string;
    name: string;
    config?: Record<string, unknown>;
    mutation_context_project_id?: string | null;
  },
): Promise<{ view_id: string }> => {
  return hubRequest<{ view_id: string }>(accessToken, `/api/hub/spaces/${encodeURIComponent(projectId)}/views`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const updateView = async (
  accessToken: string,
  viewId: string,
  payload: {
    name?: string;
    config?: Record<string, unknown>;
    mutation_context_project_id?: string | null;
  },
): Promise<{ view: HubView }> => {
  return hubRequest<{ view: HubView }>(accessToken, `/api/hub/views/${encodeURIComponent(viewId)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
};

export const queryView = async (
  accessToken: string,
  payload: { view_id: string; mode?: string; pagination?: { cursor?: string | null; limit?: number } },
): Promise<{
  schema: { collection_id: string; name: string; fields: HubCollectionField[] } | null;
  records: HubRecordSummary[];
  next_cursor: string | null;
  view: HubView;
}> => {
  const data = await hubRequest<{
    schema: { collection_id: string; name: string; fields: HubCollectionField[] } | null;
    records: HubRecordSummary[];
    next_cursor: string | null;
    view: HubView;
  }>(accessToken, '/api/hub/views/query', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return {
    ...data,
    records: data.records.map(normalizeRecordSummary),
  };
};
