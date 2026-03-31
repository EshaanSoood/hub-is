import type { SessionSummary } from '../types/domain';
import { readEnvelope } from './hub/transport';
import { buildHubAuthHeaders } from './hubAuthHeaders';

interface MeResponse {
  sessionSummary: SessionSummary;
}

interface CalendarFeedTokenResponse {
  token: string;
}

export const fetchSessionSummary = async (accessToken: string): Promise<SessionSummary> => {
  const response = await fetch('/api/hub/me', {
    method: 'GET',
    headers: buildHubAuthHeaders(accessToken),
  });

  const data = await readEnvelope<MeResponse>(response);
  return data.sessionSummary;
};

export const ensureCalendarFeedToken = async (accessToken: string): Promise<string> => {
  const response = await fetch('/api/hub/calendar-feed-token', {
    method: 'GET',
    headers: buildHubAuthHeaders(accessToken),
  });

  const data = await readEnvelope<CalendarFeedTokenResponse>(response);
  return data.token;
};
