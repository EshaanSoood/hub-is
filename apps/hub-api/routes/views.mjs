import { validateCreateEventRequest } from '../lib/validators.mjs';

export const createViewRoutes = (deps) => {
  const {
    withAuth,
    withTransaction,
    withProjectPolicyGate,
    send,
    jsonResponse,
    okEnvelope,
    errorEnvelope,
    parseBody,
    asText,
    asInteger,
    parseJsonObject,
    toJson,
    nowIso,
    newId,
    emitTimelineEvent,
    buildNotificationRouteContext,
    buildNotificationPayload,
    createNotification,
    collectionSchema,
    recordSummary,
    recordDetail,
    resolveProjectContentWriteGate,
    normalizeParticipants,
    findOrCreateEventsCollection,
    parseCursorOffset,
    encodeCursorOffset,
    viewTypeSet,
    viewsByProjectStmt,
    viewByIdStmt,
    insertViewStmt,
    collectionByIdStmt,
    recordsByCollectionStmt,
    capabilitiesByRecordStmt,
    participantsByRecordStmt,
    eventStateByRecordStmt,
    insertRecordStmt,
    insertRecordCapabilityStmt,
    upsertEventStateStmt,
    clearEventParticipantsStmt,
    insertEventParticipantStmt,
    upsertRecurrenceStmt,
    clearRemindersStmt,
    insertReminderStmt,
    calendarRecordsByProjectStmt,
    eventParticipantByRecordAndUserStmt,
    projectMembershipsByUserStmt,
    projectByIdStmt,
    timelineByProjectStmt,
    timelineRecord,
  } = deps;

  const listViews = async ({ request, response, params }) => {
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

    const views = viewsByProjectStmt.all(projectId).map((view) => ({
      view_id: view.view_id,
      project_id: view.project_id,
      collection_id: view.collection_id,
      type: view.type,
      name: view.name,
      config: parseJsonObject(view.config, {}),
    }));
    send(response, jsonResponse(200, okEnvelope({ views })));
  };

  const createView = async ({ request, response, requestUrl, params }) => {
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
      request.log.warn('Failed to parse request body for view creation.', { error });
      send(response, jsonResponse(400, errorEnvelope('invalid_json', 'Body must be valid JSON.')));
      return;
    }

    const writeGate = resolveProjectContentWriteGate({
      userId: auth.user.user_id,
      projectId,
      paneId: deps.resolveMutationContextPaneId({ body, requestUrl }),
    });
    if (writeGate.error) {
      send(response, jsonResponse(writeGate.error.status, errorEnvelope(writeGate.error.code, writeGate.error.message)));
      return;
    }

    const collectionId = asText(body.collection_id);
    const type = asText(body.type);
    const name = asText(body.name) || `${type || 'table'} view`;
    if (!viewTypeSet.has(type)) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'Invalid view type.')));
      return;
    }

    const collection = collectionByIdStmt.get(collectionId);
    if (!collection || collection.project_id !== projectId) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'Collection must belong to project.')));
      return;
    }

    const viewId = newId('view');
    const timestamp = nowIso();
    insertViewStmt.run(viewId, projectId, collectionId, type, name, toJson(parseJsonObject(body.config, {})), auth.user.user_id, timestamp, timestamp);

    send(response, jsonResponse(201, okEnvelope({ view_id: viewId })));
  };

  const queryView = async ({ request, response }) => {
    const auth = await withAuth(request);
    if (auth.error) {
      send(response, auth.error);
      return;
    }

    let body;
    try {
      body = await parseBody(request);
    } catch (error) {
      request.log.warn('Failed to parse request body for view query.', { error });
      send(response, jsonResponse(400, errorEnvelope('invalid_json', 'Body must be valid JSON.')));
      return;
    }

    const viewId = asText(body.view_id);
    const view = viewByIdStmt.get(viewId);
    if (!view) {
      send(response, jsonResponse(404, errorEnvelope('not_found', 'View not found.')));
      return;
    }

    const projectGate = withProjectPolicyGate({
      userId: auth.user.user_id,
      projectId: view.project_id,
      requiredCapability: 'view',
    });
    if (projectGate.error) {
      send(response, jsonResponse(projectGate.error.status, errorEnvelope(projectGate.error.code, projectGate.error.message)));
      return;
    }

    const schema = collectionSchema(view.collection_id);
    const allRecords = recordsByCollectionStmt.all(view.project_id, view.collection_id);
    const mode = asText(body.mode).toLowerCase();
    let filtered = allRecords;

    if (mode === 'relevant') {
      filtered = allRecords.filter((record) => {
        const hasEventCapability = capabilitiesByRecordStmt
          .all(record.record_id)
          .some((row) => row.capability_type === 'calendar_event');
        if (!hasEventCapability) {
          return false;
        }
        const participant = eventParticipantByRecordAndUserStmt.get(record.record_id, auth.user.user_id);
        return Boolean(participant?.ok);
      });
    }

    const limit = asInteger(body?.pagination?.limit, 50, 1, 200);
    const offset = parseCursorOffset(body?.pagination?.cursor);
    const page = filtered.slice(offset, offset + limit);
    const nextOffset = offset + page.length;
    const nextCursor = nextOffset < filtered.length ? encodeCursorOffset(nextOffset) : null;

    send(
      response,
      jsonResponse(
        200,
        okEnvelope({
          schema,
          records: page.map(recordSummary),
          next_cursor: nextCursor,
          view: {
            view_id: view.view_id,
            collection_id: view.collection_id,
            type: view.type,
            name: view.name,
            config: parseJsonObject(view.config, {}),
          },
        }),
      ),
    );
  };

  const createEventFromNlp = async ({ request, response, params }) => {
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
      request.log.warn('Failed to parse request body for NLP event creation.', { error });
      send(response, jsonResponse(400, errorEnvelope('invalid_json', 'Body must be valid JSON.')));
      return;
    }

    let validated;
    try {
      validated = validateCreateEventRequest(body);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid request body.';
      request.log.warn('Event validation failed', { error: message, projectId });
      send(response, jsonResponse(400, errorEnvelope('validation_error', message)));
      return;
    }

    const writeGate = resolveProjectContentWriteGate({
      userId: auth.user.user_id,
      projectId,
      paneId: validated.source_pane_id || validated.pane_id,
    });
    if (writeGate.error) {
      send(response, jsonResponse(writeGate.error.status, errorEnvelope(writeGate.error.code, writeGate.error.message)));
      return;
    }

    const nlpFields = parseJsonObject(validated.nlp_fields_json, {});
    const title = asText(validated.title || nlpFields.title) || 'Untitled Event';
    const startDt = validated.start_dt;
    const endDt = validated.end_dt;

    const eventsCollection = findOrCreateEventsCollection(projectId);
    const timestamp = nowIso();
    const recordId = newId('rec');
    const timezone = asText(validated.timezone || nlpFields.timezone) || 'UTC';
    const notificationContext = buildNotificationRouteContext({
      projectId,
      sourcePaneId: validated.source_pane_id || validated.pane_id,
      sourceDocId: validated.source_doc_id,
      sourceNodeKey: validated.source_node_key,
    });

    const participantNotificationPayloads = [];
    try {
      withTransaction(() => {
        insertRecordStmt.run(recordId, projectId, eventsCollection.collection_id, title, auth.user.user_id, timestamp, timestamp, null);
        insertRecordCapabilityStmt.run(recordId, 'calendar_event', timestamp);
        upsertEventStateStmt.run(recordId, startDt, endDt, timezone, deps.asNullableText(validated.location || nlpFields.location), timestamp);

        const participantIds = normalizeParticipants(
          projectId,
          validated.participants_user_ids || validated.participant_user_ids || nlpFields.participants_user_ids || [auth.user.user_id],
        );
        clearEventParticipantsStmt.run(recordId);
        for (const userId of participantIds) {
          insertEventParticipantStmt.run(recordId, userId, null, timestamp);
          if (userId !== auth.user.user_id) {
            participantNotificationPayloads.push({
              userId,
              message: `You were added to event ${title}`,
            });
          }
        }

        const recurrenceRule = validated.recurrence_rule || validated.rule_json || nlpFields.recurrence_rule || nlpFields.rule_json;
        if (recurrenceRule) {
          insertRecordCapabilityStmt.run(recordId, 'recurring', timestamp);
          upsertRecurrenceStmt.run(recordId, toJson(recurrenceRule), timestamp);
        }

        const reminders = Array.isArray(validated.reminders)
          ? validated.reminders
          : Array.isArray(nlpFields.reminders)
            ? nlpFields.reminders
            : [];
        if (reminders.length > 0) {
          insertRecordCapabilityStmt.run(recordId, 'remindable', timestamp);
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
      });
    } catch (error) {
      request.log.error('Failed to create NLP event record.', { error, projectId });
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'Unable to create event from the provided input.')));
      return;
    }

    for (const notification of participantNotificationPayloads) {
      createNotification({
        projectId,
        userId: notification.userId,
        reason: 'assignment',
        entityType: 'record',
        entityId: recordId,
        notificationScope: 'network',
        payload: buildNotificationPayload({
          message: notification.message,
          ...notificationContext,
        }),
      });
    }

    emitTimelineEvent({
      projectId,
      actorUserId: auth.user.user_id,
      eventType: 'event.created',
      primaryEntityType: 'record',
      primaryEntityId: recordId,
      summary: { title, start_dt: startDt, end_dt: endDt },
    });

    send(response, jsonResponse(201, okEnvelope({ record: recordDetail(deps.recordByIdStmt.get(recordId)) })));
  };

  const listProjectCalendar = async ({ request, response, requestUrl, params }) => {
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

    const mode = asText(requestUrl.searchParams.get('mode')).toLowerCase() || 'all';
    const startBound = deps.asNullableText(requestUrl.searchParams.get('start'));
    const endBound = deps.asNullableText(requestUrl.searchParams.get('end'));
    const allRecords = calendarRecordsByProjectStmt.all(projectId);

    let filtered = allRecords;
    if (mode === 'relevant') {
      filtered = filtered.filter((record) => {
        const participant = eventParticipantByRecordAndUserStmt.get(record.record_id, auth.user.user_id);
        return Boolean(participant?.ok);
      });
    }

    if (startBound || endBound) {
      filtered = filtered.filter((record) => {
        const event = eventStateByRecordStmt.get(record.record_id);
        if (!event) {
          return false;
        }
        const start = new Date(event.start_dt).getTime();
        const end = new Date(event.end_dt).getTime();
        const floor = startBound ? new Date(startBound).getTime() : Number.NEGATIVE_INFINITY;
        const ceil = endBound ? new Date(endBound).getTime() : Number.POSITIVE_INFINITY;
        return end >= floor && start <= ceil;
      });
    }

    const events = filtered.map((record) => ({
      record_id: record.record_id,
      title: record.title,
      event_state: eventStateByRecordStmt.get(record.record_id),
      participants: participantsByRecordStmt.all(record.record_id).map((row) => ({ user_id: row.user_id, role: row.role })),
    }));

    send(response, jsonResponse(200, okEnvelope({ mode, events })));
  };

  const listPersonalCalendar = async ({ request, response, requestUrl }) => {
    const auth = await withAuth(request);
    if (auth.error) {
      send(response, auth.error);
      return;
    }

    const mode = asText(requestUrl.searchParams.get('mode')).toLowerCase() === 'all' ? 'all' : 'relevant';
    const visibleProjectIds = Array.from(
      new Set(
        projectMembershipsByUserStmt
          .all(auth.user.user_id)
          .map((membership) => asText(membership.project_id))
          .filter(Boolean),
      ),
    );

    const mergedRecords = visibleProjectIds.flatMap((projectId) => calendarRecordsByProjectStmt.all(projectId));

    let filtered = mergedRecords;
    if (mode === 'relevant') {
      filtered = filtered.filter((record) => {
        const participant = eventParticipantByRecordAndUserStmt.get(record.record_id, auth.user.user_id);
        return Boolean(participant?.ok);
      });
    }

    const events = filtered
      .flatMap((record) => {
        const eventState = eventStateByRecordStmt.get(record.record_id);
        if (!eventState) {
          return [];
        }
        const project = projectByIdStmt.get(record.project_id);
        return [{
          record_id: record.record_id,
          title: record.title,
          project_id: record.project_id,
          project_name: project?.name || null,
          event_state: eventState,
          participants: participantsByRecordStmt.all(record.record_id).map((row) => ({ user_id: row.user_id, role: row.role })),
        }];
      })
      .sort((left, right) => new Date(left.event_state.start_dt).getTime() - new Date(right.event_state.start_dt).getTime());

    send(response, jsonResponse(200, okEnvelope({ mode, events })));
  };

  const listProjectTimeline = async ({ request, response, requestUrl, params }) => {
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

    const limit = asInteger(requestUrl.searchParams.get('limit'), 50, 1, 200);
    const offset = parseCursorOffset(requestUrl.searchParams.get('cursor'));
    const rows = timelineByProjectStmt.all(projectId).map(timelineRecord);
    const page = rows.slice(offset, offset + limit);
    const nextOffset = offset + page.length;
    const nextCursor = nextOffset < rows.length ? encodeCursorOffset(nextOffset) : null;

    send(response, jsonResponse(200, okEnvelope({ timeline: page, next_cursor: nextCursor })));
  };

  return {
    createEventFromNlp,
    listPersonalCalendar,
    createView,
    listProjectCalendar,
    listProjectTimeline,
    listViews,
    queryView,
  };
};
