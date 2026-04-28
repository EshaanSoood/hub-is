import {
  canUserAccessProject,
  canUserManageProjectVisibility,
  canUserEditProject,
  canUserManageSpaceMembers,
} from '../lib/permissions.mjs';

export const createPermissionHelpers = ({
  db,
  asText,
  projectMembershipRoleStmt,
  workProjectByIdStmt,
  workProjectEditorExistsStmt,
  workProjectForDocStmt,
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
  const workProjectPolicyCapabilitySet = new Set(['view', 'comment', 'write', 'manage']);
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

  const normalizeProjectRole = (role) => {
    const normalized = asText(role);
    return ['owner', 'admin', 'member', 'viewer', 'guest'].includes(normalized) ? normalized : 'member';
  };

  const membershipRoleLabel = (role) => normalizeProjectRole(role);

  const withProjectPolicyGate = ({ userId, projectId, requiredCapability }) => {
    if (!projectPolicyCapabilitySet.has(requiredCapability)) {
      throw new Error(`Unknown space capability: ${requiredCapability}`);
    }

    const membership = projectMembershipRoleStmt.get(projectId, userId);
    if (!membership) {
      return { error: { status: 403, code: 'forbidden', message: 'Space membership required.' } };
    }

    const role = normalizeProjectRole(membership.role);
    const canManageMembers = canUserManageSpaceMembers(db, userId, projectId);
    const canWriteSpace = canUserManageProjectVisibility(db, userId, projectId);
    const capabilities = new Set(['view', 'comment']);
    if (canWriteSpace) {
      capabilities.add('write');
    }
    if (canManageMembers) {
      capabilities.add('manage_members');
    }
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
      is_owner: canWriteSpace,
    };
  };

  const withWorkProjectPolicyGate = ({ userId, projectId, requiredCapability }) => {
    if (!workProjectPolicyCapabilitySet.has(requiredCapability)) {
      throw new Error(`Unknown project capability: ${requiredCapability}`);
    }

    const project = workProjectByIdStmt.get(projectId);
    if (!project) {
      return { error: { status: 404, code: 'not_found', message: 'Project not found.' } };
    }

    if (!canUserAccessProject(db, userId, projectId)) {
      return { error: { status: 403, code: 'forbidden', message: 'Project access required.' } };
    }

    const membership = projectMembershipRoleStmt.get(project.space_id, userId);
    const spaceRole = asText(membership?.role);
    const projectGate = withProjectPolicyGate({ userId, projectId: project.space_id, requiredCapability: 'view' });
    const isExplicitEditor = Boolean(workProjectEditorExistsStmt.get(projectId, userId)?.ok);
    const canWrite = canUserEditProject(db, userId, projectId);
    const canManage = projectGate.is_owner || (spaceRole === 'member' && isExplicitEditor);
    const capabilities = new Set(['view', 'comment']);
    if (canWrite) {
      capabilities.add('write');
    }
    if (canManage) {
      capabilities.add('manage');
    }
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
      project_id: projectId,
      space_id: project.space_id,
      project,
      is_owner: projectGate.is_owner,
      is_explicit_editor: isExplicitEditor,
      can_edit: canWrite,
    };
  };

  const withDocPolicyGate = ({ userId, docId, requiredCapability }) => {
    if (!docPolicyCapabilitySet.has(requiredCapability)) {
      throw new Error(`Unknown doc capability: ${requiredCapability}`);
    }

    const doc = workProjectForDocStmt.get(docId);
    if (!doc) {
      return { error: { status: 404, code: 'not_found', message: 'Doc not found.' } };
    }

    const projectGate = withWorkProjectPolicyGate({
      userId,
      projectId: doc.project_id,
      requiredCapability: requiredCapability === 'write' ? 'write' : 'view',
    });
    if (projectGate.error) {
      return projectGate;
    }
    if (requiredCapability === 'comment') {
      const commentGate = withWorkProjectPolicyGate({ userId, projectId: doc.project_id, requiredCapability: 'comment' });
      if (commentGate.error) {
        return commentGate;
      }
    }

    return {
      doc_id: doc.doc_id,
      project_id: doc.project_id,
      space_id: doc.space_id,
      can_edit: projectGate.can_edit,
    };
  };

  const ensureProjectMembership = (userId, projectId) =>
    withProjectPolicyGate({ userId, projectId, requiredCapability: 'view' }).error || null;

  const requireProjectMember = (projectId, userId) => withProjectPolicyGate({
    userId,
    projectId,
    requiredCapability: 'view',
  });

  const requireWorkProjectMember = (projectId, userId) => withWorkProjectPolicyGate({
    userId,
    projectId,
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
    workProjectPolicyCapabilitySet,
    docPolicyCapabilitySet,
    ownerProjectCapabilities,
    collaboratorProjectCapabilities,
    globalCapabilitiesBySessionRole,
    authenticatedGlobalCapabilities,
    sessionRolePriority,
    normalizeProjectRole,
    membershipRoleLabel,
    withProjectPolicyGate,
    withWorkProjectPolicyGate,
    withDocPolicyGate,
    ensureProjectMembership,
    requireProjectMember,
    requireWorkProjectMember,
    requireDocAccess,
  };
};
