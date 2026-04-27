export const createNextcloudHelpers = ({
  NEXTCLOUD_BASE_URL,
  NEXTCLOUD_USER,
  NEXTCLOUD_APP_PASSWORD,
  NEXTCLOUD_FETCH_TIMEOUT_MS,
  asText,
  assetRootByIdStmt,
  defaultAssetRootByProjectStmt,
  normalizeAssetRelativePath,
  buildAssetRelativePath,
  fetchWithTimeout,
  isFetchTimeoutError,
}) => {
  const safeNextcloudConfig = () => Boolean(NEXTCLOUD_BASE_URL && NEXTCLOUD_USER && NEXTCLOUD_APP_PASSWORD);

  const nextcloudAuthHeader = () =>
    `Basic ${Buffer.from(`${NEXTCLOUD_USER}:${NEXTCLOUD_APP_PASSWORD}`, 'utf8').toString('base64')}`;

  const nextcloudUrl = (rootPath, relativePath) => {
    const normalizedRoot = `/${asText(rootPath).replace(/^\/+/, '').replace(/\/+$/, '')}`;
    const normalizedPath = `/${asText(relativePath).replace(/^\/+/, '')}`;
    const combined = `${normalizedRoot}${normalizedPath === '/' ? '' : normalizedPath}`;
    const encoded = combined
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');
    return `${NEXTCLOUD_BASE_URL.replace(/\/$/, '')}/remote.php/dav/files/${encodeURIComponent(NEXTCLOUD_USER)}${encoded}`;
  };

  const resolveProjectAssetRoot = (projectId, requestedAssetRootId = '') => {
    const requestedId = asText(requestedAssetRootId);
    if (requestedId) {
      const root = assetRootByIdStmt.get(requestedId);
      if (!root || root.space_id !== projectId) {
        return { error: { status: 404, code: 'not_found', message: 'Asset root not found.' } };
      }
      if (root.provider !== 'nextcloud') {
        return { error: { status: 400, code: 'invalid_input', message: 'Only nextcloud asset roots are supported in V1.' } };
      }
      return { root };
    }

    const root = defaultAssetRootByProjectStmt.get(projectId);
    if (!root) {
      return { error: { status: 400, code: 'asset_root_required', message: 'Create an asset root before uploading files.' } };
    }
    if (root.provider !== 'nextcloud') {
      return { error: { status: 400, code: 'invalid_input', message: 'Only nextcloud asset roots are supported in V1.' } };
    }

    return { root };
  };

  const uploadToNextcloud = async ({ rootPath, relativePath, mimeType, content }) => {
    if (!safeNextcloudConfig()) {
      return { error: { status: 503, code: 'nextcloud_unavailable', message: 'Nextcloud runtime credentials are not configured.' } };
    }

    const normalized = normalizeAssetRelativePath(relativePath);
    const fileSegments = normalized.split('/').filter(Boolean);
    const rootSegments = normalizeAssetRelativePath(rootPath).split('/').filter(Boolean);
    const directorySegments = [...rootSegments, ...fileSegments.slice(0, -1)];

    let currentDir = '';
    for (const segment of directorySegments) {
      currentDir = buildAssetRelativePath(currentDir, segment);
      const mkcolUrl = nextcloudUrl('/', currentDir);
      let mkcolResponse;
      try {
        mkcolResponse = await fetchWithTimeout(
          mkcolUrl,
          {
            method: 'MKCOL',
            headers: {
              Authorization: nextcloudAuthHeader(),
            },
          },
          { timeoutMs: NEXTCLOUD_FETCH_TIMEOUT_MS },
        );
        mkcolResponse.clearTimeout?.();
      } catch (error) {
        if (isFetchTimeoutError(error)) {
          return { error: { status: 504, code: 'upstream_timeout', message: 'Nextcloud folder create timed out.' } };
        }
        throw error;
      }

      if (![201, 301, 302, 405].includes(mkcolResponse.status)) {
        return {
          error: {
            status: 502,
            code: 'upstream_error',
            message: `Nextcloud folder create failed (${mkcolResponse.status}).`,
          },
        };
      }
    }

    const targetUrl = nextcloudUrl(rootPath, normalized);
    let upstream;
    try {
      upstream = await fetchWithTimeout(
        targetUrl,
        {
          method: 'PUT',
          headers: {
            Authorization: nextcloudAuthHeader(),
            'Content-Type': mimeType || 'application/octet-stream',
          },
          body: content,
        },
        { timeoutMs: NEXTCLOUD_FETCH_TIMEOUT_MS },
      );
      upstream.clearTimeout?.();
    } catch (error) {
      if (isFetchTimeoutError(error)) {
        return { error: { status: 504, code: 'upstream_timeout', message: 'Nextcloud upload timed out.' } };
      }
      throw error;
    }

    if (![200, 201, 204].includes(upstream.status)) {
      return { error: { status: 502, code: 'upstream_error', message: `Nextcloud upload failed (${upstream.status}).` } };
    }

    return { ok: true };
  };

  const buildAssetProxyPath = ({ projectId, assetRootId, assetPath }) => {
    const params = new URLSearchParams();
    params.set('asset_root_id', assetRootId);
    params.set('path', assetPath);
    return `/api/hub/spaces/${encodeURIComponent(projectId)}/assets/proxy?${params.toString()}`;
  };

  return {
    safeNextcloudConfig,
    nextcloudAuthHeader,
    nextcloudUrl,
    resolveProjectAssetRoot,
    uploadToNextcloud,
    buildAssetProxyPath,
  };
};
