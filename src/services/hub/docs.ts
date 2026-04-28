import { hubRequest } from './transport.ts';
import type { HubProjectDoc } from './types.ts';

export const getDocSnapshot = async (
  accessToken: string,
  docId: string,
): Promise<{ doc_id: string; project_id: string; snapshot_version: number; snapshot_payload: Record<string, unknown>; updated_at: string }> => {
  const data = await hubRequest<{
    doc: {
      doc_id: string;
      project_id: string;
      title?: string;
      position?: number;
      snapshot_version: number;
      snapshot_payload: Record<string, unknown>;
      updated_at: string;
    };
  }>(accessToken, `/api/hub/docs/${encodeURIComponent(docId)}`, {
    method: 'GET',
  });
  return data.doc;
};

export const createProjectDoc = async (
  accessToken: string,
  projectId: string,
  title: string,
): Promise<HubProjectDoc> => {
  const data = await hubRequest<{ doc: HubProjectDoc }>(accessToken, `/api/hub/projects/${encodeURIComponent(projectId)}/docs`, {
    method: 'POST',
    body: JSON.stringify({ title }),
  });
  return data.doc;
};

export const updateProjectDoc = async (
  accessToken: string,
  docId: string,
  patch: { title?: string; position?: number },
): Promise<HubProjectDoc> => {
  const data = await hubRequest<{ doc: HubProjectDoc }>(accessToken, `/api/hub/docs/${encodeURIComponent(docId)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  return data.doc;
};

export const deleteProjectDoc = async (
  accessToken: string,
  docId: string,
): Promise<{ deleted: boolean; doc_id: string; docs: HubProjectDoc[] }> => {
  return hubRequest<{ deleted: boolean; doc_id: string; docs: HubProjectDoc[] }>(accessToken, `/api/hub/docs/${encodeURIComponent(docId)}`, {
    method: 'DELETE',
  });
};

export const saveDocSnapshot = async (
  accessToken: string,
  docId: string,
  payload: { snapshot_version?: number; snapshot_payload: Record<string, unknown> },
): Promise<{ doc_id: string; snapshot_version: number }> => {
  return hubRequest<{ doc_id: string; snapshot_version: number }>(accessToken, `/api/hub/docs/${encodeURIComponent(docId)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
};

export const postDocPresence = async (
  accessToken: string,
  docId: string,
  cursorPayload: Record<string, unknown>,
): Promise<void> => {
  await hubRequest<{ updated: boolean }>(accessToken, `/api/hub/docs/${encodeURIComponent(docId)}/presence`, {
    method: 'POST',
    body: JSON.stringify({ cursor_payload: cursorPayload }),
  });
};
