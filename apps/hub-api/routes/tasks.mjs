export const createTaskRoutes = (deps) => {
  const {
    withPolicyGate,
    withProjectPolicyGate,
    send,
    jsonResponse,
    okEnvelope,
    errorEnvelope,
    parseBody,
    asInteger,
    asText,
    asBoolean,
    asNullableText,
    parseCursorOffset,
    encodeCursorOffset,
    notificationRecord,
    buildTaskSummaryForUser,
    buildPersonalTaskSummaryFromRecord,
    buildHomeEventSummary,
    createPersonalTaskRecord,
    personalProjectIdForUser,
    projectMembershipsByUserStmt,
    personalProjectByUserStmt,
    notificationsByUserStmt,
    unreadNotificationsByUserStmt,
    visibleProjectTasksStmt,
    assignedTasksStmt,
    homeEventsByProjectStmt,
    personalCapturesStmt,
  } = deps;

  const visibleProjectIdsForUser = (userId) =>
    projectMembershipsByUserStmt.all(userId).map((membership) => membership.project_id);

  const compareTasksByUpdatedAt = (left, right) => {
    const leftUpdatedAt = new Date(left.updated_at || 0).getTime();
    const rightUpdatedAt = new Date(right.updated_at || 0).getTime();
    if (rightUpdatedAt !== leftUpdatedAt) {
      return rightUpdatedAt - leftUpdatedAt;
    }
    return String(right.record_id || '').localeCompare(String(left.record_id || ''));
  };

  const elapsedMs = (startedAtMs) => Number((performance.now() - startedAtMs).toFixed(2));

  // buildTaskSummaryForUser keeps project_id/project_name/task_state.category aligned across task endpoints.
  // visibleProjectTasksStmt excludes subtasks from top-level listings with r.parent_record_id IS NULL.
  const listVisibleProjectTasksForUser = ({ userId, projectId = '' }) => {
    const visibleProjectIds = visibleProjectIdsForUser(userId);
    const personalProjectId = personalProjectIdForUser(userId);
    const tasks = [];
    for (const visibleProjectId of visibleProjectIds) {
      if (projectId && visibleProjectId !== projectId) {
        continue;
      }
      const records = visibleProjectTasksStmt.all(visibleProjectId);
      for (const record of records) {
        tasks.push(buildTaskSummaryForUser(record, personalProjectId));
      }
    }
    return tasks.sort(compareTasksByUpdatedAt);
  };

  const listAssignedTasksForUser = ({ userId, projectId = '' }) => {
    const visibleProjectIds = new Set(visibleProjectIdsForUser(userId));
    const personalProjectId = personalProjectIdForUser(userId);
    const rows = assignedTasksStmt.all(userId);
    return rows
      .filter((row) => visibleProjectIds.has(row.project_id) && (!projectId || row.project_id === projectId))
      .map((row) => buildTaskSummaryForUser(row, personalProjectId));
  };

  const listHomeEventsForUser = ({ userId, limit }) => {
    const visibleProjectIds = visibleProjectIdsForUser(userId);
    const rows = [];
    for (const projectId of visibleProjectIds) {
      const projectRows = homeEventsByProjectStmt.all(projectId);
      rows.push(...projectRows);
    }
    const nowMs = Date.now();
    return rows
      .filter((row) => new Date(row.end_dt || 0).getTime() >= nowMs - 86_400_000)
      .sort((left, right) => {
        const leftStart = new Date(left.start_dt || left.updated_at).getTime();
        const rightStart = new Date(right.start_dt || right.updated_at).getTime();
        return leftStart - rightStart;
      })
      .slice(0, limit)
      .map(buildHomeEventSummary);
  };

  const listPersonalCapturesForUser = ({ projectId, limit }) =>
    personalCapturesStmt.all(projectId, limit).map((row) => ({
      record_id: row.record_id,
      project_id: row.project_id,
      collection_id: row.collection_id,
      title: row.title,
      created_at: row.created_at,
    }));

  const getHubTasks = withPolicyGate('hub.view', async ({ response, requestUrl, auth }) => {
    const lens = asText(requestUrl.searchParams.get('lens')).toLowerCase() || 'assigned';
    const projectId = asText(requestUrl.searchParams.get('project_id'));
    const limit = asInteger(requestUrl.searchParams.get('limit'), 50, 1, 200);
    const offset = parseCursorOffset(requestUrl.searchParams.get('cursor'));
    const personalProject = personalProjectByUserStmt.get(auth.user.user_id, auth.user.user_id);
    if (!personalProject) {
      request.log.error('Personal project is unavailable during task listing.', { userId: auth.user.user_id });
      send(response, jsonResponse(500, errorEnvelope('internal_error', 'Internal server error.')));
      return;
    }

    let tasks = [];
    if (lens === 'project' && projectId) {
      const projectGate = withProjectPolicyGate({ userId: auth.user.user_id, projectId, requiredCapability: 'view' });
      if (projectGate.error) {
        send(response, jsonResponse(projectGate.error.status, errorEnvelope(projectGate.error.code, projectGate.error.message)));
        return;
      }
      tasks = listVisibleProjectTasksForUser({ userId: auth.user.user_id, projectId });
    } else if (lens === 'assigned') {
      tasks = listAssignedTasksForUser({ userId: auth.user.user_id, projectId });
    } else {
      tasks = listVisibleProjectTasksForUser({ userId: auth.user.user_id, projectId });
    }

    const page = tasks.slice(offset, offset + limit);
    const nextOffset = offset + page.length;
    const nextCursor = nextOffset < tasks.length ? encodeCursorOffset(nextOffset) : null;
    send(response, jsonResponse(200, okEnvelope({ tasks: page, next_cursor: nextCursor })));
  });

  const createHubTask = withPolicyGate('hub.tasks.write', async ({ response, request, auth }) => {
    let body;
    try {
      body = await parseBody(request);
    } catch (error) {
      request.log.warn('Failed to parse request body for task creation.', { error });
      send(response, jsonResponse(400, errorEnvelope('invalid_json', 'Body must be valid JSON.')));
      return;
    }

    const title = asText(body.title);
    if (!title) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'title is required.')));
      return;
    }

    const personalProject = personalProjectByUserStmt.get(auth.user.user_id, auth.user.user_id);
    if (!personalProject) {
      request.log.error('Personal project is unavailable during task creation.', { userId: auth.user.user_id });
      send(response, jsonResponse(500, errorEnvelope('internal_error', 'Internal server error.')));
      return;
    }
    const tasksCollectionId = asText(personalProject.tasks_collection_id);
    if (!tasksCollectionId) {
      request.log.error('Personal tasks collection is unavailable during task creation.', { userId: auth.user.user_id });
      send(response, jsonResponse(500, errorEnvelope('internal_error', 'Internal server error.')));
      return;
    }

    const taskCreateStartedAt = performance.now();
    let taskRecord;
    try {
      taskRecord = createPersonalTaskRecord({
        userId: auth.user.user_id,
        projectId: personalProject.project_id,
        collectionId: tasksCollectionId,
        title,
        status: asText(body.status) || 'todo',
        priority: asNullableText(body.priority),
        category: asNullableText(body.category),
      });
    } catch (error) {
      request.log.error('Failed to create personal task record.', { error });
      send(response, jsonResponse(500, errorEnvelope('internal_error', 'Internal server error.')));
      return;
    }
    request.log.debug('Task creation query completed.', {
      durationMs: elapsedMs(taskCreateStartedAt),
    });

    send(response, jsonResponse(201, okEnvelope({ task: buildPersonalTaskSummaryFromRecord(taskRecord) })));
  });

  const getHubHome = withPolicyGate('hub.view', async ({ request, response, requestUrl, auth }) => {
    const homeStartedAt = performance.now();
    const tasksLimit = asInteger(requestUrl.searchParams.get('tasks_limit'), 8, 1, 50);
    const eventsLimit = asInteger(requestUrl.searchParams.get('events_limit'), 8, 1, 50);
    const capturesLimit = asInteger(requestUrl.searchParams.get('captures_limit'), 20, 1, 50);
    const notificationsLimit = asInteger(requestUrl.searchParams.get('notifications_limit'), 8, 1, 50);
    const unreadOnly = asBoolean(requestUrl.searchParams.get('unread'), false);
    const personalProject = personalProjectByUserStmt.get(auth.user.user_id, auth.user.user_id);
    if (!personalProject) {
      request.log.error('Personal project is unavailable during hub home load.', { userId: auth.user.user_id });
      send(response, jsonResponse(500, errorEnvelope('internal_error', 'Internal server error.')));
      return;
    }

    const tasksQueryStartedAt = performance.now();
    const allTasks = listAssignedTasksForUser({ userId: auth.user.user_id })
      .sort(compareTasksByUpdatedAt);
    request.log.debug('Hub home tasks query completed.', {
      durationMs: elapsedMs(tasksQueryStartedAt),
    });
    const tasks = allTasks.slice(0, tasksLimit);
    const tasksNextCursor = allTasks.length > tasksLimit ? encodeCursorOffset(tasksLimit) : null;

    const notificationsQueryStartedAt = performance.now();
    const notifications = (
      unreadOnly
        ? unreadNotificationsByUserStmt.all(auth.user.user_id, notificationsLimit)
        : notificationsByUserStmt.all(auth.user.user_id, notificationsLimit)
    ).map(notificationRecord);
    request.log.debug('Hub home notifications query completed.', {
      durationMs: elapsedMs(notificationsQueryStartedAt),
    });

    const capturesQueryStartedAt = performance.now();
    const captures = listPersonalCapturesForUser({ projectId: personalProject.project_id, limit: capturesLimit });
    request.log.debug('Hub home captures query completed.', {
      durationMs: elapsedMs(capturesQueryStartedAt),
    });

    const eventsQueryStartedAt = performance.now();
    const events = listHomeEventsForUser({ userId: auth.user.user_id, limit: eventsLimit });
    request.log.debug('Hub home events query completed.', {
      durationMs: elapsedMs(eventsQueryStartedAt),
    });

    send(
      response,
      jsonResponse(
        200,
        okEnvelope({
          home: {
            personal_project_id: personalProject.project_id,
            tasks,
            tasks_next_cursor: tasksNextCursor,
            captures,
            events,
            notifications,
          },
        }),
      ),
    );
    request.log.debug('Hub home request completed.', {
      durationMs: elapsedMs(homeStartedAt),
    });
  });

  const listProjectTasks = async ({ request, response, requestUrl, params }) => {
    const auth = await deps.withAuth(request);
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

    const limit = asInteger(requestUrl.searchParams.get('limit'), 50, 1, 200);
    const offset = parseCursorOffset(requestUrl.searchParams.get('cursor'));
    const tasks = listVisibleProjectTasksForUser({ userId: auth.user.user_id, projectId });
    const page = tasks.slice(offset, offset + limit);
    const nextOffset = offset + page.length;
    const nextCursor = nextOffset < tasks.length ? encodeCursorOffset(nextOffset) : null;
    send(response, jsonResponse(200, okEnvelope({ tasks: page, next_cursor: nextCursor })));
  };

  return {
    createHubTask,
    getHubHome,
    getHubTasks,
    listProjectTasks,
  };
};
