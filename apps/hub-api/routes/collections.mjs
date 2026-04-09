class ValidationError extends Error {}

export const createCollectionRoutes = (deps) => {
  const {
    db,
    withAuth,
    withTransaction,
    withProjectPolicyGate,
    requireDocAccess,
    send,
    jsonResponse,
    okEnvelope,
    errorEnvelope,
    parseBody,
    asText,
    asInteger,
    parseJson,
    parseJsonObject,
    toJson,
    nowIso,
    newId,
    emitTimelineEvent,
    buildNotificationRouteContext,
    buildNotificationPayload,
    buildTaskSummaryForUser,
    broadcastTaskChanged,
    createNotification,
    relationTargetCollectionIdFromField,
    recordSummary,
    recordDetail,
    recordDetailForUser,
    createPersonalTaskRecord,
    materializeMentions,
    mapMentionRowToBacklink,
    resolveProjectContentWriteGate,
    resolveMutationContextPaneId,
    normalizeParticipants,
    fieldTypeSet,
    capabilitySet,
    assignmentsByRecordStmt,
    collectionsByProjectStmt,
    collectionByIdStmt,
    collectionByNameStmt,
    insertCollectionStmt,
    fieldsByCollectionStmt,
    fieldByIdStmt,
    nextFieldSortStmt,
    insertFieldStmt,
    recordByIdStmt,
    recordsByCollectionStmt,
    insertRecordStmt,
    updateRecordStmt,
    upsertRecordValueStmt,
    valuesByRecordStmt,
    insertRelationStmt,
    relationByIdStmt,
    relationByEdgeStmt,
    deleteRelationStmt,
    relationSearchRecordsStmt,
    outgoingRelationsStmt,
    incomingRelationsStmt,
    mentionSearchUsersStmt,
    mentionSearchRecordsStmt,
    insertRecordCapabilityStmt,
    recordCapabilitiesByRecordStmt,
    upsertTaskStateStmt,
    upsertEventStateStmt,
    clearEventParticipantsStmt,
    insertEventParticipantStmt,
    clearAssignmentsStmt,
    insertAssignmentStmt,
    taskStateByRecordStmt,
    eventStateByRecordStmt,
    recurrenceByRecordStmt,
    remindersByRecordStmt,
    upsertRecurrenceStmt,
    clearRemindersStmt,
    insertReminderStmt,
    subtasksByParentStmt,
    withDocPolicyGate,
    attachmentsByEntityStmt,
    commentsByTargetStmt,
    getTaskStateStmt,
    mentionsCountByTargetStmt,
    mentionsByTargetStmt,
    personalProjectByUserStmt,
    viewByIdStmt,
  } = deps;

  const captureConversionModes = new Set(['thought', 'task']);
  const taskStatusSet = new Set(['todo', 'in_progress', 'done', 'cancelled']);
  const taskPrioritySet = new Set(['low', 'medium', 'high', 'urgent']);

  const isIsoDateTimeString = (value) => {
    if (!value) {
      return false;
    }
    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp);
  };

  const recordValuesMap = (recordId) => {
    const values = valuesByRecordStmt.all(recordId);
    const map = {};
    for (const value of values) {
      map[value.field_id] = parseJson(value.value_json, null);
    }
    return map;
  };

  const personalProjectIdForUser = (userId) => asText(personalProjectByUserStmt.get(userId, userId)?.project_id);

  const archiveSubtasksStmt = db.prepare(`
    WITH RECURSIVE descendants(id) AS (
      SELECT record_id FROM records WHERE parent_record_id = ?
      UNION ALL
      SELECT r.record_id FROM records r INNER JOIN descendants d ON r.parent_record_id = d.id
    )
    UPDATE records
    SET archived_at = ?, updated_at = ?
    WHERE record_id IN (SELECT id FROM descendants) AND archived_at IS NULL
  `);
  const unarchiveSubtasksStmt = db.prepare(`
    WITH RECURSIVE descendants(id) AS (
      SELECT record_id FROM records WHERE parent_record_id = ?
      UNION ALL
      SELECT r.record_id FROM records r INNER JOIN descendants d ON r.parent_record_id = d.id
    )
    UPDATE records
    SET archived_at = NULL, updated_at = ?
    WHERE record_id IN (SELECT id FROM descendants) AND archived_at = ?
  `);

  const listCollections = async ({ request, response, params }) => {
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

    const collections = collectionsByProjectStmt.all(projectId).map((collection) => ({
      collection_id: collection.collection_id,
      project_id: collection.project_id,
      name: collection.name,
      icon: collection.icon,
      color: collection.color,
      created_at: collection.created_at,
      updated_at: collection.updated_at,
    }));
    send(response, jsonResponse(200, okEnvelope({ collections })));
  };

  const createCollection = async ({ request, response, params }) => {
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
      request.log.warn('Failed to parse request body for collection creation.', { error });
      send(response, parseBody.errorResponse(error));
      return;
    }

    const name = asText(body.name);
    if (!name) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'Collection name is required.')));
      return;
    }

    const now = nowIso();
    const collectionId = newId('col');
    insertCollectionStmt.run(collectionId, projectId, name, deps.asNullableText(body.icon), deps.asNullableText(body.color), now, now);

    emitTimelineEvent({
      projectId,
      actorUserId: auth.user.user_id,
      eventType: 'collection.created',
      primaryEntityType: 'collection',
      primaryEntityId: collectionId,
      summary: { message: `Collection created: ${name}` },
    });

    send(response, jsonResponse(201, okEnvelope({ collection_id: collectionId })));
  };

  const listCollectionFields = async ({ request, response, params }) => {
    const auth = await withAuth(request);
    if (auth.error) {
      send(response, auth.error);
      return;
    }

    const collectionId = params.collectionId;
    const collection = collectionByIdStmt.get(collectionId);
    if (!collection) {
      send(response, jsonResponse(404, errorEnvelope('not_found', 'Collection not found.')));
      return;
    }

    const projectGate = withProjectPolicyGate({
      userId: auth.user.user_id,
      projectId: collection.project_id,
      requiredCapability: 'view',
    });
    if (projectGate.error) {
      send(response, jsonResponse(projectGate.error.status, errorEnvelope(projectGate.error.code, projectGate.error.message)));
      return;
    }

    const fields = fieldsByCollectionStmt.all(collectionId).map((field) => ({
      field_id: field.field_id,
      collection_id: field.collection_id,
      name: field.name,
      type: field.type,
      config: parseJsonObject(field.config, {}),
      sort_order: field.sort_order,
    }));

    send(response, jsonResponse(200, okEnvelope({ fields })));
  };

  const createCollectionField = async ({ request, response, params }) => {
    const auth = await withAuth(request);
    if (auth.error) {
      send(response, auth.error);
      return;
    }

    const collectionId = params.collectionId;
    const collection = collectionByIdStmt.get(collectionId);
    if (!collection) {
      send(response, jsonResponse(404, errorEnvelope('not_found', 'Collection not found.')));
      return;
    }

    const projectGate = withProjectPolicyGate({
      userId: auth.user.user_id,
      projectId: collection.project_id,
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
      request.log.warn('Failed to parse request body for collection field creation.', { error });
      send(response, parseBody.errorResponse(error));
      return;
    }

    const name = asText(body.name);
    const type = asText(body.type);
    if (!name || !fieldTypeSet.has(type)) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'Valid field name and type are required.')));
      return;
    }

    const now = nowIso();
    const sortOrder = asInteger(body.sort_order, Number(nextFieldSortStmt.get(collectionId)?.max_sort ?? -1) + 1, 0, 100000);
    const fieldId = newId('fld');
    insertFieldStmt.run(fieldId, collectionId, name, type, toJson(parseJsonObject(body.config, {})), sortOrder, now, now);

    send(response, jsonResponse(201, okEnvelope({ field_id: fieldId })));
  };

  const createRecord = async ({ request, response, params }) => {
    const auth = await withAuth(request);
    if (auth.error) {
      send(response, auth.error);
      return;
    }

    const projectId = params.projectId;
    let body;
    try {
      body = await parseBody(request);
    } catch (error) {
      request.log.warn('Failed to parse request body for record creation.', { error });
      send(response, parseBody.errorResponse(error));
      return;
    }

    const writeGate = resolveProjectContentWriteGate({
      userId: auth.user.user_id,
      projectId,
      paneId: body.source_pane_id,
    });
    if (writeGate.error) {
      send(response, jsonResponse(writeGate.error.status, errorEnvelope(writeGate.error.code, writeGate.error.message)));
      return;
    }

    const requestedCollectionId = asText(body.collection_id);
    const parentRecordId = asText(body.parent_record_id);
    const parentRecord = parentRecordId ? recordByIdStmt.get(parentRecordId) : null;
    if (parentRecordId && (!parentRecord || parentRecord.project_id !== projectId || parentRecord.archived_at)) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'Parent record not found, is archived, or belongs to a different project.')));
      return;
    }

    const collectionId = parentRecord ? parentRecord.collection_id : requestedCollectionId;
    if (parentRecord && requestedCollectionId && requestedCollectionId !== parentRecord.collection_id) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'Subtask must belong to the same collection as its parent.')));
      return;
    }
    const collection = collectionByIdStmt.get(collectionId);
    if (!collection || collection.project_id !== projectId) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'Collection must belong to project.')));
      return;
    }

    const recordId = newId('rec');
    const title = asText(body.title) || 'Untitled Record';
    const timestamp = nowIso();
    const sourcePaneId = asText(body.source_pane_id) || null;
    let sourceViewId = asText(body.source_view_id) || null;
    if (sourceViewId) {
      const sourceView = viewByIdStmt.get(sourceViewId);
      if (!sourceView || sourceView.project_id !== projectId) {
        send(response, jsonResponse(400, errorEnvelope('invalid_input', 'source_view_id must belong to project.')));
        return;
      }
    }
    const notificationContext = buildNotificationRouteContext({
      projectId,
      sourcePaneId,
      sourceDocId: body.source_doc_id,
      sourceNodeKey: body.source_node_key,
    });
    const pendingNotifications = [];

    try {
      withTransaction(() => {
        insertRecordStmt.run(
          recordId,
          projectId,
          collectionId,
          title,
          sourcePaneId,
          sourceViewId,
          auth.user.user_id,
          timestamp,
          timestamp,
          parentRecordId || null,
        );

        const values = parseJsonObject(body.values, {});
        for (const [fieldId, value] of Object.entries(values)) {
          const field = fieldByIdStmt.get(fieldId);
          if (!field || field.collection_id !== collectionId) {
            continue;
          }
          upsertRecordValueStmt.run(recordId, fieldId, toJson(value), timestamp);
        }

        const capabilityTypes = Array.isArray(body.capability_types)
          ? body.capability_types.map((value) => asText(value)).filter((value) => capabilitySet.has(value))
          : [];
        const recordCapabilities = new Set(capabilityTypes);

        const taskState = parseJsonObject(body.task_state, null);
        if (taskState) {
          recordCapabilities.add('task');
          upsertTaskStateStmt.run(
            recordId,
            asText(taskState.status) || 'todo',
            deps.asNullableText(taskState.priority),
            deps.asNullableText(taskState.due_at),
            deps.asNullableText(taskState.category),
            deps.asNullableText(taskState.completed_at),
            timestamp,
          );
        }

        const eventState = parseJsonObject(body.event_state, null);
        if (eventState) {
          const start = asText(eventState.start_dt);
          const end = asText(eventState.end_dt);
          if (!start || !end) {
            throw new ValidationError('event_state requires start_dt and end_dt.');
          }

          recordCapabilities.add('calendar_event');
          upsertEventStateStmt.run(recordId, start, end, asText(eventState.timezone) || 'UTC', deps.asNullableText(eventState.location), timestamp);

          clearEventParticipantsStmt.run(recordId);
          const participants = normalizeParticipants(projectId, eventState.participant_user_ids || []);
          for (const userId of participants) {
            insertEventParticipantStmt.run(recordId, userId, null, timestamp);
            if (userId !== auth.user.user_id) {
              pendingNotifications.push({
                projectId,
                userId,
                reason: 'assignment',
                entityType: 'record',
                entityId: recordId,
                notificationScope: 'network',
                payload: buildNotificationPayload({
                  message: `You were added to event ${title}`,
                  ...notificationContext,
                }),
              });
            }
          }
        }

        const recurrenceRule = body.recurrence_rule;
        if (recurrenceRule) {
          recordCapabilities.add('recurring');
          upsertRecurrenceStmt.run(recordId, toJson(recurrenceRule), timestamp);
        }

        const reminders = Array.isArray(body.reminders) ? body.reminders : [];
        if (reminders.length > 0) {
          recordCapabilities.add('remindable');
          clearRemindersStmt.run(recordId);
          for (const reminder of reminders) {
            const remindAt = asText(reminder.remind_at);
            if (!remindAt) {
              continue;
            }
            const channels = Array.isArray(reminder.channels) ? reminder.channels.map((item) => asText(item)).filter(Boolean) : ['in_app'];
            insertReminderStmt.run(newId('rem'), recordId, remindAt, toJson(channels), timestamp, null);
          }
        }

        for (const capability of recordCapabilities) {
          insertRecordCapabilityStmt.run(recordId, capability, timestamp);
        }

        const assignmentUserIds = normalizeParticipants(projectId, body.assignment_user_ids || []);
        clearAssignmentsStmt.run(recordId);
        for (const userId of assignmentUserIds) {
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

        emitTimelineEvent({
          projectId,
          actorUserId: auth.user.user_id,
          eventType: 'record.created',
          primaryEntityType: 'record',
          primaryEntityId: recordId,
          summary: { title },
        });
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        request.log.warn('Record creation validation failed.', { error });
        send(response, jsonResponse(400, errorEnvelope('invalid_input', error.message)));
        return;
      }
      request.log.error('Failed to create record.', {
        projectId,
        collectionId,
        recordId,
        error,
      });
      send(response, jsonResponse(500, errorEnvelope('internal_error', 'Internal server error.')));
      return;
    }

    for (const notification of pendingNotifications) {
      try {
        createNotification(notification);
      } catch (error) {
        request.log.warn('Record create notification delivery failed (best-effort).', {
          recordId,
          userId: notification.userId,
          reason: notification.reason,
          error,
        });
      }
    }

    send(response, jsonResponse(201, okEnvelope({ record_id: recordId })));
  };

  const searchProjectRecords = async ({ request, response, requestUrl, params }) => {
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

    const query = asText(requestUrl.searchParams.get('query') || requestUrl.searchParams.get('q')).toLowerCase();
    const collectionId = asText(requestUrl.searchParams.get('collection_id'));
    const excludeRecordId = asText(requestUrl.searchParams.get('exclude_record_id'));
    const limit = asInteger(requestUrl.searchParams.get('limit'), 20, 1, 50);
    const likeQuery = `%${query.replace(/[%_]/g, '')}%`;

    if (collectionId) {
      const collection = collectionByIdStmt.get(collectionId);
      if (!collection || collection.project_id !== projectId) {
        send(response, jsonResponse(400, errorEnvelope('invalid_input', 'collection_id must belong to project.')));
        return;
      }
    }

    const items = relationSearchRecordsStmt
      .all(projectId, query, likeQuery, collectionId, collectionId, excludeRecordId, excludeRecordId, limit)
      .map((row) => ({
        record_id: row.record_id,
        collection_id: row.collection_id,
        title: row.title || 'Untitled record',
        collection_name: row.collection_name || null,
        collection_icon: row.collection_icon || null,
      }));

    send(response, jsonResponse(200, okEnvelope({ query, items })));
  };

  const updateRecord = async ({ request, response, requestUrl, params }) => {
    const auth = await withAuth(request);
    if (auth.error) {
      send(response, auth.error);
      return;
    }

    const recordId = params.recordId;
    const record = recordByIdStmt.get(recordId);
    if (!record) {
      send(response, jsonResponse(404, errorEnvelope('not_found', 'Record not found.')));
      return;
    }

    let body;
    try {
      body = await parseBody(request);
    } catch (error) {
      request.log.warn('Failed to parse request body for record update.', { error });
      send(response, parseBody.errorResponse(error));
      return;
    }

    const writeGate = resolveProjectContentWriteGate({
      userId: auth.user.user_id,
      projectId: record.project_id,
      paneId: resolveMutationContextPaneId({ body, requestUrl }),
    });
    if (writeGate.error) {
      send(response, jsonResponse(writeGate.error.status, errorEnvelope(writeGate.error.code, writeGate.error.message)));
      return;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'parent_record_id')) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'Reparenting tasks is not supported yet.')));
      return;
    }

    const title = body.title !== undefined ? asText(body.title) || record.title : record.title;
    const timestamp = nowIso();
    const archivedAt = body.archived === true ? timestamp : body.archived === false ? null : record.archived_at;
    const taskState = parseJsonObject(body.task_state, null);
    let taskChanged = false;

    try {
      withTransaction(() => {
        updateRecordStmt.run(title, timestamp, archivedAt, recordId);
        if (archivedAt && !record.archived_at) {
          archiveSubtasksStmt.run(recordId, archivedAt, timestamp);
        }
        if (!archivedAt && record.archived_at) {
          unarchiveSubtasksStmt.run(recordId, timestamp, record.archived_at);
        }
        if (!taskState) {
          return;
        }

        const currentTaskState = getTaskStateStmt.get(recordId);
        if (!currentTaskState) {
          throw new ValidationError('task_state can only be updated for task records.');
        }

        const hasStatus = Object.prototype.hasOwnProperty.call(taskState, 'status');
        const hasPriority = Object.prototype.hasOwnProperty.call(taskState, 'priority');
        const hasDueAt = Object.prototype.hasOwnProperty.call(taskState, 'due_at');
        const hasCategory = Object.prototype.hasOwnProperty.call(taskState, 'category');

        let mergedStatus = asText(currentTaskState.status) || 'todo';
        if (hasStatus) {
          const nextStatus = asText(taskState.status);
          if (!taskStatusSet.has(nextStatus)) {
            throw new ValidationError('task_state.status must be one of todo, in_progress, done, or cancelled.');
          }
          mergedStatus = nextStatus;
        }

        let mergedPriority = deps.asNullableText(currentTaskState.priority);
        if (hasPriority) {
          const nextPriority = taskState.priority === null ? null : deps.asNullableText(taskState.priority);
          if (nextPriority !== null && !taskPrioritySet.has(nextPriority)) {
            throw new ValidationError('task_state.priority must be low, medium, high, urgent, or null.');
          }
          mergedPriority = nextPriority;
        }

        let mergedDueAt = deps.asNullableText(currentTaskState.due_at);
        if (hasDueAt) {
          if (taskState.due_at === null) {
            mergedDueAt = null;
          } else {
            const nextDueAt = deps.asNullableText(taskState.due_at);
            if (!nextDueAt || !isIsoDateTimeString(nextDueAt)) {
              throw new ValidationError('task_state.due_at must be an ISO datetime string or null.');
            }
            mergedDueAt = nextDueAt;
          }
        }

        let mergedCategory = deps.asNullableText(currentTaskState.category);
        if (hasCategory) {
          mergedCategory = taskState.category === null ? null : deps.asNullableText(taskState.category);
        }

        let mergedCompletedAt = deps.asNullableText(currentTaskState.completed_at);
        if (hasStatus) {
          mergedCompletedAt = mergedStatus === 'done'
            ? (mergedCompletedAt || timestamp)
            : null;
        }

        upsertTaskStateStmt.run(
          recordId,
          mergedStatus,
          mergedPriority,
          mergedDueAt,
          mergedCategory,
          mergedCompletedAt,
          timestamp,
        );
        taskChanged = true;
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        request.log.warn('Record update validation failed.', { error });
        send(response, jsonResponse(400, errorEnvelope('invalid_input', error.message)));
        return;
      }
      request.log.error('Failed to update record.', {
        recordId,
        error,
      });
      send(response, jsonResponse(500, errorEnvelope('internal_error', 'Internal server error.')));
      return;
    }

    emitTimelineEvent({
      projectId: record.project_id,
      actorUserId: auth.user.user_id,
      eventType: archivedAt && !record.archived_at ? 'record.archived' : 'record.updated',
      primaryEntityType: 'record',
      primaryEntityId: recordId,
      summary: { title },
    });
    try {
      const assignees = assignmentsByRecordStmt?.all(recordId) || [];
      for (const assignee of assignees) {
        if (assignee.user_id === auth.user.user_id) {
          continue;
        }
        createNotification({
          projectId: record.project_id,
          userId: assignee.user_id,
          reason: 'update',
          entityType: 'record',
          entityId: recordId,
          notificationScope: 'network',
          payload: buildNotificationPayload({
            message: `Record updated: ${title}`,
            sourceProjectId: record.project_id,
          }),
        });
      }
      if (taskChanged) {
        const updatedRecord = recordByIdStmt.get(recordId);
        const liveRecipients = new Set([auth.user.user_id, ...assignees.map((assignee) => assignee.user_id)]);
        for (const userId of liveRecipients) {
          broadcastTaskChanged(updatedRecord, userId);
        }
      }
    } catch (error) {
      request.log.warn('Record update notification fan-out failed (best-effort).', {
        recordId,
        error,
      });
    }

    send(response, jsonResponse(200, okEnvelope({ record: recordDetailForUser(recordByIdStmt.get(recordId), auth.user.user_id) })));
  };

  const listSubtasks = async ({ request, response, params }) => {
    const auth = await withAuth(request);
    if (auth.error) {
      send(response, auth.error);
      return;
    }

    const recordId = params.recordId;
    const parentRecord = recordByIdStmt.get(recordId);
    if (!parentRecord) {
      send(response, jsonResponse(404, errorEnvelope('not_found', 'Record not found.')));
      return;
    }

    const projectGate = withProjectPolicyGate({ userId: auth.user.user_id, projectId: parentRecord.project_id, requiredCapability: 'view' });
    if (projectGate.error) {
      send(response, jsonResponse(projectGate.error.status, errorEnvelope(projectGate.error.code, projectGate.error.message)));
      return;
    }

    const personalProjectId = personalProjectIdForUser(auth.user.user_id);
    const sourcePaneContextCache = new Map();
    const subtasks = subtasksByParentStmt.all(recordId).map((row) => buildTaskSummaryForUser(row, personalProjectId, sourcePaneContextCache));

    send(response, jsonResponse(200, okEnvelope({ subtasks })));
  };

  const convertRecord = async ({ request, response, requestUrl, params }) => {
    const auth = await withAuth(request);
    if (auth.error) {
      send(response, auth.error);
      return;
    }

    const sourceRecordId = params.recordId;
    const sourceRecord = recordByIdStmt.get(sourceRecordId);
    if (!sourceRecord) {
      send(response, jsonResponse(404, errorEnvelope('not_found', 'Record not found.')));
      return;
    }
    if (sourceRecord.archived_at) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'Archived records cannot be converted.')));
      return;
    }

    let body;
    try {
      body = await parseBody(request);
    } catch (error) {
      request.log.warn('Failed to parse request body for record conversion.', { error });
      send(response, parseBody.errorResponse(error));
      return;
    }

    const sourceWriteGate = resolveProjectContentWriteGate({
      userId: auth.user.user_id,
      projectId: sourceRecord.project_id,
      paneId: resolveMutationContextPaneId({ body, requestUrl }),
    });
    if (sourceWriteGate.error) {
      send(response, jsonResponse(sourceWriteGate.error.status, errorEnvelope(sourceWriteGate.error.code, sourceWriteGate.error.message)));
      return;
    }

    if (taskStateByRecordStmt.get(sourceRecordId) || eventStateByRecordStmt.get(sourceRecordId)) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'Only uncategorized captures can be converted.')));
      return;
    }

    const sourceMentionCount = Number(
      mentionsCountByTargetStmt.get(sourceRecord.project_id, 'record', sourceRecordId)?.mention_count || 0,
    );
    const sourceHasPayload = valuesByRecordStmt.all(sourceRecordId).length > 0
      || assignmentsByRecordStmt.all(sourceRecordId).length > 0
      || recordCapabilitiesByRecordStmt.all(sourceRecordId).length > 0
      || Boolean(recurrenceByRecordStmt.get(sourceRecordId))
      || remindersByRecordStmt.all(sourceRecordId).length > 0
      || outgoingRelationsStmt.all(sourceRecordId).length > 0
      || incomingRelationsStmt.all(sourceRecordId).length > 0
      || attachmentsByEntityStmt.all(sourceRecord.project_id, 'record', sourceRecordId).length > 0
      || commentsByTargetStmt.all(sourceRecord.project_id, 'record', sourceRecordId).length > 0
      || sourceMentionCount > 0;
    if (sourceHasPayload) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'Only empty captures can be converted.')));
      return;
    }

    const mode = asText(body.mode).toLowerCase() || 'thought';
    if (!captureConversionModes.has(mode)) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'mode must be one of thought or task.')));
      return;
    }

    const targetProjectId = asText(body.target_project_id) || sourceRecord.project_id;
    const targetWriteGate = resolveProjectContentWriteGate({
      userId: auth.user.user_id,
      projectId: targetProjectId,
      paneId: resolveMutationContextPaneId({ body, requestUrl }),
    });
    if (targetWriteGate.error) {
      send(response, jsonResponse(targetWriteGate.error.status, errorEnvelope(targetWriteGate.error.code, targetWriteGate.error.message)));
      return;
    }

    const title = asText(body.title) || sourceRecord.title || 'Untitled Record';
    const timestamp = nowIso();
    let targetRecordId = '';

    try {
      withTransaction(() => {
        const personalProject = personalProjectByUserStmt.get(auth.user.user_id, auth.user.user_id);
        const isPersonalTask = mode === 'task'
          && targetProjectId === asText(personalProject?.project_id);

        if (isPersonalTask) {
          const tasksCollectionId = asText(personalProject?.tasks_collection_id);
          if (!personalProject || !tasksCollectionId) {
            throw new ValidationError('Personal tasks collection is unavailable.');
          }
          const taskRecord = createPersonalTaskRecord({
            userId: auth.user.user_id,
            projectId: personalProject.project_id,
            collectionId: tasksCollectionId,
            title,
            createdAt: timestamp,
            updatedAt: timestamp,
          });
          targetRecordId = taskRecord.record_id;
        } else {
          const targetCollectionId = asText(body.target_collection_id);
          const targetCollection = collectionByIdStmt.get(targetCollectionId);
          if (!targetCollection || targetCollection.project_id !== targetProjectId) {
            throw new ValidationError('target_collection_id must belong to target_project_id.');
          }

          targetRecordId = newId('rec');
          const nextSourcePaneId = targetProjectId === sourceRecord.project_id ? sourceRecord.source_pane_id || null : null;
          const nextSourceViewId = targetProjectId === sourceRecord.project_id ? sourceRecord.source_view_id || null : null;
          insertRecordStmt.run(
            targetRecordId,
            targetProjectId,
            targetCollectionId,
            title,
            nextSourcePaneId,
            nextSourceViewId,
            auth.user.user_id,
            timestamp,
            timestamp,
            null,
          );

          if (mode === 'task') {
            insertRecordCapabilityStmt.run(targetRecordId, 'task', timestamp);
            upsertTaskStateStmt.run(targetRecordId, 'todo', null, null, null, null, timestamp);
          }
        }

        updateRecordStmt.run(sourceRecord.title, timestamp, timestamp, sourceRecordId);

        emitTimelineEvent({
          projectId: targetProjectId,
          actorUserId: auth.user.user_id,
          eventType: 'record.created',
          primaryEntityType: 'record',
          primaryEntityId: targetRecordId,
          summary: { title },
        });

        emitTimelineEvent({
          projectId: sourceRecord.project_id,
          actorUserId: auth.user.user_id,
          eventType: 'record.archived',
          primaryEntityType: 'record',
          primaryEntityId: sourceRecordId,
          summary: { title: sourceRecord.title },
        });
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        request.log.warn('Record conversion validation failed.', { error });
        send(response, jsonResponse(400, errorEnvelope('invalid_input', error.message)));
        return;
      }
      request.log.error('Failed to convert record.', {
        sourceRecordId,
        targetProjectId,
        mode,
        error,
      });
      send(response, jsonResponse(500, errorEnvelope('internal_error', 'Internal server error.')));
      return;
    }

    send(response, jsonResponse(201, okEnvelope({ target_record_id: targetRecordId, source_record_id: sourceRecordId })));
  };

  const getRecord = async ({ request, response, params }) => {
    const auth = await withAuth(request);
    if (auth.error) {
      send(response, auth.error);
      return;
    }

    const recordId = params.recordId;
    const record = recordByIdStmt.get(recordId);
    if (!record) {
      send(response, jsonResponse(404, errorEnvelope('not_found', 'Record not found.')));
      return;
    }

    const projectGate = withProjectPolicyGate({
      userId: auth.user.user_id,
      projectId: record.project_id,
      requiredCapability: 'view',
    });
    if (projectGate.error) {
      send(response, jsonResponse(projectGate.error.status, errorEnvelope(projectGate.error.code, projectGate.error.message)));
      return;
    }

    send(response, jsonResponse(200, okEnvelope({ record: recordDetailForUser(record, auth.user.user_id) })));
  };

  const updateRecordValues = async ({ request, response, requestUrl, params }) => {
    const auth = await withAuth(request);
    if (auth.error) {
      send(response, auth.error);
      return;
    }
    const recordId = params.recordId;
    const record = recordByIdStmt.get(recordId);
    if (!record) {
      send(response, jsonResponse(404, errorEnvelope('not_found', 'Record not found.')));
      return;
    }
    let body;
    try {
      body = await parseBody(request);
    } catch (error) {
      request.log.warn('Failed to parse request body for record values update.', { error });
      send(response, parseBody.errorResponse(error));
      return;
    }

    const writeGate = resolveProjectContentWriteGate({
      userId: auth.user.user_id,
      projectId: record.project_id,
      paneId: resolveMutationContextPaneId({ body, requestUrl }),
    });
    if (writeGate.error) {
      send(response, jsonResponse(writeGate.error.status, errorEnvelope(writeGate.error.code, writeGate.error.message)));
      return;
    }

    const values = parseJsonObject(body.values, {});
    const timestamp = nowIso();
    const ignoredFields = [];
    for (const [fieldId, value] of Object.entries(values)) {
      const field = fieldByIdStmt.get(fieldId);
      if (!field || field.collection_id !== record.collection_id) {
        ignoredFields.push(fieldId);
        continue;
      }
      upsertRecordValueStmt.run(recordId, fieldId, toJson(value), timestamp);
    }

    updateRecordStmt.run(record.title, timestamp, record.archived_at, recordId);

    emitTimelineEvent({
      projectId: record.project_id,
      actorUserId: auth.user.user_id,
      eventType: 'record.updated',
      primaryEntityType: 'record',
      primaryEntityId: recordId,
      summary: { message: 'Record values updated' },
    });
    try {
      const assignees = assignmentsByRecordStmt?.all(recordId) || [];
      for (const assignee of assignees) {
        if (assignee.user_id === auth.user.user_id) {
          continue;
        }
        createNotification({
          projectId: record.project_id,
          userId: assignee.user_id,
          reason: 'update',
          entityType: 'record',
          entityId: recordId,
          notificationScope: 'network',
          payload: buildNotificationPayload({
            message: `Record updated: ${record.title}`,
            sourceProjectId: record.project_id,
          }),
        });
      }
    } catch (error) {
      request.log.warn('Record values notification fan-out failed (best-effort).', {
        recordId,
        error,
      });
    }

    send(response, jsonResponse(200, okEnvelope({ values: recordValuesMap(recordId), ignored_fields: ignoredFields })));
  };

  const createRecordRelation = async ({ request, response, requestUrl, params }) => {
    const auth = await withAuth(request);
    if (auth.error) {
      send(response, auth.error);
      return;
    }

    const fromRecordId = params.recordId;
    const fromRecord = recordByIdStmt.get(fromRecordId);
    if (!fromRecord) {
      send(response, jsonResponse(404, errorEnvelope('not_found', 'Source record not found.')));
      return;
    }
    if (fromRecord.archived_at) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'Cannot add relations from archived records.')));
      return;
    }

    let body;
    try {
      body = await parseBody(request);
    } catch (error) {
      request.log.warn('Failed to parse request body for record relation creation.', { error });
      send(response, parseBody.errorResponse(error));
      return;
    }

    const writeGate = resolveProjectContentWriteGate({
      userId: auth.user.user_id,
      projectId: fromRecord.project_id,
      paneId: resolveMutationContextPaneId({ body, requestUrl }),
    });
    if (writeGate.error) {
      send(response, jsonResponse(writeGate.error.status, errorEnvelope(writeGate.error.code, writeGate.error.message)));
      return;
    }

    const toRecordId = asText(body.to_record_id);
    const viaFieldId = asText(body.via_field_id);
    const requestedProjectId = asText(body.project_id);
    const requestedFromRecordId = asText(body.from_record_id);
    if (requestedProjectId && requestedProjectId !== fromRecord.project_id) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'project_id must match source record project.')));
      return;
    }
    if (requestedFromRecordId && requestedFromRecordId !== fromRecordId) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'from_record_id must match route record id.')));
      return;
    }
    const toRecord = recordByIdStmt.get(toRecordId);
    const relationField = fieldByIdStmt.get(viaFieldId);
    if (!toRecord || !relationField || !toRecordId || !viaFieldId) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'to_record_id and via_field_id are required.')));
      return;
    }
    if (toRecord.project_id !== fromRecord.project_id) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'Related record must belong to the same project.')));
      return;
    }
    if (toRecord.archived_at) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'Cannot relate to archived records.')));
      return;
    }
    if (relationField.type !== 'relation') {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'via_field_id must reference a relation field.')));
      return;
    }
    const fieldCollection = collectionByIdStmt.get(relationField.collection_id);
    if (!fieldCollection || fieldCollection.project_id !== fromRecord.project_id) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'Relation field must belong to the same project.')));
      return;
    }
    if (relationField.collection_id !== fromRecord.collection_id) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'Relation field must belong to the source record collection.')));
      return;
    }
    const targetCollectionId = relationTargetCollectionIdFromField(relationField);
    if (targetCollectionId && toRecord.collection_id !== targetCollectionId) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'Related record does not match relation field target collection.')));
      return;
    }
    const relationId = newId('rel');
    const createdAt = nowIso();
    const relationConflictMessage = 'Relation already exists for this field.';
    try {
      withTransaction(() => {
        const duplicate = relationByEdgeStmt.get(fromRecord.project_id, fromRecordId, toRecordId, viaFieldId);
        if (duplicate) {
          throw new Error(relationConflictMessage);
        }

        insertRelationStmt.run(relationId, fromRecord.project_id, fromRecordId, toRecordId, viaFieldId, auth.user.user_id, createdAt);
        emitTimelineEvent({
          projectId: fromRecord.project_id,
          actorUserId: auth.user.user_id,
          eventType: 'record.relation_added',
          primaryEntityType: 'record',
          primaryEntityId: fromRecordId,
          secondaryEntities: [{ entity_type: 'record', entity_id: toRecordId }],
          summary: { relation_id: relationId, via_field_id: viaFieldId },
        });
      });
    } catch (error) {
      if (String(error?.message || '') === relationConflictMessage || String(error?.message || '').includes('UNIQUE constraint failed')) {
        send(response, jsonResponse(409, errorEnvelope('conflict', relationConflictMessage)));
        return;
      }
      request.log.error('Failed to create record relation.', {
        fromRecordId,
        toRecordId,
        viaFieldId,
        error,
      });
      throw error;
    }

    send(response, jsonResponse(201, okEnvelope({
      relation: {
        relation_id: relationId,
        project_id: fromRecord.project_id,
        from_record_id: fromRecordId,
        to_record_id: toRecordId,
        via_field_id: viaFieldId,
        created_by: auth.user.user_id,
        created_at: createdAt,
      },
    })));
  };

  const deleteRelation = async ({ request, response, requestUrl, params }) => {
    const auth = await withAuth(request);
    if (auth.error) {
      send(response, auth.error);
      return;
    }

    const relationId = params.relationId;
    const requestedProjectId = asText(requestUrl.searchParams.get('project_id'));
    const relation = relationByIdStmt.get(relationId);
    if (!relation) {
      send(response, jsonResponse(404, errorEnvelope('not_found', 'Relation not found.')));
      return;
    }
    if (requestedProjectId && requestedProjectId !== relation.project_id) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'project_id must match relation project.')));
      return;
    }
    const writeGate = resolveProjectContentWriteGate({
      userId: auth.user.user_id,
      projectId: relation.project_id,
      paneId: resolveMutationContextPaneId({ requestUrl }),
    });
    if (writeGate.error) {
      send(response, jsonResponse(writeGate.error.status, errorEnvelope(writeGate.error.code, writeGate.error.message)));
      return;
    }

    withTransaction(() => {
      deleteRelationStmt.run(relationId);
      emitTimelineEvent({
        projectId: relation.project_id,
        actorUserId: auth.user.user_id,
        eventType: 'record.relation_removed',
        primaryEntityType: 'record',
        primaryEntityId: relation.from_record_id,
        secondaryEntities: [{ entity_type: 'record', entity_id: relation.to_record_id }],
        summary: { relation_id: relationId, via_field_id: relation.via_field_id },
      });
    });

    send(response, jsonResponse(200, okEnvelope({ deleted: true, relation_id: relationId })));
  };

  const searchMentions = async ({ request, response, requestUrl, params }) => {
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

    const query = asText(requestUrl.searchParams.get('q')).toLowerCase();
    const limit = asInteger(requestUrl.searchParams.get('limit'), 20, 1, 50);
    const likeQuery = `%${query.replace(/[%_]/g, '')}%`;

    const users = mentionSearchUsersStmt.all(projectId, query, likeQuery, likeQuery, limit).map((row) => ({
      entity_ref: {
        entity_type: 'user',
        entity_id: row.user_id,
      },
      label: row.display_name,
      secondary_label: row.email || null,
      entity_type: 'user',
      metadata: {
        display_name: row.display_name,
        email: row.email || null,
      },
    }));

    const records = mentionSearchRecordsStmt.all(projectId, query, likeQuery, limit).map((row) => ({
      entity_ref: {
        entity_type: 'record',
        entity_id: row.record_id,
      },
      label: row.title || 'Untitled record',
      secondary_label: row.collection_name || null,
      entity_type: 'record',
      metadata: {
        record_id: row.record_id,
        collection_id: row.collection_id,
        collection_name: row.collection_name || null,
      },
    }));

    const items = [];
    let userIndex = 0;
    let recordIndex = 0;
    while (items.length < limit && (userIndex < users.length || recordIndex < records.length)) {
      if (userIndex < users.length) {
        items.push(users[userIndex]);
        userIndex += 1;
      }
      if (items.length >= limit) {
        break;
      }
      if (recordIndex < records.length) {
        items.push(records[recordIndex]);
        recordIndex += 1;
      }
    }
    send(response, jsonResponse(200, okEnvelope({ query, items })));
  };

  const listBacklinks = async ({ request, response, requestUrl, params }) => {
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

    const targetEntityType = asText(requestUrl.searchParams.get('target_entity_type'));
    const targetEntityId = asText(requestUrl.searchParams.get('target_entity_id'));
    if (!targetEntityType || !targetEntityId) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'target_entity_type and target_entity_id are required.')));
      return;
    }
    if (targetEntityType === 'doc') {
      const docGate = requireDocAccess(targetEntityId, auth.user.user_id);
      if (docGate.error) {
        send(response, jsonResponse(docGate.error.status, errorEnvelope(docGate.error.code, docGate.error.message)));
        return;
      }
      if (docGate.project_id !== projectId) {
        send(response, jsonResponse(404, errorEnvelope('not_found', 'Doc not found in project.')));
        return;
      }
    }

    const backlinks = mentionsByTargetStmt
      .all(auth.user.user_id, auth.user.user_id, auth.user.user_id, auth.user.user_id, projectId, targetEntityType, targetEntityId)
      .map(mapMentionRowToBacklink);

    send(response, jsonResponse(200, okEnvelope({ backlinks })));
  };

  return {
    createCollection,
    createCollectionField,
    createRecord,
    convertRecord,
    createRecordRelation,
    deleteRelation,
    getRecord,
    listBacklinks,
    listCollectionFields,
    listCollections,
    listSubtasks,
    searchMentions,
    searchProjectRecords,
    updateRecord,
    updateRecordValues,
  };
};
