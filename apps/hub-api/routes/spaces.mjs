import { projectCreatedTimelineMessage } from '../helpers/timelineStart.mjs';

export const createSpaceRoutes = (deps) => {
  const projectIdPattern = /^[A-Za-z0-9_-]+$/;
  const projectNameMaxLength = 120;
  const {
    withAuth,
    withTransaction,
    withPolicyGate,
    withProjectPolicyGate,
    canUserAccessSpaceOverview,
    canUserManageSpaceMembers,
    canUserDeleteSpace,
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
    ensureUserForEmail,
    projectMembershipExistsStmt,
    projectMembershipRoleStmt,
    previousProjectMembershipStmt,
    projectOwnerCountStmt,
    projectForMemberStmt,
    listProjectsForUserStmt,
    countOtherPersonalSpacesForOwnerStmt,
    projectByIdStmt,
    workProjectByIdStmt,
    projectMembersByProjectStmt,
    listSpaceMemberProjectAccessStmt,
    pendingInvitesByProjectStmt,
    activePendingInviteByProjectAndEmailStmt,
    userByEmailStmt,
    pendingInviteByIdStmt,
    insertPendingInviteStmt,
    insertPendingInviteProjectStmt,
    deletePendingInviteStmt,
    deletePendingInviteProjectsStmt,
    pendingInviteProjectIdsStmt,
    updatePendingInviteDecisionStmt,
    ensureKeycloakInviteOnboarding,
    cleanupKeycloakInviteOnboarding,
    sendHubInviteEmail,
    insertProjectStmt,
    insertProjectMemberStmt,
    insertProjectMemberWithInviteStmt,
    deleteProjectMemberStmt,
    removeGuestProjectMemberStmt,
    deleteSpaceMemberProjectAccessStmt,
    insertProjectAccessStmt,
    updateProjectMemberRoleStmt,
    insertProjectDefaultCollectionStmt,
    insertWorkProjectStmt,
    insertDocStmt,
    insertDocStorageStmt,
    insertAssetRootStmt,
    deleteProjectMembersByUserInProjectStmt,
    assignedTaskListForUser,
    reassignTasksForRemovedMember,
    scheduleSpaceDeletionStmt,
    updateProjectNameStmt,
    updateProjectPositionStmt,
  } = deps;
  const spaceDeletionCountdownMs = 3 * 24 * 60 * 60 * 1000;

  const isPersonalProject = (projectId) => {
    const project = projectByIdStmt.get(projectId);
    return Boolean(project) && (Number(project.is_personal || 0) === 1 || String(project.project_type || '').toLowerCase() === 'personal');
  };

  const addDaysIso = (baseIso, days) => new Date(Date.parse(baseIso) + days * 24 * 60 * 60 * 1000).toISOString();

  const parsePositiveInteger = (value, fallback) => {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
  };

  const expiryInfoForMember = (member, nowMs = Date.now()) => {
    if (member.role !== 'guest' || !member.expires_at) {
      return {
        expiry_days_remaining: null,
        expiry_reminder_window: null,
      };
    }
    const expiresMs = Date.parse(member.expires_at);
    if (!Number.isFinite(expiresMs)) {
      return {
        expiry_days_remaining: null,
        expiry_reminder_window: null,
      };
    }
    const daysRemaining = Math.max(0, Math.ceil((expiresMs - nowMs) / (24 * 60 * 60 * 1000)));
    const reminderWindow = daysRemaining <= 1 ? 1 : daysRemaining <= 3 ? 3 : daysRemaining <= 7 ? 7 : null;
    return {
      expiry_days_remaining: reminderWindow ? daysRemaining : null,
      expiry_reminder_window: reminderWindow,
    };
  };

  const validateInviteProjectIds = ({ rawProjectIds, spaceId, required }) => {
    if (!Array.isArray(rawProjectIds)) {
      return required
        ? { error: { status: 400, code: 'invalid_input', message: 'project_ids must be an array of project IDs.' } }
        : { projectIds: [] };
    }
    const projectIds = [...new Set(rawProjectIds.map((projectId) => asText(projectId)).filter(Boolean))];
    if (required && projectIds.length === 0) {
      return { error: { status: 400, code: 'invalid_input', message: 'project_ids must include at least one project ID.' } };
    }
    for (const workProjectId of projectIds) {
      const workProject = workProjectByIdStmt.get(workProjectId);
      if (!workProject || workProject.space_id !== spaceId) {
        return { error: { status: 400, code: 'invalid_input', message: 'All project_ids must belong to the target space.' } };
      }
    }
    return { projectIds };
  };

  const memberProjectAccess = (spaceId, userId) =>
    listSpaceMemberProjectAccessStmt.all(spaceId, userId).map((projectAccess) => ({
      project_id: projectAccess.project_id,
      project_name: projectAccess.project_name,
      access_level: projectAccess.access_level,
    }));

  const spaceMemberRecord = (member, nowMs = Date.now()) => ({
    space_id: member.space_id,
    user_id: member.user_id,
    role: membershipRoleLabel(member.role),
    joined_at: member.joined_at,
    expires_at: member.expires_at || null,
    display_name: member.display_name,
    email: member.email,
    project_access: memberProjectAccess(member.space_id, member.user_id),
    ...expiryInfoForMember(member, nowMs),
  });

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

  const deleteProject = async ({ request, response, params }) => {
    const auth = await withAuth(request);
    if (auth.error) {
      send(response, auth.error);
      return;
    }

    const spaceId = params.spaceId;
    const space = projectForMemberStmt.get(spaceId, auth.user.user_id);
    if (!space) {
      send(response, jsonResponse(404, errorEnvelope('not_found', 'Space not found.')));
      return;
    }

    if (!canUserDeleteSpace(auth.user.user_id, spaceId)) {
      send(response, jsonResponse(403, errorEnvelope('forbidden', 'Only space owners can delete spaces.')));
      return;
    }

    if (isPersonalProject(spaceId)) {
      const otherPersonalSpaces = Number(
        countOtherPersonalSpacesForOwnerStmt.get(auth.user.user_id, spaceId)?.personal_space_count || 0,
      );
      if (otherPersonalSpaces <= 0) {
        send(
          response,
          jsonResponse(
            409,
            errorEnvelope('last_personal_space', 'Cannot delete your last personal space. Keep or create another personal space first.'),
          ),
        );
        return;
      }
    }

    const now = nowIso();
    const pendingDeletionAt = new Date(Date.parse(now) + spaceDeletionCountdownMs).toISOString();
    scheduleSpaceDeletionStmt.run(pendingDeletionAt, now, spaceId);

    send(
      response,
      jsonResponse(
        200,
        okEnvelope({
          scheduled: true,
          pending_deletion_at: pendingDeletionAt,
        }),
      ),
    );
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
    if (!canUserAccessSpaceOverview(auth.user.user_id, projectId)) {
      send(response, jsonResponse(403, errorEnvelope('forbidden', 'Space overview access required.')));
      return;
    }

    const nowMs = Date.now();
    const members = projectMembersByProjectStmt.all(projectId).map((member) => spaceMemberRecord(member, nowMs));

    const pending_invites = canUserManageSpaceMembers(auth.user.user_id, projectId)
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
    if (!canUserManageSpaceMembers(auth.user.user_id, projectId)) {
      send(response, jsonResponse(403, errorEnvelope('forbidden', 'Only space owners and admins can add members directly. Use the invite flow instead.')));
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
    const requestedRole = asText(body.role).toLowerCase() || 'member';
    const allowedRoles = new Set(['admin', 'member', 'viewer', 'guest']);
    if (!allowedRoles.has(requestedRole)) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'role must be admin, member, viewer, or guest.')));
      return;
    }
    const inviterRole = asText(projectMembershipRoleStmt.get(projectId, auth.user.user_id)?.role);
    if (inviterRole === 'viewer' || inviterRole === 'guest' || !inviterRole) {
      send(response, jsonResponse(403, errorEnvelope('forbidden', 'Guests and viewers cannot invite space members.')));
      return;
    }
    if (inviterRole === 'admin' && requestedRole === 'admin') {
      send(response, jsonResponse(403, errorEnvelope('forbidden', 'Admins cannot invite other admins.')));
      return;
    }
    if (inviterRole === 'member' && requestedRole === 'admin') {
      send(response, jsonResponse(403, errorEnvelope('forbidden', 'Members cannot invite admins.')));
      return;
    }
    const autoApproved = inviterRole === 'owner' || (inviterRole === 'admin' && (requestedRole === 'guest' || requestedRole === 'viewer'));
    const expiresAfterDays = requestedRole === 'guest'
      ? 30
      : requestedRole === 'viewer'
        ? parsePositiveInteger(body.expires_after_days, 7)
        : null;
    const inviteProjectValidation = validateInviteProjectIds({
      rawProjectIds: body.project_ids,
      spaceId: projectId,
      required: requestedRole === 'guest' || requestedRole === 'viewer',
    });
    if (inviteProjectValidation.error) {
      send(
        response,
        jsonResponse(inviteProjectValidation.error.status, errorEnvelope(inviteProjectValidation.error.code, inviteProjectValidation.error.message)),
      );
      return;
    }
    const existingUser = userByEmailStmt.get(email);
    if (existingUser && projectMembershipExistsStmt.get(projectId, existingUser.user_id)?.ok) {
      send(response, jsonResponse(409, errorEnvelope('conflict', 'User is already a space member.')));
      return;
    }
    if (requestedRole === 'guest' && existingUser) {
      const previousMembership = previousProjectMembershipStmt.get(projectId, existingUser.user_id);
      const cooldownUntil = asText(previousMembership?.cooldown_until);
      if (cooldownUntil && Date.parse(cooldownUntil) > Date.now()) {
        send(
          response,
          jsonResponse(
            409,
            errorEnvelope(
              'guest_cooldown_active',
              `Guest cooldown is active until ${cooldownUntil}. Invite this user as a paid member instead, or purchase Guest+ for a time extension.`,
            ),
          ),
        );
        return;
      }
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
    withTransaction(() => {
      insertPendingInviteStmt.run(
        inviteRequestId,
        projectId,
        email,
        requestedRole,
        expiresAfterDays,
        auth.user.user_id,
        autoApproved ? 'approved' : 'pending',
        existingUser?.user_id || null,
        timestamp,
        timestamp,
      );
      for (const workProjectId of inviteProjectValidation.projectIds) {
        insertPendingInviteProjectStmt.run(inviteRequestId, workProjectId);
      }
    });

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
    if (!invite || invite.space_id !== projectId || !['pending', 'approved'].includes(invite.status)) {
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
      if (projectMembershipExistsStmt.get(projectId, targetUserId)?.ok) {
        send(response, jsonResponse(409, errorEnvelope('conflict', 'User is already a space member.')));
        return;
      }
      const inviteProjectIds = pendingInviteProjectIdsStmt.all(inviteRequestId).map((project) => project.project_id);
      if ((invite.role === 'viewer' || invite.role === 'guest') && inviteProjectIds.length === 0) {
        deletePendingInviteStmt.run(inviteRequestId);
        send(response, jsonResponse(410, errorEnvelope('invite_void', 'Invite no longer has any active project access.')));
        return;
      }
      const expiresAt = invite.role === 'viewer' || invite.role === 'guest'
        ? addDaysIso(timestamp, Number(invite.expires_after_days || (invite.role === 'guest' ? 30 : 7)))
        : null;
      const approvedBy = invite.status === 'pending' ? auth.user.user_id : null;
      withTransaction(() => {
        insertProjectMemberWithInviteStmt.run(
          projectId,
          targetUserId,
          invite.role,
          timestamp,
          expiresAt,
          invite.requested_by_user_id,
          approvedBy,
          null,
        );
        for (const workProjectId of inviteProjectIds) {
          insertProjectAccessStmt.run(
            projectId,
            targetUserId,
            workProjectId,
            invite.role === 'viewer' ? 'read' : 'write',
            timestamp,
            invite.requested_by_user_id,
          );
        }
        deletePendingInviteProjectsStmt.run(inviteRequestId);
        deletePendingInviteStmt.run(inviteRequestId);
      });
      try {
        createNotification({
          projectId,
          userId: targetUserId,
          reason: 'automation',
          entityType: 'project',
          entityId: projectId,
          notificationScope: 'network',
          payload: buildNotificationPayload({
            message: 'Your space invite was accepted.',
            originKind: 'space',
            extras: {
              invite_request_id: inviteRequestId,
            },
          }),
        });
      } catch (error) {
        request.log.warn('Invite acceptance notification failed (best-effort).', { projectId, targetUserId, error });
      }
      send(response, jsonResponse(200, okEnvelope({ accepted: true, space_id: projectId, user_id: targetUserId, role: invite.role })));
      return;
    }

    updatePendingInviteDecisionStmt.run('rejected', targetUserId, auth.user.user_id, timestamp, timestamp, inviteRequestId);
    send(response, jsonResponse(200, okEnvelope({ pending_invite: pendingInviteRecord(pendingInviteByIdStmt.get(inviteRequestId)) })));
  };

  const addMemberProjectAccess = async ({ request, response, params }) => {
    const auth = await withAuth(request);
    if (auth.error) {
      send(response, auth.error);
      return;
    }

    const { projectId, targetUserId } = params;
    const projectGate = withProjectPolicyGate({
      userId: auth.user.user_id,
      projectId,
      requiredCapability: 'manage_members',
    });
    if (projectGate.error) {
      send(response, jsonResponse(projectGate.error.status, errorEnvelope(projectGate.error.code, projectGate.error.message)));
      return;
    }
    if (!canUserManageSpaceMembers(auth.user.user_id, projectId)) {
      send(response, jsonResponse(403, errorEnvelope('forbidden', 'Only space owners and admins can update member project access.')));
      return;
    }

    let body;
    try {
      body = await parseBody(request);
    } catch (error) {
      request.log.warn('Failed to parse request body for member project access add.', { error });
      send(response, parseBody.errorResponse(error));
      return;
    }

    const workProjectId = asText(body.project_id);
    if (!workProjectId) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'project_id is required.')));
      return;
    }
    const targetMembership = projectMembershipRoleStmt.get(projectId, targetUserId);
    const targetRole = asText(targetMembership?.role);
    if (targetRole !== 'viewer' && targetRole !== 'guest') {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'Project access can only be added for viewers and guests.')));
      return;
    }
    const workProject = workProjectByIdStmt.get(workProjectId);
    if (!workProject || workProject.space_id !== projectId) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'project_id must belong to the requested space.')));
      return;
    }

    insertProjectAccessStmt.run(
      projectId,
      targetUserId,
      workProjectId,
      targetRole === 'viewer' ? 'read' : 'write',
      nowIso(),
      auth.user.user_id,
    );
    const projectAccess = memberProjectAccess(projectId, targetUserId).find((access) => access.project_id === workProjectId) || {
      project_id: workProjectId,
      project_name: workProject.name,
      access_level: targetRole === 'viewer' ? 'read' : 'write',
    };
    send(response, jsonResponse(200, okEnvelope({ added: true, space_id: projectId, user_id: targetUserId, project_id: workProjectId, project_access: projectAccess })));
  };

  const updateProjectMember = async ({ request, response, params }) => {
    const auth = await withAuth(request);
    if (auth.error) {
      send(response, auth.error);
      return;
    }

    const { projectId, targetUserId } = params;
    const projectGate = withProjectPolicyGate({
      userId: auth.user.user_id,
      projectId,
      requiredCapability: 'manage_members',
    });
    if (projectGate.error) {
      send(response, jsonResponse(projectGate.error.status, errorEnvelope(projectGate.error.code, projectGate.error.message)));
      return;
    }
    if (!canUserManageSpaceMembers(auth.user.user_id, projectId)) {
      send(response, jsonResponse(403, errorEnvelope('forbidden', 'Only space owners and admins can update members.')));
      return;
    }

    let body;
    try {
      body = await parseBody(request);
    } catch (error) {
      request.log.warn('Failed to parse request body for project member update.', { error });
      send(response, parseBody.errorResponse(error));
      return;
    }

    const targetMembership = projectMembershipRoleStmt.get(projectId, targetUserId);
    if (!targetMembership) {
      send(response, jsonResponse(404, errorEnvelope('not_found', 'Space member not found.')));
      return;
    }

    const currentRole = membershipRoleLabel(targetMembership.role);
    if (currentRole === 'owner' || currentRole === 'admin') {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'Owner and admin roles are managed separately.')));
      return;
    }

    const requestedRole = asText(body.role).toLowerCase();
    const nextRole = requestedRole || currentRole;
    if (!['member', 'viewer', 'guest'].includes(nextRole)) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'role must be member, viewer, or guest.')));
      return;
    }

    const hasExpiresAt = Object.prototype.hasOwnProperty.call(body, 'expires_at');
    const requestedExpiresAt = body.expires_at === null ? null : asText(body.expires_at);
    if (
      hasExpiresAt &&
      requestedExpiresAt !== null &&
      (!requestedExpiresAt || !Number.isFinite(Date.parse(requestedExpiresAt)))
    ) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'expires_at must be an ISO 8601 timestamp or null.')));
      return;
    }
    const nextExpiresAt = nextRole === 'member'
      ? null
      : hasExpiresAt
        ? requestedExpiresAt
        : targetMembership.expires_at || null;

    withTransaction(() => {
      updateProjectMemberRoleStmt.run(nextRole, nextExpiresAt, projectId, targetUserId);
      if (nextRole === 'member') {
        deleteSpaceMemberProjectAccessStmt.run(projectId, targetUserId);
      }
    });

    const updatedMember = projectMembersByProjectStmt.all(projectId).find((member) => member.user_id === targetUserId);
    if (!updatedMember) {
      send(response, jsonResponse(404, errorEnvelope('not_found', 'Space member not found.')));
      return;
    }
    send(response, jsonResponse(200, okEnvelope({ member: spaceMemberRecord(updatedMember) })));
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

    if (!selfRemoval && !canUserManageSpaceMembers(auth.user.user_id, projectId)) {
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
      deleteSpaceMemberProjectAccessStmt.run(projectId, targetUserId);
      if (targetRole === 'guest') {
        const timestamp = nowIso();
        removeGuestProjectMemberStmt.run(timestamp, addDaysIso(timestamp, 90), projectId, targetUserId);
      } else {
        deleteProjectMemberStmt.run(projectId, targetUserId);
      }
      deleteProjectMembersByUserInProjectStmt.run(targetUserId, projectId);
    });

    send(response, jsonResponse(200, okEnvelope({ removed: true })));
  };

  return {
    addProjectMember,
    addMemberProjectAccess,
    createInvite,
    createProject,
    deleteProject,
    getProject,
    listProjectMembers,
    listProjects,
    removeProjectMember,
    reviewInvite,
    updateProjectMember,
    updateProject,
  };
};
