import { hubRequest } from './transport.ts';

import type { HubTrackedFile } from './types.ts';

export const uploadFile = async (
  accessToken: string,
  payload: {
    project_id: string;
    name: string;
    mime_type?: string;
    content_base64: string;
    asset_root_id?: string;
    path?: string;
    mutation_context_pane_id?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<{
  file: {
    file_id: string;
    project_id: string;
    asset_root_id: string;
    provider: string;
    asset_path: string;
    name: string;
    mime_type: string;
    size_bytes: number;
    metadata?: Record<string, unknown>;
    proxy_url: string;
  };
}> => {
  return hubRequest<{
    file: {
      file_id: string;
      project_id: string;
      asset_root_id: string;
      provider: string;
      asset_path: string;
      name: string;
      mime_type: string;
      size_bytes: number;
      metadata?: Record<string, unknown>;
      proxy_url: string;
    };
  }>(accessToken, '/api/hub/files/upload', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const listTrackedFiles = async (
  accessToken: string,
  projectId: string,
  options?: { scope?: 'all' | 'project' } | { scope: 'pane'; pane_id: string },
): Promise<HubTrackedFile[]> => {
  const params = new URLSearchParams();
  if (options?.scope) {
    params.set('scope', options.scope);
  }
  if (options?.scope === 'pane') {
    params.set('pane_id', options.pane_id);
  }
  const query = params.toString();
  const data = await hubRequest<{ files: HubTrackedFile[] }>(
    accessToken,
    `/api/hub/projects/${encodeURIComponent(projectId)}/files${query ? `?${query}` : ''}`,
    { method: 'GET' },
  );
  return data.files;
};

export const listAssetRoots = async (
  accessToken: string,
  projectId: string,
): Promise<
  Array<{
    asset_root_id: string;
    project_id: string;
    provider: string;
    root_path: string;
    connection_ref: Record<string, unknown> | null;
    created_at: string;
    updated_at: string;
  }>
> => {
  const data = await hubRequest<{
    asset_roots: Array<{
      asset_root_id: string;
      project_id: string;
      provider: string;
      root_path: string;
      connection_ref: Record<string, unknown> | null;
      created_at: string;
      updated_at: string;
    }>;
  }>(accessToken, `/api/hub/projects/${encodeURIComponent(projectId)}/asset-roots`, {
    method: 'GET',
  });
  return data.asset_roots;
};

export const createAssetRoot = async (
  accessToken: string,
  projectId: string,
  payload: { provider?: string; root_path: string; connection_ref?: Record<string, unknown> },
): Promise<{ asset_root_id: string }> => {
  return hubRequest<{ asset_root_id: string }>(accessToken, `/api/hub/projects/${encodeURIComponent(projectId)}/asset-roots`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const listAssets = async (
  accessToken: string,
  projectId: string,
  assetRootId: string,
  path: string,
): Promise<{ provider: string; path: string; entries: Array<{ name: string; path: string; proxy_url?: string }>; warning?: string }> => {
  const params = new URLSearchParams();
  params.set('asset_root_id', assetRootId);
  params.set('path', path);
  return hubRequest<{ provider: string; path: string; entries: Array<{ name: string; path: string; proxy_url?: string }>; warning?: string }>(
    accessToken,
    `/api/hub/projects/${encodeURIComponent(projectId)}/assets/list?${params.toString()}`,
    {
      method: 'GET',
    },
  );
};
