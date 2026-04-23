const parseSnapshotPayload = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value;
};

export const createRoomDocRoutes = (deps) => {
  const {
    withAuth,
    send,
    jsonResponse,
    okEnvelope,
    errorEnvelope,
    parseBody,
    asText,
    parseJson,
    nowIso,
    roomDocByIdStmt,
    roomMembershipExistsStmt,
    updateRoomDocStorageStmt,
    updateRoomDocTimestampStmt,
    upsertRoomDocPresenceStmt,
  } = deps;

  const resolveAuthorizedRoomDoc = ({ userId, docId, requireWrite = false }) => {
    const doc = roomDocByIdStmt.get(docId);
    if (!doc) {
      return { error: { status: 404, code: 'not_found', message: 'Room document not found.' } };
    }

    const membership = roomMembershipExistsStmt.get(doc.room_id, userId);
    if (!membership?.ok) {
      return { error: { status: 403, code: 'forbidden', message: 'Room membership required.' } };
    }

    const canEdit = doc.room_status !== 'archived';
    if (requireWrite && !canEdit) {
      return { error: { status: 403, code: 'forbidden', message: 'Archived room documents are read-only.' } };
    }

    return { doc, canEdit };
  };

  const getRoomDoc = async ({ request, response, params }) => {
    const auth = await withAuth(request);
    if (auth.error) {
      send(response, auth.error);
      return;
    }

    const docGate = resolveAuthorizedRoomDoc({
      userId: auth.user.user_id,
      docId: params.docId,
    });
    if (docGate.error) {
      send(response, jsonResponse(docGate.error.status, errorEnvelope(docGate.error.code, docGate.error.message)));
      return;
    }

    send(
      response,
      jsonResponse(
        200,
        okEnvelope({
          doc: {
            doc_id: docGate.doc.doc_id,
            room_id: docGate.doc.room_id,
            snapshot_version: docGate.doc.snapshot_version || 0,
            snapshot_payload: parseJson(docGate.doc.snapshot_payload, {}),
            updated_at: docGate.doc.storage_updated_at || docGate.doc.updated_at,
          },
        }),
      ),
    );
  };

  const updateRoomDoc = async ({ request, response, params }) => {
    const auth = await withAuth(request);
    if (auth.error) {
      send(response, auth.error);
      return;
    }

    const docGate = resolveAuthorizedRoomDoc({
      userId: auth.user.user_id,
      docId: params.docId,
      requireWrite: true,
    });
    if (docGate.error) {
      send(response, jsonResponse(docGate.error.status, errorEnvelope(docGate.error.code, docGate.error.message)));
      return;
    }

    let body;
    try {
      body = await parseBody(request, { maxBytes: parseBody.largeMaxBytes });
    } catch (error) {
      request.log.warn('Failed to parse request body for room doc update.', { error, docId: params.docId });
      send(response, parseBody.errorResponse(error));
      return;
    }

    const payloadSource = body.snapshot_payload === undefined
      ? Object.fromEntries(
        Object.entries(body).filter(([key]) => key !== 'snapshot_version'),
      )
      : body.snapshot_payload;
    const payload = parseSnapshotPayload(payloadSource);
    if (!payload) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'snapshot_payload must be an object.')));
      return;
    }

    const currentVersion = Number(docGate.doc.snapshot_version || 0);
    if (body.snapshot_version === undefined) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'snapshot_version is required.')));
      return;
    }

    const providedVersion = Number(body.snapshot_version);
    if (!Number.isInteger(providedVersion) || providedVersion < 0) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'snapshot_version must be a non-negative integer.')));
      return;
    }

    if (providedVersion !== currentVersion) {
      send(response, jsonResponse(409, errorEnvelope('version_conflict', 'snapshot_version is stale. Refresh and retry.')));
      return;
    }

    const nextVersion = currentVersion + 1;
    const timestamp = nowIso();
    const updateResult = updateRoomDocStorageStmt.run(nextVersion, JSON.stringify(payload), timestamp, params.docId, currentVersion);
    if (updateResult.changes === 0) {
      send(response, jsonResponse(409, errorEnvelope('version_conflict', 'snapshot_version is stale. Refresh and retry.')));
      return;
    }

    updateRoomDocTimestampStmt.run(timestamp, params.docId);
    send(response, jsonResponse(200, okEnvelope({ doc_id: params.docId, snapshot_version: nextVersion })));
  };

  const updateRoomDocPresence = async ({ request, response, params }) => {
    const auth = await withAuth(request);
    if (auth.error) {
      send(response, auth.error);
      return;
    }

    const docGate = resolveAuthorizedRoomDoc({
      userId: auth.user.user_id,
      docId: params.docId,
    });
    if (docGate.error) {
      send(response, jsonResponse(docGate.error.status, errorEnvelope(docGate.error.code, docGate.error.message)));
      return;
    }

    let body;
    try {
      body = await parseBody(request);
    } catch (error) {
      request.log.warn('Failed to parse request body for room doc presence update; using empty payload.', {
        docId: params.docId,
        error,
      });
      const parseErrorResponse = parseBody.errorResponse(error);
      if (parseErrorResponse.statusCode === 413) {
        send(response, parseErrorResponse);
        return;
      }
      body = {};
    }

    upsertRoomDocPresenceStmt.run(params.docId, auth.user.user_id, JSON.stringify(body.cursor_payload ?? null), nowIso());
    send(response, jsonResponse(200, okEnvelope({ updated: true })));
  };

  const authorizeCollab = async ({ request, response, requestUrl }) => {
    const auth = await withAuth(request);
    if (auth.error) {
      send(response, auth.error);
      return;
    }

    const docId = asText(requestUrl.searchParams.get('doc_id'));
    if (!docId) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'doc_id is required.')));
      return;
    }

    const docGate = resolveAuthorizedRoomDoc({
      userId: auth.user.user_id,
      docId,
    });
    if (docGate.error) {
      send(response, jsonResponse(docGate.error.status, errorEnvelope(docGate.error.code, docGate.error.message)));
      return;
    }

    send(
      response,
      jsonResponse(
        200,
        okEnvelope({
          authorization: {
            doc_id: docId,
            pane_id: null,
            room_id: docGate.doc.room_id,
            project_id: docGate.doc.space_id,
            user_id: auth.user.user_id,
            display_name: auth.user.display_name,
            can_edit: docGate.canEdit,
          },
        }),
      ),
    );
  };

  return {
    authorizeCollab,
    getRoomDoc,
    updateRoomDoc,
    updateRoomDocPresence,
  };
};
