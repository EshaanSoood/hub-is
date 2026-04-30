import { validateCreateTaskRequest } from '../lib/validators.mjs';

export const createTaskRoutes = (deps) => {
  const {
    withPolicyGate,
    withProjectPolicyGate,
    withWorkProjectPolicyGate,
    resolveProjectContentWriteGate,
    withTransaction,
    send,
    jsonResponse,
    okEnvelope,
    errorEnvelope,
    parseBody,
    asInteger,
    asText,
    asBoolean,
    nowIso,
    newId,
    buildNotificationRouteContext,
    buildNotificationPayload,
    broadcastTaskChanged,
    createNotification,
    normalizeParticipants,
    parseCursorOffset,
    encodeCursorOffset,
    notificationRecord,
    buildTaskSummaryForUser,
    recordByIdStmt,
    buildHomeEventSummary,
    personalProjectIdForUser,
    projectMembershipsByUserStmt,
    projectMembershipRoleStmt,
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
    projectMembershipsByUserStmt.all(userId).map((membership) => membership.space_id);

  const canUserSeeRecordInHomeRollup = ({ userId, record, visibilityCache }) => {
    const sourceProjectId = asText(record.source_project_id);
    const cacheKey = `${userId}:${record.space_id}:${sourceProjectId}`;
    if (visibilityCache?.has(cacheKey)) {
      return visibilityCache.get(cacheKey);
    }

    const membership = projectMembershipRoleStmt.get(record.space_id, userId);
    const role = asText(membership?.role);
    if (role !== 'viewer' && role !== 'guest') {
      visibilityCache?.set(cacheKey, true);
      return true;
    }
    if (!sourceProjectId) {
      visibilityCache?.set(cacheKey, false);
      return false;
    }
    const allowed = !withWorkProjectPolicyGate({
      userId,
      projectId: sourceProjectId,
      requiredCapability: 'view',
    }).error;
    visibilityCache?.set(cacheKey, allowed);
    return allowed;
  };

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
  const listVisibleProjectTasksForUser = ({ userId, projectId = '', visibilityCache = new Map() }) => {
    const visibleProjectIds = visibleProjectIdsForUser(userId);
    const personalProjectId = personalProjectIdForUser(userId);
    const sourceProjectContextCache = new Map();
    const tasks = [];
    for (const visibleProjectId of visibleProjectIds) {
      if (projectId && visibleProjectId !== projectId) {
        continue;
      }
      const records = visibleProjectTasksStmt.all(visibleProjectId);
      for (const record of records) {
        if (!canUserSeeRecordInHomeRollup({ userId, record, visibilityCache })) {
          continue;
        }
        tasks.push(buildTaskSummaryForUser(record, personalProjectId, sourceProjectContextCache));
      }
    }
    return tasks.sort(compareTasksByUpdatedAt);
  };

  const getVisibleTaskRowsByProject = ({ userId, projectId = '', rowsByProjectCache = null }) => {
    const visibleProjectIds = visibleProjectIdsForUser(userId).filter((visibleProjectId) => !projectId || visibleProjectId === projectId);
    const rowsByProject = rowsByProjectCache || new Map();
    for (const visibleProjectId of visibleProjectIds) {
      if (!rowsByProject.has(visibleProjectId)) {
        rowsByProject.set(
          visibleProjectId,
          visibleProjectTasksStmt.all(visibleProjectId),
        );
      }
    }
    return {
      visibleProjectIds,
      rowsByProject,
    };
  };

  const listAssignedTasksForUser = ({ userId, projectId = '', rowsByProjectCache = null, visibilityCache = new Map() }) => {
    const personalProjectId = personalProjectIdForUser(userId);
    const sourceProjectContextCache = new Map();
    const { visibleProjectIds, rowsByProject } = getVisibleTaskRowsByProject({ userId, projectId, rowsByProjectCache });
    const assignedRecordIds = new Set(
      assignedTasksStmt
        .all(userId)
        .filter((row) => !projectId || row.space_id === projectId)
        .map((row) => row.record_id),
    );
    const tasks = [];
    for (const visibleProjectId of visibleProjectIds) {
      const records = rowsByProject.get(visibleProjectId) || [];
      for (const record of records) {
        if (!canUserSeeRecordInHomeRollup({ userId, record, visibilityCache })) {
          continue;
        }
        if (!assignedRecordIds.has(record.record_id)) {
          continue;
        }
        tasks.push(buildTaskSummaryForUser(record, personalProjectId, sourceProjectContextCache));
      }
    }
    return tasks.sort(compareTasksByUpdatedAt);
  };

  const listCreatedTasksForUser = ({ userId, projectId = '', rowsByProjectCache = null, visibilityCache = new Map() }) => {
    const personalProjectId = personalProjectIdForUser(userId);
    const sourceProjectContextCache = new Map();
    const { visibleProjectIds, rowsByProject } = getVisibleTaskRowsByProject({ userId, projectId, rowsByProjectCache });
    const tasks = [];
    for (const visibleProjectId of visibleProjectIds) {
      const records = rowsByProject.get(visibleProjectId) || [];
      for (const record of records) {
        if (!canUserSeeRecordInHomeRollup({ userId, record, visibilityCache })) {
          continue;
        }
        if (record.created_by !== userId) {
          continue;
        }
        tasks.push(buildTaskSummaryForUser(record, personalProjectId, sourceProjectContextCache));
      }
    }
    return tasks;
  };

  const mergeTaskSummaries = (...lists) => {
    const byRecordId = new Map();
    for (const list of lists) {
      for (const task of list) {
        const recordId = String(task?.record_id || '');
        if (!recordId) {
          continue;
        }
        const existing = byRecordId.get(recordId);
        if (!existing) {
          byRecordId.set(recordId, task);
          continue;
        }
        const existingUpdatedAt = new Date(existing.updated_at || 0).getTime();
        const candidateUpdatedAt = new Date(task.updated_at || 0).getTime();
        if (candidateUpdatedAt > existingUpdatedAt) {
          byRecordId.set(recordId, task);
        }
      }
    }
    return [...byRecordId.values()];
  };

  const filterTasksByProject = (tasks, projectId = '') => {
    const normalizedProjectId = asText(projectId);
    if (!normalizedProjectId) {
      return tasks;
    }
    return tasks.filter((task) => asText(task?.source_project?.project_id) === normalizedProjectId);
  };

  const listHomeEventsForUser = ({ userId, limit, visibilityCache = new Map() }) => {
    const visibleProjectIds = visibleProjectIdsForUser(userId);
    const sourceProjectContextCache = new Map();
    const rows = [];
    for (const projectId of visibleProjectIds) {
      const projectRows = homeEventsByProjectStmt.all(projectId);
      rows.push(...projectRows.filter((record) => canUserSeeRecordInHomeRollup({ userId, record, visibilityCache })));
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
      .map((row) => buildHomeEventSummary(row, sourceProjectContextCache));
  };

  const listPersonalCapturesForUser = ({ projectId, limit }) =>
    personalCapturesStmt.all(projectId, limit).map((row) => ({
      record_id: row.record_id,
      space_id: row.space_id,
      collection_id: row.collection_id,
      title: row.title,
      created_at: row.created_at,
    }));

  const getHubTasks = withPolicyGate('hub.view', async ({ response, requestUrl, auth }) => {
    const lens = asText(requestUrl.searchParams.get('lens')).toLowerCase() || 'assigned';
    const projectId = asText(requestUrl.searchParams.get('space_id'));
    const sourceProjectId = asText(requestUrl.searchParams.get('project_id') || requestUrl.searchParams.get('source_project_id'));
    const limit = asInteger(requestUrl.searchParams.get('limit'), 50, 1, 200);
    const offset = parseCursorOffset(requestUrl.searchParams.get('cursor'));

    let tasks = [];
    if (lens === 'project') {
      if (!projectId || !sourceProjectId) {
        send(response, jsonResponse(400, errorEnvelope('invalid_input', 'project lens requires space_id and project_id.')));
        return;
      }
      const projectGate = withProjectPolicyGate({ userId: auth.user.user_id, projectId, requiredCapability: 'view' });
      if (projectGate.error) {
        send(response, jsonResponse(projectGate.error.status, errorEnvelope(projectGate.error.code, projectGate.error.message)));
        return;
      }
      tasks = filterTasksByProject(
        listVisibleProjectTasksForUser({ userId: auth.user.user_id, projectId }),
        sourceProjectId,
      );
    } else if (lens === 'space') {
      if (!projectId) {
        send(response, jsonResponse(400, errorEnvelope('invalid_input', 'space lens requires space_id.')));
        return;
      }
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
      send(response, parseBody.errorResponse(error, { invalidCode: 'invalid_body', invalidMessage: 'Invalid request body.' }));
      return;
    }

    let validated;
    try {
      validated = validateCreateTaskRequest(body);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid request body.';
      request.log.warn('Task validation failed', { error: message });
      send(response, jsonResponse(400, errorEnvelope('validation_error', message)));
      return;
    }

    const personalProject = personalProjectByUserStmt.get(auth.user.user_id, auth.user.user_id);
    const projectId = asText(validated.project_id) || asText(personalProject?.project_id);
    if (!projectId) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'space_id is required.')));
      return;
    }

    const sourceProjectId = asText(validated.source_project_id);
    const writeGate = resolveProjectContentWriteGate({
      userId: auth.user.user_id,
      projectId,
      sourceProjectId,
    });
    if (writeGate.error) {
      send(response, jsonResponse(writeGate.error.status, errorEnvelope(writeGate.error.code, writeGate.error.message)));
      return;
    }

    const title = validated.title;
    const status = validated.status || 'todo';
    const priority = typeof validated.priority === 'undefined' ? null : validated.priority;
    const dueAt = typeof validated.due_at === 'undefined' ? null : validated.due_at;
    const category = typeof validated.category === 'undefined' ? null : validated.category;
    let assigneeUserIds = normalizeParticipants(
      projectId,
      validated.assignee_user_ids || validated.assignment_user_ids || [],
    );
    if (assigneeUserIds.length === 0) {
      assigneeUserIds = normalizeParticipants(projectId, [auth.user.user_id]);
    }

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

        insertRecordStmt.run(
          recordId,
          projectId,
          collectionId,
          title,
          sourceProjectId || null,
          null,
          auth.user.user_id,
          timestamp,
          timestamp,
          null,
        );
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
      const isValidationError = error instanceof Error && error.name === 'ValidationError';
      if (!isValidationError) {
        console.error('Failed to create task record:', error);
      }
      send(
        response,
        jsonResponse(
          isValidationError ? 400 : 500,
          errorEnvelope(
            isValidationError ? 'invalid_input' : 'server_error',
            isValidationError && error instanceof Error ? error.message : 'Failed to create task.',
          ),
        ),
      );
      return;
    }

    for (const notification of pendingNotifications) {
      try {
        createNotification(notification);
      } catch {
        // Best effort; task creation should still succeed.
      }
    }

    try {
      const createdRecord = recordByIdStmt.get(recordId);
      const liveRecipients = new Set([auth.user.user_id, ...assigneeUserIds]);
      for (const userId of liveRecipients) {
        broadcastTaskChanged(createdRecord, userId);
      }
    } catch {
      // Best effort; task creation should still succeed.
    }

    const createdRecord = recordByIdStmt.get(recordId);
    const task = buildTaskSummaryForUser(createdRecord, personalProjectIdForUser(auth.user.user_id), new Map());
    send(response, jsonResponse(201, okEnvelope({ task })));
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
      request.log.error('Personal project is unavailable during myHub load.', { userId: auth.user.user_id });
      send(response, jsonResponse(500, errorEnvelope('internal_error', 'Internal server error.')));
      return;
    }

    const tasksQueryStartedAt = performance.now();
    const rowsByProjectCache = new Map();
    const visibilityCache = new Map();
    const assignedTasks = listAssignedTasksForUser({ userId: auth.user.user_id, rowsByProjectCache, visibilityCache });
    const createdTasks = listCreatedTasksForUser({ userId: auth.user.user_id, rowsByProjectCache, visibilityCache });
    const allTasks = mergeTaskSummaries(assignedTasks, createdTasks)
      .sort(compareTasksByUpdatedAt);
    request.log.debug('myHub tasks query completed.', {
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
    request.log.debug('myHub notifications query completed.', {
      durationMs: elapsedMs(notificationsQueryStartedAt),
    });

    const capturesQueryStartedAt = performance.now();
    const captures = listPersonalCapturesForUser({ projectId: personalProject.space_id, limit: capturesLimit });
    request.log.debug('myHub captures query completed.', {
      durationMs: elapsedMs(capturesQueryStartedAt),
    });

    const eventsQueryStartedAt = performance.now();
    const events = listHomeEventsForUser({ userId: auth.user.user_id, limit: eventsLimit, visibilityCache });
    request.log.debug('myHub events query completed.', {
      durationMs: elapsedMs(eventsQueryStartedAt),
    });

    send(
      response,
      jsonResponse(
        200,
        okEnvelope({
          home: {
            personal_project_id: personalProject.space_id,
            tasks,
            tasks_next_cursor: tasksNextCursor,
            captures,
            events,
            notifications,
          },
        }),
      ),
    );
    request.log.debug('myHub request completed.', {
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
