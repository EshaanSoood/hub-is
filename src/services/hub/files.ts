import { hubRequest } from './transport.ts';

import type { HubTrackedFile } from './types.ts';

export const uploadFile = async (
  accessToken: string,
  payload: {
    space_id?: string;
    project_id?: string;
    name: string;
    mime_type?: string;
    content_base64: string;
    asset_root_id?: string;
    path?: string;
    mutation_context_project_id?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<{
  file: {
    file_id: string;
    space_id: string;
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
  const { project_id: legacyProjectId, ...requestPayload } = payload;
  const body = {
    ...requestPayload,
    space_id: payload.space_id ?? legacyProjectId,
    mutation_context_project_id: payload.mutation_context_project_id,
  };
  return hubRequest<{
    file: {
      file_id: string;
      space_id: string;
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
    body: JSON.stringify(body),
  });
};

export const listTrackedFiles = async (
  accessToken: string,
  spaceId: string,
  options?: { scope?: 'all' | 'space' } | { scope: 'project'; project_id: string },
): Promise<HubTrackedFile[]> => {
  const params = new URLSearchParams();
  if (options?.scope) {
    params.set('scope', options.scope);
  }
  if (options?.scope === 'project') {
    params.set('project_id', options.project_id);
  }
  const query = params.toString();
  const data = await hubRequest<{ files: HubTrackedFile[] }>(
    accessToken,
    `/api/hub/spaces/${encodeURIComponent(spaceId)}/files${query ? `?${query}` : ''}`,
    { method: 'GET' },
  );
  return data.files;
};

export const listAssetRoots = async (
  accessToken: string,
  spaceId: string,
): Promise<
  Array<{
    asset_root_id: string;
    space_id: string;
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
      space_id: string;
      provider: string;
      root_path: string;
      connection_ref: Record<string, unknown> | null;
      created_at: string;
      updated_at: string;
    }>;
  }>(accessToken, `/api/hub/spaces/${encodeURIComponent(spaceId)}/asset-roots`, {
    method: 'GET',
  });
  return data.asset_roots;
};

export const createAssetRoot = async (
  accessToken: string,
  spaceId: string,
  payload: { provider?: string; root_path: string; connection_ref?: Record<string, unknown> },
): Promise<{ asset_root_id: string }> => {
  return hubRequest<{ asset_root_id: string }>(accessToken, `/api/hub/spaces/${encodeURIComponent(spaceId)}/asset-roots`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const listAssets = async (
  accessToken: string,
  spaceId: string,
  assetRootId: string,
  path: string,
): Promise<{ provider: string; path: string; entries: Array<{ name: string; path: string; proxy_url?: string }>; warning?: string }> => {
  const params = new URLSearchParams();
  params.set('asset_root_id', assetRootId);
  params.set('path', path);
  return hubRequest<{ provider: string; path: string; entries: Array<{ name: string; path: string; proxy_url?: string }>; warning?: string }>(
    accessToken,
    `/api/hub/spaces/${encodeURIComponent(spaceId)}/assets/list?${params.toString()}`,
    {
      method: 'GET',
    },
  );
};
