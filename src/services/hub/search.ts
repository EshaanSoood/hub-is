import { hubRequest } from './transport';

export interface HubSearchResult {
  type: 'record' | 'project' | 'pane';
  id: string;
  title: string;
  project_id: string | null;
  project_name: string | null;
  content_type?: string;
}

export const searchHub = async (
  accessToken: string,
  query: string,
  options?: { limit?: number; type?: 'record' | 'project' | 'pane' },
): Promise<{ query: string; results: HubSearchResult[] }> => {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    return { query: normalizedQuery, results: [] };
  }

  const params = new URLSearchParams();
  params.set('q', normalizedQuery);
  if (options?.limit) {
    params.set('limit', String(options.limit));
  }
  if (options?.type) {
    params.set('type', options.type);
  }

  return hubRequest<{ query: string; results: HubSearchResult[] }>(
    accessToken,
    `/api/hub/search?${params.toString()}`,
    { method: 'GET' },
  );
};
