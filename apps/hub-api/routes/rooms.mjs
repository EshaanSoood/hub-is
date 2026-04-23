import { buildRoomDocumentId } from '../lib/roomDocuments.mjs';

class ValidationError extends Error {}

const roomRecord = (room, memberUserIds) => ({
  id: room.room_id,
  displayName: room.display_name,
  spaceId: room.space_id,
  coordinationPaneId: room.coordination_pane_id || null,
  status: room.status,
  createdAt: room.created_at,
  archivedAt: room.archived_at || null,
  memberUserIds,
});

const roomMembershipRecord = (row) => ({
  roomId: row.room_id,
  userId: row.user_id,
  role: row.role,
  joinedAt: row.joined_at,
});

export const createRoomRoutes = (deps) => {
  const {
    withAuth,
    withTransaction,
    send,
    jsonResponse,
    okEnvelope,
    errorEnvelope,
    parseBody,
    asText,
    parseJsonObject,
    nowIso,
    newId,
    toJson,
    emitTimelineEvent,
    collectionByIdStmt,
    docByIdStmt,
    paneByIdStmt,
    paneDocByPaneStmt,
    paneListForUserByProjectStmt,
    paneNextSortStmt,
    projectMembershipExistsStmt,
    projectMembershipRoleStmt,
    projectMembersByProjectStmt,
    roomByIdStmt,
    roomForUserStmt,
    roomMemberUserIdsByRoomStmt,
    roomMembershipExistsStmt,
    roomMembershipRoleStmt,
    roomMembersByRoomStmt,
    roomsByUserStmt,
    insertDocStmt,
    insertDocStorageStmt,
    insertPaneMemberStmt,
    insertPaneStmt,
    insertRoomStmt,
    insertRoomMemberStmt,
    insertRoomDocStmt,
    insertRoomDocStorageStmt,
    insertRecordStmt,
    insertRecordCapabilityStmt,
    insertReminderStmt,
    insertAssignmentStmt,
    upsertRecordValueStmt,
    upsertTaskStateStmt,
    upsertRecurrenceStmt,
    visibleProjectTasksStmt,
    valuesByRecordStmt,
    recordByIdStmt,
    recordCapabilitiesByRecordStmt,
    subtasksByParentStmt,
    taskStateByRecordStmt,
    recurrenceByRecordStmt,
    remindersByRecordStmt,
    assignmentsByRecordStmt,
    archiveRoomStmt,
    updateRoomCoordinationPaneStmt,
  } = deps;

  const normalizeRoomParticipantIdentifier = (value) => {
    const text = asText(value);
    return text.includes('@') ? text.toLowerCase() : text;
  };

  const projectMembershipRole = (spaceId, userId) => {
    const role = asText(projectMembershipRoleStmt.get(spaceId, userId)?.role).toLowerCase();
    return role === 'admin' ? 'owner' : role;
  };

  const hasOwnerSpaceMembership = (spaceId, userId) =>
    projectMembershipRole(spaceId, userId) === 'owner';

  const hasSpaceMembership = (spaceId, userId) =>
    Boolean(projectMembershipExistsStmt.get(spaceId, userId)?.ok);

  const shouldGrantPaneEditor = (spaceId, userId) =>
    projectMembershipRole(spaceId, userId) !== 'owner';

  const roomLayout = (pane) => parseJsonObject(pane?.layout_config, {});

  const isRoomProjectPane = (pane, roomId) => {
    const layoutConfig = roomLayout(pane);
    return asText(layoutConfig.room_id) === roomId && layoutConfig.fixed_room_project === true;
  };

  const isRoomPane = (pane, roomId) => asText(roomLayout(pane).room_id) === roomId;

  const createCoordinationPane = ({
    roomId,
    spaceId,
    displayName,
    createdBy,
    createdAt,
    sortOrder,
  }) => {
    const paneId = newId('pan');
    const docId = newId('doc');
    insertPaneStmt.run(
      paneId,
      spaceId,
      `${displayName} Coordination`,
      sortOrder,
      sortOrder,
      0,
      toJson({
        doc_binding_mode: 'owned',
        modules_enabled: false,
        room_coordination: true,
        room_hidden: true,
        room_id: roomId,
        workspace_enabled: false,
      }),
      createdBy,
      createdAt,
      createdAt,
    );
    insertDocStmt.run(docId, paneId, createdAt, createdAt);
    insertDocStorageStmt.run(docId, 0, toJson({}), createdAt);
    return paneId;
  };

  const grantRoomPaneEditors = ({ spaceId, paneId, userIds, joinedAt }) => {
    for (const userId of userIds) {
      if (shouldGrantPaneEditor(spaceId, userId)) {
        insertPaneMemberStmt.run(paneId, userId, joinedAt);
      }
    }
  };

  const roomPaneIdsForSpace = ({ roomId, spaceId, coordinationPaneId }) => {
    const paneIds = paneListForUserByProjectStmt
      .all(spaceId)
      .filter((pane) => isRoomPane(pane, roomId))
      .map((pane) => pane.pane_id);
    if (coordinationPaneId && !paneIds.includes(coordinationPaneId)) {
      paneIds.unshift(coordinationPaneId);
    }
    return paneIds;
  };

  const ensureRoomCoordinationPane = (room) => {
    const existingPaneId = asText(room?.coordination_pane_id);
    if (existingPaneId && paneByIdStmt.get(existingPaneId)) {
      return existingPaneId;
    }

    const createdAt = nowIso();
    const sortOrder = Number(paneNextSortStmt.get(room.space_id)?.max_sort || 0) + 1;
    const paneId = createCoordinationPane({
      roomId: room.room_id,
      spaceId: room.space_id,
      displayName: room.display_name,
      createdBy: room.created_by,
      createdAt,
      sortOrder,
    });
    updateRoomCoordinationPaneStmt.run(paneId, room.room_id);
    grantRoomPaneEditors({
      spaceId: room.space_id,
      paneId,
      userIds: roomMemberUserIdsByRoomStmt.all(room.room_id).map((member) => member.user_id),
      joinedAt: createdAt,
    });
    return paneId;
  };

  const resolveParticipantUserId = ({ identifier, spaceMembers }) => {
    const normalizedIdentifier = normalizeRoomParticipantIdentifier(identifier);
    if (!normalizedIdentifier) {
      return '';
    }
    const byUserId = spaceMembers.find((member) => member.user_id === normalizedIdentifier);
    if (byUserId) {
      return byUserId.user_id;
    }
    const byEmail = spaceMembers.find((member) => asText(member.email).toLowerCase() === normalizedIdentifier);
    return byEmail?.user_id || '';
  };

  const loadRoomRecord = (roomId) => {
    let room = roomByIdStmt.get(roomId);
    if (!room) {
      return null;
    }
    if (!asText(room.coordination_pane_id) || !paneByIdStmt.get(room.coordination_pane_id)) {
      withTransaction(() => {
        ensureRoomCoordinationPane(room);
      });
      room = roomByIdStmt.get(roomId);
    }
    const memberUserIds = roomMemberUserIdsByRoomStmt.all(roomId).map((member) => member.user_id);
    return roomRecord(room, memberUserIds);
  };

  const normalizePaneLayoutConfig = (pane, roomId) => {
    const layoutConfig = {
      ...roomLayout(pane),
      doc_binding_mode: 'owned',
    };
    delete layoutConfig.fixed_room_project;
    delete layoutConfig.room_coordination;
    delete layoutConfig.room_hidden;
    delete layoutConfig.room_id;
    delete layoutConfig.room_slot;
    if (asText(layoutConfig.room_origin_room_id) !== roomId) {
      delete layoutConfig.room_origin_room_id;
    }
    return layoutConfig;
  };

  const listRooms = async ({ request, response }) => {
    const auth = await withAuth(request);
    if (auth.error) {
      send(response, auth.error);
      return;
    }

    const rooms = roomsByUserStmt
      .all(auth.user.user_id)
      .map((room) => loadRoomRecord(room.room_id))
      .filter(Boolean);

    send(response, jsonResponse(200, okEnvelope({ rooms })));
  };

  const getRoom = async ({ request, response, params }) => {
    const auth = await withAuth(request);
    if (auth.error) {
      send(response, auth.error);
      return;
    }

    let room = roomForUserStmt.get(params.roomId, auth.user.user_id);
    if (!room) {
      send(response, jsonResponse(404, errorEnvelope('not_found', 'Room not found.')));
      return;
    }

    send(response, jsonResponse(200, okEnvelope({ room: loadRoomRecord(room.room_id) })));
  };

  const createRoom = async ({ request, response }) => {
    const auth = await withAuth(request);
    if (auth.error) {
      send(response, auth.error);
      return;
    }

    let body;
    try {
      body = await parseBody(request);
    } catch (error) {
      request.log.warn('Failed to parse request body for room creation.', { error });
      send(response, parseBody.errorResponse(error));
      return;
    }

    const displayName = asText(body.displayName);
    const spaceId = asText(body.spaceId);
    const requestedProjectNames = Array.isArray(body.projectNames)
      ? body.projectNames.map((value) => asText(value)).filter(Boolean)
      : [];
    if (!displayName || !spaceId || requestedProjectNames.length !== 2) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'displayName, spaceId, and exactly two projectNames are required.')));
      return;
    }

    if (!hasOwnerSpaceMembership(spaceId, auth.user.user_id)) {
      send(response, jsonResponse(403, errorEnvelope('forbidden', 'Only space owners can create rooms.')));
      return;
    }

    const spaceMembers = projectMembersByProjectStmt.all(spaceId);
    const requestedParticipantIdentifiers = Array.isArray(body.participantIdentifiers)
      ? body.participantIdentifiers.map((value) => normalizeRoomParticipantIdentifier(value)).filter(Boolean)
      : [];
    const participantUserIds = requestedParticipantIdentifiers
      .map((identifier) => resolveParticipantUserId({ identifier, spaceMembers }))
      .filter(Boolean);
    const invalidIdentifiers = requestedParticipantIdentifiers.filter(
      (identifier) => !resolveParticipantUserId({ identifier, spaceMembers }),
    );
    if (invalidIdentifiers.length > 0) {
      send(response, jsonResponse(400, errorEnvelope('invalid_members', `Participants must already belong to the selected space: ${invalidIdentifiers.join(', ')}`)));
      return;
    }

    const memberUserIds = [...new Set([auth.user.user_id, ...participantUserIds])];
    if (memberUserIds.length < 2) {
      send(response, jsonResponse(400, errorEnvelope('invalid_members', 'Invite at least one participant from the selected space.')));
      return;
    }

    for (const userId of memberUserIds) {
      if (!hasSpaceMembership(spaceId, userId)) {
        send(response, jsonResponse(400, errorEnvelope('invalid_members', `User ${userId} is not a space member.`)));
        return;
      }
    }

    const roomId = newId('room');
    const docId = buildRoomDocumentId(roomId);
    const now = nowIso();
    const baseSortOrder = Number(paneNextSortStmt.get(spaceId)?.max_sort || 0);

    withTransaction(() => {
      const coordinationPaneId = createCoordinationPane({
        roomId,
        spaceId,
        displayName,
        createdBy: auth.user.user_id,
        createdAt: now,
        sortOrder: baseSortOrder + 1,
      });
      insertRoomStmt.run(roomId, spaceId, displayName, coordinationPaneId, 'active', auth.user.user_id, now, null);
      insertRoomMemberStmt.run(roomId, auth.user.user_id, 'owner', now);
      for (const userId of memberUserIds) {
        if (userId !== auth.user.user_id) {
          insertRoomMemberStmt.run(roomId, userId, 'participant', now);
        }
      }
      insertRoomDocStmt.run(docId, roomId, now, now);
      insertRoomDocStorageStmt.run(docId, 0, toJson({}), now);
      grantRoomPaneEditors({
        spaceId,
        paneId: coordinationPaneId,
        userIds: memberUserIds,
        joinedAt: now,
      });

      requestedProjectNames.forEach((paneName, index) => {
        const paneId = newId('pan');
        const paneDocId = newId('doc');
        const sortOrder = baseSortOrder + index + 2;
        insertPaneStmt.run(
          paneId,
          spaceId,
          paneName,
          sortOrder,
          sortOrder,
          0,
          toJson({
            doc_binding_mode: 'owned',
            fixed_room_project: true,
            modules: [],
            room_id: roomId,
            room_slot: index + 1,
          }),
          auth.user.user_id,
          now,
          now,
        );
        insertDocStmt.run(paneDocId, paneId, now, now);
        insertDocStorageStmt.run(paneDocId, 0, toJson({}), now);
        grantRoomPaneEditors({
          spaceId,
          paneId,
          userIds: memberUserIds,
          joinedAt: now,
        });
      });
    });

    send(response, jsonResponse(201, okEnvelope({ room: loadRoomRecord(roomId) })));
  };

  const migrateRoomProjects = async ({ request, response, params }) => {
    const auth = await withAuth(request);
    if (auth.error) {
      send(response, auth.error);
      return;
    }

    let room = roomForUserStmt.get(params.roomId, auth.user.user_id);
    if (!room) {
      send(response, jsonResponse(404, errorEnvelope('not_found', 'Room not found.')));
      return;
    }

    if (!hasOwnerSpaceMembership(room.space_id, auth.user.user_id)) {
      send(response, jsonResponse(403, errorEnvelope('forbidden', 'Only space owners can migrate room content.')));
      return;
    }

    let body;
    try {
      body = await parseBody(request);
    } catch (error) {
      request.log.warn('Failed to parse request body for room migration.', { error, roomId: params.roomId });
      send(response, parseBody.errorResponse(error));
      return;
    }

    const requestedMigrations = Array.isArray(body.projectMigrations)
      ? body.projectMigrations.map((entry) => ({
        sourcePaneId: asText(entry?.sourcePaneId),
        destinationName: asText(entry?.destinationName),
      }))
      : [];

    if (requestedMigrations.length === 0) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'Select at least one room project to migrate.')));
      return;
    }

    const seenSourcePaneIds = new Set();
    for (const migration of requestedMigrations) {
      if (!migration.sourcePaneId || !migration.destinationName) {
        send(response, jsonResponse(400, errorEnvelope('invalid_input', 'Each migration requires sourcePaneId and destinationName.')));
        return;
      }
      if (seenSourcePaneIds.has(migration.sourcePaneId)) {
        send(response, jsonResponse(400, errorEnvelope('invalid_input', 'Each room project can only be migrated once per request.')));
        return;
      }
      seenSourcePaneIds.add(migration.sourcePaneId);
    }

    const now = nowIso();
    const baseSortOrder = Number(paneNextSortStmt.get(room.space_id)?.max_sort || 0);
    const sourceSpaceMembers = new Set(
      projectMembersByProjectStmt.all(room.space_id).map((member) => member.user_id),
    );
    const migrations = [];

    const copyTaskTree = ({
      sourceRecordId,
      targetPaneId,
      parentTargetRecordId,
      timestamp,
    }) => {
      const sourceRecord = recordByIdStmt.get(sourceRecordId);
      if (!sourceRecord || sourceRecord.archived_at) {
        return 0;
      }

      const sourceCollection = collectionByIdStmt.get(sourceRecord.collection_id);
      if (!sourceCollection || sourceCollection.project_id !== room.space_id) {
        throw new ValidationError('Source tasks must belong to the parent space.');
      }

      const targetRecordId = newId('rec');
      insertRecordStmt.run(
        targetRecordId,
        room.space_id,
        sourceRecord.collection_id,
        sourceRecord.title || 'Untitled Record',
        targetPaneId,
        sourceRecord.source_view_id || null,
        auth.user.user_id,
        timestamp,
        timestamp,
        parentTargetRecordId,
      );

      for (const value of valuesByRecordStmt.all(sourceRecordId)) {
        upsertRecordValueStmt.run(targetRecordId, value.field_id, value.value_json, timestamp);
      }

      for (const capability of recordCapabilitiesByRecordStmt.all(sourceRecordId)) {
        insertRecordCapabilityStmt.run(targetRecordId, capability.capability_type, timestamp);
      }

      const taskState = taskStateByRecordStmt.get(sourceRecordId);
      if (taskState) {
        upsertTaskStateStmt.run(
          targetRecordId,
          taskState.status,
          taskState.priority || null,
          taskState.due_at || null,
          taskState.category || null,
          taskState.completed_at || null,
          timestamp,
        );
      }

      const recurrence = recurrenceByRecordStmt.get(sourceRecordId);
      if (recurrence?.rule_json) {
        upsertRecurrenceStmt.run(targetRecordId, recurrence.rule_json, timestamp);
      }

      for (const reminder of remindersByRecordStmt.all(sourceRecordId)) {
        insertReminderStmt.run(
          newId('rem'),
          targetRecordId,
          reminder.remind_at,
          reminder.channels,
          timestamp,
          reminder.recurrence_json || null,
        );
      }

      for (const assignment of assignmentsByRecordStmt.all(sourceRecordId)) {
        if (!sourceSpaceMembers.has(assignment.user_id)) {
          continue;
        }
        insertAssignmentStmt.run(targetRecordId, assignment.user_id, timestamp);
      }

      let migratedCount = 1;
      for (const subtask of subtasksByParentStmt.all(sourceRecordId)) {
        migratedCount += copyTaskTree({
          sourceRecordId: subtask.record_id,
          targetPaneId,
          parentTargetRecordId: targetRecordId,
          timestamp,
        });
      }

      return migratedCount;
    };

    try {
      withTransaction(() => {
        requestedMigrations.forEach((requestedMigration, index) => {
          const sourcePane = paneByIdStmt.get(requestedMigration.sourcePaneId);
          if (!sourcePane || sourcePane.project_id !== room.space_id || !isRoomProjectPane(sourcePane, params.roomId)) {
            throw new ValidationError('Selected room project is not available for migration.');
          }

          const targetPaneId = newId('pan');
          const targetDocId = newId('doc');
          const targetSortOrder = baseSortOrder + index + 1;

          insertPaneStmt.run(
            targetPaneId,
            room.space_id,
            requestedMigration.destinationName,
            targetSortOrder,
            targetSortOrder,
            0,
            toJson(normalizePaneLayoutConfig(sourcePane, params.roomId)),
            auth.user.user_id,
            now,
            now,
          );

          insertDocStmt.run(targetDocId, targetPaneId, now, now);
          const sourceDocRef = paneDocByPaneStmt.get(sourcePane.pane_id);
          const sourceDoc = sourceDocRef?.doc_id ? docByIdStmt.get(sourceDocRef.doc_id) : null;
          insertDocStorageStmt.run(
            targetDocId,
            Number(sourceDoc?.snapshot_version || 0),
            sourceDoc?.snapshot_payload || toJson({}),
            now,
          );

          const topLevelTasks = visibleProjectTasksStmt
            .all(room.space_id)
            .filter((task) => task.source_pane_id === sourcePane.pane_id);
          let migratedTaskCount = 0;
          for (const task of topLevelTasks) {
            migratedTaskCount += copyTaskTree({
              sourceRecordId: task.record_id,
              targetPaneId,
              parentTargetRecordId: null,
              timestamp: now,
            });
          }

          emitTimelineEvent({
            projectId: room.space_id,
            actorUserId: auth.user.user_id,
            eventType: 'pane.created',
            primaryEntityType: 'pane',
            primaryEntityId: targetPaneId,
            summary: {
              message: `Project migrated from room: ${requestedMigration.destinationName}`,
              room_id: params.roomId,
              source_pane_id: sourcePane.pane_id,
              source_pane_name: sourcePane.name,
            },
          });

          migrations.push({
            sourcePaneId: sourcePane.pane_id,
            sourcePaneName: sourcePane.name,
            targetPaneId,
            targetPaneName: requestedMigration.destinationName,
            migratedTaskCount,
            migratedDocument: Boolean(sourceDocRef?.doc_id),
          });
        });
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        send(response, jsonResponse(400, errorEnvelope('invalid_input', error.message)));
        return;
      }
      request.log.error('Room migration failed.', {
        roomId: params.roomId,
        projectId: room.space_id,
        error,
      });
      send(response, jsonResponse(500, errorEnvelope('internal_error', 'Internal server error.')));
      return;
    }

    send(response, jsonResponse(201, okEnvelope({
      projectId: room.space_id,
      migrations,
    })));
  };

  const archiveRoom = async ({ request, response, params }) => {
    const auth = await withAuth(request);
    if (auth.error) {
      send(response, auth.error);
      return;
    }

    const room = roomForUserStmt.get(params.roomId, auth.user.user_id);
    if (!room) {
      send(response, jsonResponse(404, errorEnvelope('not_found', 'Room not found.')));
      return;
    }

    const membershipRole = roomMembershipRoleStmt.get(params.roomId, auth.user.user_id)?.role;
    if (membershipRole !== 'owner') {
      send(response, jsonResponse(403, errorEnvelope('forbidden', 'Only room owners can archive rooms.')));
      return;
    }

    if (room.status !== 'archived') {
      archiveRoomStmt.run(nowIso(), params.roomId);
    }

    send(response, jsonResponse(200, okEnvelope({ room: loadRoomRecord(params.roomId) })));
  };

  const listRoomMembers = async ({ request, response, params }) => {
    const auth = await withAuth(request);
    if (auth.error) {
      send(response, auth.error);
      return;
    }

    const room = roomForUserStmt.get(params.roomId, auth.user.user_id);
    if (!room) {
      send(response, jsonResponse(404, errorEnvelope('not_found', 'Room not found.')));
      return;
    }

    const members = roomMembersByRoomStmt.all(params.roomId).map(roomMembershipRecord);
    send(response, jsonResponse(200, okEnvelope({ members })));
  };

  const addRoomMember = async ({ request, response, params }) => {
    const auth = await withAuth(request);
    if (auth.error) {
      send(response, auth.error);
      return;
    }

    const room = roomForUserStmt.get(params.roomId, auth.user.user_id);
    if (!room) {
      send(response, jsonResponse(404, errorEnvelope('not_found', 'Room not found.')));
      return;
    }

    const membershipRole = roomMembershipRoleStmt.get(params.roomId, auth.user.user_id)?.role;
    if (membershipRole !== 'owner') {
      send(response, jsonResponse(403, errorEnvelope('forbidden', 'Only room owners can add participants.')));
      return;
    }
    if (room.status === 'archived') {
      send(response, jsonResponse(403, errorEnvelope('room_archived', 'Archived rooms are read-only.')));
      return;
    }
    if (!asText(room.coordination_pane_id) || !paneByIdStmt.get(room.coordination_pane_id)) {
      withTransaction(() => {
        ensureRoomCoordinationPane(room);
      });
      room = roomByIdStmt.get(params.roomId);
    }

    let body;
    try {
      body = await parseBody(request);
    } catch (error) {
      request.log.warn('Failed to parse request body for room participant add.', { error });
      send(response, parseBody.errorResponse(error));
      return;
    }

    const email = asText(body.email).toLowerCase();
    if (!email) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'email is required.')));
      return;
    }

    const spaceMembers = projectMembersByProjectStmt.all(room.space_id);
    const targetUser = spaceMembers.find((member) => asText(member.email).toLowerCase() === email);
    if (!targetUser?.user_id) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'Participant must already belong to the room space.')));
      return;
    }

    if (!projectMembershipExistsStmt.get(room.space_id, targetUser.user_id)?.ok) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'Participant must already belong to the room space.')));
      return;
    }

    if (roomMembershipExistsStmt.get(params.roomId, targetUser.user_id)?.ok) {
      const members = roomMembersByRoomStmt.all(params.roomId).map(roomMembershipRecord);
      send(response, jsonResponse(200, okEnvelope({ members })));
      return;
    }

    const joinedAt = nowIso();
    withTransaction(() => {
      insertRoomMemberStmt.run(params.roomId, targetUser.user_id, 'participant', joinedAt);
      for (const paneId of roomPaneIdsForSpace({
        roomId: params.roomId,
        spaceId: room.space_id,
        coordinationPaneId: asText(room.coordination_pane_id),
      })) {
        if (shouldGrantPaneEditor(room.space_id, targetUser.user_id)) {
          insertPaneMemberStmt.run(paneId, targetUser.user_id, joinedAt);
        }
      }
    });
    const members = roomMembersByRoomStmt.all(params.roomId).map(roomMembershipRecord);
    send(response, jsonResponse(200, okEnvelope({ members })));
  };

  return {
    addRoomMember,
    archiveRoom,
    createRoom,
    getRoom,
    listRoomMembers,
    listRooms,
    migrateRoomProjects,
  };
};
