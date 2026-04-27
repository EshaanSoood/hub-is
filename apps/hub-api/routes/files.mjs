export const createFileRoutes = (deps) => {
  const strictBase64Pattern = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
  const {
    withAuth,
    withProjectPolicyGate,
    send,
    jsonResponse,
    errorEnvelope,
    parseBody,
    asText,
    asInteger,
    parseJson,
    parseJsonObject,
    fetchWithTimeout,
    isFetchTimeoutError,
    normalizeAssetRelativePath,
    buildAssetRelativePath,
    normalizeAssetPathSegment,
    NEXTCLOUD_FETCH_TIMEOUT_MS,
    nowIso,
    newId,
    toJson,
    emitTimelineEvent,
    resolveProjectAssetRoot,
    resolveProjectContentWriteGate,
    resolveMutationContextProjectId,
    uploadToNextcloud,
    safeNextcloudConfig,
    nextcloudUrl,
    nextcloudAuthHeader,
    buildAssetProxyPath,
    trackedFileRecord,
    withTransaction,
    ALLOWED_ORIGIN,
    NEXTCLOUD_USER,
    workProjectByIdStmt,
    projectByIdStmt,
    assetRootByIdStmt,
    assetRootsByProjectStmt,
    defaultAssetRootByProjectStmt,
    insertAssetRootStmt,
    filesByProjectStmt,
    insertFileStmt,
    insertFileBlobStmt,
    insertAttachmentStmt,
    deleteAttachmentStmt,
    attachmentByIdStmt,
  } = deps;
  const fileOkEnvelope = (data) => ({ ok: true, data, error: null });

  const uploadFile = async ({ request, response, requestUrl }) => {
    const auth = await withAuth(request);
    if (auth.error) {
      send(response, auth.error);
      return;
    }
    let body;
    try {
      body = await parseBody(request, { maxBytes: parseBody.largeMaxBytes });
    } catch (error) {
      request.log.warn('Failed to parse request body for file upload.', { error });
      send(response, parseBody.errorResponse(error));
      return;
    }

    const projectId = asText(body.project_id);
    const name = asText(body.name);
    const mimeType = asText(body.mime_type) || 'application/octet-stream';
    const contentBase64 = asText(body.content_base64);

    if (!projectId || !name || !contentBase64) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'project_id, name, content_base64 are required.')));
      return;
    }

    const writeGate = resolveProjectContentWriteGate({
      userId: auth.user.user_id,
      projectId,
      sourceProjectId: resolveMutationContextProjectId({ body, requestUrl }),
    });
    if (writeGate.error) {
      send(response, jsonResponse(writeGate.error.status, errorEnvelope(writeGate.error.code, writeGate.error.message)));
      return;
    }

    if (!strictBase64Pattern.test(contentBase64)) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'content_base64 must be valid base64.')));
      return;
    }
    const content = Buffer.from(contentBase64, 'base64');

    const rootResult = resolveProjectAssetRoot(projectId, body.asset_root_id);
    if (rootResult.error) {
      send(response, jsonResponse(rootResult.error.status, errorEnvelope(rootResult.error.code, rootResult.error.message)));
      return;
    }

    const root = rootResult.root;
    const requestedDirectory = normalizeAssetRelativePath(body.path || body.directory || 'Uploads');
    const metadata = parseJsonObject(body.metadata, {});
    const requestedProjectId = resolveMutationContextProjectId({ body, requestUrl });
    const uploadSpace = projectByIdStmt.get(projectId);
    const uploadProject = requestedProjectId ? workProjectByIdStmt.get(requestedProjectId) : null;
    const spaceSegmentName = normalizeAssetPathSegment(uploadSpace?.name, '');
    const spaceSegment = [projectId, spaceSegmentName].filter(Boolean).join('-');
    const projectSegmentName = normalizeAssetPathSegment(uploadProject?.name, '');
    const projectSegment = uploadProject?.project_id ? [uploadProject.project_id, projectSegmentName].filter(Boolean).join('-') : 'Unsorted';
    const uploadDirectory = asText(metadata.scope) === 'doc_attachment'
      ? buildAssetRelativePath('z-Attachments', spaceSegment, projectSegment)
      : requestedDirectory || 'Uploads';
    const safeName = asText(body.name);
    if (!safeName) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'name is required.')));
      return;
    }
    const providerPath = buildAssetRelativePath(uploadDirectory, safeName);
    const storedMetadata = {
      ...metadata,
      ...(requestedProjectId ? { scope: 'project', project_id: requestedProjectId } : {}),
    };
    const uploadResult = await uploadToNextcloud({
      rootPath: root.root_path,
      relativePath: providerPath,
      mimeType,
      content,
    });
    if (uploadResult.error) {
      send(response, jsonResponse(uploadResult.error.status, errorEnvelope(uploadResult.error.code, uploadResult.error.message)));
      return;
    }

    const fileId = newId('fil');
    const createdAt = nowIso();
    try {
      withTransaction(() => {
        insertFileStmt.run(
          fileId,
          projectId,
          root.asset_root_id,
          'nextcloud',
          providerPath,
          name,
          mimeType,
          content.byteLength,
          null,
          toJson(storedMetadata),
          auth.user.user_id,
          createdAt,
        );
        insertFileBlobStmt.run(
          fileId,
          toJson({
            provider: 'nextcloud',
            asset_root_id: root.asset_root_id,
            provider_path: providerPath,
          }),
          createdAt,
        );

        emitTimelineEvent({
          projectId,
          actorUserId: auth.user.user_id,
          eventType: 'file.uploaded',
          primaryEntityType: 'file',
          primaryEntityId: fileId,
          summary: {
            name,
            size_bytes: content.byteLength,
            provider: 'nextcloud',
            asset_root_id: root.asset_root_id,
            asset_path: providerPath,
          },
        });
      });
    } catch (error) {
      request.log.error('Failed to persist file metadata transaction.', {
        error,
        projectId,
        fileId,
      });
      send(response, jsonResponse(500, errorEnvelope('internal_error', 'Failed to save uploaded file metadata.')));
      return;
    }

    send(response, jsonResponse(201, fileOkEnvelope({
      file: {
        file_id: fileId,
        space_id: projectId,
        asset_root_id: root.asset_root_id,
        provider: 'nextcloud',
        asset_path: providerPath,
        name,
        mime_type: mimeType,
        size_bytes: content.byteLength,
        metadata: storedMetadata,
        proxy_url: buildAssetProxyPath({ projectId, assetRootId: root.asset_root_id, assetPath: providerPath }),
      },
    })));
  };

  const createAttachment = async ({ request, response, requestUrl }) => {
    const auth = await withAuth(request);
    if (auth.error) {
      send(response, auth.error);
      return;
    }

    let body;
    try {
      body = await parseBody(request);
    } catch (error) {
      request.log.warn('Failed to parse request body for attachment creation.', { error });
      send(response, parseBody.errorResponse(error));
      return;
    }

    const projectId = asText(body.project_id);
    const entityType = asText(body.entity_type);
    const entityId = asText(body.entity_id);
    const provider = asText(body.provider) || 'nextcloud';
    const assetRootId = asText(body.asset_root_id);
    const assetPath = normalizeAssetRelativePath(body.asset_path);

    if (!projectId || !entityType || !entityId || !provider || !assetRootId || !assetPath) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'project_id, entity_type, entity_id, provider, asset_root_id, asset_path are required.')));
      return;
    }

    const writeGate = resolveProjectContentWriteGate({
      userId: auth.user.user_id,
      projectId,
      sourceProjectId: resolveMutationContextProjectId({ body, requestUrl }),
    });
    if (writeGate.error) {
      send(response, jsonResponse(writeGate.error.status, errorEnvelope(writeGate.error.code, writeGate.error.message)));
      return;
    }

    const root = assetRootByIdStmt.get(assetRootId);
    if (!root || root.project_id !== projectId) {
      send(response, jsonResponse(404, errorEnvelope('not_found', 'Asset root not found in project.')));
      return;
    }
    if (provider !== root.provider) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'Attachment provider must match asset root provider.')));
      return;
    }

    const fileName = asText(body.name) || assetPath.split('/').filter(Boolean).pop() || 'Asset';
    const mimeType = asText(body.mime_type) || 'application/octet-stream';
    const sizeBytes = asInteger(body.size_bytes, 0, 0);
    const metadata = parseJsonObject(body.metadata, {});

    const attachmentId = newId('att');
    insertAttachmentStmt.run(attachmentId, projectId, entityType, entityId, provider, assetRootId, assetPath, fileName, mimeType, sizeBytes, toJson(metadata), auth.user.user_id, nowIso());

    emitTimelineEvent({
      projectId,
      actorUserId: auth.user.user_id,
      eventType: 'file.attached',
      primaryEntityType: entityType,
      primaryEntityId: entityId,
      secondaryEntities: [{ entity_type: 'file', entity_id: assetPath }],
      summary: {
        attachment_id: attachmentId,
        provider,
        asset_root_id: assetRootId,
        asset_path: assetPath,
        name: fileName,
      },
    });

    send(response, jsonResponse(201, fileOkEnvelope({
      attachment_id: attachmentId,
      attachment: {
        attachment_id: attachmentId,
        space_id: projectId,
        entity_type: entityType,
        entity_id: entityId,
        provider,
        asset_root_id: assetRootId,
        asset_path: assetPath,
        name: fileName,
        mime_type: mimeType,
        size_bytes: sizeBytes,
        metadata,
        proxy_url: buildAssetProxyPath({ projectId, assetRootId, assetPath }),
      },
    })));
  };

  const deleteAttachment = async ({ request, response, requestUrl, params }) => {
    const auth = await withAuth(request);
    if (auth.error) {
      send(response, auth.error);
      return;
    }
    const attachmentId = params.attachmentId;
    const attachment = attachmentByIdStmt.get(attachmentId);
    if (!attachment) {
      send(response, jsonResponse(404, errorEnvelope('not_found', 'Attachment not found.')));
      return;
    }

    const writeGate = resolveProjectContentWriteGate({
      userId: auth.user.user_id,
      projectId: attachment.project_id,
      sourceProjectId: resolveMutationContextProjectId({ requestUrl }),
    });
    if (writeGate.error) {
      send(response, jsonResponse(writeGate.error.status, errorEnvelope(writeGate.error.code, writeGate.error.message)));
      return;
    }

    deleteAttachmentStmt.run(attachmentId);
    emitTimelineEvent({
      projectId: attachment.project_id,
      actorUserId: auth.user.user_id,
      eventType: 'file.detached',
      primaryEntityType: attachment.entity_type,
      primaryEntityId: attachment.entity_id,
      secondaryEntities: [{ entity_type: 'file', entity_id: attachment.asset_path }],
      summary: {
        attachment_id: attachmentId,
        provider: attachment.provider,
        asset_root_id: attachment.asset_root_id,
        asset_path: attachment.asset_path,
      },
    });

    send(response, jsonResponse(200, fileOkEnvelope({ deleted: true })));
  };

  const listAssetRoots = async ({ request, response, params }) => {
    const auth = await withAuth(request);
    if (auth.error) {
      send(response, auth.error);
      return;
    }
    const projectId = params.projectId;
    const projectGate = withProjectPolicyGate({ userId: auth.user.user_id, projectId, requiredCapability: 'view' });
    if (projectGate.error) {
      send(response, jsonResponse(projectGate.error.status, errorEnvelope(projectGate.error.code, projectGate.error.message)));
      return;
    }

    const roots = assetRootsByProjectStmt.all(projectId).map((root) => ({
      asset_root_id: root.asset_root_id,
      space_id: root.project_id,
      provider: root.provider,
      root_path: root.root_path,
      connection_ref: parseJson(root.connection_ref, null),
      created_at: root.created_at,
      updated_at: root.updated_at,
    }));
    send(response, jsonResponse(200, fileOkEnvelope({ asset_roots: roots })));
  };

  const createAssetRoot = async ({ request, response, params }) => {
    const auth = await withAuth(request);
    if (auth.error) {
      send(response, auth.error);
      return;
    }
    const projectId = params.projectId;
    const projectGate = withProjectPolicyGate({ userId: auth.user.user_id, projectId, requiredCapability: 'write' });
    if (projectGate.error) {
      send(response, jsonResponse(projectGate.error.status, errorEnvelope(projectGate.error.code, projectGate.error.message)));
      return;
    }

    let body;
    try {
      body = await parseBody(request);
    } catch (error) {
      request.log.warn('Failed to parse request body for asset root creation.', { error });
      send(response, parseBody.errorResponse(error));
      return;
    }

    const provider = asText(body.provider) || 'nextcloud';
    const rootPath = asText(body.root_path);
    if (!rootPath) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'root_path is required.')));
      return;
    }
    if (provider !== 'nextcloud') {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'V1 supports nextcloud asset roots only.')));
      return;
    }

    const rootId = newId('ast');
    const timestamp = nowIso();
    insertAssetRootStmt.run(rootId, projectId, provider, rootPath, toJson(body.connection_ref ?? null), timestamp, timestamp);
    send(response, jsonResponse(201, fileOkEnvelope({ asset_root_id: rootId })));
  };

  const listProjectFiles = async ({ request, response, requestUrl, params }) => {
    const auth = await withAuth(request);
    if (auth.error) {
      send(response, auth.error);
      return;
    }
    const projectId = params.projectId;
    const projectGate = withProjectPolicyGate({ userId: auth.user.user_id, projectId, requiredCapability: 'view' });
    if (projectGate.error) {
      send(response, jsonResponse(projectGate.error.status, errorEnvelope(projectGate.error.code, projectGate.error.message)));
      return;
    }

    const sourceProjectId = asText(requestUrl.searchParams.get('project_id') || requestUrl.searchParams.get('source_project_id'));
    const scope = asText(requestUrl.searchParams.get('scope') || (sourceProjectId ? 'project' : 'space')).toLowerCase();
    if (scope !== 'all' && scope !== 'space' && scope !== 'project') {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'scope must be all, space, or project.')));
      return;
    }
    if (scope === 'project') {
      if (!sourceProjectId) {
        send(response, jsonResponse(400, errorEnvelope('invalid_input', 'project_id is required when scope is project.')));
        return;
      }
      const project = workProjectByIdStmt.get(sourceProjectId);
      if (!project || project.space_id !== projectId) {
        send(response, jsonResponse(404, errorEnvelope('not_found', 'Project not found in space.')));
        return;
      }
    }

    const files = filesByProjectStmt
      .all(projectId)
      .map(trackedFileRecord)
      .filter((file) => scope === 'all' || asText(file.metadata?.scope) !== 'doc_attachment')
      .filter((file) => scope !== 'project' || file.project_id === sourceProjectId);

    send(response, jsonResponse(200, fileOkEnvelope({ files })));
  };

  const listAssets = async ({ request, response, requestUrl, params }) => {
    const auth = await withAuth(request);
    if (auth.error) {
      send(response, auth.error);
      return;
    }
    const projectId = params.projectId;
    const projectGate = withProjectPolicyGate({ userId: auth.user.user_id, projectId, requiredCapability: 'view' });
    if (projectGate.error) {
      send(response, jsonResponse(projectGate.error.status, errorEnvelope(projectGate.error.code, projectGate.error.message)));
      return;
    }

    const assetRootId = asText(requestUrl.searchParams.get('asset_root_id'));
    const relativePath = normalizeAssetRelativePath(requestUrl.searchParams.get('path') || '');
    const root = assetRootByIdStmt.get(assetRootId);
    if (!root || root.project_id !== projectId) {
      send(response, jsonResponse(404, errorEnvelope('not_found', 'Asset root not found.')));
      return;
    }

    if (root.provider !== 'nextcloud') {
      send(response, jsonResponse(200, fileOkEnvelope({ provider: root.provider, path: relativePath || '/', entries: [], warning: 'Provider adapter not configured.' })));
      return;
    }

    if (!safeNextcloudConfig()) {
      send(response, jsonResponse(503, errorEnvelope('nextcloud_unavailable', 'Nextcloud runtime credentials are not configured.')));
      return;
    }

    const targetUrl = nextcloudUrl(root.root_path, relativePath || '/');
    const propfindBody = '<?xml version="1.0" encoding="UTF-8"?><d:propfind xmlns:d="DAV:"><d:prop><d:getlastmodified/><d:getcontentlength/><d:resourcetype/></d:prop></d:propfind>';
    let upstream;
    try {
      upstream = await fetchWithTimeout(
        targetUrl,
        {
          method: 'PROPFIND',
          headers: {
            Authorization: nextcloudAuthHeader(),
            Depth: '1',
            'Content-Type': 'application/xml; charset=utf-8',
          },
          body: propfindBody,
        },
        { timeoutMs: NEXTCLOUD_FETCH_TIMEOUT_MS },
      );
      if (![200, 207].includes(upstream.status)) {
        upstream.clearTimeout?.();
        send(response, jsonResponse(502, errorEnvelope('upstream_error', `Nextcloud list failed (${upstream.status}).`)));
        return;
      }
    } catch (error) {
      if (isFetchTimeoutError(error)) {
        send(response, jsonResponse(504, errorEnvelope('upstream_timeout', 'Nextcloud list request timed out.')));
        return;
      }
      request.log.error('Nextcloud asset list request failed.', { error, projectId });
      send(response, jsonResponse(502, errorEnvelope('upstream_error', 'Upstream request failed.')));
      return;
    }

    let xml;
    try {
      xml = await upstream.text();
    } catch (error) {
      if (isFetchTimeoutError(error)) {
        send(response, jsonResponse(504, errorEnvelope('upstream_timeout', 'Nextcloud list response timed out.')));
        return;
      }
      request.log.error('Nextcloud asset list response read failed.', { error, projectId });
      send(response, jsonResponse(502, errorEnvelope('upstream_error', 'Upstream response read failed.')));
      return;
    }
    const hrefs = [...xml.matchAll(/<d:href>(.*?)<\/d:href>/g)].map((match) => decodeURIComponent(match[1] || ''));
    const rootPrefix = `/remote.php/dav/files/${NEXTCLOUD_USER}/${asText(root.root_path).replace(/^\/+/, '').replace(/\/+$/, '')}`;
    const entries = hrefs
      .filter((href) => href && !href.endsWith('/remote.php/dav/files/') && !href.endsWith(encodeURIComponent(NEXTCLOUD_USER)))
      .map((href) => {
        const normalizedHref = href.replace(/^https?:\/\/[^/]+/i, '');
        const relativeFromRoot = normalizeAssetRelativePath(normalizedHref.replace(rootPrefix, ''));
        const parts = relativeFromRoot.split('/').filter(Boolean);
        const name = parts[parts.length - 1] || '/';
        return {
          name,
          path: relativeFromRoot,
          proxy_url: buildAssetProxyPath({ projectId, assetRootId, assetPath: relativeFromRoot }),
        };
      })
      .filter((entry) => entry.path);

    send(response, jsonResponse(200, fileOkEnvelope({ provider: 'nextcloud', path: relativePath || '/', entries })));
  };

  const uploadAsset = async ({ request, response, requestUrl, params }) => {
    const auth = await withAuth(request);
    if (auth.error) {
      send(response, auth.error);
      return;
    }
    const projectId = params.projectId;
    let body;
    try {
      body = await parseBody(request, { maxBytes: parseBody.largeMaxBytes });
    } catch (error) {
      request.log.warn('Failed to parse request body for asset upload.', { error });
      send(response, parseBody.errorResponse(error));
      return;
    }

    const writeGate = resolveProjectContentWriteGate({
      userId: auth.user.user_id,
      projectId,
      sourceProjectId: resolveMutationContextProjectId({ body, requestUrl }),
    });
    if (writeGate.error) {
      send(response, jsonResponse(writeGate.error.status, errorEnvelope(writeGate.error.code, writeGate.error.message)));
      return;
    }

    const assetRootId = asText(body.asset_root_id);
    const root = assetRootByIdStmt.get(assetRootId);
    if (!root || root.project_id !== projectId) {
      send(response, jsonResponse(404, errorEnvelope('not_found', 'Asset root not found.')));
      return;
    }
    if (root.provider !== 'nextcloud') {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'Only nextcloud provider is supported.')));
      return;
    }
    if (!safeNextcloudConfig()) {
      send(response, jsonResponse(503, errorEnvelope('nextcloud_unavailable', 'Nextcloud runtime credentials are not configured.')));
      return;
    }

    const name = asText(body.name);
    const contentBase64 = asText(body.content_base64);
    if (!name || !contentBase64) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'name and content_base64 are required.')));
      return;
    }
    if (!strictBase64Pattern.test(contentBase64)) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'content_base64 must be valid base64.')));
      return;
    }
    const relativePath = buildAssetRelativePath(body.path || 'Uploads', name);
    const content = Buffer.from(contentBase64, 'base64');
    const uploadResult = await uploadToNextcloud({
      rootPath: root.root_path,
      relativePath,
      mimeType: asText(body.mime_type) || 'application/octet-stream',
      content,
    });
    if (uploadResult.error) {
      send(response, jsonResponse(uploadResult.error.status, errorEnvelope(uploadResult.error.code, uploadResult.error.message)));
      return;
    }

    send(response, jsonResponse(200, fileOkEnvelope({
      uploaded: true,
      provider: 'nextcloud',
      asset_root_id: assetRootId,
      path: relativePath,
      proxy_url: buildAssetProxyPath({ projectId, assetRootId, assetPath: relativePath }),
    })));
  };

  const deleteAsset = async ({ request, response, requestUrl, params }) => {
    const auth = await withAuth(request);
    if (auth.error) {
      send(response, auth.error);
      return;
    }
    const projectId = params.projectId;
    const writeGate = resolveProjectContentWriteGate({
      userId: auth.user.user_id,
      projectId,
      sourceProjectId: resolveMutationContextProjectId({ requestUrl }),
    });
    if (writeGate.error) {
      send(response, jsonResponse(writeGate.error.status, errorEnvelope(writeGate.error.code, writeGate.error.message)));
      return;
    }

    const assetRootId = asText(requestUrl.searchParams.get('asset_root_id'));
    const relativePath = normalizeAssetRelativePath(requestUrl.searchParams.get('path') || '');
    const root = assetRootByIdStmt.get(assetRootId);
    if (!root || root.project_id !== projectId) {
      send(response, jsonResponse(404, errorEnvelope('not_found', 'Asset root not found.')));
      return;
    }
    if (!relativePath) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'path is required.')));
      return;
    }
    if (root.provider !== 'nextcloud') {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'Only nextcloud provider is supported.')));
      return;
    }
    if (!safeNextcloudConfig()) {
      send(response, jsonResponse(503, errorEnvelope('nextcloud_unavailable', 'Nextcloud runtime credentials are not configured.')));
      return;
    }

    const targetUrl = nextcloudUrl(root.root_path, relativePath);
    let upstream;
    try {
      upstream = await fetchWithTimeout(
        targetUrl,
        {
          method: 'DELETE',
          headers: { Authorization: nextcloudAuthHeader() },
        },
        { timeoutMs: NEXTCLOUD_FETCH_TIMEOUT_MS },
      );
      upstream.clearTimeout?.();
      if (![200, 204].includes(upstream.status)) {
        send(response, jsonResponse(502, errorEnvelope('upstream_error', `Nextcloud delete failed (${upstream.status}).`)));
        return;
      }
    } catch (error) {
      if (isFetchTimeoutError(error)) {
        send(response, jsonResponse(504, errorEnvelope('upstream_timeout', 'Nextcloud delete request timed out.')));
        return;
      }
      request.log.error('Nextcloud asset delete request failed.', { error, projectId });
      send(response, jsonResponse(502, errorEnvelope('upstream_error', 'Upstream request failed.')));
      return;
    }

    send(response, jsonResponse(200, fileOkEnvelope({ deleted: true })));
  };

  const proxyAsset = async ({ request, response, requestUrl, params }) => {
    const auth = await withAuth(request);
    if (auth.error) {
      send(response, auth.error);
      return;
    }

    const projectId = params.projectId;
    const projectGate = withProjectPolicyGate({ userId: auth.user.user_id, projectId, requiredCapability: 'view' });
    if (projectGate.error) {
      send(response, jsonResponse(projectGate.error.status, errorEnvelope(projectGate.error.code, projectGate.error.message)));
      return;
    }

    const assetRootId = asText(requestUrl.searchParams.get('asset_root_id'));
    const relativePath = normalizeAssetRelativePath(requestUrl.searchParams.get('path') || '');
    if (!assetRootId || !relativePath) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'asset_root_id and path are required.')));
      return;
    }

    const root = assetRootByIdStmt.get(assetRootId);
    if (!root || root.project_id !== projectId) {
      send(response, jsonResponse(404, errorEnvelope('not_found', 'Asset root not found.')));
      return;
    }
    if (root.provider !== 'nextcloud') {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'Only nextcloud provider is supported.')));
      return;
    }
    if (!safeNextcloudConfig()) {
      send(response, jsonResponse(503, errorEnvelope('nextcloud_unavailable', 'Nextcloud runtime credentials are not configured.')));
      return;
    }

    const targetUrl = nextcloudUrl(root.root_path, relativePath);
    let upstream;
    try {
      upstream = await fetchWithTimeout(
        targetUrl,
        {
          method: 'GET',
          headers: { Authorization: nextcloudAuthHeader() },
        },
        { timeoutMs: NEXTCLOUD_FETCH_TIMEOUT_MS },
      );
      if (!upstream.ok) {
        upstream.clearTimeout?.();
        send(response, jsonResponse(502, errorEnvelope('upstream_error', `Nextcloud proxy failed (${upstream.status}).`)));
        return;
      }
    } catch (error) {
      if (isFetchTimeoutError(error)) {
        send(response, jsonResponse(504, errorEnvelope('upstream_timeout', 'Nextcloud proxy request timed out.')));
        return;
      }
      request.log.error('Nextcloud asset proxy request failed.', { error, projectId });
      send(response, jsonResponse(502, errorEnvelope('upstream_error', 'Upstream request failed.')));
      return;
    }

    let payload;
    try {
      payload = Buffer.from(await upstream.arrayBuffer());
    } catch (error) {
      if (isFetchTimeoutError(error)) {
        send(response, jsonResponse(504, errorEnvelope('upstream_timeout', 'Nextcloud proxy response timed out.')));
        return;
      }
      request.log.error('Nextcloud asset proxy response read failed.', { error, projectId });
      send(response, jsonResponse(502, errorEnvelope('upstream_error', 'Upstream response read failed.')));
      return;
    }
    response.writeHead(200, {
      'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
      'Cache-Control': 'private, max-age=30',
      'Content-Type': upstream.headers.get('content-type') || 'application/octet-stream',
    });
    response.end(payload);
  };

  return {
    createAssetRoot,
    createAttachment,
    deleteAsset,
    deleteAttachment,
    listAssetRoots,
    listAssets,
    listProjectFiles,
    proxyAsset,
    uploadAsset,
    uploadFile,
  };
};
