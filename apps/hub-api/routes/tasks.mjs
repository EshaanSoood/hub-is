export const createTaskRoutes = (deps) => {
  const taskStatusSet = new Set(['todo', 'in_progress', 'done', 'cancelled']);
  const taskPrioritySet = new Set(['low', 'medium', 'high', 'urgent']);

  const {
    withPolicyGate,
    withProjectPolicyGate,
    withTransaction,
    send,
    jsonResponse,
    okEnvelope,
    errorEnvelope,
    parseBody,
    asInteger,
    asText,
    asBoolean,
    asNullableText,
    nowIso,
    newId,
    buildNotificationRouteContext,
    buildNotificationPayload,
    createNotification,
    normalizeParticipants,
    parseCursorOffset,
    encodeCursorOffset,
    notificationRecord,
    buildTaskSummaryForUser,
    recordByIdStmt,
    recordDetail,
    buildHomeEventSummary,
    personalProjectIdForUser,
    projectMembershipsByUserStmt,
    personalProjectByUserStmt,
    notificationsByUserStmt,
    unreadNotificationsByUserStmt,
    visibleProjectTasksStmt,
    assignedTasksStmt,
    homeEventsByProjectStmt,
    personalCapturesStmt,
    collectionsByProjectStmt,
    insertCollectionStmt,
    insertRecordStmt,
    insertRecordCapabilityStmt,
    upsertTaskStateStmt,
    clearAssignmentsStmt,
    insertAssignmentStmt,
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
      send(response, jsonResponse(400, errorEnvelope('invalid_body', 'Invalid request body.')));
      return;
    }

    const projectId = asText(body.project_id);
    if (!projectId) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'project_id is required.')));
      return;
    }

    const projectGate = withProjectPolicyGate({ userId: auth.user.user_id, projectId, requiredCapability: 'write' });
    if (projectGate.error) {
      send(response, jsonResponse(projectGate.error.status, errorEnvelope(projectGate.error.code, projectGate.error.message)));
      return;
    }

    const title = asText(body.title);
    if (!title) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'title is required.')));
      return;
    }

    const status = asText(body.status) || 'todo';
    if (!taskStatusSet.has(status)) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'status must be one of todo, in_progress, done, or cancelled.')));
      return;
    }

    let priority = asNullableText(body.priority);
    if (priority && !taskPrioritySet.has(priority)) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'priority must be low, medium, high, urgent, or null.')));
      return;
    }

    let dueAt = asNullableText(body.due_at);
    if (dueAt) {
      const parsedDueAt = new Date(dueAt);
      if (Number.isNaN(parsedDueAt.getTime())) {
        send(response, jsonResponse(400, errorEnvelope('invalid_input', 'due_at must be a valid ISO timestamp or null.')));
        return;
      }
      dueAt = parsedDueAt.toISOString();
    }

    const category = asNullableText(body.category);
    const assigneeUserIds = normalizeParticipants(
      projectId,
      body.assignee_user_ids || body.assignment_user_ids || [],
    );

    const timestamp = nowIso();
    const notificationContext = buildNotificationRouteContext({ projectId });
    const pendingNotifications = [];
    const recordId = newId('rec');
    let collectionId = '';

    try {
      withTransaction(() => {
        const collections = collectionsByProjectStmt.all(projectId);
        const matchedCollection = collections.find((collection) => {
          const name = asText(collection.name).toLowerCase();
          return name.includes('task') || name.includes('todo');
        });
        if (matchedCollection) {
          collectionId = matchedCollection.collection_id;
        } else {
          collectionId = newId('col');
          insertCollectionStmt.run(collectionId, projectId, 'Tasks', null, null, timestamp, timestamp);
        }

        insertRecordStmt.run(recordId, projectId, collectionId, title, auth.user.user_id, timestamp, timestamp, null);
        insertRecordCapabilityStmt.run(recordId, 'task', timestamp);
        upsertTaskStateStmt.run(
          recordId,
          status,
          priority,
          dueAt,
          category,
          status === 'done' ? timestamp : null,
          timestamp,
        );

        clearAssignmentsStmt.run(recordId);
        for (const userId of assigneeUserIds) {
          insertAssignmentStmt.run(recordId, userId, timestamp);
          if (userId === auth.user.user_id) {
            continue;
          }
          pendingNotifications.push({
            projectId,
            userId,
            reason: 'assignment',
            entityType: 'record',
            entityId: recordId,
            notificationScope: 'network',
            payload: buildNotificationPayload({
              message: 'You were assigned to a record.',
              ...notificationContext,
            }),
          });
        }
      });
    } catch (error) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', error instanceof Error ? error.message : 'Failed to create task.')));
      return;
    }

    for (const notification of pendingNotifications) {
      try {
        createNotification(notification);
      } catch {
        // Best effort; task creation should still succeed.
      }
    }

    send(response, jsonResponse(201, okEnvelope({ record: recordDetail(recordByIdStmt.get(recordId)) })));
  });

  const getHubHome = withPolicyGate('hub.view', async ({ response, requestUrl, auth }) => {
    const tasksLimit = asInteger(requestUrl.searchParams.get('tasks_limit'), 8, 1, 50);
    const eventsLimit = asInteger(requestUrl.searchParams.get('events_limit'), 8, 1, 50);
    const capturesLimit = asInteger(requestUrl.searchParams.get('captures_limit'), 20, 1, 50);
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
            captures: listPersonalCapturesForUser({ projectId: personalProject.project_id, limit: capturesLimit }),
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
