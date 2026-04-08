export const createReminderScheduler = ({
  REMINDER_CHECK_INTERVAL_MS,
  nowIso,
  asText,
  db,
  withTransaction,
  dueRemindersStmt,
  claimReminderFiredStmt,
  assignmentsByRecordStmt,
  participantsByRecordStmt,
  recordByIdStmt,
  newId,
  buildNotificationPayload,
  toJson,
  insertNotificationStmt,
  notificationRecord,
  broadcastHubLiveToUser,
  systemLog,
}) => {
  let timer = null;

  const fireDueReminders = () => {
    try {
      const firedAt = nowIso();
      const dueReminders = dueRemindersStmt.all(firedAt);
      for (const reminder of dueReminders) {
        try {
          const createdNotifications = [];
          let claimed = false;
          withTransaction(db, () => {
            const claimResult = claimReminderFiredStmt.run(firedAt, reminder.reminder_id);
            if (claimResult.changes === 0) {
              return;
            }
            claimed = true;

            const recipientUserIds = new Set(
              assignmentsByRecordStmt
                .all(reminder.record_id)
                .map((row) => asText(row.user_id))
                .filter(Boolean),
            );
            for (const participant of participantsByRecordStmt.all(reminder.record_id)) {
              const participantUserId = asText(participant.user_id);
              if (participantUserId) {
                recipientUserIds.add(participantUserId);
              }
            }
            if (recipientUserIds.size === 0) {
              const record = recordByIdStmt.get(reminder.record_id);
              const createdByUserId = asText(record?.created_by);
              if (createdByUserId) {
                recipientUserIds.add(createdByUserId);
              }
            }

            const recordTitle = asText(reminder.record_title) || 'Untitled record';
            for (const userId of recipientUserIds) {
              const notificationId = newId('ntf');
              const createdAt = nowIso();
              const payload = buildNotificationPayload({
                message: `Reminder: ${recordTitle}`,
              });
              const payloadJson = toJson(payload);
              insertNotificationStmt.run(
                notificationId,
                reminder.project_id,
                userId,
                'reminder',
                'record',
                reminder.record_id,
                payloadJson,
                'network',
                createdAt,
              );
              createdNotifications.push({
                userId,
                notification: notificationRecord({
                  notification_id: notificationId,
                  project_id: reminder.project_id,
                  user_id: userId,
                  reason: 'reminder',
                  entity_type: 'record',
                  entity_id: reminder.record_id,
                  payload_json: payloadJson,
                  notification_scope: 'network',
                  read_at: null,
                  created_at: createdAt,
                }),
              });
            }
          });

          if (!claimed) {
            continue;
          }

          for (const entry of createdNotifications) {
            broadcastHubLiveToUser(entry.userId, {
              type: 'notification.new',
              notification: entry.notification,
            });
          }

          systemLog.info('Reminder fired.', {
            reminderId: reminder.reminder_id,
            recordId: reminder.record_id,
          });
        } catch (error) {
          systemLog.error('Failed to fire reminder.', {
            reminderId: reminder.reminder_id,
            recordId: reminder.record_id,
            error,
          });
        }
      }
    } catch (error) {
      systemLog.error('Reminder check loop tick failed.', { error });
    }
  };

  const startReminderScheduler = () => {
    if (timer) {
      return timer;
    }
    timer = setInterval(fireDueReminders, REMINDER_CHECK_INTERVAL_MS);
    systemLog.info('Reminder check loop started.', { intervalMs: REMINDER_CHECK_INTERVAL_MS });
    return timer;
  };

  const stopReminderScheduler = () => {
    if (!timer) {
      return;
    }
    clearInterval(timer);
    timer = null;
  };

  return {
    fireDueReminders,
    startReminderScheduler,
    stopReminderScheduler,
  };
};
