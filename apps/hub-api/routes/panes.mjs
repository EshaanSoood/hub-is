export const createPaneRoutes = (deps) => {
  const {
    withAuth,
    withTransaction,
    withProjectPolicyGate,
    withPanePolicyGate,
    send,
    jsonResponse,
    okEnvelope,
    errorEnvelope,
    parseBody,
    asText,
    asBoolean,
    asInteger,
    parseJsonObject,
    nowIso,
    newId,
    toJson,
    emitTimelineEvent,
    buildNotificationPayload,
    createNotification,
    paneSummary,
    normalizeProjectRole,
    paneListForUserByProjectStmt,
    paneNextSortStmt,
    projectMembershipExistsStmt,
    projectMembershipRoleStmt,
    projectMembersByProjectStmt,
    paneByIdStmt,
    insertPaneStmt,
    insertDocStmt,
    insertDocStorageStmt,
    insertPaneMemberStmt,
    updatePaneStmt,
    deletePaneStmt,
    deletePaneMemberStmt,
  } = deps;

  const listProjectPanes = async ({ request, response, params }) => {
    const auth = await withAuth(request);
    if (auth.error) {
      send(response, auth.error);
      return;
    }

    const projectId = params.projectId;
    const projectGate = withProjectPolicyGate({
      userId: auth.user.user_id,
      projectId,
      requiredCapability: 'view',
    });
    if (projectGate.error) {
      send(response, jsonResponse(projectGate.error.status, errorEnvelope(projectGate.error.code, projectGate.error.message)));
      return;
    }

    const panes = paneListForUserByProjectStmt.all(projectId).map((pane) => paneSummary(pane, auth.user.user_id));
    send(response, jsonResponse(200, okEnvelope({ panes })));
  };

  const createProjectPane = async ({ request, response, params }) => {
    const auth = await withAuth(request);
    if (auth.error) {
      send(response, auth.error);
      return;
    }

    const projectId = params.projectId;
    const projectGate = withProjectPolicyGate({
      userId: auth.user.user_id,
      projectId,
      requiredCapability: 'write',
    });
    if (projectGate.error) {
      send(response, jsonResponse(projectGate.error.status, errorEnvelope(projectGate.error.code, projectGate.error.message)));
      return;
    }

    let body;
    try {
      body = await parseBody(request);
    } catch (error) {
      request.log.warn('Failed to parse request body for pane creation.', { error });
      send(response, parseBody.errorResponse(error));
      return;
    }

    const name = asText(body.name) || 'Untitled Pane';
    const pinned = asBoolean(body.pinned, false);
    const layoutConfig = parseJsonObject(body.layout_config, {});
    const nextSort = asInteger(body.sort_order, Number(paneNextSortStmt.get(projectId)?.max_sort || 0) + 1, 0, 100000);
    const nextPosition = asInteger(body.position, nextSort, 0, 100000);

    const paneId = newId('pan');
    const docId = newId('doc');
    const now = nowIso();

    const requestedEditors = Array.isArray(body.member_user_ids) ? body.member_user_ids.map((value) => asText(value)).filter(Boolean) : [];
    const editorUserIds = [...new Set(requestedEditors)];
    for (const userId of editorUserIds) {
      const membership = projectMembershipExistsStmt.get(projectId, userId);
      if (!membership?.ok) {
        send(response, jsonResponse(400, errorEnvelope('invalid_members', `User ${userId} is not a project member.`)));
        return;
      }
    }

    withTransaction(() => {
      insertPaneStmt.run(
        paneId,
        projectId,
        name,
        nextSort,
        nextPosition,
        pinned ? 1 : 0,
        toJson(layoutConfig),
        auth.user.user_id,
        now,
        now,
      );
      insertDocStmt.run(docId, paneId, now, now);
      insertDocStorageStmt.run(docId, 0, toJson({}), now);

      for (const userId of editorUserIds) {
        if (normalizeProjectRole(projectMembershipRoleStmt.get(projectId, userId)?.role) !== 'owner') {
          insertPaneMemberStmt.run(paneId, userId, now);
        }
      }
    });

    emitTimelineEvent({
      projectId,
      actorUserId: auth.user.user_id,
      eventType: 'pane.created',
      primaryEntityType: 'pane',
      primaryEntityId: paneId,
      summary: { message: `Pane created: ${name}` },
    });
    try {
      const projectMembers = projectMembersByProjectStmt.all(projectId);
      for (const member of projectMembers) {
        if (member.user_id === auth.user.user_id) {
          continue;
        }
        createNotification({
          projectId,
          userId: member.user_id,
          reason: 'automation',
          entityType: 'pane',
          entityId: paneId,
          notificationScope: 'network',
          payload: buildNotificationPayload({
            message: `New pane created: ${name}`,
            sourceProjectId: projectId,
            sourcePaneId: paneId,
          }),
        });
      }
    } catch (error) {
      request.log.warn('Pane creation notification fan-out failed (best-effort).', {
        paneId,
        projectId,
        error,
      });
    }

    const pane = paneByIdStmt.get(paneId);
    send(response, jsonResponse(201, okEnvelope({ pane: paneSummary(pane, auth.user.user_id) })));
  };

  const updatePane = async ({ request, response, params }) => {
    const auth = await withAuth(request);
    if (auth.error) {
      send(response, auth.error);
      return;
    }
    const paneId = params.paneId;
    const paneGate = withPanePolicyGate({
      userId: auth.user.user_id,
      paneId,
      requiredCapability: 'manage',
    });
    if (paneGate.error) {
      send(response, jsonResponse(paneGate.error.status, errorEnvelope(paneGate.error.code, paneGate.error.message)));
      return;
    }
    const pane = paneGate.pane;

    let body;
    try {
      body = await parseBody(request);
    } catch (error) {
      request.log.warn('Failed to parse request body for pane update.', { error });
      send(response, parseBody.errorResponse(error));
      return;
    }

    const name = asText(body.name) || pane.name;
    const sortOrder = asInteger(body.sort_order, pane.sort_order, 0, 100000);
    const position = body.position === null
      ? null
      : asInteger(body.position, typeof pane.position === 'number' ? pane.position : pane.sort_order, 0, 100000);
    const pinned = asBoolean(body.pinned, pane.pinned === 1);
    const layoutConfig = body.layout_config !== undefined ? parseJsonObject(body.layout_config, {}) : parseJsonObject(pane.layout_config, {});

    updatePaneStmt.run(name, sortOrder, position, pinned ? 1 : 0, toJson(layoutConfig), nowIso(), paneId);
    const updated = paneByIdStmt.get(paneId);

    emitTimelineEvent({
      projectId: pane.project_id,
      actorUserId: auth.user.user_id,
      eventType: 'pane.updated',
      primaryEntityType: 'pane',
      primaryEntityId: paneId,
      summary: { message: `Pane updated: ${name}` },
    });

    send(response, jsonResponse(200, okEnvelope({ pane: paneSummary(updated, auth.user.user_id) })));
  };

  const deletePane = async ({ request, response, params }) => {
    const auth = await withAuth(request);
    if (auth.error) {
      send(response, auth.error);
      return;
    }

    const paneId = params.paneId;
    const paneGate = withPanePolicyGate({
      userId: auth.user.user_id,
      paneId,
      requiredCapability: 'write',
    });
    if (paneGate.error) {
      send(response, jsonResponse(paneGate.error.status, errorEnvelope(paneGate.error.code, paneGate.error.message)));
      return;
    }
    const pane = paneGate.pane;

    deletePaneStmt.run(paneId);

    emitTimelineEvent({
      projectId: pane.project_id,
      actorUserId: auth.user.user_id,
      eventType: 'pane.deleted',
      primaryEntityType: 'pane',
      primaryEntityId: paneId,
      summary: { message: `Pane deleted: ${pane.name}` },
    });

    send(response, jsonResponse(200, okEnvelope({ deleted: true })));
  };

  const addPaneMember = async ({ request, response, params }) => {
    const auth = await withAuth(request);
    if (auth.error) {
      send(response, auth.error);
      return;
    }

    const paneId = params.paneId;
    const paneGate = withPanePolicyGate({
      userId: auth.user.user_id,
      paneId,
      requiredCapability: 'manage',
    });
    if (paneGate.error) {
      send(response, jsonResponse(paneGate.error.status, errorEnvelope(paneGate.error.code, paneGate.error.message)));
      return;
    }
    if (!paneGate.is_owner) {
      send(response, jsonResponse(403, errorEnvelope('forbidden', 'Only project owners can add pane editors.')));
      return;
    }
    const pane = paneGate.pane;

    let body;
    try {
      body = await parseBody(request);
    } catch (error) {
      request.log.warn('Failed to parse request body for pane member add.', { error });
      send(response, parseBody.errorResponse(error));
      return;
    }

    const userId = asText(body.user_id);
    if (!userId) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'user_id is required.')));
      return;
    }

    const membership = projectMembershipExistsStmt.get(pane.project_id, userId);
    if (!membership?.ok) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'Pane members must be project members.')));
      return;
    }

    if (normalizeProjectRole(projectMembershipRoleStmt.get(pane.project_id, userId)?.role) !== 'owner') {
      insertPaneMemberStmt.run(paneId, userId, nowIso());
    }

    emitTimelineEvent({
      projectId: pane.project_id,
      actorUserId: auth.user.user_id,
      eventType: 'pane.member_added',
      primaryEntityType: 'pane',
      primaryEntityId: paneId,
      secondaryEntities: [{ entity_type: 'user', entity_id: userId }],
      summary: { message: 'Pane member added' },
    });

    send(response, jsonResponse(200, okEnvelope({ pane: paneSummary(paneByIdStmt.get(paneId), auth.user.user_id) })));
  };

  const removePaneMember = async ({ request, response, params }) => {
    const auth = await withAuth(request);
    if (auth.error) {
      send(response, auth.error);
      return;
    }

    const { paneId, userId } = params;
    const paneGate = withPanePolicyGate({
      userId: auth.user.user_id,
      paneId,
      requiredCapability: 'manage',
    });
    if (paneGate.error) {
      send(response, jsonResponse(paneGate.error.status, errorEnvelope(paneGate.error.code, paneGate.error.message)));
      return;
    }
    if (!paneGate.is_owner) {
      send(response, jsonResponse(403, errorEnvelope('forbidden', 'Only project owners can remove pane editors.')));
      return;
    }
    const pane = paneGate.pane;

    deletePaneMemberStmt.run(paneId, userId);

    emitTimelineEvent({
      projectId: pane.project_id,
      actorUserId: auth.user.user_id,
      eventType: 'pane.member_removed',
      primaryEntityType: 'pane',
      primaryEntityId: paneId,
      secondaryEntities: [{ entity_type: 'user', entity_id: userId }],
      summary: { message: 'Pane member removed' },
    });

    send(response, jsonResponse(200, okEnvelope({ removed: true })));
  };

  return {
    addPaneMember,
    createProjectPane,
    deletePane,
    listProjectPanes,
    removePaneMember,
    updatePane,
  };
};
