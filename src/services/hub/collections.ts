import { hubRequest } from './transport';

import type { HubCollection, HubCollectionField } from './types';

export const listCollections = async (accessToken: string, projectId: string): Promise<HubCollection[]> => {
  const data = await hubRequest<{ collections: HubCollection[] }>(
    accessToken,
    `/api/hub/projects/${encodeURIComponent(projectId)}/collections`,
    {
      method: 'GET',
    },
  );
  return data.collections;
};

export const createCollection = async (
  accessToken: string,
  projectId: string,
  payload: { name: string; icon?: string; color?: string },
): Promise<{ collection_id: string }> => {
  return hubRequest<{ collection_id: string }>(accessToken, `/api/hub/projects/${encodeURIComponent(projectId)}/collections`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const listCollectionFields = async (accessToken: string, collectionId: string): Promise<HubCollectionField[]> => {
  const data = await hubRequest<{ fields: HubCollectionField[] }>(
    accessToken,
    `/api/hub/collections/${encodeURIComponent(collectionId)}/fields`,
    {
      method: 'GET',
    },
  );
  return data.fields;
};

export const createCollectionField = async (
  accessToken: string,
  collectionId: string,
  payload: { name: string; type: string; config?: Record<string, unknown>; sort_order?: number },
): Promise<{ field_id: string }> => {
  return hubRequest<{ field_id: string }>(accessToken, `/api/hub/collections/${encodeURIComponent(collectionId)}/fields`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};
