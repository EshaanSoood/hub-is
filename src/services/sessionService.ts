import type { SessionSummary } from '../types/domain';
import { readEnvelope } from './hub/transport';
import { buildHubAuthHeaders } from './hubAuthHeaders';

interface MeResponse {
  sessionSummary: SessionSummary;
  calendar_feed_url?: string;
}

export const fetchSessionSummary = async (accessToken: string): Promise<SessionSummary> => {
  const response = await fetch('/api/hub/me', {
    method: 'GET',
    headers: buildHubAuthHeaders(accessToken),
  });

  const data = await readEnvelope<MeResponse>(response);
  return {
    ...data.sessionSummary,
    calendarFeedUrl: data.calendar_feed_url ?? data.sessionSummary.calendarFeedUrl ?? '',
  };
};
