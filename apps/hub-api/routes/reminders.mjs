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

const nextReminderAtForFrequency = (isoValue, frequency) => {
  const date = new Date(isoValue);
  if (!Number.isFinite(date.getTime()) || !frequency) {
    return null;
  }

  if (frequency === 'daily') {
    date.setDate(date.getDate() + 1);
  } else if (frequency === 'weekly') {
    date.setDate(date.getDate() + 7);
  } else if (frequency === 'monthly') {
    date.setMonth(date.getMonth() + 1);
  } else if (frequency === 'yearly') {
    date.setFullYear(date.getFullYear() + 1);
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
      const nextRemindAt = asText(recurrence?.next_remind_at) || nextReminderAtForFrequency(reminder.remind_at, asText(recurrence?.frequency));
      if (!nextRemindAt) {
        return;
      }

      const subsequentRemindAt = asText(recurrence?.subsequent_remind_at) || nextReminderAtForFrequency(nextRemindAt, asText(recurrence?.frequency));
      const nextRecurrence = subsequentRemindAt || recurrence?.frequency
        ? toJson({
            ...(subsequentRemindAt ? { next_remind_at: subsequentRemindAt } : {}),
            ...(recurrence?.frequency ? { frequency: recurrence.frequency } : {}),
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
    const remindAt = asText(body.remind_at);
    const recurrenceJson = body.recurrence_json ? toJson(body.recurrence_json) : null;

    if (!title) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'title is required.')));
      return;
    }

    if (!remindAt) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'remind_at is required.')));
      return;
    }

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
