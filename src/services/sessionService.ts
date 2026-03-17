import type { SessionSummary } from '../types/domain';
import { readEnvelope } from './hub/transport';
import { buildHubAuthHeaders } from './hubAuthHeaders';

interface MeResponse {
  sessionSummary: SessionSummary;
  dev_auth_mode?: boolean;
}

export interface SessionBootstrap {
  sessionSummary: SessionSummary;
  devAuthMode: boolean;
}

export const fetchSessionSummary = async (accessToken: string): Promise<SessionBootstrap> => {
  const response = await fetch('/api/hub/me', {
    method: 'GET',
    headers: buildHubAuthHeaders(accessToken),
  });

  const data = await readEnvelope<MeResponse>(response);
  return {
    sessionSummary: data.sessionSummary,
    devAuthMode: Boolean(data.dev_auth_mode),
  };
};
