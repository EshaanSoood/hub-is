export const createDomainUtils = ({
  asText,
  asNullableText,
  parseJson,
  parseJsonObject,
  workProjectForDocStmt,
}) => {
  const relationTargetCollectionIdFromField = (field) => {
    const config = parseJsonObject(field?.config, {});
    const direct = asText(config.target_collection_id || config.targetCollectionId);
    if (direct) {
      return direct;
    }
    const nestedTarget = config.target;
    if (nestedTarget && typeof nestedTarget === 'object' && !Array.isArray(nestedTarget)) {
      const nested = asText(nestedTarget.collection_id || nestedTarget.collectionId);
      if (nested) {
        return nested;
      }
    }
    return '';
  };

  const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

  const normalizeAssetRelativePath = (value) => {
    const raw = asText(value).replace(/\\/g, '/');
    if (!raw) {
      return '';
    }

    const parts = raw.split('/').map((part) => part.trim()).filter(Boolean);
    const clean = [];
    for (const part of parts) {
      if (part === '.') {
        continue;
      }
      if (part === '..') {
        if (clean.length > 0) {
          clean.pop();
        }
        continue;
      }
      clean.push(part);
    }
    return clean.join('/');
  };

  const buildAssetRelativePath = (...segments) => normalizeAssetRelativePath(segments.filter(Boolean).join('/'));
  const normalizeAssetPathSegment = (value, fallback = 'Unsorted') =>
    asText(value).replace(/[\\/]+/g, ' ').trim().replace(/\s+/g, '_') || fallback;

  const collectLexicalNodeKeys = (candidate, output) => {
    if (!candidate || typeof candidate !== 'object') {
      return;
    }

    if (Array.isArray(candidate)) {
      for (const item of candidate) {
        collectLexicalNodeKeys(item, output);
      }
      return;
    }

    const key = candidate.key;
    if (typeof key === 'string' && key.trim()) {
      output.add(key.trim());
    }

    for (const value of Object.values(candidate)) {
      if (value && typeof value === 'object') {
        collectLexicalNodeKeys(value, output);
      }
    }
  };

  const extractDocNodeKeyState = (snapshotPayload) => {
    const result = {
      hasSignal: false,
      nodeKeys: new Set(),
    };

    if (!snapshotPayload || typeof snapshotPayload !== 'object' || Array.isArray(snapshotPayload)) {
      return result;
    }

    const payload = snapshotPayload;

    if (Array.isArray(payload.node_keys)) {
      result.hasSignal = true;
      for (const key of payload.node_keys) {
        const normalized = asText(key);
        if (normalized) {
          result.nodeKeys.add(normalized);
        }
      }
    }

    const lexicalCandidates = [];
    if (isPlainObject(payload.lexical_state)) {
      lexicalCandidates.push(payload.lexical_state);
    }
    if (isPlainObject(payload.lexicalState)) {
      lexicalCandidates.push(payload.lexicalState);
    }
    if (isPlainObject(payload.lexical_snapshot)) {
      lexicalCandidates.push(payload.lexical_snapshot);
      if (isPlainObject(payload.lexical_snapshot.lexicalState)) {
        lexicalCandidates.push(payload.lexical_snapshot.lexicalState);
      }
      if (isPlainObject(payload.lexical_snapshot.lexical_state)) {
        lexicalCandidates.push(payload.lexical_snapshot.lexical_state);
      }
    }

    for (const lexicalState of lexicalCandidates) {
      result.hasSignal = true;
      collectLexicalNodeKeys(lexicalState, result.nodeKeys);
    }

    return result;
  };

  const timelineRecord = (row) => ({
    timeline_event_id: row.timeline_event_id,
    space_id: row.space_id,
    actor_user_id: row.actor_user_id,
    event_type: row.event_type,
    primary_entity_type: row.primary_entity_type,
    primary_entity_id: row.primary_entity_id,
    secondary_entities: parseJson(row.secondary_entities_json, []),
    summary_json: parseJsonObject(row.summary_json, {}),
    created_at: row.created_at,
  });

  const notificationRecord = (row) => ({
    notification_id: row.notification_id,
    space_id: row.space_id,
    user_id: row.user_id,
    reason: row.reason,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    payload: parseJsonObject(row.payload_json, {}),
    notification_scope: asText(row.notification_scope) === 'local' ? 'local' : 'network',
    read_at: row.read_at,
    created_at: row.created_at,
  });

  const buildNotificationRouteContext = ({
    projectId,
    sourceProjectId = null,
    sourceDocId = null,
    sourceNodeKey = null,
    originKind = null,
  }) => {
    const normalizedDocId = asNullableText(sourceDocId);
    const doc = normalizedDocId ? workProjectForDocStmt.get(normalizedDocId) : null;
    const resolvedProjectId = asNullableText(sourceProjectId) || asNullableText(doc?.project_id);
    const resolvedSpaceId = asNullableText(doc?.space_id) || projectId;
    return {
      sourceProjectId: resolvedProjectId,
      spaceId: resolvedSpaceId,
      sourceDocId: normalizedDocId,
      sourceNodeKey: asNullableText(sourceNodeKey),
      originKind: resolvedProjectId ? 'project' : asNullableText(originKind) || 'space',
    };
  };

  const buildNotificationPayload = ({
    message = null,
    sourceProjectId = null,
    sourceDocId = null,
    sourceNodeKey = null,
    originKind = null,
    extras = {},
  }) => ({
    ...extras,
    message: message ?? null,
    source_project_id: sourceProjectId ?? null,
    source_doc_id: sourceDocId ?? null,
    source_node_key: sourceNodeKey ?? null,
    origin_kind: originKind ?? null,
  });

  return {
    relationTargetCollectionIdFromField,
    isPlainObject,
    normalizeAssetRelativePath,
    buildAssetRelativePath,
    normalizeAssetPathSegment,
    extractDocNodeKeyState,
    timelineRecord,
    notificationRecord,
    buildNotificationRouteContext,
    buildNotificationPayload,
  };
};
