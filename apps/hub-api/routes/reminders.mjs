import { validateCreateReminderRequest, validateUpdateReminderRequest } from '../lib/validators.mjs';

const elapsedMs = (startedAtMs) => Number((performance.now() - startedAtMs).toFixed(2));

const parseJsonArray = (value, fallback = [], requestLog = null) => {
  if (typeof value !== 'string' || !value) {
    return fallback;
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch (error) {
    requestLog?.warn?.('Failed to parse reminder channels JSON.', { error });
    return fallback;
  }
};

const parseRecurrenceJson = (value, requestLog = null) => {
  if (typeof value !== 'string' || !value) {
    return null;
  }
  try {
    return JSON.parse(value);
  } catch (error) {
    requestLog?.warn?.('Failed to parse reminder recurrence JSON.', { error });
    return null;
  }
};

const nextReminderAtForFrequency = (isoValue, frequency, interval = 1) => {
  const date = new Date(isoValue);
  if (!Number.isFinite(date.getTime()) || !frequency || !Number.isInteger(interval) || interval < 1) {
    return null;
  }

  if (frequency === 'daily') {
    date.setDate(date.getDate() + interval);
  } else if (frequency === 'weekly') {
    date.setDate(date.getDate() + (7 * interval));
  } else if (frequency === 'monthly') {
    date.setMonth(date.getMonth() + interval);
  } else if (frequency === 'yearly') {
    date.setFullYear(date.getFullYear() + interval);
  } else {
    return null;
  }

  return date.toISOString();
};

const reminderScopeFromValue = (value) => (value === 'space' || value === 'project' ? 'space' : 'personal');

export const createReminderRoutes = (deps) => {
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
    nowIso,
    newId,
    toJson,
    withTransaction,
    broadcastReminderChanged,
    collectionByNameStmt,
    insertCollectionStmt,
    projectByIdStmt,
    workProjectByIdStmt,
    viewByIdStmt,
    personalProjectByUserStmt,
    projectMembershipsByUserStmt,
    insertRecordStmt,
    insertRecordCapabilityStmt,
    listRemindersForUserStmt,
    dismissReminderStmt,
    updateReminderByIdStmt,
    findReminderByIdStmt,
    insertStandaloneReminderStmt,
    updateProjectRemindersCollectionStmt,
  } = deps;

  const visibleSpaceIdsForUser = (userId) =>
    Array.from(
      new Set(
        projectMembershipsByUserStmt
          .all(userId)
          .map((membership) => asText(membership.space_id))
          .filter(Boolean),
      ),
    );

  const compareRemindersByDueDate = (left, right) => {
    const leftDueMs = left.remind_at ? new Date(left.remind_at).getTime() : Number.POSITIVE_INFINITY;
    const rightDueMs = right.remind_at ? new Date(right.remind_at).getTime() : Number.POSITIVE_INFINITY;
    const normalizedLeftDueMs = Number.isFinite(leftDueMs) ? leftDueMs : Number.POSITIVE_INFINITY;
    const normalizedRightDueMs = Number.isFinite(rightDueMs) ? rightDueMs : Number.POSITIVE_INFINITY;

    if (normalizedLeftDueMs !== normalizedRightDueMs) {
      return normalizedLeftDueMs - normalizedRightDueMs;
    }
    return String(left.reminder_id || '').localeCompare(String(right.reminder_id || ''));
  };

  const serializeReminder = (reminder, timestamp, requestLog = null) => ({
    reminder_id: reminder.reminder_id,
    record_id: reminder.record_id,
    record_title: reminder.record_title,
    space_id: reminder.space_id,
    remind_at: reminder.remind_at,
    channels: parseJsonArray(reminder.channels, ['in_app'], requestLog),
    recurrence_json: parseRecurrenceJson(reminder.recurrence_json, requestLog),
    created_at: reminder.created_at,
    fired_at: reminder.fired_at ?? null,
    overdue: reminder.remind_at < timestamp,
  });

  const listReminders = withPolicyGate('hub.view', async ({ request, response, requestUrl, auth }) => {
    const listQueryStartedAt = performance.now();
    const scope = reminderScopeFromValue(asText(requestUrl.searchParams.get('scope')));
    const requestedSpaceId = asText(requestUrl.searchParams.get('space_id'));
    const sourceProjectId = asText(requestUrl.searchParams.get('project_id') || requestUrl.searchParams.get('source_project_id'));
    const limit = asInteger(requestUrl.searchParams.get('limit'), 50, 1, 200);

    if (scope === 'space' && !requestedSpaceId) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'space_id is required for space-scoped reminders.')));
      return;
    }
    if (sourceProjectId && !requestedSpaceId) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'space_id is required when project_id is provided.')));
      return;
    }

    const visibleSpaceIds = visibleSpaceIdsForUser(auth.user.user_id)
      .filter((spaceId) => !requestedSpaceId || spaceId === requestedSpaceId);
    if (requestedSpaceId && visibleSpaceIds.length > 0 && sourceProjectId) {
      const project = workProjectByIdStmt.get(sourceProjectId);
      if (!project || project.space_id !== requestedSpaceId) {
        send(response, jsonResponse(400, errorEnvelope('invalid_input', 'project_id must belong to the requested space.')));
        return;
      }
    }

    const rows = [];
    for (const visibleSpaceId of visibleSpaceIds) {
      // Keep this argument order aligned with statements.mjs:listForUser, including the duplicated projectId binding.
      rows.push(
        ...listRemindersForUserStmt.all(
          auth.user.user_id,
          'space',
          '',
          'space',
          visibleSpaceId,
          requestedSpaceId && sourceProjectId ? sourceProjectId : '',
          requestedSpaceId && sourceProjectId ? sourceProjectId : '',
          limit,
        ),
      );
    }
    rows.sort(compareRemindersByDueDate);
    request.log.debug('Reminder listing query completed.', {
      durationMs: elapsedMs(listQueryStartedAt),
      queriedSpaceCount: visibleSpaceIds.length,
    });
    const now = nowIso();

    const reminders = rows.slice(0, limit).map((row) => ({
      reminder_id: row.reminder_id,
      record_id: row.record_id,
      record_title: row.record_title,
      space_id: row.space_id,
      remind_at: row.remind_at,
      channels: parseJsonArray(row.channels, ['in_app'], request.log),
      recurrence_json: parseRecurrenceJson(row.recurrence_json, request.log),
      created_at: row.created_at,
      fired_at: row.fired_at ?? null,
      overdue: row.remind_at < now,
    }));

    send(response, jsonResponse(200, okEnvelope({ reminders })));
  });

  const dismissReminder = withPolicyGate('hub.tasks.write', async ({ request, response, auth, params }) => {
    const reminderId = asText(params.reminderId);
    const reminder = reminderId ? findReminderByIdStmt.get(reminderId) : null;

    if (!reminder) {
      send(response, jsonResponse(404, errorEnvelope('not_found', 'Reminder not found.')));
      return;
    }

    if (reminder.record_archived_at) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'Cannot dismiss a reminder on an archived record.')));
      return;
    }

    const projectGate = withProjectPolicyGate({
      userId: auth.user.user_id,
      projectId: reminder.space_id,
      requiredCapability: 'view',
    });
    if (projectGate.error) {
      send(response, jsonResponse(projectGate.error.status, errorEnvelope(projectGate.error.code, projectGate.error.message)));
      return;
    }

    const timestamp = nowIso();

    try {
      withTransaction(() => {
        dismissReminderStmt.run(timestamp, reminderId);

        const recurrence = parseRecurrenceJson(reminder.recurrence_json, request.log);
        const interval =
          Number.isInteger(recurrence?.interval) && recurrence.interval > 0 ? recurrence.interval : 1;
        const nextRemindAt =
          asText(recurrence?.next_remind_at)
          || nextReminderAtForFrequency(reminder.remind_at, asText(recurrence?.frequency), interval);
        if (!nextRemindAt) {
          return;
        }

        const subsequentRemindAt =
          asText(recurrence?.subsequent_remind_at)
          || nextReminderAtForFrequency(nextRemindAt, asText(recurrence?.frequency), interval);
        const nextRecurrence = subsequentRemindAt || recurrence?.frequency
          ? toJson({
              ...(subsequentRemindAt ? { next_remind_at: subsequentRemindAt } : {}),
              ...(recurrence?.frequency ? { frequency: recurrence.frequency } : {}),
              ...(interval > 1 ? { interval } : {}),
            })
          : null;

        insertStandaloneReminderStmt.run(
          newId('rem'),
          reminder.record_id,
          nextRemindAt,
          reminder.channels,
          timestamp,
          nextRecurrence,
        );
      });
    } catch (error) {
      request.log.error('Failed to dismiss reminder.', { error });
      send(response, jsonResponse(500, errorEnvelope('internal_error', 'Internal server error.')));
      return;
    }

    try {
      broadcastReminderChanged(
        {
          reminder_id: reminderId,
          record_id: reminder.record_id,
          space_id: reminder.space_id,
          action: 'dismissed',
        },
        auth.user.user_id,
      );
    } catch (error) {
      console.debug('broadcastReminderChanged failed during reminder dismissal', {
        reminderId,
        userId: auth.user.user_id,
        error,
      });
    }

    send(response, jsonResponse(200, okEnvelope({ dismissed: true, reminder_id: reminderId })));
  });

  const updateReminder = withPolicyGate('hub.tasks.write', async ({ request, response, auth, params }) => {
    const reminderId = asText(params.reminderId);
    const reminder = reminderId ? findReminderByIdStmt.get(reminderId) : null;

    if (!reminder) {
      send(response, jsonResponse(404, errorEnvelope('not_found', 'Reminder not found.')));
      return;
    }

    if (reminder.record_archived_at) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'Cannot update a reminder on an archived record.')));
      return;
    }

    const projectGate = withProjectPolicyGate({
      userId: auth.user.user_id,
      projectId: reminder.space_id,
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
      request.log.warn('Failed to parse request body for reminder update.', { error });
      send(response, parseBody.errorResponse(error, { invalidCode: 'invalid_body', invalidMessage: 'Invalid request body.' }));
      return;
    }

    let validated;
    try {
      validated = validateUpdateReminderRequest(body);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid request body.';
      request.log.warn('Reminder update validation failed', { error: message, reminderId });
      send(response, jsonResponse(400, errorEnvelope('validation_error', message)));
      return;
    }

    const remindAt = validated.remind_at ?? reminder.remind_at;
    const recurrenceJson = typeof validated.recurrence_json === 'undefined'
      ? reminder.recurrence_json ?? null
      : validated.recurrence_json
        ? toJson(validated.recurrence_json)
        : null;

    try {
      updateReminderByIdStmt.run(remindAt, recurrenceJson, reminderId);
    } catch (error) {
      request.log.error('Failed to update reminder.', { error, reminderId });
      send(response, jsonResponse(500, errorEnvelope('internal_error', 'Internal server error.')));
      return;
    }

    const updatedReminder = findReminderByIdStmt.get(reminderId);
    if (!updatedReminder) {
      request.log.error('Reminder disappeared after update.', { reminderId });
      send(response, jsonResponse(500, errorEnvelope('internal_error', 'Internal server error.')));
      return;
    }

    try {
      broadcastReminderChanged(
        {
          reminder_id: reminderId,
          record_id: updatedReminder.record_id,
          space_id: updatedReminder.space_id,
          action: 'updated',
        },
        auth.user.user_id,
      );
    } catch (error) {
      console.debug('broadcastReminderChanged failed during reminder update', {
        reminderId,
        userId: auth.user.user_id,
        error,
      });
    }

    send(response, jsonResponse(200, okEnvelope({ reminder: serializeReminder(updatedReminder, nowIso(), request.log) })));
  });

  const createReminder = withPolicyGate('hub.tasks.write', async ({ request, response, auth }) => {
    let body;
    try {
      body = await parseBody(request);
    } catch (error) {
      request.log.warn('Failed to parse request body for reminder creation.', { error });
      send(response, parseBody.errorResponse(error, { invalidCode: 'invalid_body', invalidMessage: 'Invalid request body.' }));
      return;
    }

    let validated;
    try {
      validated = validateCreateReminderRequest(body);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid request body.';
      request.log.warn('Reminder validation failed', { error: message });
      send(response, jsonResponse(400, errorEnvelope('validation_error', message)));
      return;
    }

    const title = validated.title;
    const remindAt = validated.remind_at;
    const recurrenceJson = validated.recurrence_json ? toJson(validated.recurrence_json) : null;
    const scope = reminderScopeFromValue(validated.scope);
    const projectId = asText(validated.project_id) || null;
    const sourceProjectId = asText(validated.source_project_id) || null;
    const sourceViewId = typeof validated.source_view_id === 'string' && validated.source_view_id ? validated.source_view_id : null;

    let targetProject;
    if (scope === 'space') {
      const projectId = asText(validated.project_id);
      if (!projectId) {
        send(response, jsonResponse(400, errorEnvelope('invalid_input', 'space_id is required for space-scoped reminders.')));
        return;
      }

      const projectGate = withProjectPolicyGate({
        userId: auth.user.user_id,
        projectId,
        requiredCapability: 'write',
      });
      if (projectGate.error) {
        send(response, jsonResponse(projectGate.error.status, errorEnvelope(projectGate.error.code, projectGate.error.message)));
        return;
      }

      targetProject = projectByIdStmt.get(projectId);
      if (!targetProject) {
        send(response, jsonResponse(404, errorEnvelope('not_found', 'Space not found.')));
        return;
      }

      if (sourceProjectId) {
        const project = workProjectByIdStmt.get(sourceProjectId);
        if (!project || project.space_id !== projectId) {
          send(response, jsonResponse(400, errorEnvelope('invalid_input', 'project_id must belong to the requested space.')));
          return;
        }
      }

      if (sourceViewId) {
        const view = viewByIdStmt.get(sourceViewId);
        if (!view || view.space_id !== projectId) {
          send(response, jsonResponse(400, errorEnvelope('invalid_input', 'source_view_id must belong to the requested space.')));
          return;
        }
      }
    } else {
      targetProject = personalProjectByUserStmt.get(auth.user.user_id, auth.user.user_id);
      if (!targetProject) {
        send(response, jsonResponse(400, errorEnvelope('invalid_input', 'No personal space found for user.')));
        return;
      }
    }

    const timestamp = nowIso();
    const recordId = newId('rec');
    const reminderId = newId('rem');
    let collectionId = asText(targetProject.reminders_collection_id);

    try {
      withTransaction(() => {
        if (!collectionId) {
          const existingCollection = collectionByNameStmt.get(targetProject.space_id, 'Reminders');
          if (existingCollection?.collection_id) {
            collectionId = existingCollection.collection_id;
            updateProjectRemindersCollectionStmt.run(collectionId, timestamp, targetProject.space_id);
          } else {
            collectionId = newId('col');
            insertCollectionStmt.run(collectionId, targetProject.space_id, 'Reminders', null, null, timestamp, timestamp);
            updateProjectRemindersCollectionStmt.run(collectionId, timestamp, targetProject.space_id);
          }
        }

        insertRecordStmt.run(
          recordId,
          targetProject.space_id,
          collectionId,
          title,
          sourceProjectId,
          sourceViewId,
          auth.user.user_id,
          timestamp,
          timestamp,
          null,
        );
        insertRecordCapabilityStmt.run(recordId, 'remindable', timestamp);
        insertStandaloneReminderStmt.run(reminderId, recordId, remindAt, toJson(['in_app']), timestamp, recurrenceJson);
      });
    } catch (error) {
      request.log.error('Failed to create reminder record.', { error });
      send(response, jsonResponse(500, errorEnvelope('internal_error', 'Internal server error.')));
      return;
    }

    try {
      broadcastReminderChanged(
        {
          reminder_id: reminderId,
          record_id: recordId,
          space_id: targetProject.space_id,
          action: 'created',
        },
        auth.user.user_id,
      );
    } catch (error) {
      console.debug('broadcastReminderChanged failed during reminder creation', {
        reminderId,
        userId: auth.user.user_id,
        error,
      });
    }

    send(
      response,
      jsonResponse(
        201,
        okEnvelope({
          reminder: serializeReminder({
            reminder_id: reminderId,
            record_id: recordId,
            record_title: title,
            space_id: targetProject.space_id,
            remind_at: remindAt,
            channels: toJson(['in_app']),
            recurrence_json: recurrenceJson,
            created_at: timestamp,
            fired_at: null,
          }, timestamp, request.log),
        }),
      ),
    );
  });

  return { listReminders, dismissReminder, updateReminder, createReminder };
};
