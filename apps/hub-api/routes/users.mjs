export const createUserRoutes = (deps) => {
  const {
    withPolicyGate,
    send,
    jsonResponse,
    okEnvelope,
    membershipRoleLabel,
    projectMembershipsByUserStmt,
  } = deps;

  const getSession = withPolicyGate('hub.view', async ({ response, auth, sessionSummary }) => {
    const memberships = projectMembershipsByUserStmt.all(auth.user.user_id).map((row) => ({
      project_id: row.project_id,
      role: membershipRoleLabel(row.role),
      joined_at: row.joined_at,
    }));

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
          sessionSummary,
          dev_auth_mode: Boolean(auth.devAuthMode),
        }),
      ),
    );
  });

  return {
    getSession,
  };
};
