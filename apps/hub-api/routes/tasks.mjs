export const createTaskRoutes = (deps) => {
  const {
    db,
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
  const visibleProjectTasksStmt = db.prepare(`
    SELECT r.*
    FROM records r
    JOIN task_state ts ON ts.record_id = r.record_id
    WHERE r.project_id = ? AND r.archived_at IS NULL
    ORDER BY COALESCE(ts.updated_at, r.updated_at) DESC, r.record_id DESC
  `);
  const assignedTasksStmt = db.prepare(`
    SELECT r.*
    FROM assignments a
    JOIN records r ON r.record_id = a.record_id
    JOIN task_state ts ON ts.record_id = r.record_id
    WHERE a.user_id = ? AND r.archived_at IS NULL
    ORDER BY COALESCE(ts.updated_at, r.updated_at) DESC, r.record_id DESC
  `);
  const homeEventsByProjectStmt = db.prepare(`
    SELECT r.*, es.start_dt, es.end_dt
    FROM records r
    JOIN event_state es ON es.record_id = r.record_id
    WHERE r.project_id = ? AND r.archived_at IS NULL
    ORDER BY es.start_dt ASC, r.record_id ASC
  `);

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

  const getHubTasks = withPolicyGate('hub.view', async ({ response, requestUrl, auth }) => {
    const lens = asText(requestUrl.searchParams.get('lens')).toLowerCase() || 'assigned';
    const projectId = asText(requestUrl.searchParams.get('project_id'));
    const limit = asInteger(requestUrl.searchParams.get('limit'), 50, 1, 200);
    const offset = parseCursorOffset(requestUrl.searchParams.get('cursor'));
    const personalProject = personalProjectByUserStmt.get(auth.user.user_id, auth.user.user_id);
    if (!personalProject) {
      send(response, jsonResponse(500, errorEnvelope('server_error', 'Personal project is unavailable.')));
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
    } catch {
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
      send(response, jsonResponse(500, errorEnvelope('server_error', 'Personal project is unavailable.')));
      return;
    }
    const tasksCollectionId = asText(personalProject.tasks_collection_id);
    if (!tasksCollectionId) {
      send(response, jsonResponse(500, errorEnvelope('server_error', 'Personal tasks collection is unavailable.')));
      return;
    }

    const taskRecord = createPersonalTaskRecord({
      userId: auth.user.user_id,
      projectId: personalProject.project_id,
      collectionId: tasksCollectionId,
      title,
      status: asText(body.status) || 'todo',
      priority: asNullableText(body.priority),
    });

    send(response, jsonResponse(201, okEnvelope({ task: buildPersonalTaskSummaryFromRecord(taskRecord) })));
  });

  const getHubHome = withPolicyGate('hub.view', async ({ response, requestUrl, auth }) => {
    const tasksLimit = asInteger(requestUrl.searchParams.get('tasks_limit'), 8, 1, 50);
    const eventsLimit = asInteger(requestUrl.searchParams.get('events_limit'), 8, 1, 50);
    const notificationsLimit = asInteger(requestUrl.searchParams.get('notifications_limit'), 8, 1, 50);
    const unreadOnly = asBoolean(requestUrl.searchParams.get('unread'), false);
    const personalProject = personalProjectByUserStmt.get(auth.user.user_id, auth.user.user_id);
    if (!personalProject) {
      send(response, jsonResponse(500, errorEnvelope('server_error', 'Personal project is unavailable.')));
      return;
    }

    const allTasks = listAssignedTasksForUser({ userId: auth.user.user_id })
      .sort(compareTasksByUpdatedAt);
    const tasks = allTasks.slice(0, tasksLimit);
    const tasksNextCursor = allTasks.length > tasksLimit ? encodeCursorOffset(tasksLimit) : null;

    const notifications = (
      unreadOnly
        ? unreadNotificationsByUserStmt.all(auth.user.user_id, notificationsLimit)
        : notificationsByUserStmt.all(auth.user.user_id, notificationsLimit)
    ).map(notificationRecord);

    send(
      response,
      jsonResponse(
        200,
        okEnvelope({
          home: {
            personal_project_id: personalProject.project_id,
            tasks,
            tasks_next_cursor: tasksNextCursor,
            events: listHomeEventsForUser({ userId: auth.user.user_id, limit: eventsLimit }),
            notifications,
          },
        }),
      ),
    );
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
