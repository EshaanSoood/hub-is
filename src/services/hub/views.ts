import { hubRequest, normalizeRecordSummary } from './transport';

import type { HubCollectionField, HubRecordSummary, HubView } from './types';

export const listViews = async (accessToken: string, projectId: string): Promise<HubView[]> => {
  const data = await hubRequest<{ views: HubView[] }>(accessToken, `/api/hub/projects/${encodeURIComponent(projectId)}/views`, {
    method: 'GET',
  });
  return data.views;
};

export const createView = async (
  accessToken: string,
  projectId: string,
  payload: { collection_id: string; type: string; name: string; config?: Record<string, unknown> },
): Promise<{ view_id: string }> => {
  return hubRequest<{ view_id: string }>(accessToken, `/api/hub/projects/${encodeURIComponent(projectId)}/views`, {
    method: 'POST',
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
