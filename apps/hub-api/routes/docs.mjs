export const createDocRoutes = (deps) => {
  const {
    withAuth,
    withProjectPolicyGate,
    withDocPolicyGate,
    requireDocAccess,
    send,
    jsonResponse,
    okEnvelope,
    errorEnvelope,
    parseBody,
    asText,
    asBoolean,
    parseJson,
    parseJsonObject,
    isPlainObject,
    extractDocNodeKeyState,
    toJson,
    nowIso,
    newId,
    emitTimelineEvent,
    buildNotificationPayload,
    createNotification,
    notificationContextForSource,
    materializeMentions,
    issueCollabTicket,
    consumeCollabTicket,
    assignmentsByRecordStmt,
    docByIdStmt,
    paneMembersByPaneStmt,
    projectMembersByProjectStmt,
    recordByIdStmt,
    updateDocStorageStmt,
    updateDocTimestampStmt,
    upsertDocPresenceStmt,
    commentByIdStmt,
    commentsByTargetStmt,
    insertCommentStmt,
    insertCommentAnchorStmt,
    commentAnchorsByDocStmt,
    updateCommentStatusStmt,
    commentStatusSet,
    projectMembershipRoleStmt,
    membershipRoleLabel,
  } = deps;

  const docCollaboratorUserIds = ({ paneId, projectId }) => {
    const userIds = new Set();
    if (paneId) {
      for (const member of paneMembersByPaneStmt?.all(paneId) || []) {
        userIds.add(member.user_id);
      }
    }
    for (const member of projectMembersByProjectStmt?.all(projectId) || []) {
      if (membershipRoleLabel(member.role) === 'owner') {
        userIds.add(member.user_id);
      }
    }
    return [...userIds];
  };

  const getDoc = async ({ request, response, params }) => {
    const auth = await withAuth(request);
    if (auth.error) {
      send(response, auth.error);
      return;
    }

    const docId = params.docId;
    const docGate = withDocPolicyGate({
      userId: auth.user.user_id,
      docId,
      requiredCapability: 'view',
    });
    if (docGate.error) {
      send(response, jsonResponse(docGate.error.status, errorEnvelope(docGate.error.code, docGate.error.message)));
      return;
    }
    const doc = docByIdStmt.get(docId);

    send(
      response,
      jsonResponse(
        200,
        okEnvelope({
          doc: {
            doc_id: doc.doc_id,
            pane_id: doc.pane_id,
            snapshot_version: doc.snapshot_version || 0,
            snapshot_payload: parseJson(doc.snapshot_payload, {}),
            updated_at: doc.storage_updated_at || doc.updated_at,
          },
        }),
      ),
    );
  };

  const updateDoc = async ({ request, response, params }) => {
    const auth = await withAuth(request);
    if (auth.error) {
      send(response, auth.error);
      return;
    }

    const docId = params.docId;
    const docGate = withDocPolicyGate({
      userId: auth.user.user_id,
      docId,
      requiredCapability: 'write',
    });
    if (docGate.error) {
      send(response, jsonResponse(docGate.error.status, errorEnvelope(docGate.error.code, docGate.error.message)));
      return;
    }
    const doc = docByIdStmt.get(docId);

    let body;
    try {
      body = await parseBody(request);
    } catch (error) {
      request.log.warn('Failed to parse request body for doc update.', { error, docId });
      send(response, jsonResponse(400, errorEnvelope('invalid_json', 'Body must be valid JSON.')));
      return;
    }

    const incomingPayload = body.snapshot_payload ?? body;
    const currentPayload = parseJson(doc.snapshot_payload, {});
    const payload =
      isPlainObject(currentPayload) && isPlainObject(incomingPayload)
        ? {
            ...currentPayload,
            ...incomingPayload,
          }
        : incomingPayload;
    const currentVersion = Number(doc.snapshot_version || 0);
    const hasProvidedVersion = body.snapshot_version !== undefined;
    const providedVersion = Number(body.snapshot_version);
    if (hasProvidedVersion && (!Number.isInteger(providedVersion) || providedVersion < 0 || providedVersion !== currentVersion)) {
      send(response, jsonResponse(409, errorEnvelope('version_conflict', 'snapshot_version is stale. Refresh and retry.')));
      return;
    }
    const nextVersion = currentVersion + 1;
    const timestamp = nowIso();

    const updateResult = updateDocStorageStmt.run(nextVersion, toJson(payload), timestamp, docId, currentVersion);
    if (updateResult.changes === 0) {
      send(response, jsonResponse(409, errorEnvelope('version_conflict', 'snapshot_version is stale. Refresh and retry.')));
      return;
    }
    updateDocTimestampStmt.run(timestamp, docId);

    if (docGate.doc_id) {
      emitTimelineEvent({
        projectId: docGate.project_id,
        actorUserId: auth.user.user_id,
        eventType: 'doc.snapshot_saved',
        primaryEntityType: 'doc',
        primaryEntityId: docId,
        summary: {
          message: 'Workspace snapshot updated',
          snapshot_version: nextVersion,
        },
      });
    }

    send(response, jsonResponse(200, okEnvelope({ doc_id: docId, snapshot_version: nextVersion })));
  };

  const updateDocPresence = async ({ request, response, params }) => {
    const auth = await withAuth(request);
    if (auth.error) {
      send(response, auth.error);
      return;
    }

    const docId = params.docId;
    const docGate = withDocPolicyGate({
      userId: auth.user.user_id,
      docId,
      requiredCapability: 'view',
    });
    if (docGate.error) {
      send(response, jsonResponse(docGate.error.status, errorEnvelope(docGate.error.code, docGate.error.message)));
      return;
    }

    let body;
    try {
      body = await parseBody(request);
    } catch (error) {
      request.log.warn('Failed to parse request body for doc presence update; using empty payload.', {
        docId,
        error,
      });
      body = {};
    }

    upsertDocPresenceStmt.run(docId, auth.user.user_id, toJson(body.cursor_payload ?? null), nowIso());
    send(response, jsonResponse(200, okEnvelope({ updated: true })));
  };

  const createComment = async ({ request, response }) => {
    const auth = await withAuth(request);
    if (auth.error) {
      send(response, auth.error);
      return;
    }

    let body;
    try {
      body = await parseBody(request);
    } catch (error) {
      request.log.warn('Failed to parse request body for comment creation.', { error });
      send(response, jsonResponse(400, errorEnvelope('invalid_json', 'Body must be valid JSON.')));
      return;
    }

    const projectId = asText(body.project_id);
    const targetEntityType = asText(body.target_entity_type);
    const targetEntityId = asText(body.target_entity_id);
    const bodyJson = parseJson(body.body_json, body.body_json || body.body || null);

    if (!projectId || !targetEntityType || !targetEntityId || bodyJson === null) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'project_id, target_entity_type, target_entity_id, body_json are required.')));
      return;
    }

    const projectGate = withProjectPolicyGate({ userId: auth.user.user_id, projectId, requiredCapability: 'comment' });
    if (projectGate.error) {
      send(response, jsonResponse(projectGate.error.status, errorEnvelope(projectGate.error.code, projectGate.error.message)));
      return;
    }
    let targetDocGate = null;
    let targetRecord = null;
    if (targetEntityType === 'doc') {
      targetDocGate = withDocPolicyGate({
        userId: auth.user.user_id,
        docId: targetEntityId,
        requiredCapability: 'comment',
      });
      if (targetDocGate.error) {
        send(response, jsonResponse(targetDocGate.error.status, errorEnvelope(targetDocGate.error.code, targetDocGate.error.message)));
        return;
      }
      if (targetDocGate.project_id !== projectId) {
        send(response, jsonResponse(404, errorEnvelope('not_found', 'Doc not found in project.')));
        return;
      }
    }
    if (targetEntityType === 'record') {
      targetRecord = recordByIdStmt.get(targetEntityId);
      if (!targetRecord || targetRecord.project_id !== projectId) {
        send(response, jsonResponse(404, errorEnvelope('not_found', 'Record not found in project.')));
        return;
      }
    }

    const timestamp = nowIso();
    const commentId = newId('cmt');
    insertCommentStmt.run(commentId, projectId, auth.user.user_id, targetEntityType, targetEntityId, toJson(bodyJson), 'open', timestamp, timestamp);

    const mentionUserIds = deps.normalizeParticipants(projectId, body.mention_user_ids || []);
    const explicitMentions = Array.isArray(body.mentions) ? body.mentions : [];
    const mentions = [
      ...explicitMentions,
      ...mentionUserIds.map((userId) => ({
        target_entity_type: 'user',
        target_entity_id: userId,
        context: { source: 'comment' },
      })),
    ];
    const mentionRows = materializeMentions({
      projectId,
      sourceEntityType: 'comment',
      sourceEntityId: commentId,
      mentions,
      actorUserId: auth.user.user_id,
    });

    emitTimelineEvent({
      projectId,
      actorUserId: auth.user.user_id,
      eventType: 'comment.created',
      primaryEntityType: targetEntityType,
      primaryEntityId: targetEntityId,
      secondaryEntities: [{ entity_type: 'comment', entity_id: commentId }],
      summary: { message: 'Comment created' },
    });
    const notificationContext = notificationContextForSource({
      projectId,
      sourceEntityType: 'comment',
      sourceEntityId: commentId,
    });
    if (targetEntityType === 'record') {
      try {
        const assignees = assignmentsByRecordStmt?.all(targetEntityId) || [];
        for (const assignee of assignees) {
          if (assignee.user_id === auth.user.user_id) {
            continue;
          }
          createNotification({
            projectId,
            userId: assignee.user_id,
            reason: 'comment',
            entityType: 'record',
            entityId: targetEntityId,
            notificationScope: 'network',
            payload: buildNotificationPayload({
              message: `New comment on ${targetRecord?.title || 'a record'}.`,
              ...notificationContext,
              extras: {
                comment_id: commentId,
                target_entity_type: 'record',
                target_entity_id: targetEntityId,
              },
            }),
          });
        }
      } catch (error) {
        request.log.warn('Comment notification fan-out failed for record mentions (best-effort).', {
          commentId,
          error,
        });
      }
    }
    if (targetEntityType === 'doc') {
      try {
        for (const userId of docCollaboratorUserIds({ paneId: targetDocGate?.pane_id, projectId })) {
          if (userId === auth.user.user_id) {
            continue;
          }
          createNotification({
            projectId,
            userId,
            reason: 'comment',
            entityType: 'comment',
            entityId: commentId,
            notificationScope: 'network',
            payload: buildNotificationPayload({
              message: 'New comment on a doc you collaborate on.',
              ...notificationContext,
            }),
          });
        }
      } catch (error) {
        request.log.warn('Comment notification fan-out failed for doc collaborators (best-effort).', {
          commentId,
          error,
        });
      }
    }

    send(
      response,
      jsonResponse(
        201,
        okEnvelope({
          comment_id: commentId,
          mentions: mentionRows,
        }),
      ),
    );
  };

  const createDocAnchorComment = async ({ request, response }) => {
    const auth = await withAuth(request);
    if (auth.error) {
      send(response, auth.error);
      return;
    }

    let body;
    try {
      body = await parseBody(request);
    } catch (error) {
      request.log.warn('Failed to parse request body for doc anchor comment creation.', { error });
      send(response, jsonResponse(400, errorEnvelope('invalid_json', 'Body must be valid JSON.')));
      return;
    }

    const projectId = asText(body.project_id);
    const docId = asText(body.doc_id);
    const anchorPayload = parseJson(body.anchor_payload, body.anchor_payload || null);
    const bodyJson = parseJson(body.body_json, body.body_json || body.body || null);

    if (!projectId || !docId || !anchorPayload || !bodyJson) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'project_id, doc_id, anchor_payload, body_json are required.')));
      return;
    }

    const anchorKind = asText(anchorPayload.kind);
    const nodeKey = asText(anchorPayload.nodeKey);
    if (anchorKind !== 'node' || !nodeKey) {
      send(
        response,
        jsonResponse(400, errorEnvelope('invalid_input', 'Doc comment anchors must be node-based: { kind: "node", nodeKey }.')),
      );
      return;
    }

    const docGate = withDocPolicyGate({
      userId: auth.user.user_id,
      docId,
      requiredCapability: 'comment',
    });
    if (docGate.error) {
      send(response, jsonResponse(docGate.error.status, errorEnvelope(docGate.error.code, docGate.error.message)));
      return;
    }
    if (docGate.project_id !== projectId) {
      send(response, jsonResponse(404, errorEnvelope('not_found', 'Doc not found in project.')));
      return;
    }

    const timestamp = nowIso();
    const commentId = newId('cmt');
    insertCommentStmt.run(commentId, projectId, auth.user.user_id, 'doc', docId, toJson(bodyJson), 'open', timestamp, timestamp);
    insertCommentAnchorStmt.run(
      commentId,
      docId,
      toJson({
        kind: 'node',
        nodeKey,
        context: isPlainObject(anchorPayload.context) ? anchorPayload.context : null,
      }),
      timestamp,
      timestamp,
    );
    const mentionRows = materializeMentions({
      projectId,
      sourceEntityType: 'comment',
      sourceEntityId: commentId,
      mentions: Array.isArray(body.mentions) ? body.mentions : [],
      actorUserId: auth.user.user_id,
    });

    emitTimelineEvent({
      projectId,
      actorUserId: auth.user.user_id,
      eventType: 'doc.comment_created',
      primaryEntityType: 'doc',
      primaryEntityId: docId,
      secondaryEntities: [{ entity_type: 'comment', entity_id: commentId }],
      summary: { message: 'Doc node comment created', node_key: nodeKey },
    });
    const notificationContext = notificationContextForSource({
      projectId,
      sourceEntityType: 'comment',
      sourceEntityId: commentId,
      context: { nodeKey },
    });
    try {
      for (const userId of docCollaboratorUserIds({ paneId: docGate.pane_id, projectId })) {
        if (userId === auth.user.user_id) {
          continue;
        }
        createNotification({
          projectId,
          userId,
          reason: 'comment',
          entityType: 'comment',
          entityId: commentId,
          notificationScope: 'network',
          payload: buildNotificationPayload({
            message: 'New comment on a doc you collaborate on.',
            ...notificationContext,
          }),
        });
      }
    } catch (error) {
      request.log.warn('Doc anchor comment notification fan-out failed (best-effort).', {
        commentId,
        error,
      });
    }

    send(response, jsonResponse(201, okEnvelope({ comment_id: commentId, mentions: mentionRows })));
  };

  const updateCommentStatus = async ({ request, response, params }) => {
    const auth = await withAuth(request);
    if (auth.error) {
      send(response, auth.error);
      return;
    }

    const commentId = params.commentId;
    const comment = commentByIdStmt.get(commentId);
    if (!comment) {
      send(response, jsonResponse(404, errorEnvelope('not_found', 'Comment not found.')));
      return;
    }
    if (comment.target_entity_type === 'doc') {
      const docGate = withDocPolicyGate({
        userId: auth.user.user_id,
        docId: comment.target_entity_id,
        requiredCapability: 'comment',
      });
      if (docGate.error) {
        send(response, jsonResponse(docGate.error.status, errorEnvelope(docGate.error.code, docGate.error.message)));
        return;
      }
    } else {
      const projectGate = withProjectPolicyGate({
        userId: auth.user.user_id,
        projectId: comment.project_id,
        requiredCapability: 'comment',
      });
      if (projectGate.error) {
        send(response, jsonResponse(projectGate.error.status, errorEnvelope(projectGate.error.code, projectGate.error.message)));
        return;
      }
    }

    let body;
    try {
      body = await parseBody(request);
    } catch (error) {
      request.log.warn('Failed to parse request body for comment status update.', { error });
      send(response, jsonResponse(400, errorEnvelope('invalid_json', 'Body must be valid JSON.')));
      return;
    }

    const status = asText(body.status);
    if (!commentStatusSet.has(status)) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'Status must be open or resolved.')));
      return;
    }

    updateCommentStatusStmt.run(status, nowIso(), commentId);
    if (status === 'resolved') {
      emitTimelineEvent({
        projectId: comment.project_id,
        actorUserId: auth.user.user_id,
        eventType: 'comment.resolved',
        primaryEntityType: comment.target_entity_type,
        primaryEntityId: comment.target_entity_id,
        secondaryEntities: [{ entity_type: 'comment', entity_id: commentId }],
        summary: { message: 'Comment resolved' },
      });
    }
    send(response, jsonResponse(200, okEnvelope({ comment_id: commentId, status })));
  };

  const listComments = async ({ request, response, requestUrl }) => {
    const auth = await withAuth(request);
    if (auth.error) {
      send(response, auth.error);
      return;
    }

    const projectId = asText(requestUrl.searchParams.get('project_id'));
    const targetEntityType = asText(requestUrl.searchParams.get('target_entity_type'));
    const targetEntityId = asText(requestUrl.searchParams.get('target_entity_id'));
    const docId = asText(requestUrl.searchParams.get('doc_id'));

    if (!projectId) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'project_id is required.')));
      return;
    }

    const projectGate = withProjectPolicyGate({ userId: auth.user.user_id, projectId, requiredCapability: 'view' });
    if (projectGate.error) {
      send(response, jsonResponse(projectGate.error.status, errorEnvelope(projectGate.error.code, projectGate.error.message)));
      return;
    }

    if (docId) {
      const docGate = withDocPolicyGate({
        userId: auth.user.user_id,
        docId,
        requiredCapability: 'view',
      });
      if (docGate.error) {
        send(response, jsonResponse(docGate.error.status, errorEnvelope(docGate.error.code, docGate.error.message)));
        return;
      }
      if (docGate.project_id !== projectId) {
        send(response, jsonResponse(404, errorEnvelope('not_found', 'Doc not found in project.')));
        return;
      }

      const docSnapshot = docByIdStmt.get(docId);
      const snapshotPayload = parseJson(docSnapshot?.snapshot_payload, {});
      const nodeState = extractDocNodeKeyState(snapshotPayload);

      const allAnchors = commentAnchorsByDocStmt.all(docId).map((row) => {
        const anchorPayload = parseJsonObject(row.anchor_payload, {});
        const nodeKey = asText(anchorPayload.nodeKey);
        const isOrphaned = nodeState.hasSignal ? !nodeState.nodeKeys.has(nodeKey) : false;
        return {
          comment_id: row.comment_id,
          doc_id: row.doc_id,
          anchor_payload: {
            ...anchorPayload,
            kind: 'node',
            nodeKey,
          },
          body_json: parseJson(row.body_json, {}),
          status: row.status,
          author_user_id: row.author_user_id,
          created_at: row.comment_created_at,
          orphaned: isOrphaned,
          is_orphaned: isOrphaned,
        };
      });

      const comments = allAnchors.filter((row) => !row.is_orphaned);
      const orphanedComments = allAnchors.filter((row) => row.is_orphaned);

      send(response, jsonResponse(200, okEnvelope({ comments, orphaned_comments: orphanedComments })));
      return;
    }

    if (!targetEntityType || !targetEntityId) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'target_entity_type and target_entity_id are required when doc_id is absent.')));
      return;
    }

    if (targetEntityType === 'doc') {
      const docGate = withDocPolicyGate({
        userId: auth.user.user_id,
        docId: targetEntityId,
        requiredCapability: 'view',
      });
      if (docGate.error) {
        send(response, jsonResponse(docGate.error.status, errorEnvelope(docGate.error.code, docGate.error.message)));
        return;
      }
      if (docGate.project_id !== projectId) {
        send(response, jsonResponse(404, errorEnvelope('not_found', 'Doc not found in project.')));
        return;
      }
    }

    const comments = commentsByTargetStmt.all(projectId, targetEntityType, targetEntityId).map((row) => ({
      comment_id: row.comment_id,
      project_id: row.project_id,
      author_user_id: row.author_user_id,
      target_entity_type: row.target_entity_type,
      target_entity_id: row.target_entity_id,
      body_json: parseJson(row.body_json, {}),
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
    send(response, jsonResponse(200, okEnvelope({ comments })));
  };

  const materializeCommentMentions = async ({ request, response }) => {
    const auth = await withAuth(request);
    if (auth.error) {
      send(response, auth.error);
      return;
    }

    let body;
    try {
      body = await parseBody(request);
    } catch (error) {
      request.log.warn('Failed to parse request body for mention materialization.', { error });
      send(response, jsonResponse(400, errorEnvelope('invalid_json', 'Body must be valid JSON.')));
      return;
    }

    const projectId = asText(body.project_id);
    if (!projectId) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'project_id is required.')));
      return;
    }
    const projectGate = withProjectPolicyGate({ userId: auth.user.user_id, projectId, requiredCapability: 'comment' });
    if (projectGate.error) {
      send(response, jsonResponse(projectGate.error.status, errorEnvelope(projectGate.error.code, projectGate.error.message)));
      return;
    }

    const sourceEntityType = asText(body.source_entity_type);
    const sourceEntityId = asText(body.source_entity_id);
    if (!sourceEntityType || !sourceEntityId) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'source_entity_type and source_entity_id are required.')));
      return;
    }

    if (sourceEntityType === 'doc') {
      const docGate = withDocPolicyGate({
        userId: auth.user.user_id,
        docId: sourceEntityId,
        requiredCapability: 'write',
      });
      if (docGate.error) {
        send(response, jsonResponse(docGate.error.status, errorEnvelope(docGate.error.code, docGate.error.message)));
        return;
      }
      if (docGate.project_id !== projectId) {
        send(response, jsonResponse(400, errorEnvelope('invalid_input', 'Doc must belong to project_id.')));
        return;
      }
    }
    if (sourceEntityType === 'comment') {
      const comment = commentByIdStmt.get(sourceEntityId);
      if (!comment || comment.project_id !== projectId) {
        send(response, jsonResponse(404, errorEnvelope('not_found', 'Comment source not found in project.')));
        return;
      }
      const membership = projectMembershipRoleStmt.get(projectId, auth.user.user_id);
      const membershipRole = membershipRoleLabel(membership?.role || 'member');
      const canMutateCommentMentions =
        comment.author_user_id === auth.user.user_id || membershipRole === 'owner';
      if (!canMutateCommentMentions) {
        send(response, jsonResponse(403, errorEnvelope('forbidden', 'Comment mention mutation not permitted.')));
        return;
      }
      if (comment.target_entity_type === 'doc') {
        const docGate = requireDocAccess(comment.target_entity_id, auth.user.user_id);
        if (docGate.error) {
          send(response, jsonResponse(docGate.error.status, errorEnvelope(docGate.error.code, docGate.error.message)));
          return;
        }
      }
    }

    const mentions = materializeMentions({
      projectId,
      sourceEntityType,
      sourceEntityId,
      mentions: Array.isArray(body.mentions) ? body.mentions : [],
      actorUserId: auth.user.user_id,
      replaceSource: asBoolean(body.replace_source, false),
    });

    send(response, jsonResponse(200, okEnvelope({ mentions })));
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

    const docGate = withDocPolicyGate({ userId: auth.user.user_id, docId, requiredCapability: 'write' });
    if (docGate.error) {
      send(response, jsonResponse(docGate.error.status, errorEnvelope(docGate.error.code, docGate.error.message)));
      return;
    }

    const ticket = issueCollabTicket({
      docId,
      paneId: docGate.pane_id,
      projectId: docGate.project_id,
      userId: auth.user.user_id,
      displayName: auth.user.display_name,
      accessToken: auth.token,
    });

    send(
      response,
      jsonResponse(
        200,
        okEnvelope({
          authorization: {
            doc_id: docId,
            pane_id: docGate.pane_id,
            project_id: docGate.project_id,
            user_id: auth.user.user_id,
            display_name: auth.user.display_name,
            can_edit: true,
            ws_ticket: ticket.ws_ticket,
            ticket_issued_at: ticket.issued_at,
            ticket_expires_at: ticket.expires_at,
            ticket_expires_in_ms: ticket.expires_in_ms,
          },
        }),
      ),
    );
  };

  const consumeCollab = async ({ request, response }) => {
    let body;
    try {
      body = await parseBody(request);
    } catch (error) {
      request.log.warn('Failed to parse request body for collab ticket consume.', { error });
      send(response, jsonResponse(400, errorEnvelope('invalid_json', 'Body must be valid JSON.')));
      return;
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      send(response, jsonResponse(400, errorEnvelope('invalid_json', 'Body must be valid JSON.')));
      return;
    }

    const docId = asText(body.doc_id);
    const wsTicket = asText(body.ws_ticket);
    if (!docId || !wsTicket) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'doc_id and ws_ticket are required.')));
      return;
    }

    const consumed = consumeCollabTicket({ wsTicket, docId });
    if (consumed.error) {
      send(response, jsonResponse(consumed.error.status, errorEnvelope(consumed.error.code, consumed.error.message)));
      return;
    }

    send(response, jsonResponse(200, okEnvelope({ ticket: consumed.ticket })));
  };

  return {
    authorizeCollab,
    consumeCollab,
    createComment,
    createDocAnchorComment,
    getDoc,
    listComments,
    materializeCommentMentions,
    updateCommentStatus,
    updateDoc,
    updateDocPresence,
  };
};
