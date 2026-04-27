export const createProjectRoutes = (deps) => {
  const {
    withAuth,
    withTransaction,
    withProjectPolicyGate,
    withWorkProjectPolicyGate,
    send,
    jsonResponse,
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
    projectSummary,
    normalizeProjectRole,
    projectsBySpaceStmt,
    projectNextSortStmt,
    projectMembershipExistsStmt,
    projectMembershipRoleStmt,
    projectMembersByProjectStmt,
    workProjectByIdStmt,
    insertWorkProjectStmt,
    insertDocStmt,
    insertDocStorageStmt,
    insertWorkProjectMemberStmt,
    updateWorkProjectStmt,
    deleteWorkProjectStmt,
    deleteWorkProjectMemberStmt,
  } = deps;
  const workOkEnvelope = (data) => ({ ok: true, data, error: null });

  const listProjectProjects = async ({ request, response, params }) => {
    const auth = await withAuth(request);
    if (auth.error) {
      send(response, auth.error);
      return;
    }

    const spaceId = params.projectId;
    const projectGate = withProjectPolicyGate({
      userId: auth.user.user_id,
      projectId: spaceId,
      requiredCapability: 'view',
    });
    if (projectGate.error) {
      send(response, jsonResponse(projectGate.error.status, errorEnvelope(projectGate.error.code, projectGate.error.message)));
      return;
    }

    const projects = projectsBySpaceStmt
      .all(spaceId)
      .filter((project) => !withWorkProjectPolicyGate({
        userId: auth.user.user_id,
        projectId: project.project_id,
        requiredCapability: 'view',
      }).error)
      .map((project) => projectSummary(project, auth.user.user_id));
    send(response, jsonResponse(200, workOkEnvelope({ projects })));
  };

  const createProjectProject = async ({ request, response, params }) => {
    const auth = await withAuth(request);
    if (auth.error) {
      send(response, auth.error);
      return;
    }

    const spaceId = params.projectId;
    const projectGate = withProjectPolicyGate({
      userId: auth.user.user_id,
      projectId: spaceId,
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
      request.log.warn('Failed to parse request body for project creation.', { error });
      send(response, parseBody.errorResponse(error));
      return;
    }

    const name = asText(body.name) || 'Untitled Project';
    const pinned = asBoolean(body.pinned, false);
    const layoutConfig = parseJsonObject(body.layout_config, {});
    const nextSort = asInteger(body.sort_order, Number(projectNextSortStmt.get(spaceId)?.max_sort || 0) + 1, 0, 100000);
    const nextPosition = asInteger(body.position, nextSort, 0, 100000);
    const workProjectId = newId('prj');
    const docId = newId('doc');
    const now = nowIso();

    const requestedEditors = Array.isArray(body.member_user_ids) ? body.member_user_ids.map((value) => asText(value)).filter(Boolean) : [];
    const editorUserIds = [...new Set(requestedEditors)];
    for (const userId of editorUserIds) {
      const membership = projectMembershipExistsStmt.get(spaceId, userId);
      if (!membership?.ok) {
        send(response, jsonResponse(400, errorEnvelope('invalid_members', `User ${userId} is not a space member.`)));
        return;
      }
    }

    withTransaction(() => {
      insertWorkProjectStmt.run(
        workProjectId,
        spaceId,
        name,
        nextSort,
        nextPosition,
        pinned ? 1 : 0,
        toJson(layoutConfig),
        auth.user.user_id,
        now,
        now,
      );
      insertDocStmt.run(docId, workProjectId, now, now);
      insertDocStorageStmt.run(docId, 0, toJson({}), now);

      for (const userId of editorUserIds) {
        if (normalizeProjectRole(projectMembershipRoleStmt.get(spaceId, userId)?.role) !== 'owner') {
          insertWorkProjectMemberStmt.run(workProjectId, userId, now);
        }
      }
    });

    emitTimelineEvent({
      projectId: spaceId,
      actorUserId: auth.user.user_id,
      eventType: 'project.created',
      primaryEntityType: 'project',
      primaryEntityId: workProjectId,
      summary: { message: `Project created: ${name}` },
    });
    try {
      const projectMembers = projectMembersByProjectStmt.all(spaceId);
      for (const member of projectMembers) {
        if (member.user_id === auth.user.user_id) {
          continue;
        }
        createNotification({
          projectId: spaceId,
          userId: member.user_id,
          reason: 'automation',
          entityType: 'project',
          entityId: workProjectId,
          notificationScope: 'network',
          payload: buildNotificationPayload({
            message: `New project created: ${name}`,
            sourceProjectId: workProjectId,
          }),
        });
      }
    } catch (error) {
      request.log.warn('Project creation notification fan-out failed (best-effort).', {
        projectId: workProjectId,
        spaceId,
        error,
      });
    }

    const project = workProjectByIdStmt.get(workProjectId);
    send(response, jsonResponse(201, workOkEnvelope({ project: projectSummary(project, auth.user.user_id) })));
  };

  const updateProject = async ({ request, response, params }) => {
    const auth = await withAuth(request);
    if (auth.error) {
      send(response, auth.error);
      return;
    }
    const workProjectId = params.projectId;
    const projectGate = withWorkProjectPolicyGate({
      userId: auth.user.user_id,
      projectId: workProjectId,
      requiredCapability: 'manage',
    });
    if (projectGate.error) {
      send(response, jsonResponse(projectGate.error.status, errorEnvelope(projectGate.error.code, projectGate.error.message)));
      return;
    }
    const project = projectGate.project;

    let body;
    try {
      body = await parseBody(request);
    } catch (error) {
      request.log.warn('Failed to parse request body for project update.', { error });
      send(response, parseBody.errorResponse(error));
      return;
    }

    const name = asText(body.name) || project.name;
    const sortOrder = asInteger(body.sort_order, project.sort_order, 0, 100000);
    const position = body.position === null
      ? null
      : asInteger(body.position, typeof project.position === 'number' ? project.position : project.sort_order, 0, 100000);
    const pinned = asBoolean(body.pinned, project.pinned === 1);
    const layoutConfig = body.layout_config !== undefined ? parseJsonObject(body.layout_config, {}) : parseJsonObject(project.layout_config, {});

    updateWorkProjectStmt.run(name, sortOrder, position, pinned ? 1 : 0, toJson(layoutConfig), nowIso(), workProjectId);
    const updated = workProjectByIdStmt.get(workProjectId);

    emitTimelineEvent({
      projectId: project.space_id,
      actorUserId: auth.user.user_id,
      eventType: 'project.updated',
      primaryEntityType: 'project',
      primaryEntityId: workProjectId,
      summary: { message: `Project updated: ${name}` },
    });

    send(response, jsonResponse(200, workOkEnvelope({ project: projectSummary(updated, auth.user.user_id) })));
  };

  const deleteProject = async ({ request, response, params }) => {
    const auth = await withAuth(request);
    if (auth.error) {
      send(response, auth.error);
      return;
    }

    const workProjectId = params.projectId;
    const projectGate = withWorkProjectPolicyGate({
      userId: auth.user.user_id,
      projectId: workProjectId,
      requiredCapability: 'write',
    });
    if (projectGate.error) {
      send(response, jsonResponse(projectGate.error.status, errorEnvelope(projectGate.error.code, projectGate.error.message)));
      return;
    }
    const project = projectGate.project;

    deleteWorkProjectStmt.run(workProjectId);

    emitTimelineEvent({
      projectId: project.space_id,
      actorUserId: auth.user.user_id,
      eventType: 'project.deleted',
      primaryEntityType: 'project',
      primaryEntityId: workProjectId,
      summary: { message: `Project deleted: ${project.name}` },
    });

    send(response, jsonResponse(200, workOkEnvelope({ deleted: true })));
  };

  const addProjectMember = async ({ request, response, params }) => {
    const auth = await withAuth(request);
    if (auth.error) {
      send(response, auth.error);
      return;
    }

    const workProjectId = params.projectId;
    const projectGate = withWorkProjectPolicyGate({
      userId: auth.user.user_id,
      projectId: workProjectId,
      requiredCapability: 'manage',
    });
    if (projectGate.error) {
      send(response, jsonResponse(projectGate.error.status, errorEnvelope(projectGate.error.code, projectGate.error.message)));
      return;
    }
    if (!projectGate.is_owner) {
      send(response, jsonResponse(403, errorEnvelope('forbidden', 'Only space owners can add project editors.')));
      return;
    }
    const project = projectGate.project;

    let body;
    try {
      body = await parseBody(request);
    } catch (error) {
      request.log.warn('Failed to parse request body for project member add.', { error });
      send(response, parseBody.errorResponse(error));
      return;
    }

    const userId = asText(body.user_id);
    if (!userId) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'user_id is required.')));
      return;
    }

    const membership = projectMembershipExistsStmt.get(project.space_id, userId);
    if (!membership?.ok) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'Project members must be space members.')));
      return;
    }

    if (normalizeProjectRole(projectMembershipRoleStmt.get(project.space_id, userId)?.role) !== 'owner') {
      insertWorkProjectMemberStmt.run(workProjectId, userId, nowIso());
    }

    emitTimelineEvent({
      projectId: project.space_id,
      actorUserId: auth.user.user_id,
      eventType: 'project.member_added',
      primaryEntityType: 'project',
      primaryEntityId: workProjectId,
      secondaryEntities: [{ entity_type: 'user', entity_id: userId }],
      summary: { message: 'Project member added' },
    });

    send(response, jsonResponse(200, workOkEnvelope({ project: projectSummary(workProjectByIdStmt.get(workProjectId), auth.user.user_id) })));
  };

  const removeProjectMember = async ({ request, response, params }) => {
    const auth = await withAuth(request);
    if (auth.error) {
      send(response, auth.error);
      return;
    }

    const { projectId: workProjectId, userId } = params;
    const projectGate = withWorkProjectPolicyGate({
      userId: auth.user.user_id,
      projectId: workProjectId,
      requiredCapability: 'manage',
    });
    if (projectGate.error) {
      send(response, jsonResponse(projectGate.error.status, errorEnvelope(projectGate.error.code, projectGate.error.message)));
      return;
    }
    if (!projectGate.is_owner) {
      send(response, jsonResponse(403, errorEnvelope('forbidden', 'Only space owners can remove project editors.')));
      return;
    }
    const project = projectGate.project;

    deleteWorkProjectMemberStmt.run(workProjectId, userId);

    emitTimelineEvent({
      projectId: project.space_id,
      actorUserId: auth.user.user_id,
      eventType: 'project.member_removed',
      primaryEntityType: 'project',
      primaryEntityId: workProjectId,
      secondaryEntities: [{ entity_type: 'user', entity_id: userId }],
      summary: { message: 'Project member removed' },
    });

    send(response, jsonResponse(200, workOkEnvelope({ removed: true })));
  };

  return {
    addProjectMember,
    createProjectProject,
    deleteProject,
    listProjectProjects,
    removeProjectMember,
    updateProject,
  };
};
