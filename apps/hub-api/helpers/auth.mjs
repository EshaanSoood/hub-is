export const createAuthHelpers = ({
  asText,
  systemLog,
  projectMembershipsByUserStmt,
  membershipRoleLabel,
  collaboratorProjectCapabilities,
  ownerProjectCapabilities,
  sessionRolePriority,
  authenticatedGlobalCapabilities,
  globalCapabilitiesBySessionRole,
}) => {
  const fromBase64Url = (value) => {
    const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    return Buffer.from(padded, 'base64').toString('utf8');
  };

  const parseBearerToken = (request) => {
    const header = asText(request.headers.authorization || '');
    if (!header) {
      return '';
    }
    const [scheme, token] = header.split(/\s+/);
    if (scheme !== 'Bearer' || !token) {
      return '';
    }
    return token;
  };

  const parseCursorOffset = (cursorRaw) => {
    const cursor = asText(cursorRaw);
    if (!cursor) {
      return 0;
    }
    try {
      const payload = JSON.parse(fromBase64Url(cursor));
      const offset = Number(payload?.offset);
      return Number.isInteger(offset) && offset >= 0 ? offset : 0;
    } catch (error) {
      systemLog.warn('Failed to decode pagination cursor; defaulting to offset 0.', { error });
      return 0;
    }
  };

  const encodeCursorOffset = (offset) =>
    Buffer.from(JSON.stringify({ offset }), 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');

  const buildSessionSummary = (user) => {
    const memberships = projectMembershipsByUserStmt.all(user.user_id);
    let sessionRole = 'Viewer';
    const projectMemberships = memberships.map((membership) => ({
      projectId: membership.space_id,
      membershipRole: membershipRoleLabel(membership.role),
    }));

    const projectCapabilities = {};
    for (const membership of memberships) {
      const membershipRole = membershipRoleLabel(membership.role);
      let capabilities = collaboratorProjectCapabilities;
      let derivedSessionRole = 'Collaborator';

      if (membershipRole === 'owner') {
        capabilities = ownerProjectCapabilities;
        derivedSessionRole = 'Owner';
      }

      projectCapabilities[membership.space_id] = [...capabilities];
      if (sessionRolePriority[derivedSessionRole] > sessionRolePriority[sessionRole]) {
        sessionRole = derivedSessionRole;
      }
    }

    const globalCapabilities = [...new Set([
      ...authenticatedGlobalCapabilities,
      ...(memberships.length > 0 ? globalCapabilitiesBySessionRole[sessionRole] : []),
    ])];

    return {
      userId: user.user_id,
      name: user.display_name,
      firstName: user.display_name,
      lastName: '',
      email: user.email || '',
      role: sessionRole,
      projectMemberships,
      globalCapabilities,
      projectCapabilities,
    };
  };

  return {
    parseBearerToken,
    parseCursorOffset,
    encodeCursorOffset,
    buildSessionSummary,
  };
};
