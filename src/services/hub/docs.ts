import { hubRequest } from './transport.ts';

export const getDocSnapshot = async (
  accessToken: string,
  docId: string,
): Promise<{ doc_id: string; pane_id: string; snapshot_version: number; snapshot_payload: Record<string, unknown>; updated_at: string }> => {
  const data = await hubRequest<{
    doc: { doc_id: string; pane_id: string; snapshot_version: number; snapshot_payload: Record<string, unknown>; updated_at: string };
  }>(accessToken, `/api/hub/docs/${encodeURIComponent(docId)}`, {
    method: 'GET',
  });
  return data.doc;
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
