import { buildHubAuthHeaders } from '../hubAuthHeaders.ts';
import { HubEnvelopeUnknownSchema } from './schemas';

import type { HubEnvelope, HubLiveAuthorization, HubRecordDetail, HubRecordSummary, HubSourcePaneContext } from './types.ts';

const authHeaders = (accessToken: string, hasBody = false): Headers => buildHubAuthHeaders(accessToken, hasBody);

export class HubRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'HubRequestError';
    this.status = status;
    Object.setPrototypeOf(this, HubRequestError.prototype);
  }
}

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

const readHubEnvelopeJson = async (response: Response): Promise<HubEnvelope<unknown>> => {
  const body = await response.json().catch(() => null);
  const parsedEnvelope = HubEnvelopeUnknownSchema.safeParse(body);
  if (!parsedEnvelope.success) {
    throw new HubRequestError(`Invalid API response envelope (${response.status}).`, response.status);
  }
  return parsedEnvelope.data;
};

const parseHubEnvelope = <T>(response: Response, envelope: HubEnvelope<unknown>): T => {
  if (!response.ok || !envelope.ok || envelope.data == null) {
    throw new HubRequestError(envelope.error?.message || `Request failed (${response.status}).`, response.status);
  }

  return envelope.data as T;
};

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

  return parseHubEnvelope(response, await readHubEnvelopeJson(response));
};

export const authorizeHubLive = async (accessToken: string): Promise<HubLiveAuthorization> => {
  const data = await hubRequest<{ authorization: HubLiveAuthorization }>(accessToken, '/api/hub/live/authorize', {
    method: 'GET',
  });
  return data.authorization;
};

export const readEnvelope = async <T>(response: Response): Promise<T> => {
  return parseHubEnvelope(response, await readHubEnvelopeJson(response));
};
