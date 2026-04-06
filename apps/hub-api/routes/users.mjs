export const createUserRoutes = (deps) => {
  const {
    withPolicyGate,
    send,
    jsonResponse,
    okEnvelope,
    buildCalendarFeedUrl,
    getOrCreateCalendarFeedToken,
    membershipRoleLabel,
    projectMembershipsByUserStmt,
  } = deps;

  const getSession = withPolicyGate('hub.view', async ({ request, response, auth, sessionSummary }) => {
    const memberships = projectMembershipsByUserStmt.all(auth.user.user_id).map((row) => ({
      project_id: row.project_id,
      role: membershipRoleLabel(row.role),
      joined_at: row.joined_at,
    }));
    let calendarFeedUrl = '';
    try {
      const calendarFeedToken = getOrCreateCalendarFeedToken(auth.user.user_id);
      calendarFeedUrl = buildCalendarFeedUrl(calendarFeedToken.token);
    } catch (error) {
      request.log?.error?.('Failed to resolve calendar feed URL for session bootstrap.', {
        userId: auth.user.user_id,
        error,
      });
    }

    send(
      response,
      jsonResponse(
        200,
        okEnvelope({
          user: {
            user_id: auth.user.user_id,
            kc_sub: auth.user.kc_sub,
            display_name: auth.user.display_name,
            email: auth.user.email,
          },
          memberships,
          calendar_feed_url: calendarFeedUrl,
          sessionSummary,
        }),
      ),
    );
  });

  return {
    getSession,
  };
};
