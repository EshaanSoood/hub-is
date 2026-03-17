export const createNotificationRoutes = (deps) => {
  const {
    withPolicyGate,
    send,
    jsonResponse,
    okEnvelope,
    errorEnvelope,
    asBoolean,
    asInteger,
    asText,
    nowIso,
    notificationRecord,
    notificationsByUserStmt,
    unreadNotificationsByUserStmt,
    notificationByIdStmt,
    markNotificationReadStmt,
    issueHubLiveTicket,
  } = deps;

  const listNotifications = withPolicyGate('hub.view', async ({ response, requestUrl, auth }) => {
    const unreadOnly = asBoolean(requestUrl.searchParams.get('unread'), false);
    const limit = asInteger(requestUrl.searchParams.get('limit'), 100, 1, 250);
    const rows = unreadOnly
      ? unreadNotificationsByUserStmt.all(auth.user.user_id, limit)
      : notificationsByUserStmt.all(auth.user.user_id, limit);
    const notifications = rows.map(notificationRecord);

    send(response, jsonResponse(200, okEnvelope({ notifications })));
  });

  const markNotificationRead = withPolicyGate('hub.notifications.write', async ({ response, auth, params }) => {
    const notificationId = asText(params?.notificationId);
    const existing = notificationByIdStmt.get(notificationId);
    if (!existing || existing.user_id !== auth.user.user_id) {
      send(response, jsonResponse(404, errorEnvelope('not_found', 'Notification not found.')));
      return;
    }

    markNotificationReadStmt.run(nowIso(), notificationId, auth.user.user_id);
    const refreshed = notificationByIdStmt.get(notificationId);
    send(response, jsonResponse(200, okEnvelope({ notification: notificationRecord(refreshed) })));
  });

  const authorizeHubLive = withPolicyGate('hub.live', async ({ response, auth }) => {
    const ticket = issueHubLiveTicket({
      userId: auth.user.user_id,
    });

    send(
      response,
      jsonResponse(
        200,
        okEnvelope({
          authorization: {
            user_id: auth.user.user_id,
            ws_ticket: ticket.ws_ticket,
            ticket_issued_at: ticket.issued_at,
            ticket_expires_at: ticket.expires_at,
            ticket_expires_in_ms: ticket.expires_in_ms,
          },
        }),
      ),
    );
  });

  return {
    authorizeHubLive,
    listNotifications,
    markNotificationRead,
  };
};
