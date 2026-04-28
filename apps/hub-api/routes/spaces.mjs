import { projectCreatedTimelineMessage } from '../helpers/timelineStart.mjs';

export const createSpaceRoutes = (deps) => {
  const projectIdPattern = /^[A-Za-z0-9_-]+$/;
  const projectNameMaxLength = 120;
  const {
    withAuth,
    withTransaction,
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
    emitTimelineEvent,
    buildNotificationPayload,
    createNotification,
    projectRecord,
    pendingInviteRecord,
    membershipRoleLabel,
    normalizeProjectRole,
    ensureUserForEmail,
    projectMembershipExistsStmt,
    projectMembershipRoleStmt,
    projectOwnerCountStmt,
    projectForMemberStmt,
    listProjectsForUserStmt,
    projectByIdStmt,
    projectMembersByProjectStmt,
    pendingInvitesByProjectStmt,
    activePendingInviteByProjectAndEmailStmt,
    userByEmailStmt,
    pendingInviteByIdStmt,
    insertPendingInviteStmt,
    deletePendingInviteStmt,
    updatePendingInviteDecisionStmt,
    ensureKeycloakInviteOnboarding,
    cleanupKeycloakInviteOnboarding,
    sendHubInviteEmail,
    insertProjectStmt,
    insertProjectMemberStmt,
    deleteProjectMemberStmt,
    insertProjectDefaultCollectionStmt,
    insertWorkProjectStmt,
    insertDocStmt,
    insertDocStorageStmt,
    insertAssetRootStmt,
    deleteProjectMembersByUserInProjectStmt,
    assignedTaskListForUser,
    reassignTasksForRemovedMember,
    updateProjectNameStmt,
    updateProjectPositionStmt,
  } = deps;

  const isPersonalProject = (projectId) => {
    const project = projectByIdStmt.get(projectId);
    return Boolean(project) && (Number(project.is_personal || 0) === 1 || String(project.project_type || '').toLowerCase() === 'personal');
  };

  const listProjects = withPolicyGate('projects.view', async ({ response, auth }) => {
    const spaces = listProjectsForUserStmt.all(auth.user.user_id).map(projectRecord);
    send(response, jsonResponse(200, okEnvelope({ spaces })));
  });

  const createProject = withPolicyGate('projects.view', async ({ request, response, auth }) => {
    let body;
    try {
      body = await parseBody(request);
    } catch (error) {
      request.log.warn('Failed to parse request body for project creation.', { error });
      send(response, parseBody.errorResponse(error));
      return;
    }

    const name = asText(body.name);
    if (!name) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'Space name is required.')));
      return;
    }

    const now = nowIso();
    const providedProjectId = asText(body.space_id);
    if (providedProjectId && !projectIdPattern.test(providedProjectId)) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'space_id must contain only letters, numbers, underscores, and hyphens.')));
      return;
    }
    const projectId = providedProjectId || newId('prj');

    if (projectByIdStmt.get(projectId)) {
      send(response, jsonResponse(409, errorEnvelope('conflict', 'Space already exists.')));
      return;
    }

    withTransaction(() => {
      insertProjectStmt.run(projectId, name, auth.user.user_id, now, now);
      insertProjectMemberStmt.run(projectId, auth.user.user_id, 'owner', now);
      const defaultCollectionId = newId('col');
      const defaultCollectionNow = nowIso();
      insertProjectDefaultCollectionStmt.run(defaultCollectionId, projectId, 'Tasks', defaultCollectionNow, defaultCollectionNow);

      const workProjectId = newId('prj');
      const docId = newId('doc');
      insertWorkProjectStmt.run(
        workProjectId,
        projectId,
        'Main Work',
        1,
        1,
        0,
        toJson({ widgets: [], doc_binding_mode: 'owned' }),
        auth.user.user_id,
        now,
        now,
      );
      insertDocStmt.run(docId, workProjectId, 'Untitled', 0, now, now);
      insertDocStorageStmt.run(docId, 0, toJson({}), now);
      insertAssetRootStmt.run(
        newId('ast'),
        projectId,
        'nextcloud',
        `/HubOS/${projectId}`,
        toJson({ provider: 'nextcloud' }),
        now,
        now,
      );
    });

    emitTimelineEvent({
      projectId,
      actorUserId: auth.user.user_id,
      eventType: 'project.created',
      primaryEntityType: 'project',
      primaryEntityId: projectId,
      summary: { message: projectCreatedTimelineMessage({ name }) },
    });

    const project = projectForMemberStmt.get(projectId, auth.user.user_id);
    send(response, jsonResponse(201, okEnvelope({ space: projectRecord(project) })));
  });

  const getProject = async ({ request, response, params }) => {
    const auth = await withAuth(request);
    if (auth.error) {
      send(response, auth.error);
      return;
    }

    const project = projectForMemberStmt.get(params.projectId, auth.user.user_id);
    if (!project) {
      send(response, jsonResponse(404, errorEnvelope('not_found', 'Space not found.')));
      return;
    }

    send(response, jsonResponse(200, okEnvelope({ space: projectRecord(project) })));
  };

  const updateProject = async ({ request, response, params }) => {
    const auth = await withAuth(request);
    if (auth.error) {
      send(response, auth.error);
      return;
    }

    const projectId = params.projectId;
    const projectGate = withProjectPolicyGate({
      userId: auth.user.user_id,
      projectId,
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
      request.log.warn('Failed to parse request body for project update.', { error });
      send(response, parseBody.errorResponse(error));
      return;
    }

    const nextName = body.name === undefined ? undefined : asText(body.name);
    if (body.name !== undefined && !nextName) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'name must be a non-empty string.')));
      return;
    }
    if (typeof nextName === 'string' && nextName.length > projectNameMaxLength) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', `name must be ${projectNameMaxLength} characters or fewer.`)));
      return;
    }

    const position = body.position === null ? null : Number.isInteger(body.position) ? body.position : null;
    if (body.position !== undefined && body.position !== null && position === null) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'position must be an integer or null.')));
      return;
    }

    if (typeof position === 'number' && position < 0) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'position must be zero or greater.')));
      return;
    }

    const existingProject = projectForMemberStmt.get(projectId, auth.user.user_id);
    if (!existingProject) {
      send(response, jsonResponse(404, errorEnvelope('not_found', 'Space not found.')));
      return;
    }

    let project = existingProject;
    if (body.position !== undefined || nextName !== undefined) {
      const updatedAt = nowIso();
      withTransaction(() => {
        if (nextName !== undefined) {
          updateProjectNameStmt.run(nextName, updatedAt, projectId);
        }

        if (body.position !== undefined) {
          updateProjectPositionStmt.run(position, updatedAt, projectId);
        }

        project = projectForMemberStmt.get(projectId, auth.user.user_id) || existingProject;
      });
    }

    send(response, jsonResponse(200, okEnvelope({ space: projectRecord(project) })));
  };

  const listProjectMembers = async ({ request, response, params }) => {
    const auth = await withAuth(request);
    if (auth.error) {
      send(response, auth.error);
      return;
    }

    const projectId = params.projectId;
    const projectGate = withProjectPolicyGate({
      userId: auth.user.user_id,
      projectId,
      requiredCapability: 'view',
    });
    if (projectGate.error) {
      send(response, jsonResponse(projectGate.error.status, errorEnvelope(projectGate.error.code, projectGate.error.message)));
      return;
    }

    const members = projectMembersByProjectStmt.all(projectId).map((member) => ({
      space_id: member.space_id,
      user_id: member.user_id,
      role: membershipRoleLabel(member.role),
      joined_at: member.joined_at,
      display_name: member.display_name,
      email: member.email,
    }));

    const pending_invites = projectGate.is_owner
      ? pendingInvitesByProjectStmt.all(projectId).map(pendingInviteRecord)
      : [];

    send(response, jsonResponse(200, okEnvelope({ members, pending_invites })));
  };

  const addProjectMember = async ({ request, response, params }) => {
    const auth = await withAuth(request);
    if (auth.error) {
      send(response, auth.error);
      return;
    }

    const projectId = params.projectId;
    const projectGate = withProjectPolicyGate({
      userId: auth.user.user_id,
      projectId,
      requiredCapability: 'manage_members',
    });
    if (projectGate.error) {
      send(response, jsonResponse(projectGate.error.status, errorEnvelope(projectGate.error.code, projectGate.error.message)));
      return;
    }
    if (isPersonalProject(projectId)) {
      send(response, jsonResponse(403, errorEnvelope('forbidden', 'Cannot add collaborators to a personal space.')));
      return;
    }
    const callerRole = normalizeProjectRole(projectMembershipRoleStmt.get(projectId, auth.user.user_id)?.role);
    if (callerRole !== 'owner') {
      send(response, jsonResponse(403, errorEnvelope('forbidden', 'Only space owners can add members directly. Use the invite flow instead.')));
      return;
    }

    let body;
    try {
      body = await parseBody(request);
    } catch (error) {
      request.log.warn('Failed to parse request body for project member add.', { error });
      send(response, parseBody.errorResponse(error));
      return;
    }

    let targetUserId = asText(body.user_id);
    const role = asText(body.role) === 'owner' ? 'owner' : 'member';

    if (!targetUserId) {
      const email = asText(body.email).toLowerCase();
      const displayName = asText(body.display_name) || email || 'Space Member';
      if (!email) {
        send(response, jsonResponse(400, errorEnvelope('invalid_input', 'user_id or email is required.')));
        return;
      }

      targetUserId = ensureUserForEmail({ email, displayName })?.user_id || '';
    }

    if (!targetUserId) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'Unable to resolve target space member.')));
      return;
    }

    if (projectMembershipExistsStmt.get(projectId, targetUserId)?.ok) {
      send(response, jsonResponse(409, errorEnvelope('conflict', 'Space member already exists.')));
      return;
    }

    insertProjectMemberStmt.run(projectId, targetUserId, role, nowIso());
    if (targetUserId !== auth.user.user_id) {
      try {
        createNotification({
          projectId,
          userId: targetUserId,
          reason: 'assignment',
          entityType: 'project',
          entityId: projectId,
          notificationScope: 'network',
          payload: buildNotificationPayload({
            message: 'You were added to a space.',
            originKind: 'space',
          }),
        });
      } catch (error) {
        request.log.warn('Project member notification failed (best-effort).', {
          projectId,
          targetUserId,
          error,
        });
      }
    }

    send(
      response,
          jsonResponse(
            200,
            okEnvelope({
              space_id: projectId,
              user_id: targetUserId,
              role,
            }),
      ),
    );
  };

  const createInvite = async ({ request, response, params }) => {
    const auth = await withAuth(request);
    if (auth.error) {
      send(response, auth.error);
      return;
    }

    const projectId = params.projectId;
    const projectGate = withProjectPolicyGate({
      userId: auth.user.user_id,
      projectId,
      requiredCapability: 'view',
    });
    if (projectGate.error) {
      send(response, jsonResponse(projectGate.error.status, errorEnvelope(projectGate.error.code, projectGate.error.message)));
      return;
    }
    if (isPersonalProject(projectId)) {
      send(response, jsonResponse(403, errorEnvelope('forbidden', 'Cannot add collaborators to a personal space.')));
      return;
    }

    let body;
    try {
      body = await parseBody(request);
    } catch (error) {
      request.log.warn('Failed to parse request body for project invite creation.', { error });
      send(response, parseBody.errorResponse(error));
      return;
    }

    const email = asText(body.email).toLowerCase();
    if (!email) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'email is required.')));
      return;
    }
    const existingUser = userByEmailStmt.get(email);
    if (existingUser && projectMembershipExistsStmt.get(projectId, existingUser.user_id)?.ok) {
      send(response, jsonResponse(409, errorEnvelope('conflict', 'User is already a space member.')));
      return;
    }
    const existingInvite = activePendingInviteByProjectAndEmailStmt.get(projectId, email);
    if (existingInvite) {
      send(response, jsonResponse(409, errorEnvelope('conflict', 'A pending invite request already exists for this email.')));
      return;
    }

    let onboardingResult = null;
    if (!existingUser) {
      onboardingResult = await ensureKeycloakInviteOnboarding({
        email,
        requestLog: request.log,
      });
      if (onboardingResult.error) {
        send(
          response,
          jsonResponse(onboardingResult.error.status, errorEnvelope(onboardingResult.error.code, onboardingResult.error.message)),
        );
        return;
      }
    }

    const project = projectByIdStmt.get(projectId);
    const inviteRequestId = newId('pinv');
    const timestamp = nowIso();
    insertPendingInviteStmt.run(
      inviteRequestId,
      projectId,
      email,
      'member',
      auth.user.user_id,
      'pending',
      existingUser?.user_id || null,
      timestamp,
      timestamp,
    );

    const inviteEmail = await sendHubInviteEmail({
      to: email,
      projectName: project?.name || 'Pilot Party',
      requestLog: request.log,
    });
    if (inviteEmail.error) {
      request.log.error('Failed to send project invite email.', {
        projectId,
        inviteRequestId,
        email,
        error: inviteEmail.error,
      });
      try {
        deletePendingInviteStmt.run(inviteRequestId);
      } catch (cleanupError) {
        request.log.error('Failed to roll back pending invite after email failure.', {
          projectId,
          inviteRequestId,
          email,
          error: cleanupError,
        });
      }
      if (onboardingResult?.data?.created && onboardingResult.data.userId) {
        const cleanupResult = await cleanupKeycloakInviteOnboarding({
          userId: onboardingResult.data.userId,
          requestLog: request.log,
        });
        if (cleanupResult.error) {
          request.log.error('Failed to clean up Keycloak invite onboarding after email failure.', {
            projectId,
            inviteRequestId,
            email,
            userId: onboardingResult.data.userId,
            error: cleanupResult.error,
          });
        }
      }
      send(response, jsonResponse(inviteEmail.error.status, errorEnvelope(inviteEmail.error.code, inviteEmail.error.message)));
      return;
    }

    send(response, jsonResponse(201, okEnvelope({ pending_invite: pendingInviteRecord(pendingInviteByIdStmt.get(inviteRequestId)) })));
  };

  const reviewInvite = async ({ request, response, params }) => {
    const auth = await withAuth(request);
    if (auth.error) {
      send(response, auth.error);
      return;
    }

    const { projectId, inviteRequestId } = params;
    const projectGate = withProjectPolicyGate({
      userId: auth.user.user_id,
      projectId,
      requiredCapability: 'manage_members',
    });
    if (projectGate.error) {
      send(response, jsonResponse(projectGate.error.status, errorEnvelope(projectGate.error.code, projectGate.error.message)));
      return;
    }
    if (isPersonalProject(projectId)) {
      send(response, jsonResponse(403, errorEnvelope('forbidden', 'Cannot add collaborators to a personal space.')));
      return;
    }

    const invite = pendingInviteByIdStmt.get(inviteRequestId);
    if (!invite || invite.project_id !== projectId || invite.status !== 'pending') {
      send(response, jsonResponse(404, errorEnvelope('not_found', 'Pending invite not found.')));
      return;
    }

    let body;
    try {
      body = await parseBody(request);
    } catch (error) {
      request.log.warn('Failed to parse request body for invite review.', { error });
      send(response, parseBody.errorResponse(error));
      return;
    }

    const decision = asText(body.decision).toLowerCase();
    if (decision !== 'approve' && decision !== 'reject') {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'decision must be approve or reject.')));
      return;
    }

    const timestamp = nowIso();
    let targetUserId = invite.target_user_id || null;
    if (decision === 'approve') {
      const resolvedUser = ensureUserForEmail({
        email: invite.email,
        displayName: invite.email.split('@')[0] || 'Space Member',
      });
      targetUserId = resolvedUser?.user_id || null;
      if (!targetUserId) {
        send(response, jsonResponse(400, errorEnvelope('invalid_input', 'Unable to resolve invited user.')));
        return;
      }
      if (!projectMembershipExistsStmt.get(projectId, targetUserId)?.ok) {
        insertProjectMemberStmt.run(projectId, targetUserId, 'member', timestamp);
      }
      createNotification({
        projectId,
        userId: targetUserId,
        reason: 'automation',
        entityType: 'project',
        entityId: projectId,
        notificationScope: 'network',
        payload: buildNotificationPayload({
          message: 'Your space invite was approved.',
          originKind: 'space',
          extras: {
            invite_request_id: inviteRequestId,
          },
        }),
      });
    }

    updatePendingInviteDecisionStmt.run(
      decision === 'approve' ? 'approved' : 'rejected',
      targetUserId,
      auth.user.user_id,
      timestamp,
      timestamp,
      inviteRequestId,
    );

    send(response, jsonResponse(200, okEnvelope({ pending_invite: pendingInviteRecord(pendingInviteByIdStmt.get(inviteRequestId)) })));
  };

  const removeProjectMember = async ({ request, response, params }) => {
    const auth = await withAuth(request);
    if (auth.error) {
      send(response, auth.error);
      return;
    }

    const { projectId, targetUserId } = params;
    const selfRemoval = auth.user.user_id === targetUserId;
    const requiredCapability = selfRemoval ? 'view' : 'manage_members';
    const projectGate = withProjectPolicyGate({
      userId: auth.user.user_id,
      projectId,
      requiredCapability,
    });
    if (projectGate.error) {
      send(response, jsonResponse(projectGate.error.status, errorEnvelope(projectGate.error.code, projectGate.error.message)));
      return;
    }
    if (isPersonalProject(projectId)) {
      send(response, jsonResponse(403, errorEnvelope('forbidden', 'Cannot manage collaborators on a personal space.')));
      return;
    }

    const targetMembership = projectMembershipRoleStmt.get(projectId, targetUserId);
    if (!targetMembership) {
      send(response, jsonResponse(404, errorEnvelope('not_found', 'Space member not found.')));
      return;
    }

    const targetRole = membershipRoleLabel(targetMembership.role);
    if (targetRole === 'owner') {
      const ownerCount = Number(projectOwnerCountStmt.get(projectId)?.owner_count || 0);
      if (ownerCount <= 1) {
        send(
          response,
          jsonResponse(
            409,
            errorEnvelope('last_owner', 'The last owner cannot leave the space. Assign ownership to another member first.'),
          ),
        );
        return;
      }
    }

    if (selfRemoval) {
      const assignedTasks = assignedTaskListForUser({ projectId, userId: targetUserId });
      if (assignedTasks.length > 0) {
        const taskSummary = assignedTasks.map((task) => `${task.title} (${task.record_id})`).join(', ');
        send(
          response,
          jsonResponse(
            409,
            errorEnvelope(
              'assigned_tasks_remaining',
              `Reassign ${assignedTasks.length} remaining task(s) before leaving: ${taskSummary}.`,
            ),
          ),
        );
        return;
      }
    }

    if (!selfRemoval && !projectGate.is_owner) {
      send(response, jsonResponse(403, errorEnvelope('forbidden', 'Only space owners can remove members.')));
      return;
    }

    if (!selfRemoval) {
      reassignTasksForRemovedMember({
        projectId,
        removedUserId: targetUserId,
        nextOwnerUserId: auth.user.user_id,
      });
    }

    withTransaction(() => {
      deleteProjectMemberStmt.run(projectId, targetUserId);
      deleteProjectMembersByUserInProjectStmt.run(targetUserId, projectId);
    });

    send(response, jsonResponse(200, okEnvelope({ removed: true })));
  };

  return {
    addProjectMember,
    createInvite,
    createProject,
    getProject,
    listProjectMembers,
    listProjects,
    removeProjectMember,
    reviewInvite,
    updateProject,
  };
};
