export const createPermissionHelpers = ({
  asText,
  projectMembershipRoleStmt,
  paneByIdStmt,
  paneEditorExistsStmt,
  paneForDocStmt,
}) => {
  const fieldTypeSet = new Set([
    'text',
    'number',
    'date',
    'checkbox',
    'select',
    'multi_select',
    'person',
    'relation',
    'file',
  ]);
  const viewTypeSet = new Set(['table', 'kanban', 'list', 'calendar', 'timeline', 'gallery']);
  const capabilitySet = new Set(['task', 'calendar_event', 'recurring', 'remindable', 'meeting', 'milestone', 'capture']);
  const commentStatusSet = new Set(['open', 'resolved']);
  const notificationReasons = Object.freeze([
    'mention', 'assignment', 'reminder', 'comment_reply', 'automation', 'update', 'comment', 'snapshot',
  ]);
  const notificationReasonSet = new Set(notificationReasons);
  const projectPolicyCapabilitySet = new Set(['view', 'comment', 'write', 'manage_members']);
  const panePolicyCapabilitySet = new Set(['view', 'comment', 'write', 'manage']);
  const docPolicyCapabilitySet = new Set(['view', 'comment', 'write']);
  const ownerProjectCapabilities = Object.freeze([
    'project.view',
    'project.activity.view',
    'project.notes.view',
    'project.files.view',
    'project.automations.view',
  ]);
  const collaboratorProjectCapabilities = Object.freeze([
    'project.view',
    'project.activity.view',
    'project.notes.view',
    'project.files.view',
  ]);
  const globalCapabilitiesBySessionRole = Object.freeze({
    Owner: Object.freeze(['hub.view', 'hub.tasks.write', 'hub.notifications.write', 'hub.live', 'projects.view', 'services.external.view']),
    Collaborator: Object.freeze(['hub.view', 'hub.tasks.write', 'hub.notifications.write', 'hub.live', 'projects.view']),
    Viewer: Object.freeze([]),
  });
  const authenticatedGlobalCapabilities = Object.freeze([
    'hub.chat.provision',
    'hub.chat.view',
    'hub.chat.write',
  ]);
  const sessionRolePriority = Object.freeze({
    Viewer: 0,
    Collaborator: 1,
    Owner: 2,
  });

  const normalizeProjectRole = (role) => (asText(role) === 'owner' || asText(role) === 'admin' ? 'owner' : 'member');

  const membershipRoleLabel = (role) => (normalizeProjectRole(role) === 'owner' ? 'owner' : 'member');

  const withProjectPolicyGate = ({ userId, projectId, requiredCapability }) => {
    if (!projectPolicyCapabilitySet.has(requiredCapability)) {
      throw new Error(`Unknown project capability: ${requiredCapability}`);
    }

    const membership = projectMembershipRoleStmt.get(projectId, userId);
    if (!membership) {
      return { error: { status: 403, code: 'forbidden', message: 'Space membership required.' } };
    }

    const role = normalizeProjectRole(membership.role);
    const capabilities = new Set(role === 'owner'
      ? ['view', 'comment', 'write', 'manage_members']
      : ['view', 'comment']);
    if (!capabilities.has(requiredCapability)) {
      return {
        error: {
          status: 403,
          code: 'forbidden',
          message: `Space capability "${requiredCapability}" required.`,
        },
      };
    }

    return {
      project_id: projectId,
      role,
      is_owner: role === 'owner',
    };
  };

  const withPanePolicyGate = ({ userId, paneId, requiredCapability }) => {
    if (!panePolicyCapabilitySet.has(requiredCapability)) {
      throw new Error(`Unknown pane capability: ${requiredCapability}`);
    }

    const pane = paneByIdStmt.get(paneId);
    if (!pane) {
      return { error: { status: 404, code: 'not_found', message: 'Project not found.' } };
    }

    const projectGate = withProjectPolicyGate({ userId, projectId: pane.project_id, requiredCapability: 'view' });
    if (projectGate.error) {
      return projectGate;
    }

    const isExplicitEditor = Boolean(paneEditorExistsStmt.get(paneId, userId)?.ok);
    const canWrite = projectGate.is_owner || isExplicitEditor;
    const capabilities = new Set(canWrite ? ['view', 'comment', 'write', 'manage'] : ['view', 'comment']);
    if (!capabilities.has(requiredCapability)) {
      return {
        error: {
          status: 403,
          code: 'forbidden',
          message: `Project capability "${requiredCapability}" required.`,
        },
      };
    }

    return {
      pane_id: paneId,
      project_id: pane.project_id,
      pane,
      is_owner: projectGate.is_owner,
      is_explicit_editor: isExplicitEditor,
      can_edit: canWrite,
    };
  };

  const withDocPolicyGate = ({ userId, docId, requiredCapability }) => {
    if (!docPolicyCapabilitySet.has(requiredCapability)) {
      throw new Error(`Unknown doc capability: ${requiredCapability}`);
    }

    const doc = paneForDocStmt.get(docId);
    if (!doc) {
      return { error: { status: 404, code: 'not_found', message: 'Doc not found.' } };
    }

    const paneGate = withPanePolicyGate({
      userId,
      paneId: doc.pane_id,
      requiredCapability: requiredCapability === 'write' ? 'write' : 'view',
    });
    if (paneGate.error) {
      return paneGate;
    }
    if (requiredCapability === 'comment') {
      const commentGate = withPanePolicyGate({ userId, paneId: doc.pane_id, requiredCapability: 'comment' });
      if (commentGate.error) {
        return commentGate;
      }
    }

    return {
      doc_id: doc.doc_id,
      pane_id: doc.pane_id,
      project_id: doc.project_id,
      can_edit: paneGate.can_edit,
    };
  };

  const ensureProjectMembership = (userId, projectId) =>
    withProjectPolicyGate({ userId, projectId, requiredCapability: 'view' }).error || null;

  const requireProjectMember = (projectId, userId) => withProjectPolicyGate({
    userId,
    projectId,
    requiredCapability: 'view',
  });

  const requirePaneMember = (paneId, userId) => withPanePolicyGate({
    userId,
    paneId,
    requiredCapability: 'view',
  });

  const requireDocAccess = (docId, userId) => withDocPolicyGate({
    userId,
    docId,
    requiredCapability: 'view',
  });

  return {
    fieldTypeSet,
    viewTypeSet,
    capabilitySet,
    commentStatusSet,
    notificationReasons,
    notificationReasonSet,
    projectPolicyCapabilitySet,
    panePolicyCapabilitySet,
    docPolicyCapabilitySet,
    ownerProjectCapabilities,
    collaboratorProjectCapabilities,
    globalCapabilitiesBySessionRole,
    authenticatedGlobalCapabilities,
    sessionRolePriority,
    normalizeProjectRole,
    membershipRoleLabel,
    withProjectPolicyGate,
    withPanePolicyGate,
    withDocPolicyGate,
    ensureProjectMembership,
    requireProjectMember,
    requirePaneMember,
    requireDocAccess,
  };
};
