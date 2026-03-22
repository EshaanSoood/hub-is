const parseJsonArray = (value, fallback = []) => {
  if (typeof value !== 'string' || !value) {
    return fallback;
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
};

const parseRecurrenceJson = (value) => {
  if (typeof value !== 'string' || !value) {
    return null;
  }
  try {
    return JSON.parse(value);
  } catch {
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

export const createReminderRoutes = (deps) => {
  const {
    withPolicyGate,
    withProjectPolicyGate,
    send,
    jsonResponse,
    okEnvelope,
    errorEnvelope,
    parseBody,
    asText,
    nowIso,
    newId,
    toJson,
    withTransaction,
    broadcastReminderChanged,
    personalProjectByUserStmt,
    insertRecordStmt,
    insertRecordCapabilityStmt,
    listRemindersForUserStmt,
    dismissReminderStmt,
    findReminderByIdStmt,
    insertStandaloneReminderStmt,
  } = deps;

  const listReminders = withPolicyGate('hub.view', async ({ response, auth }) => {
    const rows = listRemindersForUserStmt.all(auth.user.user_id);
    const now = nowIso();

    const reminders = rows.map((row) => ({
      reminder_id: row.reminder_id,
      record_id: row.record_id,
      record_title: row.record_title,
      project_id: row.project_id,
      remind_at: row.remind_at,
      channels: parseJsonArray(row.channels, ['in_app']),
      recurrence_json: parseRecurrenceJson(row.recurrence_json),
      created_at: row.created_at,
      fired_at: row.fired_at ?? null,
      overdue: row.remind_at < now,
    }));

    send(response, jsonResponse(200, okEnvelope({ reminders })));
  });

  const dismissReminder = withPolicyGate('hub.tasks.write', async ({ response, auth, params }) => {
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
      projectId: reminder.project_id,
      requiredCapability: 'view',
    });
    if (projectGate.error) {
      send(response, jsonResponse(projectGate.error.status, errorEnvelope(projectGate.error.code, projectGate.error.message)));
      return;
    }

    const timestamp = nowIso();

    withTransaction(() => {
      dismissReminderStmt.run(timestamp, reminderId);

      const recurrence = parseRecurrenceJson(reminder.recurrence_json);
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

    try {
      broadcastReminderChanged(
        {
          reminder_id: reminderId,
          record_id: reminder.record_id,
          project_id: reminder.project_id,
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

  const createReminder = withPolicyGate('hub.tasks.write', async ({ request, response, auth }) => {
    let body;
    try {
      body = await parseBody(request);
    } catch {
      send(response, jsonResponse(400, errorEnvelope('invalid_body', 'Invalid request body.')));
      return;
    }

    const title = asText(body.title);
    const remindAtRaw = asText(body.remind_at);
    const remindAtDate = remindAtRaw ? new Date(remindAtRaw) : null;
    const recurrenceJson = body.recurrence_json ? toJson(body.recurrence_json) : null;

    if (!title) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'title is required.')));
      return;
    }

    if (!remindAtDate || Number.isNaN(remindAtDate.getTime())) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'remind_at must be a valid ISO timestamp.')));
      return;
    }
    const remindAt = remindAtDate.toISOString();

    const personalProject = personalProjectByUserStmt.get(auth.user.user_id, auth.user.user_id);
    if (!personalProject) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'No personal project found for user.')));
      return;
    }

    const collectionId = asText(personalProject.reminders_collection_id);
    if (!collectionId) {
      send(response, jsonResponse(500, errorEnvelope('server_error', 'Personal reminders collection is unavailable.')));
      return;
    }

    const timestamp = nowIso();
    const recordId = newId('rec');
    const reminderId = newId('rem');

    withTransaction(() => {
      insertRecordStmt.run(
        recordId,
        personalProject.project_id,
        collectionId,
        title,
        auth.user.user_id,
        timestamp,
        timestamp,
      );
      insertRecordCapabilityStmt.run(recordId, 'remindable', timestamp);
      insertStandaloneReminderStmt.run(reminderId, recordId, remindAt, toJson(['in_app']), timestamp, recurrenceJson);
    });

    try {
      broadcastReminderChanged(
        {
          reminder_id: reminderId,
          record_id: recordId,
          project_id: personalProject.project_id,
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
          reminder: {
            reminder_id: reminderId,
            record_id: recordId,
            record_title: title,
            project_id: personalProject.project_id,
            remind_at: remindAt,
            channels: ['in_app'],
            recurrence_json: body.recurrence_json ?? null,
            created_at: timestamp,
            fired_at: null,
            overdue: remindAt < timestamp,
          },
        }),
      ),
    );
  });

  return { listReminders, dismissReminder, createReminder };
};
