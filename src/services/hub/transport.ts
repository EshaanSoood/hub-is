import { buildHubAuthHeaders } from '../hubAuthHeaders.ts';

import type { HubEnvelope, HubLiveAuthorization, HubRecordDetail, HubRecordSummary, HubSourcePaneContext } from './types.ts';

const authHeaders = (accessToken: string, hasBody = false): Headers => buildHubAuthHeaders(accessToken, hasBody);

const ensureData = <T>(envelope: HubEnvelope<T>, fallbackMessage: string): T => {
  if (!envelope.ok || envelope.data === null) {
    throw new Error(envelope.error?.message || fallbackMessage);
  }
  return envelope.data;
};

// Normalize source-pane payloads once so the rest of the client only deals with a value or null.
export const normalizeSourcePane = (sourcePane: HubSourcePaneContext | null | undefined): HubSourcePaneContext | null => {
  if (!sourcePane) {
    return null;
  }
  return {
    pane_id: sourcePane.pane_id ?? null,
    pane_name: sourcePane.pane_name ?? null,
    doc_id: sourcePane.doc_id ?? null,
  };
};

export const normalizeRecordSummary = (record: HubRecordSummary): HubRecordSummary => ({
  ...record,
  source_pane: normalizeSourcePane(record.source_pane),
});

export const normalizeRecordDetail = (record: HubRecordDetail): HubRecordDetail => ({
  ...record,
  source_pane: normalizeSourcePane(record.source_pane),
});

export const hubRequest = async <T>(
  accessToken: string,
  path: string,
  init?: RequestInit,
): Promise<T> => {
  const hasBody = init?.body !== undefined;
  const headers = new Headers(authHeaders(accessToken, hasBody));
  if (init?.headers) {
    const inputHeaders = new Headers(init.headers);
    inputHeaders.forEach((value, key) => {
      headers.set(key, value);
    });
  }
  const response = await fetch(path, {
    ...init,
    headers,
  });

  const envelope = (await response.json().catch(() => null)) as HubEnvelope<T> | null;
  if (!envelope || typeof envelope.ok !== 'boolean') {
    throw new Error(`Unexpected API response (${response.status}).`);
  }

  if (!response.ok || !envelope.ok || envelope.data === null) {
    throw new Error(envelope.error?.message || `Request failed (${response.status}).`);
  }

  return envelope.data;
};

export const authorizeHubLive = async (accessToken: string): Promise<HubLiveAuthorization> => {
  const data = await hubRequest<{ authorization: HubLiveAuthorization }>(accessToken, '/api/hub/live/authorize', {
    method: 'GET',
  });
  return data.authorization;
};

export const readEnvelope = async <T>(response: Response): Promise<T> => {
  const envelope = (await response.json().catch(() => null)) as HubEnvelope<T> | null;
  if (!envelope || typeof envelope.ok !== 'boolean') {
    throw new Error(`Unexpected API response (${response.status}).`);
  }
  if (!response.ok) {
    throw new Error(envelope.error?.message || `Request failed (${response.status}).`);
  }
  return ensureData(envelope, `Request failed (${response.status}).`);
};
